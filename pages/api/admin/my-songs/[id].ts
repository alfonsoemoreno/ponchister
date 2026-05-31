import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
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

const parseYoutubeValidation = (body: Record<string, unknown>) => {
  const raw = body.youtubeValidation;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const status =
    value.status === "operational" ||
    value.status === "restricted" ||
    value.status === "unavailable" ||
    value.status === "invalid"
      ? value.status
      : null;
  if (!status) return null;
  const validatedAtValue =
    typeof value.validatedAt === "string" ? new Date(value.validatedAt) : null;
  return {
    youtubeStatus: status,
    youtubeValidationMessage:
      typeof value.message === "string" ? value.message : null,
    youtubeValidationCode:
      typeof value.code === "number" && Number.isFinite(value.code)
        ? value.code
        : null,
    youtubeValidatedAt:
      validatedAtValue && !Number.isNaN(validatedAtValue.getTime())
        ? validatedAtValue
        : new Date(),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.status(400).end("ID inválido.");
    return;
  }

  const baseWhere = and(
    eq(songs.id, id),
    eq(songs.scope, "personal"),
    eq(songs.ownerUserId, user.id)
  );

  if (req.method === "PUT") {
    const body = parseBody(req);
    const artist = typeof body.artist === "string" ? body.artist.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const youtubeUrl =
      typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
    const year =
      typeof body.year === "number" && Number.isFinite(body.year)
        ? body.year
        : null;
    const playStartSeconds =
      typeof body.play_start_seconds === "number" &&
      Number.isFinite(body.play_start_seconds)
        ? Math.max(0, Math.trunc(body.play_start_seconds))
        : 0;
    const mimica = body.mimica === true;
    const tararear = body.tararear === true;
    const karaoke = body.karaoke === true;
    const karaokePauseSeconds =
      karaoke &&
      typeof body.karaoke_pause_seconds === "number" &&
      Number.isFinite(body.karaoke_pause_seconds)
        ? Math.max(0, Math.trunc(body.karaoke_pause_seconds))
        : 0;
    const karaokeLyric =
      karaoke && typeof body.karaoke_lyric === "string"
        ? body.karaoke_lyric.trim() || null
        : null;
    const trivia = body.trivia === true;
    const triviaQuestion =
      trivia && typeof body.trivia_question === "string"
        ? body.trivia_question.trim() || null
        : null;
    const triviaAnswer =
      trivia && typeof body.trivia_answer === "string"
        ? body.trivia_answer.trim() || null
        : null;
    const tags = syncSongModeTags(normalizeSongTags(body.tags, body.isspanish), {
      mimica,
      tararear,
    });
    const isSpanish = isSpanishTagSelected(tags);
    const youtubeValidation = parseYoutubeValidation(body);

    if (!artist || !title || !youtubeUrl) {
      res.status(400).end("Datos inválidos.");
      return;
    }

    const [updated] = await db
      .update(songs)
      .set({
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
        youtubeStatus: youtubeValidation?.youtubeStatus ?? undefined,
        youtubeValidationMessage:
          youtubeValidation?.youtubeValidationMessage ?? undefined,
        youtubeValidationCode: youtubeValidation?.youtubeValidationCode ?? undefined,
        youtubeValidatedAt: youtubeValidation?.youtubeValidatedAt ?? undefined,
        updatedAt: new Date(),
      })
      .where(baseWhere)
      .returning({ id: songs.id });

    if (!updated) {
      res.status(404).end("Canción no encontrada.");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "DELETE") {
    const deleted = await db.delete(songs).where(baseWhere).returning({ id: songs.id });
    if (!deleted.length) {
      res.status(404).end("Canción no encontrada.");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.status(405).end("Método no permitido.");
}
