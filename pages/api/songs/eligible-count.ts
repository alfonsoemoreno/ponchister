import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { songs, playlistSongs } from "../../../src/db/schema";
import { normalizeSongTags } from "../../../src/lib/songTags";
import { setPublicCatalogCache } from "../../../src/server/publicCatalogCache";
import { db } from "../_db";
import { requireAdmin } from "../_admin";

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const source = typeof body.source === "string" ? body.source : "classic";
  const personal = source === "personal_catalog" || source === "personal_playlist";
  const user = personal ? await requireAdmin(req, res) : null;
  if (personal && !user) return;

  const filters = [
    personal
      ? or(
          isNull(songs.youtubeStatus),
          eq(songs.youtubeStatus, "operational"),
          eq(songs.youtubeStatus, "unchecked"),
        )
      : or(isNull(songs.youtubeStatus), eq(songs.youtubeStatus, "operational")),
  ];
  if (personal) {
    filters.push(eq(songs.scope, "personal"), eq(songs.ownerUserId, user!.id));
  } else {
    filters.push(eq(songs.scope, "public"), eq(songs.catalogStatus, "approved"));
  }

  const minYear = integer(body.minYear);
  const maxYear = integer(body.maxYear);
  if (!body.playlistId && minYear !== null) filters.push(gte(songs.year, minYear));
  if (!body.playlistId && maxYear !== null) filters.push(lte(songs.year, maxYear));

  const playlistId = integer(body.playlistId);
  if (playlistId && playlistId > 0) {
    const playlistRows = db
      .select({ songId: playlistSongs.songId })
      .from(playlistSongs)
      .where(eq(playlistSongs.playlistId, playlistId));
    filters.push(inArray(songs.id, playlistRows));
  }

  const tags = normalizeSongTags(body.selectedTags);
  if (tags.length) {
    const tagArray = sql`ARRAY[${sql.join(tags.map((tag) => sql`${tag}`), sql`, `)}]::text[]`;
    const spanishSelected = tags.includes("espanol");
    const songTags = songs.songAttributes;
    const matchesTags = body.tagMatchMode === "all"
      ? (spanishSelected
          ? sql`(${songTags} @> ${tagArray} OR (${songs.isSpanish} AND ${songTags} @> ARRAY[${sql.join(tags.filter((tag) => tag !== "espanol").map((tag) => sql`${tag}`), sql`, `)}]::text[]))`
          : sql`${songTags} @> ${tagArray}`)
      : (spanishSelected
          ? sql`(${songTags} && ${tagArray} OR ${songs.isSpanish})`
          : sql`${songTags} && ${tagArray}`);
    filters.push(matchesTags);
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(songs)
    .where(and(...filters));

  if (!personal) setPublicCatalogCache(res);
  res.status(200).json({ count: Number(row?.count ?? 0) });
}
