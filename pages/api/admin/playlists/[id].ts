import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  adminUsers,
  playlistSongs,
  playlists,
  songs,
} from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";
import { serializeAdminIdentity } from "../../../../src/admin/serializers";

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
      scope: playlists.scope,
      ownerUserId: playlists.ownerUserId,
      createdBy: playlists.createdBy,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
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
      position: playlistSongs.position,
    })
    .from(playlistSongs)
    .innerJoin(songs, eq(playlistSongs.songId, songs.id))
    .where(eq(playlistSongs.playlistId, id))
    .orderBy(asc(playlistSongs.position), asc(songs.id));

  const userIds = Array.from(
    new Set(
      [playlist.createdBy].filter(
        (entry): entry is number => typeof entry === "number" && Number.isFinite(entry)
      )
    )
  );

  const users = userIds.length
    ? await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          displayName: adminUsers.displayName,
          avatarUrl: adminUsers.avatarUrl,
        })
        .from(adminUsers)
        .where(inArray(adminUsers.id, userIds))
    : [];

  const userMap = new Map(
    users.map((entry) => [
      entry.id,
      serializeAdminIdentity({
        id: entry.id,
        email: entry.email,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
      }),
    ])
  );

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    active: playlist.active,
    scope: playlist.scope,
    owner_user_id: playlist.ownerUserId,
    songCount: playlistSongRows.length,
    created_at: playlist.createdAt.toISOString(),
    updated_at: playlist.updatedAt.toISOString(),
    created_by_user:
      playlist.createdBy !== null ? (userMap.get(playlist.createdBy) ?? null) : null,
    songs: playlistSongRows.map((row) => {
      const { position, ...song } = row;
      void position;
      return song;
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
    if (playlist.scope === "personal" && playlist.owner_user_id !== user.id) {
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
      .select({ id: playlists.id, scope: playlists.scope, ownerUserId: playlists.ownerUserId })
      .from(playlists)
      .where(eq(playlists.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).end("Playlist no encontrada.");
      return;
    }
    if (existing.scope === "personal" && existing.ownerUserId !== user.id) {
      res.status(403).end("No tienes permiso para modificar esta playlist.");
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

      const existingEntries = await tx
        .select({
          songId: playlistSongs.songId,
        })
        .from(playlistSongs)
        .where(eq(playlistSongs.playlistId, id));

      const existingSongIds = new Set(existingEntries.map((entry) => entry.songId));
      const nextSongIds = new Set(songIds);

      const songIdsToDelete = existingEntries
        .map((entry) => entry.songId)
        .filter((songId) => !nextSongIds.has(songId));

      if (songIdsToDelete.length) {
        await tx
          .delete(playlistSongs)
          .where(
            and(
              eq(playlistSongs.playlistId, id),
              inArray(playlistSongs.songId, songIdsToDelete)
            )
          );
      }

      const existingSongIdsToReorder = songIds.filter((songId) =>
        existingSongIds.has(songId)
      );

      if (existingSongIdsToReorder.length) {
        const positionCases = sql.join(
          existingSongIdsToReorder.map((songId, index) =>
            sql`when ${playlistSongs.songId} = ${songId} then ${index}`
          ),
          sql.raw(" ")
        );

        await tx.execute(sql`
          update ${playlistSongs}
          set "position" = case
            ${positionCases}
            else "position"
          end
          where ${playlistSongs.playlistId} = ${id}
            and ${playlistSongs.songId} in (${sql.join(
              existingSongIdsToReorder.map((songId) => sql`${songId}`),
              sql.raw(", ")
            )})
        `);
      }

      const newSongEntries = songIds
        .map((songId, index) => ({ songId, index }))
        .filter(({ songId }) => !existingSongIds.has(songId));

      if (newSongEntries.length) {
        await tx.insert(playlistSongs).values(
          newSongEntries.map(({ songId, index }) => ({
            playlistId: id,
            songId,
            position: index,
            addedBy: user.id,
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
    const [existing] = await db
      .select({ scope: playlists.scope, ownerUserId: playlists.ownerUserId })
      .from(playlists)
      .where(eq(playlists.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).end("Playlist no encontrada.");
      return;
    }
    if (existing.scope === "personal" && existing.ownerUserId !== user.id) {
      res.status(403).end("No tienes permiso para eliminar esta playlist.");
      return;
    }

    await db.delete(playlists).where(eq(playlists.id, id));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.status(405).end("Método no permitido.");
}
