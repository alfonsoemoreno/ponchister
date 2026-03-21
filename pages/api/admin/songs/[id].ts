import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { songs } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";

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
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const status =
    value.status === "operational" ||
    value.status === "restricted" ||
    value.status === "unavailable" ||
    value.status === "invalid"
      ? value.status
      : null;

  if (!status) {
    return null;
  }

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
    res.statusCode = 400;
    res.end("ID inválido.");
    return;
  }

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
    const isSpanish = Boolean(body.isspanish);
    const youtubeValidation = parseYoutubeValidation(body);

    const [currentSong] = await db
      .select({ youtubeUrl: songs.youtubeUrl })
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    if (!artist || !title || !youtubeUrl) {
      res.statusCode = 400;
      res.end("Datos inválidos.");
      return;
    }

    if (!currentSong) {
      res.statusCode = 404;
      res.end("Canción no encontrada.");
      return;
    }

    const youtubeChanged = currentSong.youtubeUrl !== youtubeUrl;

    const [updated] = await db
      .update(songs)
      .set({
        artist,
        title,
        youtubeUrl,
        year,
        isSpanish,
        youtubeStatus: youtubeChanged
          ? youtubeValidation?.youtubeStatus ?? null
          : youtubeValidation?.youtubeStatus ?? undefined,
        youtubeValidationMessage: youtubeChanged
          ? youtubeValidation?.youtubeValidationMessage ?? null
          : youtubeValidation?.youtubeValidationMessage ?? undefined,
        youtubeValidationCode: youtubeChanged
          ? youtubeValidation?.youtubeValidationCode ?? null
          : youtubeValidation?.youtubeValidationCode ?? undefined,
        youtubeValidatedAt: youtubeChanged
          ? youtubeValidation?.youtubeValidatedAt ?? null
          : youtubeValidation?.youtubeValidatedAt ?? undefined,
      })
      .where(eq(songs.id, id))
      .returning({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        year: songs.year,
        youtube_url: songs.youtubeUrl,
        isspanish: songs.isSpanish,
        youtube_status: songs.youtubeStatus,
        youtube_validation_message: songs.youtubeValidationMessage,
        youtube_validation_code: songs.youtubeValidationCode,
        youtube_validated_at: songs.youtubeValidatedAt,
      });

    if (!updated) {
      res.statusCode = 404;
      res.end("Canción no encontrada.");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(updated));
    return;
  }

  if (req.method === "DELETE") {
    await db.delete(songs).where(eq(songs.id, id));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 405;
  res.end("Método no permitido.");
}
