import type { NextApiRequest, NextApiResponse } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { playlistSongs, playlists, songs } from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";

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

async function listPlaylists() {
  return db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      active: playlists.active,
      songCount: sql<number>`count(${playlistSongs.id})`,
    })
    .from(playlists)
    .leftJoin(playlistSongs, eq(playlistSongs.playlistId, playlists.id))
    .groupBy(playlists.id)
    .orderBy(asc(playlists.name));
}

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

  if (req.method === "GET") {
    const rows = await listPlaylists();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(rows));
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    const active = body.active !== false;
    const songIds = Array.isArray(body.songIds)
      ? body.songIds
          .map((id) =>
            typeof id === "number" && Number.isFinite(id) ? Math.trunc(id) : null
          )
          .filter((id): id is number => id !== null)
      : [];

    if (!name) {
      res.status(400).end("El nombre de la playlist es obligatorio.");
      return;
    }

    const playlistId = await db.transaction(async (tx) => {
      const [playlist] = await tx
        .insert(playlists)
        .values({
          name,
          description,
          active,
          updatedAt: new Date(),
        })
        .returning({ id: playlists.id });

      if (songIds.length) {
        await tx.insert(playlistSongs).values(
          songIds.map((songId, index) => ({
            playlistId: playlist.id,
            songId,
            position: index,
          }))
        );
      }

      return playlist.id;
    });

    const created = await hydratePlaylist(playlistId);

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(created));
    return;
  }

  res.status(405).end("Método no permitido.");
}
