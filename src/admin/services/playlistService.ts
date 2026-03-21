import type { Playlist, PlaylistInput, Song } from "../types";

const API_BASE = "/api/admin/playlists";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "No se pudo completar la operación.");
  }

  return response.json() as Promise<T>;
}

function normalizeSong(raw: Record<string, unknown>): Song {
  const yearValue = raw.year;
  let year: number | null = null;

  if (typeof yearValue === "number" && Number.isFinite(yearValue)) {
    year = yearValue;
  } else if (typeof yearValue === "string" && yearValue.trim() !== "") {
    const parsed = Number.parseInt(yearValue, 10);
    year = Number.isNaN(parsed) ? null : parsed;
  }

  return {
    id: Number(raw.id),
    artist: String(raw.artist ?? ""),
    title: String(raw.title ?? ""),
    year,
    youtube_url: String(raw.youtube_url ?? ""),
    isspanish: raw.isspanish === true,
    youtube_status:
      raw.youtube_status === "unchecked" ||
      raw.youtube_status === "checking" ||
      raw.youtube_status === "operational" ||
      raw.youtube_status === "restricted" ||
      raw.youtube_status === "unavailable" ||
      raw.youtube_status === "invalid"
        ? raw.youtube_status
        : null,
    youtube_validation_message:
      typeof raw.youtube_validation_message === "string"
        ? raw.youtube_validation_message
        : null,
    youtube_validation_code:
      typeof raw.youtube_validation_code === "number"
        ? raw.youtube_validation_code
        : null,
    youtube_validated_at:
      typeof raw.youtube_validated_at === "string"
        ? raw.youtube_validated_at
        : null,
  };
}

function normalizePlaylist(raw: Record<string, unknown>): Playlist {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    description:
      typeof raw.description === "string" ? raw.description : null,
    active: raw.active === true,
    songCount:
      typeof raw.songCount === "number"
        ? raw.songCount
        : Number.parseInt(String(raw.songCount ?? "0"), 10) || 0,
    songs: Array.isArray(raw.songs)
      ? raw.songs.map((song) => normalizeSong(song as Record<string, unknown>))
      : undefined,
  };
}

function sanitizePlaylistInput(payload: PlaylistInput): PlaylistInput {
  return {
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    active: payload.active === true,
    songIds: payload.songIds
      .map((id) => Math.trunc(id))
      .filter((id, index, list) => id > 0 && list.indexOf(id) === index),
  };
}

export async function listPlaylists(): Promise<Playlist[]> {
  const data = await fetchJson<Record<string, unknown>[]>(API_BASE);
  return data.map(normalizePlaylist);
}

export async function getPlaylist(id: number): Promise<Playlist> {
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/${id}`);
  return normalizePlaylist(data);
}

export async function createPlaylist(payload: PlaylistInput): Promise<Playlist> {
  const data = await fetchJson<Record<string, unknown>>(API_BASE, {
    method: "POST",
    body: JSON.stringify(sanitizePlaylistInput(payload)),
  });
  return normalizePlaylist(data);
}

export async function updatePlaylist(
  id: number,
  payload: PlaylistInput
): Promise<Playlist> {
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(sanitizePlaylistInput(payload)),
  });
  return normalizePlaylist(data);
}

export async function deletePlaylist(id: number): Promise<void> {
  await fetchJson(`${API_BASE}/${id}`, { method: "DELETE" });
}
