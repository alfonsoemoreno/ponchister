import type { IncomingMessage, ServerResponse } from "node:http";
import { eq } from "drizzle-orm";
import { songs } from "../../../src/db/schema.ts";
import { db } from "../../_db.ts";
import { requireAdmin } from "../../_admin";

const parseBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.statusCode = 400;
    res.end("ID inválido.");
    return;
  }

  if (req.method === "PUT") {
    const body = await parseBody(req);
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
