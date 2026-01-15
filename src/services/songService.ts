import type { Song, YearRange } from "../types";

let cachedSongCount: number | null = null;
let cachedYearBounds: YearRange | null = null;

const MAX_RANDOM_ATTEMPTS = 5;
const YOUTUBE_ID_REGEX =
  /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;

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

function hasValidYoutubeId(url: string): boolean {
  if (!url) return false;
  const match = url.match(YOUTUBE_ID_REGEX);
  return Boolean(match && match[1] && match[1].length === 11);
}

function normalizeSong(raw: Record<string, unknown>): Song {
  const yearValue = raw.year;
  let year: number | null = null;
  if (typeof yearValue === "number") {
    year = Number.isFinite(yearValue) ? yearValue : null;
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
    isSpanish: (raw as Record<string, unknown>).isspanish === true,
  };
}

export async function getSongCount(options?: {
  forceRefresh?: boolean;
}): Promise<number> {
  if (!options?.forceRefresh && cachedSongCount !== null) {
    return cachedSongCount;
  }

  const data = await fetchJson<{ count: number }>("/api/songs/count");
  cachedSongCount = typeof data.count === "number" ? data.count : 0;
  return cachedSongCount;
}

export function invalidateSongCount(): void {
  cachedSongCount = null;
}

export function invalidateSongYearBounds(): void {
  cachedYearBounds = null;
}

async function fetchSongByOffset(offset: number): Promise<Song | null> {
  const data = await fetchJson<Record<string, unknown> | null>(
    `/api/songs/by-offset?offset=${offset}`
  );
  if (!data) return null;
  return normalizeSong(data);
}

export async function fetchRandomSong(): Promise<Song> {
  const total = await getSongCount();
  if (!total) {
    throw new Error("No hay canciones disponibles en la base de datos");
  }

  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt += 1) {
    const randomIndex = Math.floor(Math.random() * total);
    const song = await fetchSongByOffset(randomIndex);
    if (song && hasValidYoutubeId(song.youtube_url.trim())) {
      return song;
    }
  }

  throw new Error(
    "No se encontró una canción reproducible tras varios intentos. Verifica los datos cargados."
  );
}

export async function fetchSongYearBounds(options?: {
  forceRefresh?: boolean;
}): Promise<YearRange> {
  if (!options?.forceRefresh && cachedYearBounds) {
    return cachedYearBounds;
  }

  const fallbackMin = 1950;
  const fallbackMax = new Date().getFullYear();

  const coerceBound = (value: unknown): number | null => {
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
  };

  let minYear: number | null = null;
  let maxYear: number | null = null;

  const data = await fetchJson<{ min: number | null; max: number | null }>(
    "/api/songs/year-bounds"
  );
  minYear = coerceBound(data.min);
  maxYear = coerceBound(data.max);

  if (minYear === null && maxYear !== null) {
    minYear = maxYear;
  } else if (maxYear === null && minYear !== null) {
    maxYear = minYear;
  }

  if (minYear === null || maxYear === null) {
    minYear = fallbackMin;
    maxYear = fallbackMax;
  }

  if (minYear > maxYear) {
    const temp = minYear;
    minYear = maxYear;
    maxYear = temp;
  }

  cachedYearBounds = { min: minYear, max: maxYear };
  return cachedYearBounds;
}

export async function fetchAllSongs(options?: {
  minYear?: number | null;
  maxYear?: number | null;
  onlySpanish?: boolean;
}): Promise<Song[]> {
  const minYear =
    typeof options?.minYear === "number" ? Math.floor(options.minYear) : null;
  const maxYear =
    typeof options?.maxYear === "number" ? Math.floor(options.maxYear) : null;
  const onlySpanish = options?.onlySpanish === true;
  const hasYearFilter =
    typeof minYear === "number" || typeof maxYear === "number";
  const params = new URLSearchParams();
  if (typeof minYear === "number") params.set("minYear", String(minYear));
  if (typeof maxYear === "number") params.set("maxYear", String(maxYear));
  if (onlySpanish) params.set("onlySpanish", "true");
  const data = await fetchJson<Record<string, unknown>[]>(
    `/api/songs?${params.toString()}`
  );
  const collected = data.map((raw) => normalizeSong(raw));

  if (!collected.length && hasYearFilter) {
    throw new Error(
      "No hay canciones dentro del rango de años seleccionado. Ajusta la configuración para continuar."
    );
  }

  return collected;
}
