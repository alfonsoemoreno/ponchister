import type { IncomingMessage, ServerResponse } from "node:http";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { songs } from "../../../src/db/schema.ts";
import { db } from "../_db.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const minYearParam = url.searchParams.get("minYear");
  const maxYearParam = url.searchParams.get("maxYear");
  const onlySpanish = url.searchParams.get("onlySpanish") === "true";

  const minYear =
    typeof minYearParam === "string" && minYearParam !== ""
      ? Number(minYearParam)
      : null;
  const maxYear =
    typeof maxYearParam === "string" && maxYearParam !== ""
      ? Number(maxYearParam)
      : null;

  const filters = [];
  if (typeof minYear === "number" && Number.isFinite(minYear)) {
    filters.push(gte(songs.year, minYear));
  }
  if (typeof maxYear === "number" && Number.isFinite(maxYear)) {
    filters.push(lte(songs.year, maxYear));
  }
  if (onlySpanish) {
    filters.push(eq(songs.isSpanish, true));
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
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(songs.id));

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(rows));
}
