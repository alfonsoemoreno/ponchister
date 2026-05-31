import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { songs } from "../../../../src/db/schema";
import type { Song, SongInput, YoutubeValidationStatus } from "../../../../src/admin/types";
import { findSongDuplicateMatches } from "../../../../src/admin/songDuplicateUtils";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";
import {
  isSpanishTagSelected,
  normalizeSongTags,
} from "../../../../src/lib/songTags";

const parseBody = (req: NextApiRequest): Record<string, unknown> => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") return req.body as Record<string, unknown>;
  return {};
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const tags = normalizeSongTags(body.tags, body.isspanish);
  const payload: SongInput = {
    artist: typeof body.artist === "string" ? body.artist.trim() : "",
    title: typeof body.title === "string" ? body.title.trim() : "",
    youtube_url:
      typeof body.youtube_url === "string" ? body.youtube_url.trim() : "",
    year:
      typeof body.year === "number" && Number.isFinite(body.year)
        ? body.year
        : null,
    play_start_seconds:
      typeof body.play_start_seconds === "number" &&
      Number.isFinite(body.play_start_seconds)
        ? Math.max(0, Math.trunc(body.play_start_seconds))
        : 0,
    tags,
    isspanish: isSpanishTagSelected(tags),
    mimica: body.mimica === true,
    tararear: body.tararear === true,
    karaoke: body.karaoke === true,
    karaoke_pause_seconds:
      body.karaoke === true &&
      typeof body.karaoke_pause_seconds === "number" &&
      Number.isFinite(body.karaoke_pause_seconds)
        ? Math.max(0, Math.trunc(body.karaoke_pause_seconds))
        : 0,
    karaoke_lyric:
      body.karaoke === true && typeof body.karaoke_lyric === "string"
        ? body.karaoke_lyric.trim() || null
        : null,
    trivia: body.trivia === true,
    trivia_question:
      body.trivia === true && typeof body.trivia_question === "string"
        ? body.trivia_question.trim() || null
        : null,
    trivia_answer:
      body.trivia === true && typeof body.trivia_answer === "string"
        ? body.trivia_answer.trim() || null
        : null,
  };
  const excludeId =
    typeof body.excludeId === "number" && Number.isFinite(body.excludeId)
      ? body.excludeId
      : null;

  if (!payload.artist || !payload.title || !payload.youtube_url) {
    res.statusCode = 400;
    res.end("Datos inválidos.");
    return;
  }

  const existingSongs = await db
    .select({
      id: songs.id,
      artist: songs.artist,
      title: songs.title,
      year: songs.year,
      play_start_seconds: songs.playStartSeconds,
      youtube_url: songs.youtubeUrl,
      tags: songs.songAttributes,
      isspanish: songs.isSpanish,
      mimica: songs.mimica,
      tararear: songs.tararear,
      karaoke: songs.karaoke,
      karaoke_pause_seconds: songs.karaokePauseSeconds,
      karaoke_lyric: songs.karaokeLyric,
      trivia: songs.trivia,
      trivia_question: songs.triviaQuestion,
      trivia_answer: songs.triviaAnswer,
      youtube_status: songs.youtubeStatus,
      youtube_validation_message: songs.youtubeValidationMessage,
      youtube_validation_code: songs.youtubeValidationCode,
      youtube_validated_at: songs.youtubeValidatedAt,
    })
    .from(songs)
    .where(eq(songs.scope, "public"));

  const normalizedSongs: Song[] = existingSongs.map((song) => {
    const youtubeStatus: YoutubeValidationStatus | null =
      song.youtube_status === "unchecked" ||
      song.youtube_status === "checking" ||
      song.youtube_status === "operational" ||
      song.youtube_status === "restricted" ||
      song.youtube_status === "unavailable" ||
      song.youtube_status === "invalid"
        ? song.youtube_status
        : null;

    return {
      ...song,
      tags: normalizeSongTags(song.tags, song.isspanish),
      youtube_status: youtubeStatus,
      youtube_validated_at: song.youtube_validated_at
        ? song.youtube_validated_at.toISOString()
        : null,
      catalog_status: "pending",
      created_at: null,
      updated_at: null,
      approved_at: null,
      created_by_user: null,
      approved_by_user: null,
    };
  });

  const matches = findSongDuplicateMatches(payload, normalizedSongs, { excludeId });

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ matches }));
}
