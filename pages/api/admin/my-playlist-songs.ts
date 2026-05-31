import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, eq } from "drizzle-orm";
import { playlistSongs, playlists, songs } from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const playlistId = Number(req.query.playlistId);
  if (!Number.isFinite(playlistId)) {
    res.status(400).end("Playlist inválida.");
    return;
  }

  const [playlist] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(
      and(
        eq(playlists.id, playlistId),
        eq(playlists.scope, "personal"),
        eq(playlists.ownerUserId, user.id)
      )
    )
    .limit(1);

  if (!playlist) {
    res.status(404).end("Playlist no encontrada.");
    return;
  }

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
      karaoke_lyric: songs.karaokeLyric,
      trivia: songs.trivia,
      trivia_question: songs.triviaQuestion,
      trivia_answer: songs.triviaAnswer,
    })
    .from(playlistSongs)
    .innerJoin(songs, eq(playlistSongs.songId, songs.id))
    .where(eq(playlistSongs.playlistId, playlistId))
    .orderBy(asc(playlistSongs.position), asc(songs.id));

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(rows));
}
