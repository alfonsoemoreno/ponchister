import type { IncomingMessage, ServerResponse } from "node:http";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { playlistSongs, playlists, songs } from "../../../src/db/schema";
import { db } from "../_db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      active: playlists.active,
      songCount: sql<number>`count(${songs.id})`,
    })
    .from(playlists)
    .leftJoin(
      playlistSongs,
      eq(playlistSongs.playlistId, playlists.id)
    )
    .leftJoin(
      songs,
      and(
        eq(playlistSongs.songId, songs.id),
        or(isNull(songs.youtubeStatus), eq(songs.youtubeStatus, "operational"))
      )
    )
    .where(eq(playlists.active, true))
    .groupBy(playlists.id)
    .having(sql`count(${songs.id}) > 0`)
    .orderBy(asc(playlists.name));

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(rows));
}
