import type { PlaylistSummary } from "../types";

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

export async function fetchAvailablePlaylists(): Promise<PlaylistSummary[]> {
  const data = await fetchJson<Record<string, unknown>[]>("/api/playlists");
  return data.map((item) => ({
    id: Number(item.id),
    name: String(item.name ?? ""),
    description:
      typeof item.description === "string" ? item.description : null,
    active: item.active === true,
    songCount:
      typeof item.songCount === "number"
        ? item.songCount
        : Number.parseInt(String(item.songCount ?? "0"), 10) || 0,
  }));
}
