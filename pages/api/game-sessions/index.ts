import type { NextApiRequest, NextApiResponse } from "next";
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

function isMissingColumnError(error: unknown, columnName: string): boolean {
  let candidate: unknown = error;
  while (candidate && typeof candidate === "object") {
    const current = candidate as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (
      current.code === "42703" &&
      typeof current.message === "string" &&
      current.message.toLowerCase().includes(`column "${columnName.toLowerCase()}"`)
    ) {
      return true;
    }
    candidate = current.cause;
  }
  return false;
}

function getCountryCode(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const countryCode = candidate?.trim().toUpperCase();
  return countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
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
  const countryCode = getCountryCode(req.headers["x-vercel-ip-country"]);

  if (!mode) {
    res.status(400).end("Datos inválidos.");
    return;
  }

  try {
    await db.insert(gameSessions).values({
      mode,
      yearMin,
      yearMax,
      onlySpanish,
      selectedSongAttributes: selectedTags,
      tagMatchMode,
      timerEnabled,
      playlistId,
      playlistName,
      countryCode,
    });
  } catch (error) {
    const missingTagMatchMode = isMissingColumnError(error, "tag_match_mode");
    const missingCountryCode = isMissingColumnError(error, "country_code");
    if (!missingTagMatchMode && !missingCountryCode) {
      throw error;
    }

    console.warn(
      "[game-session] Database schema is missing a session metadata column. Retrying with available columns."
    );

    await db.insert(gameSessions).values({
      mode,
      yearMin,
      yearMax,
      onlySpanish,
      selectedSongAttributes: selectedTags,
      ...(missingTagMatchMode ? {} : { tagMatchMode }),
      timerEnabled,
      playlistId,
      playlistName,
      ...(missingCountryCode ? {} : { countryCode }),
    });
  }

  res.status(201).json({ ok: true });
}
