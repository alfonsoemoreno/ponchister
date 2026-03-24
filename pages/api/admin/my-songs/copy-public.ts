import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
import { songs } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";

const parseBody = (req: NextApiRequest): Record<string, unknown> => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") return req.body as Record<string, unknown>;
  return {};
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const sourceId =
    typeof body.songId === "number" && Number.isFinite(body.songId)
      ? Math.trunc(body.songId)
      : null;

  if (!sourceId) {
    res.status(400).end("Canción inválida.");
    return;
  }

  const [sourceSong] = await db
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
      scope: songs.scope,
    })
    .from(songs)
    .where(eq(songs.id, sourceId))
    .limit(1);

  if (!sourceSong || sourceSong.scope !== "public") {
    res.status(404).end("Canción pública no encontrada.");
    return;
  }

  const [existingPersonalCopy] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(
      and(
        eq(songs.scope, "personal"),
        eq(songs.ownerUserId, user.id),
        eq(songs.youtubeUrl, sourceSong.youtubeUrl)
      )
    )
    .limit(1);

  if (existingPersonalCopy) {
    res.status(409).end("Esta canción ya está en tu colección personal.");
    return;
  }

  await db.insert(songs).values({
    artist: sourceSong.artist,
    title: sourceSong.title,
    year: sourceSong.year,
    youtubeUrl: sourceSong.youtubeUrl,
    isSpanish: sourceSong.isSpanish,
    youtubeStatus: sourceSong.youtubeStatus,
    youtubeValidationMessage: sourceSong.youtubeValidationMessage,
    youtubeValidationCode: sourceSong.youtubeValidationCode,
    youtubeValidatedAt: sourceSong.youtubeValidatedAt,
    scope: "personal",
    ownerUserId: user.id,
    sourceSongId: sourceId,
    catalogStatus: "approved",
    createdBy: user.id,
    updatedAt: new Date(),
  });

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
}
