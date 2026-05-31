import type { IncomingMessage, ServerResponse } from "node:http";
import { eq } from "drizzle-orm";
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
      youtube_status: songs.youtubeStatus,
      youtube_validation_message: songs.youtubeValidationMessage,
      youtube_validation_code: songs.youtubeValidationCode,
      youtube_validated_at: songs.youtubeValidatedAt,
    })
    .from(songs)
    .where(eq(songs.scope, "public"))
    .orderBy(songs.id);

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(rows));
}
