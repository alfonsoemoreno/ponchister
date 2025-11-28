import type { Song } from "../types";

export interface ArtworkCandidate {
  url: string;
  score: number;
  source: string;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

export async function preloadImage(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    image.src = url;
  });
}

interface EvaluationParams {
  candidateParts: Array<string | undefined>;
  artistTokens: string[];
  titleTokens: string[];
  normalizedArtist: string;
  normalizedTitle: string;
}

export function evaluateArtworkScore({
  candidateParts,
  artistTokens,
  titleTokens,
  normalizedArtist,
  normalizedTitle,
}: EvaluationParams): number {
  const validParts = candidateParts.filter((value): value is string =>
    Boolean(value && value.trim())
  );

  if (!validParts.length) {
    return 0;
  }

  const tokenPool = new Set<string>();
  const normalizedParts = validParts.map((part) => {
    const tokens = tokenize(part);
    tokens.forEach((token) => tokenPool.add(token));
    return normalizeText(part);
  });

  let score = 0;

  const artistMatches = artistTokens.filter((token) => tokenPool.has(token));
  const titleMatches = titleTokens.filter((token) => tokenPool.has(token));

  if (artistMatches.length) {
    score += 3 + artistMatches.length * 1.5;
  }
  if (artistMatches.length === artistTokens.length && artistTokens.length > 0) {
    score += 2;
  }

  if (titleMatches.length) {
    score += 4 + titleMatches.length * 2;
  }
  if (titleMatches.length === titleTokens.length && titleTokens.length) {
    score += 3;
  }

  const combined = normalizedParts.join(" ");
  if (normalizedArtist && combined.includes(normalizedArtist)) {
    score += 2;
  }
  if (normalizedTitle && combined.includes(normalizedTitle)) {
    score += 2;
  }

  return score;
}

export interface ArtworkSelectionResult {
  selected: ArtworkCandidate | null;
  candidates: ArtworkCandidate[];
}

export async function selectBestArtworkCandidate(
  song: Song,
  fetcher: typeof fetch,
  abortSignal: AbortSignal
): Promise<ArtworkSelectionResult> {
  const searchTerms = [`${song.artist} ${song.title}`, song.artist];

  const entities = ["album", "musicTrack"] as const;
  const normalizedArtist = normalizeText(song.artist);
  const normalizedTitle = normalizeText(song.title);
  const artistTokens = tokenize(song.artist);
  const titleTokens = tokenize(song.title);

  const candidateMap = new Map<string, ArtworkCandidate>();

  for (const term of searchTerms) {
    const encodedTerm = encodeURIComponent(term);
    for (const entity of entities) {
      const endpoint = `https://itunes.apple.com/search?term=${encodedTerm}&entity=${entity}&limit=5`;
      const response = await fetcher(endpoint, { signal: abortSignal });

      if (!response.ok) {
        continue;
      }

      const payload: {
        results?: Array<{
          artworkUrl100?: string;
          artistName?: string;
          trackName?: string;
          collectionName?: string;
          collectionCensoredName?: string;
          collectionArtistName?: string;
        }>;
      } = await response.json();

      (payload.results ?? []).forEach((item, index) => {
        if (!item?.artworkUrl100) {
          return;
        }

        const score = evaluateArtworkScore({
          candidateParts: [
            item.artistName,
            item.trackName,
            item.collectionName,
            item.collectionCensoredName,
            item.collectionArtistName,
          ],
          artistTokens,
          titleTokens,
          normalizedArtist,
          normalizedTitle,
        });

        if (score <= 0) {
          return;
        }

        let weightedScore = score;
        if (entity === "album") {
          weightedScore += 1.5;
        }
        if (term === searchTerms[0]) {
          weightedScore += 1;
        }
        if (index === 0) {
          weightedScore += 0.5;
        }

        const highRes = item.artworkUrl100.replace(
          /100x100bb\.jpg$/i,
          "1000x1000bb.jpg"
        );

        const existing = candidateMap.get(highRes);
        if (!existing || weightedScore > existing.score) {
          candidateMap.set(highRes, {
            url: highRes,
            score: weightedScore,
            source: `${entity}-${term}`,
          });
        }
      });
    }
  }

  const candidates = Array.from(candidateMap.values()).sort(
    (a, b) => b.score - a.score
  );

  const MIN_CONFIDENCE_SCORE = titleTokens.length ? 7 : 5.5;

  for (const candidate of candidates) {
    try {
      await preloadImage(candidate.url);
      if (candidate.score >= MIN_CONFIDENCE_SCORE) {
        return { selected: candidate, candidates };
      }
    } catch {
      console.info(
        `[artwork] songId=${song.id} status=skip url=${candidate.url} reason=load_error`
      );
    }
  }

  return { selected: null, candidates };
}
