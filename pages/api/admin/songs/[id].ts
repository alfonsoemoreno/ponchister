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

    if (!artist || !title || !youtubeUrl) {
      res.statusCode = 400;
      res.end("Datos inválidos.");
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
      })
      .where(eq(songs.id, id))
      .returning({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        year: songs.year,
        youtube_url: songs.youtubeUrl,
        isspanish: songs.isSpanish,
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
