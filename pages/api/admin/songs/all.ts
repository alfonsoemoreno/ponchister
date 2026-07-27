import type { IncomingMessage, ServerResponse } from "node:http";
import { asc, eq, sql } from "drizzle-orm";
import { songs } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const requestedPage = Number(url.searchParams.get("page") ?? "0");
  const requestedPageSize = Number(url.searchParams.get("pageSize") ?? "100");
  const page = Number.isFinite(requestedPage) ? Math.max(0, Math.trunc(requestedPage)) : 0;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(Math.max(Math.trunc(requestedPageSize), 1), 100)
    : 100;
  const whereClause = eq(songs.scope, "public");

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(songs)
    .where(whereClause);

  // This endpoint feeds selectors and statistics.  Keep it deliberately
  // summary-only: lyrics and trivia are fetched only from a song detail route.
  const rows = await db
    .select({
      id: songs.id,
      artist: songs.artist,
      title: songs.title,
      year: songs.year,
      play_start_seconds: songs.playStartSeconds,
      youtube_url: songs.youtubeUrl,
      tags: songs.songAttributes,
      isspanish: songs.isSpanish,
      mimica: songs.mimica,
      tararear: songs.tararear,
      karaoke: songs.karaoke,
      karaoke_pause_seconds: songs.karaokePauseSeconds,
      karaoke_lyric: sql<string | null>`null`,
      trivia: songs.trivia,
      trivia_question: sql<string | null>`null`,
      trivia_answer: sql<string | null>`null`,
      youtube_status: songs.youtubeStatus,
      youtube_validation_message: songs.youtubeValidationMessage,
      youtube_validation_code: songs.youtubeValidationCode,
      youtube_validated_at: songs.youtubeValidatedAt,
    })
    .from(songs)
    .where(whereClause)
    .orderBy(asc(songs.id))
    .limit(pageSize)
    .offset(page * pageSize);

  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      songs: rows,
      total: Number(countRow?.count ?? 0),
      page,
      pageSize,
    })
  );
}
