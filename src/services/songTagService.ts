import type { SongTagDefinition } from "../lib/songTags";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || "No se pudo completar la solicitud al servidor."
    );
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

export async function fetchAvailableSongTags(): Promise<SongTagDefinition[]> {
  const data = await fetchJson<Record<string, unknown>[]>("/api/song-tags");
  return data.map(normalizeSongTagDefinition);
}
