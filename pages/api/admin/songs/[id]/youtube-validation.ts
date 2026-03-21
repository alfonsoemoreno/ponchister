import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { songs } from "../../../../../src/db/schema";
import { db } from "../../../_db";
import { requireAdmin } from "../../../_admin";

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

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.statusCode = 400;
    res.end("ID inválido.");
    return;
  }

  if (req.method !== "PUT") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const status =
    body.status === "operational" ||
    body.status === "restricted" ||
    body.status === "unavailable" ||
    body.status === "invalid"
      ? body.status
      : null;

  if (!status) {
    res.statusCode = 400;
    res.end("Estado de validación inválido.");
    return;
  }

  const validatedAtValue =
    typeof body.validatedAt === "string" ? new Date(body.validatedAt) : null;

  const [updated] = await db
    .update(songs)
    .set({
      youtubeStatus: status,
      youtubeValidationMessage:
        typeof body.message === "string" ? body.message : null,
      youtubeValidationCode:
        typeof body.code === "number" && Number.isFinite(body.code)
          ? body.code
          : null,
      youtubeValidatedAt:
        validatedAtValue && !Number.isNaN(validatedAtValue.getTime())
          ? validatedAtValue
          : new Date(),
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
}
