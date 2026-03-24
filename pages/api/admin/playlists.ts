import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  adminUsers,
  playlistSongs,
  playlists,
  songs,
} from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";
import { serializeAdminIdentity } from "../../../src/admin/serializers";

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

async function listPlaylists(scope: "public" | "personal", userId: number) {
  const rows = await db
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
      songCount: sql<number>`count(${playlistSongs.id})`,
    })
    .from(playlists)
    .leftJoin(playlistSongs, eq(playlistSongs.playlistId, playlists.id))
    .where(
      scope === "personal"
        ? and(eq(playlists.scope, "personal"), eq(playlists.ownerUserId, userId))
        : eq(playlists.scope, "public")
    )
    .groupBy(playlists.id)
    .orderBy(asc(playlists.name));

  const creatorIds = Array.from(
    new Set(
      rows
        .map((entry) => entry.createdBy)
        .filter(
          (entry): entry is number => typeof entry === "number" && Number.isFinite(entry)
        )
    )
  );

  const creators = creatorIds.length
    ? await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          displayName: adminUsers.displayName,
          avatarUrl: adminUsers.avatarUrl,
        })
        .from(adminUsers)
        .where(inArray(adminUsers.id, creatorIds))
    : [];

  const creatorMap = new Map(
    creators.map((entry) => [
      entry.id,
      serializeAdminIdentity({
        id: entry.id,
        email: entry.email,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
      }),
    ])
  );

  return rows.map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    active: entry.active,
    songCount: Number(entry.songCount ?? 0),
    scope: entry.scope,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
    created_by_user:
      entry.createdBy !== null ? (creatorMap.get(entry.createdBy) ?? null) : null,
  }));
}

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
  const url = new URL(req.url ?? "", "http://localhost");
  const scope = url.searchParams.get("scope") === "personal" ? "personal" : "public";

  if (req.method === "GET") {
    const rows = await listPlaylists(scope, user.id);
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
    const playlistScope = body.scope === "personal" ? "personal" : "public";
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
          scope: playlistScope,
          ownerUserId: playlistScope === "personal" ? user.id : null,
          createdBy: user.id,
          updatedAt: new Date(),
        })
        .returning({ id: playlists.id });

      if (songIds.length) {
        await tx.insert(playlistSongs).values(
          songIds.map((songId, index) => ({
            playlistId: playlist.id,
            songId,
            position: index,
            addedBy: user.id,
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
