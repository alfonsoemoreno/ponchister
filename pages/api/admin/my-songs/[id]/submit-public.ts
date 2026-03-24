import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
import { songs } from "../../../../../src/db/schema";
import { db } from "../../../_db";
import { requireAdmin } from "../../../_admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.status(400).end("ID inválido.");
    return;
  }

  const [personalSong] = await db
    .select({
      artist: songs.artist,
      title: songs.title,
      year: songs.year,
      youtubeUrl: songs.youtubeUrl,
      isSpanish: songs.isSpanish,
      youtubeStatus: songs.youtubeStatus,
      youtubeValidationMessage: songs.youtubeValidationMessage,
      youtubeValidationCode: songs.youtubeValidationCode,
      youtubeValidatedAt: songs.youtubeValidatedAt,
    })
    .from(songs)
    .where(
      and(eq(songs.id, id), eq(songs.scope, "personal"), eq(songs.ownerUserId, user.id))
    )
    .limit(1);

  if (!personalSong) {
    res.status(404).end("Canción no encontrada.");
    return;
  }

  const [existingPublic] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(
      and(eq(songs.scope, "public"), eq(songs.youtubeUrl, personalSong.youtubeUrl))
    )
    .limit(1);

  if (existingPublic) {
    res.status(409).end("Ya existe una canción pública con ese enlace de YouTube.");
    return;
  }

  await db.insert(songs).values({
    artist: personalSong.artist,
    title: personalSong.title,
    year: personalSong.year,
    youtubeUrl: personalSong.youtubeUrl,
    isSpanish: personalSong.isSpanish,
    youtubeStatus: personalSong.youtubeStatus,
    youtubeValidationMessage: personalSong.youtubeValidationMessage,
    youtubeValidationCode: personalSong.youtubeValidationCode,
    youtubeValidatedAt: personalSong.youtubeValidatedAt,
    scope: "public",
    sourceSongId: id,
    catalogStatus: user.role === "superadmin" ? "approved" : "pending",
    createdBy: user.id,
    approvedBy: user.role === "superadmin" ? user.id : null,
    approvedAt: user.role === "superadmin" ? new Date() : null,
    updatedAt: new Date(),
  });

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
}
