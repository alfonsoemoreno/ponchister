import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, eq } from "drizzle-orm";
import { playlistSongs, playlists, songs } from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";
import {
  buildBalancedQueue,
  dedupePlayableSongs,
  getSongArtistKey,
} from "../../../src/lib/autoGameQueue";
import {
  normalizeSongTags,
  songMatchesSelectedTags,
} from "../../../src/lib/songTags";
import { checkQueueRateLimit } from "../../../src/server/queueRateLimit";

const MAX_QUEUE_SIZE = 25;

function toInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}

function toPositiveIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map(toInteger)
        .filter((id): id is number => id !== null && id > 0)
        .slice(0, 2_000)
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const playlistId = toInteger(body.playlistId);
  if (playlistId === null || playlistId <= 0) {
    res.status(400).end("Playlist inválida.");
    return;
  }

  const [playlist] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(
      and(
        eq(playlists.id, playlistId),
        eq(playlists.scope, "personal"),
        eq(playlists.ownerUserId, user.id)
      )
    )
    .limit(1);

  if (!playlist) {
    res.status(404).end("Playlist no encontrada.");
    return;
  }

  const rateLimit = checkQueueRateLimit(`personal-playlist:${user.id}`);
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).end("Demasiadas solicitudes. Intenta nuevamente en un momento.");
    return;
  }

  const selectedTags = normalizeSongTags(body.selectedTags);
  const tagMatchMode = body.tagMatchMode === "all" ? "all" : "any";
  const excludedSongIds = new Set(toPositiveIds(body.excludedSongIds));
  const recentSongIds = new Set(toPositiveIds(body.recentSongIds));
  const excludedArtistKeys = new Set(toArtistKeys(body.excludedArtistKeys));
  const requestedSize = toInteger(body.size);
  const size = Math.min(Math.max(requestedSize ?? MAX_QUEUE_SIZE, 1), MAX_QUEUE_SIZE);

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
      karaoke: songs.karaoke,
      karaoke_pause_seconds: songs.karaokePauseSeconds,
      karaoke_lyric: songs.karaokeLyric,
      trivia: songs.trivia,
      trivia_question: songs.triviaQuestion,
      trivia_answer: songs.triviaAnswer,
    })
    .from(playlistSongs)
    .innerJoin(songs, eq(playlistSongs.songId, songs.id))
    .where(eq(playlistSongs.playlistId, playlistId))
    .orderBy(asc(playlistSongs.position), asc(songs.id));

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
  const queue = buildBalancedQueue(
    resetRecentHistory ? candidates : freshCandidates
  ).slice(0, size);

  res.status(200).json({ songs: queue, resetRecentHistory });
}
