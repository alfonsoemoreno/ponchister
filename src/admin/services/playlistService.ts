import type { AdminIdentity, Playlist, PlaylistInput, Song } from "../types";

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

  const normalizeIdentity = (value: unknown): AdminIdentity | null => {
    if (!value || typeof value !== "object") return null;
    const rawIdentity = value as Record<string, unknown>;
    const id = Number(rawIdentity.id);
    if (!Number.isFinite(id)) return null;
    return {
      id,
      email: String(rawIdentity.email ?? ""),
      display_name:
        typeof rawIdentity.display_name === "string"
          ? rawIdentity.display_name
          : null,
      avatar_url:
        typeof rawIdentity.avatar_url === "string" ? rawIdentity.avatar_url : null,
    };
  };

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
    catalog_status: raw.catalog_status === "approved" ? "approved" : "pending",
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    approved_at: typeof raw.approved_at === "string" ? raw.approved_at : null,
    created_by_user: normalizeIdentity(raw.created_by_user),
    approved_by_user: normalizeIdentity(raw.approved_by_user),
  };
}

function normalizePlaylist(raw: Record<string, unknown>): Playlist {
  const normalizeIdentity = (value: unknown): AdminIdentity | null => {
    if (!value || typeof value !== "object") return null;
    const rawIdentity = value as Record<string, unknown>;
    const id = Number(rawIdentity.id);
    if (!Number.isFinite(id)) return null;
    return {
      id,
      email: String(rawIdentity.email ?? ""),
      display_name:
        typeof rawIdentity.display_name === "string"
          ? rawIdentity.display_name
          : null,
      avatar_url:
        typeof rawIdentity.avatar_url === "string" ? rawIdentity.avatar_url : null,
    };
  };

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
    scope: raw.scope === "personal" ? "personal" : "public",
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    created_by_user: normalizeIdentity(raw.created_by_user),
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

export async function listPlaylists(scope: "public" | "personal" = "public"): Promise<Playlist[]> {
  const data = await fetchJson<Record<string, unknown>[]>(`${API_BASE}?scope=${scope}`);
  return data.map(normalizePlaylist);
}

export async function getPlaylist(id: number): Promise<Playlist> {
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/${id}`);
  return normalizePlaylist(data);
}

export async function createPlaylist(
  payload: PlaylistInput,
  scope: "public" | "personal" = "public"
): Promise<Playlist> {
  const data = await fetchJson<Record<string, unknown>>(API_BASE, {
    method: "POST",
    body: JSON.stringify({ ...sanitizePlaylistInput(payload), scope }),
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
