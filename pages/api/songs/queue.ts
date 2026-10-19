import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, gte, inArray, isNull, lte, notInArray, or } from "drizzle-orm";
import { playlistSongs, songs } from "../../../src/db/schema";
import { db } from "../_db";
import {
  buildBalancedQueue,
  dedupePlayableSongs,
  getSongArtistKey,
} from "../../../src/lib/autoGameQueue";
import {
  normalizeSongTags,
  songMatchesSelectedTags,
} from "../../../src/lib/songTags";
import { MAX_RECENT_SONG_IDS } from "../../../src/lib/recentSongsHistory";
import { checkQueueRateLimit } from "../../../src/server/queueRateLimit";

const MAX_QUEUE_SIZE = 25;

export const config = {
  api: { bodyParser: { sizeLimit: "64kb" } },
};

function toInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function toPositiveIds(value: unknown, limit = 2_000): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map(toInteger)
        .filter((id): id is number => id !== null && id > 0)
        .slice(0, limit)
    )
  );
}

function toArtistKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLocaleLowerCase().slice(0, 160))
        .filter(Boolean)
        .slice(0, 2_000)
    )
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const clientKey = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkQueueRateLimit(clientKey);
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).end("Demasiadas solicitudes. Intenta nuevamente en un momento.");
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const minYear = toInteger(body.minYear);
  const maxYear = toInteger(body.maxYear);
  const playlistId = toInteger(body.playlistId);
  const selectedTags = normalizeSongTags(body.selectedTags);
  const tagMatchMode = body.tagMatchMode === "all" ? "all" : "any";
  const excludedSongIds = new Set(toPositiveIds(body.excludedSongIds));
  const recentSongIds = new Set(
    toPositiveIds(body.recentSongIds, MAX_RECENT_SONG_IDS)
  );
  const excludedArtistKeys = new Set(toArtistKeys(body.excludedArtistKeys));
  const requestedSize = toInteger(body.size);
  const size = Math.min(Math.max(requestedSize ?? MAX_QUEUE_SIZE, 1), MAX_QUEUE_SIZE);

  const filters = [
    or(isNull(songs.youtubeStatus), eq(songs.youtubeStatus, "operational")),
    eq(songs.catalogStatus, "approved"),
  ];
  if (excludedSongIds.size) {
    filters.push(notInArray(songs.id, Array.from(excludedSongIds)));
  }
  if (minYear !== null) filters.push(gte(songs.year, minYear));
  if (maxYear !== null) filters.push(lte(songs.year, maxYear));

  if (playlistId !== null && playlistId > 0) {
    const playlistSongRows = await db
      .select({ songId: playlistSongs.songId })
      .from(playlistSongs)
      .where(eq(playlistSongs.playlistId, playlistId));
    const songIds = playlistSongRows.map((row) => row.songId);
    if (!songIds.length) {
      res.status(200).json({ songs: [], resetRecentHistory: false });
      return;
    }
    filters.push(inArray(songs.id, songIds));
  }

  const rows = await db
    .select({
      id: songs.id,
      artist: songs.artist,
      title: songs.title,
      year: songs.year,
      play_start_seconds: songs.playStartSeconds,
      youtube_url: songs.youtubeUrl,
      tags: songs.songAttributes,
      isSpanish: songs.isSpanish,
      mimica: songs.mimica,
      tararear: songs.tararear,
    })
    .from(songs)
    .where(and(...filters));

  const candidates = dedupePlayableSongs(
    rows.filter((song) => {
      if (excludedSongIds.has(song.id)) return false;
      if (excludedArtistKeys.has(getSongArtistKey(song.artist))) return false;
      return songMatchesSelectedTags(
        normalizeSongTags(song.tags, song.isSpanish),
        selectedTags,
        tagMatchMode
      );
    })
  );

  const freshCandidates = candidates.filter((song) => !recentSongIds.has(song.id));
  const resetRecentHistory = candidates.length > 0 && freshCandidates.length === 0;
  const selectedCandidates = buildBalancedQueue(
    resetRecentHistory ? candidates : freshCandidates
  ).slice(0, size);

  if (!selectedCandidates.length) {
    res.status(200).json({ songs: [], resetRecentHistory });
    return;
  }

  // Keep lyrics and trivia out of the full catalog scan. Fetch them only for
  // the small batch that will actually be sent to the client.
  const selectedDetails = await db
    .select({
      id: songs.id,
      karaoke: songs.karaoke,
      karaoke_pause_seconds: songs.karaokePauseSeconds,
      karaoke_lyric: songs.karaokeLyric,
      trivia: songs.trivia,
      trivia_question: songs.triviaQuestion,
      trivia_answer: songs.triviaAnswer,
    })
    .from(songs)
    .where(inArray(songs.id, selectedCandidates.map((song) => song.id)));
  const detailsById = new Map(selectedDetails.map((song) => [song.id, song]));
  const queue = selectedCandidates.map((song) => ({
    ...song,
    karaoke: detailsById.get(song.id)?.karaoke ?? false,
    karaoke_pause_seconds: detailsById.get(song.id)?.karaoke_pause_seconds ?? 0,
    karaoke_lyric: detailsById.get(song.id)?.karaoke_lyric ?? null,
    trivia: detailsById.get(song.id)?.trivia ?? false,
    trivia_question: detailsById.get(song.id)?.trivia_question ?? null,
    trivia_answer: detailsById.get(song.id)?.trivia_answer ?? null,
  }));

  res.status(200).json({ songs: queue, resetRecentHistory });
}
