import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
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
    const isSpanish = Boolean(body.isspanish);
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
        isSpanish,
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
