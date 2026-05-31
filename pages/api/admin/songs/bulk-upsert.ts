import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { songs } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";
import {
  isSpanishTagSelected,
  normalizeSongTags,
  syncSongModeTags,
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

  if (user.role !== "superadmin") {
    res.statusCode = 403;
    res.end("Solo un superadmin puede importar canciones por lote.");
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const list = Array.isArray(body.songs) ? body.songs : [];

  if (!list.length) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const values = list
    .map((song) => {
      if (!song || typeof song !== "object") return null;
      const artist =
        typeof song.artist === "string" ? song.artist.trim() : "";
      const title = typeof song.title === "string" ? song.title.trim() : "";
      const youtubeUrl =
        typeof song.youtube_url === "string" ? song.youtube_url.trim() : "";
      const year =
        typeof song.year === "number" && Number.isFinite(song.year)
          ? song.year
          : null;
      const playStartSeconds =
        typeof (song as Record<string, unknown>).play_start_seconds === "number" &&
        Number.isFinite((song as Record<string, unknown>).play_start_seconds)
          ? Math.max(
              0,
              Math.trunc((song as Record<string, unknown>).play_start_seconds as number)
            )
          : 0;
      const mimica = (song as Record<string, unknown>).mimica === true;
      const tararear = (song as Record<string, unknown>).tararear === true;
      const karaoke = (song as Record<string, unknown>).karaoke === true;
      const karaokePauseSeconds =
        karaoke &&
        typeof (song as Record<string, unknown>).karaoke_pause_seconds ===
          "number" &&
        Number.isFinite((song as Record<string, unknown>).karaoke_pause_seconds)
          ? Math.max(
              0,
              Math.trunc(
                (song as Record<string, unknown>).karaoke_pause_seconds as number
              )
            )
          : 0;
      const karaokeLyric =
        karaoke &&
        typeof (song as Record<string, unknown>).karaoke_lyric === "string"
          ? ((song as Record<string, unknown>).karaoke_lyric as string).trim() ||
            null
          : null;
      const trivia = (song as Record<string, unknown>).trivia === true;
      const triviaQuestion =
        trivia &&
        typeof (song as Record<string, unknown>).trivia_question === "string"
          ? ((song as Record<string, unknown>).trivia_question as string).trim() ||
            null
          : null;
      const triviaAnswer =
        trivia &&
        typeof (song as Record<string, unknown>).trivia_answer === "string"
          ? ((song as Record<string, unknown>).trivia_answer as string).trim() ||
            null
          : null;
      const tags = syncSongModeTags(
        normalizeSongTags(
          (song as Record<string, unknown>).tags,
          (song as Record<string, unknown>).isspanish
        ),
        {
          mimica,
          tararear,
        }
      );
      const isSpanish = isSpanishTagSelected(tags);
      if (!artist || !title || !youtubeUrl) return null;
      return {
        artist,
        title,
        youtubeUrl,
        year,
        playStartSeconds,
        songAttributes: tags,
        isSpanish,
        mimica,
        tararear,
        karaoke,
        karaokePauseSeconds,
        karaokeLyric,
        trivia,
        triviaQuestion,
        triviaAnswer,
        youtubeStatus: null,
        youtubeValidationMessage: null,
        youtubeValidationCode: null,
        youtubeValidatedAt: null,
        catalogStatus: "approved" as const,
        createdBy: user.id,
        approvedBy: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      };
    })
    .filter(Boolean) as Array<{
    artist: string;
    title: string;
    youtubeUrl: string;
    year: number | null;
    playStartSeconds: number;
    songAttributes: string[];
    isSpanish: boolean;
    mimica: boolean;
    tararear: boolean;
    karaoke: boolean;
    karaokePauseSeconds: number;
    karaokeLyric: string | null;
    trivia: boolean;
    triviaQuestion: string | null;
    triviaAnswer: string | null;
    youtubeStatus: null;
    youtubeValidationMessage: null;
    youtubeValidationCode: null;
    youtubeValidatedAt: null;
    catalogStatus: "approved";
    createdBy: number;
    approvedBy: number;
    approvedAt: Date;
    updatedAt: Date;
  }>;

  if (!values.length) {
    res.statusCode = 400;
    res.end("Datos inválidos.");
    return;
  }

  await db
    .insert(songs)
    .values(values)
    .onConflictDoUpdate({
      target: songs.youtubeUrl,
      set: {
        artist: sql`excluded.artist`,
        title: sql`excluded.title`,
        year: sql`excluded.year`,
        playStartSeconds: sql`excluded.play_start_seconds`,
        songAttributes: sql`excluded.song_attributes`,
        isSpanish: sql`excluded.isspanish`,
        mimica: sql`excluded.mimica`,
        tararear: sql`excluded.tararear`,
        karaoke: sql`excluded.karaoke`,
        karaokePauseSeconds: sql`excluded.karaoke_pause_seconds`,
        karaokeLyric: sql`excluded.karaoke_lyric`,
        trivia: sql`excluded.trivia`,
        triviaQuestion: sql`excluded.trivia_question`,
        triviaAnswer: sql`excluded.trivia_answer`,
        youtubeStatus: sql`null`,
        youtubeValidationMessage: sql`null`,
        youtubeValidationCode: sql`null`,
        youtubeValidatedAt: sql`null`,
        catalogStatus: sql`'approved'`,
        approvedBy: sql`${user.id}`,
        approvedAt: sql`now()`,
        updatedAt: sql`now()`,
      },
    });

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
}
