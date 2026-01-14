import type { IncomingMessage, ServerResponse } from "node:http";
import { sql } from "drizzle-orm";
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

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const body = await parseBody(req);
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
      const isSpanish = Boolean(song.isspanish);
      if (!artist || !title || !youtubeUrl) return null;
      return { artist, title, youtubeUrl, year, isSpanish };
    })
    .filter(Boolean) as Array<{
    artist: string;
    title: string;
    youtubeUrl: string;
    year: number | null;
    isSpanish: boolean;
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
        isSpanish: sql`excluded.isspanish`,
      },
    });

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
}
