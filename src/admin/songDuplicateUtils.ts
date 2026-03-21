import type { Song, SongDuplicateMatch, SongInput } from "./types";

const MIN_SIMILARITY = 0.72;
const HIGH_SIMILARITY = 0.86;
const MAX_MATCHES = 5;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);

  for (let column = 0; column <= right.length; column += 1) {
    previous[column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length];
}

function editSimilarity(left: string, right: string): number {
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  const maxLength = Math.max(left.length, right.length);
  return 1 - levenshteinDistance(left, right) / maxLength;
}

function tokenSimilarity(left: string, right: string): number {
  if (!left && !right) return 1;
  if (!left || !right) return 0;

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function fieldSimilarity(left: string, right: string): number {
  if (!left && !right) return 1;
  if (!left || !right) return 0;

  const editScore = editSimilarity(left, right);
  const tokenScore = tokenSimilarity(left, right);
  const containsScore =
    left.includes(right) || right.includes(left)
      ? Math.max(editScore, tokenScore, 0.9)
      : 0;

  return Math.max(editScore, tokenScore, containsScore);
}

function buildReason(
  titleSimilarity: number,
  artistSimilarity: number,
  sameYear: boolean,
  youtubeSimilarity: number
): string {
  if (youtubeSimilarity === 1) {
    return "Mismo enlace de YouTube";
  }
  if (titleSimilarity >= 0.97 && artistSimilarity >= 0.9) {
    return sameYear
      ? "Mismo titulo y artista, con el mismo año"
      : "Mismo titulo y artista";
  }
  if (titleSimilarity >= 0.9 && artistSimilarity >= 0.72) {
    return "Titulo muy parecido y artista similar";
  }
  if (titleSimilarity >= 0.88) {
    return "Titulo muy parecido";
  }
  if (artistSimilarity >= 0.88) {
    return "Artista muy parecido";
  }
  return sameYear
    ? "Coincidencia parcial en artista, titulo y año"
    : "Coincidencia parcial en artista y titulo";
}

export function findSongDuplicateMatches(
  payload: SongInput,
  collection: Song[],
  options?: { excludeId?: number | null }
): SongDuplicateMatch[] {
  const normalizedArtist = normalizeText(payload.artist);
  const normalizedTitle = normalizeText(payload.title);
  const normalizedYoutube = normalizeText(payload.youtube_url);
  const normalizedCombined = normalizeText(
    `${payload.artist} ${payload.title}`.trim()
  );

  return collection
    .filter((song) => song.id !== options?.excludeId)
    .map((song) => {
      const songArtist = normalizeText(song.artist);
      const songTitle = normalizeText(song.title);
      const songYoutube = normalizeText(song.youtube_url);
      const songCombined = normalizeText(`${song.artist} ${song.title}`.trim());

      const artistSimilarity = fieldSimilarity(normalizedArtist, songArtist);
      const titleSimilarity = fieldSimilarity(normalizedTitle, songTitle);
      const combinedSimilarity = fieldSimilarity(
        normalizedCombined,
        songCombined
      );
      const youtubeSimilarity =
        normalizedYoutube && normalizedYoutube === songYoutube ? 1 : 0;
      const sameYear =
        payload.year !== null && song.year !== null && payload.year === song.year;

      let similarity =
        combinedSimilarity * 0.5 +
        titleSimilarity * 0.3 +
        artistSimilarity * 0.15 +
        youtubeSimilarity * 0.05;

      if (sameYear) {
        similarity += 0.04;
      }

      if (titleSimilarity >= 0.97 && artistSimilarity >= 0.92) {
        similarity = Math.max(similarity, sameYear ? 0.99 : 0.97);
      } else if (youtubeSimilarity === 1) {
        similarity = Math.max(similarity, 1);
      }

      const finalSimilarity = Math.min(1, similarity);

      return {
        ...song,
        similarity: finalSimilarity,
        matchLabel:
          finalSimilarity >= HIGH_SIMILARITY
            ? ("high" as const)
            : ("medium" as const),
        reason: buildReason(
          titleSimilarity,
          artistSimilarity,
          sameYear,
          youtubeSimilarity
        ),
      };
    })
    .filter((song) => song.similarity >= MIN_SIMILARITY)
    .sort((left, right) => right.similarity - left.similarity || left.id - right.id)
    .slice(0, MAX_MATCHES);
}
