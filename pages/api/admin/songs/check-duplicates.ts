import type { NextApiRequest, NextApiResponse } from "next";
import { songs } from "../../../../src/db/schema";
import type { Song, SongInput, YoutubeValidationStatus } from "../../../../src/admin/types";
import { findSongDuplicateMatches } from "../../../../src/admin/songDuplicateUtils";
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
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const payload: SongInput = {
    artist: typeof body.artist === "string" ? body.artist.trim() : "",
    title: typeof body.title === "string" ? body.title.trim() : "",
    youtube_url:
      typeof body.youtube_url === "string" ? body.youtube_url.trim() : "",
    year:
      typeof body.year === "number" && Number.isFinite(body.year)
        ? body.year
        : null,
    isspanish: Boolean(body.isspanish),
  };
  const excludeId =
    typeof body.excludeId === "number" && Number.isFinite(body.excludeId)
      ? body.excludeId
      : null;

  if (!payload.artist || !payload.title || !payload.youtube_url) {
    res.statusCode = 400;
    res.end("Datos inválidos.");
    return;
  }

  const existingSongs = await db
    .select({
      id: songs.id,
      artist: songs.artist,
      title: songs.title,
      year: songs.year,
      youtube_url: songs.youtubeUrl,
      isspanish: songs.isSpanish,
      youtube_status: songs.youtubeStatus,
      youtube_validation_message: songs.youtubeValidationMessage,
      youtube_validation_code: songs.youtubeValidationCode,
      youtube_validated_at: songs.youtubeValidatedAt,
    })
    .from(songs);

  const normalizedSongs: Song[] = existingSongs.map((song) => {
    const youtubeStatus: YoutubeValidationStatus | null =
      song.youtube_status === "unchecked" ||
      song.youtube_status === "checking" ||
      song.youtube_status === "operational" ||
      song.youtube_status === "restricted" ||
      song.youtube_status === "unavailable" ||
      song.youtube_status === "invalid"
        ? song.youtube_status
        : null;

    return {
      ...song,
      youtube_status: youtubeStatus,
      youtube_validated_at: song.youtube_validated_at
        ? song.youtube_validated_at.toISOString()
        : null,
    };
  });

  const matches = findSongDuplicateMatches(payload, normalizedSongs, { excludeId });

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ matches }));
}
