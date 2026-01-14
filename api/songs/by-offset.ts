import type { IncomingMessage, ServerResponse } from "node:http";
import { asc } from "drizzle-orm";
import { songs } from "../../src/db/schema";
import { db } from "../_db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const offset = Number(url.searchParams.get("offset") ?? "");

  if (!Number.isFinite(offset) || offset < 0) {
    res.statusCode = 400;
    res.end("Offset inválido.");
    return;
  }

  const rows = await db
    .select({
      id: songs.id,
      artist: songs.artist,
      title: songs.title,
      year: songs.year,
      youtube_url: songs.youtubeUrl,
      isspanish: songs.isSpanish,
    })
    .from(songs)
    .orderBy(asc(songs.id))
    .limit(1)
    .offset(offset);

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(rows[0] ?? null));
}
