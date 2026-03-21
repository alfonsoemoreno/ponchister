import type { NextApiRequest, NextApiResponse } from "next";
import { asc, eq } from "drizzle-orm";
import { playlistSongs, playlists, songs } from "../../../../src/db/schema";
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

async function hydratePlaylist(id: number) {
  const [playlist] = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      active: playlists.active,
    })
    .from(playlists)
    .where(eq(playlists.id, id))
    .limit(1);

  if (!playlist) {
    return null;
  }

  const playlistSongRows = await db
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
      position: playlistSongs.position,
    })
    .from(playlistSongs)
    .innerJoin(songs, eq(playlistSongs.songId, songs.id))
    .where(eq(playlistSongs.playlistId, id))
    .orderBy(asc(playlistSongs.position), asc(songs.id));

  return {
    ...playlist,
    songCount: playlistSongRows.length,
    songs: playlistSongRows.map((row) => {
      const { position, ...song } = row;
      void position;
      return {
        ...song,
        youtube_validated_at: song.youtube_validated_at
          ? song.youtube_validated_at.toISOString()
          : null,
      };
    }),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.status(400).end("ID inválido.");
    return;
  }

  if (req.method === "GET") {
    const playlist = await hydratePlaylist(id);
    if (!playlist) {
      res.status(404).end("Playlist no encontrada.");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(playlist));
    return;
  }

  if (req.method === "PUT") {
    const body = parseBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    const active = body.active !== false;
    const songIds = Array.isArray(body.songIds)
      ? body.songIds
          .map((entry) =>
            typeof entry === "number" && Number.isFinite(entry)
              ? Math.trunc(entry)
              : null
          )
          .filter((entry): entry is number => entry !== null)
      : [];

    if (!name) {
      res.status(400).end("El nombre de la playlist es obligatorio.");
      return;
    }

    const [existing] = await db
      .select({ id: playlists.id })
      .from(playlists)
      .where(eq(playlists.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).end("Playlist no encontrada.");
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(playlists)
        .set({
          name,
          description,
          active,
          updatedAt: new Date(),
        })
        .where(eq(playlists.id, id));

      await tx.delete(playlistSongs).where(eq(playlistSongs.playlistId, id));

      if (songIds.length) {
        await tx.insert(playlistSongs).values(
          songIds.map((songId, index) => ({
            playlistId: id,
            songId,
            position: index,
          }))
        );
      }
    });

    const playlist = await hydratePlaylist(id);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(playlist));
    return;
  }

  if (req.method === "DELETE") {
    await db.delete(playlists).where(eq(playlists.id, id));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.status(405).end("Método no permitido.");
}
