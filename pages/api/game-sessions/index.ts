import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { getGameSessionLocation, getMissingSessionColumn } from "../../../src/server/gameSessionLocation";
import { gameSessions } from "../../../src/db/schema";
import { db } from "../_db";
import {
  isSpanishTagSelected,
  normalizeSongTags,
} from "../../../src/lib/songTags";

const parseBody = (req: NextApiRequest): Record<string, unknown> => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  return {};
};

function toFiniteInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const mode = typeof body.mode === "string" ? body.mode.trim() : "auto";
  const yearMin = toFiniteInteger(body.yearMin);
  const yearMax = toFiniteInteger(body.yearMax);
  const selectedTags = normalizeSongTags(body.selectedTags, body.onlySpanish);
  const tagMatchMode = body.tagMatchMode === "all" ? "all" : "any";
  const onlySpanish = isSpanishTagSelected(selectedTags);
  const timerEnabled = body.timerEnabled === true;
  const playlistId = toFiniteInteger(body.playlistId);
  const playlistName =
    typeof body.playlistName === "string" && body.playlistName.trim()
      ? body.playlistName.trim()
      : null;
  const location = getGameSessionLocation(req.headers);

  if (!mode) {
    res.status(400).end("Datos inválidos.");
    return;
  }

  // Explicit columns let older deployments keep recording games until migrated.
  // Drizzle's insert builder also names omitted schema columns as DEFAULT.
  const values: Record<string, unknown> = {
    mode, year_min: yearMin, year_max: yearMax,
    only_spanish: onlySpanish,
    selected_song_attributes: sql.param(selectedTags, gameSessions.selectedSongAttributes),
    tag_match_mode: tagMatchMode, timer_enabled: timerEnabled,
    playlist_id: playlistId, playlist_name: playlistName,
    country_code: location.countryCode, city: location.city, region: location.region,
    latitude: location.latitude, longitude: location.longitude,
  };
  const optionalColumns = new Set([
    "tag_match_mode", "country_code", "city", "region", "latitude", "longitude",
  ]);
  for (;;) {
    try {
      const entries = Object.entries(values);
      await db.execute(sql`insert into ${gameSessions} (
        ${sql.join(entries.map(([name]) => sql.identifier(name)), sql`, `)}
      ) values (
        ${sql.join(entries.map(([, value]) => sql`${value}`), sql`, `)}
      )`);
      break;
    } catch (error) {
      const missing = getMissingSessionColumn(error);
      if (!missing || !optionalColumns.delete(missing)) throw error;
      delete values[missing];
      console.warn(`[game-session] Missing metadata column ${missing}; apply database migrations.`);
    }
  }

  res.status(201).json({ ok: true });
}
