import type { SongTagDefinition } from "../../lib/songTags";

const API_BASE = "/api/admin/song-tags";

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

function normalizeSongTagDefinition(raw: Record<string, unknown>): SongTagDefinition {
  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ""),
    label: String(raw.label ?? ""),
    active: raw.active === true,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export async function listSongTags(): Promise<SongTagDefinition[]> {
  const data = await fetchJson<Record<string, unknown>[]>(API_BASE);
  return data.map(normalizeSongTagDefinition);
}

export async function createSongTag(payload: {
  label: string;
  slug?: string | null;
}): Promise<SongTagDefinition> {
  const data = await fetchJson<Record<string, unknown>>(API_BASE, {
    method: "POST",
    body: JSON.stringify({
      label: payload.label.trim(),
      slug: payload.slug?.trim() || null,
    }),
  });
  return normalizeSongTagDefinition(data);
}
