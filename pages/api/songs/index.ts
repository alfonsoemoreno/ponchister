import type { IncomingMessage, ServerResponse } from "node:http";
import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { playlistSongs, songs } from "../../../src/db/schema";
import { db } from "../_db";
import {
  normalizeSongTags,
  songMatchesSelectedTags,
} from "../../../src/lib/songTags";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const minYearParam = url.searchParams.get("minYear");
  const maxYearParam = url.searchParams.get("maxYear");
  const selectedTags = normalizeSongTags(url.searchParams.get("tags"));
  const tagMatchMode = url.searchParams.get("tagMatchMode") === "all" ? "all" : "any";
  const playlistIdParam = url.searchParams.get("playlistId");

  const minYear =
    typeof minYearParam === "string" && minYearParam !== ""
      ? Number(minYearParam)
      : null;
  const maxYear =
    typeof maxYearParam === "string" && maxYearParam !== ""
      ? Number(maxYearParam)
      : null;
  const playlistId =
    typeof playlistIdParam === "string" && playlistIdParam !== ""
      ? Number(playlistIdParam)
      : null;

  const filters = [];
  if (typeof minYear === "number" && Number.isFinite(minYear)) {
    filters.push(gte(songs.year, minYear));
  }
  if (typeof maxYear === "number" && Number.isFinite(maxYear)) {
    filters.push(lte(songs.year, maxYear));
  }
  filters.push(or(isNull(songs.youtubeStatus), eq(songs.youtubeStatus, "operational")));
  filters.push(eq(songs.catalogStatus, "approved"));

  if (typeof playlistId === "number" && Number.isFinite(playlistId)) {
    const playlistSongRows = await db
      .select({ songId: playlistSongs.songId })
      .from(playlistSongs)
      .where(eq(playlistSongs.playlistId, playlistId));

    const songIds = playlistSongRows.map((row) => row.songId);
    if (!songIds.length) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify([]));
      return;
    }

    filters.push(inArray(songs.id, songIds));
  }

  const rows = await db
    .select({
      id: songs.id,
      artist: songs.artist,
      title: songs.title,
      year: songs.year,
      youtube_url: songs.youtubeUrl,
      tags: songs.songAttributes,
      isspanish: songs.isSpanish,
      mimica: songs.mimica,
      tararear: songs.tararear,
    })
    .from(songs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(songs.id));

  const filteredRows = selectedTags.length
    ? rows.filter((row) =>
        songMatchesSelectedTags(
          normalizeSongTags(row.tags, row.isspanish),
          selectedTags,
          tagMatchMode
        )
      )
    : rows;

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(filteredRows));
}
