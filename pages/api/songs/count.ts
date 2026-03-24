import type { IncomingMessage, ServerResponse } from "node:http";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { songs } from "../../../src/db/schema";
import { db } from "../_db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(songs)
    .where(
      and(
        or(isNull(songs.youtubeStatus), eq(songs.youtubeStatus, "operational")),
        eq(songs.catalogStatus, "approved")
      )
    );

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ count: Number(row?.count ?? 0) }));
}
