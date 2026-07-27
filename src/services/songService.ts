import type { Song, YearRange } from "../types";
import {
  isSpanishTagSelected,
  normalizeSongTags,
  type SongTagMatchMode,
} from "../lib/songTags";

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

async function fetchJsonWithCredentials<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  return fetchJson<T>(input, {
    credentials: "include",
    ...init,
  });
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

  const tags = normalizeSongTags(raw.tags ?? raw.song_attributes, raw.isspanish);

  return {
    id: Number(raw.id),
    artist: String(raw.artist ?? ""),
    title: String(raw.title ?? ""),
    year,
    play_start_seconds:
      typeof raw.play_start_seconds === "number" &&
      Number.isFinite(raw.play_start_seconds)
        ? Math.max(0, Math.trunc(raw.play_start_seconds))
        : 0,
    youtube_url: String(raw.youtube_url ?? ""),
    tags,
    isSpanish: isSpanishTagSelected(tags),
    mimica: raw.mimica === true,
    tararear: raw.tararear === true,
    karaoke: raw.karaoke === true,
    karaoke_pause_seconds:
      typeof raw.karaoke_pause_seconds === "number" &&
      Number.isFinite(raw.karaoke_pause_seconds)
        ? Math.max(0, Math.trunc(raw.karaoke_pause_seconds))
        : 0,
    karaoke_lyric:
      typeof raw.karaoke_lyric === "string" ? raw.karaoke_lyric : null,
    trivia: raw.trivia === true,
    trivia_question:
      typeof raw.trivia_question === "string" ? raw.trivia_question : null,
    trivia_answer:
      typeof raw.trivia_answer === "string" ? raw.trivia_answer : null,
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

export async function fetchSongQueue(options?: {
  minYear?: number | null;
  maxYear?: number | null;
  selectedTags?: string[];
  tagMatchMode?: SongTagMatchMode;
  playlistId?: number | null;
  excludedSongIds?: number[];
  excludedArtistKeys?: string[];
  recentSongIds?: number[];
}): Promise<{ songs: Song[]; resetRecentHistory: boolean }> {
  const minYear =
    typeof options?.minYear === "number" ? Math.floor(options.minYear) : null;
  const maxYear =
    typeof options?.maxYear === "number" ? Math.floor(options.maxYear) : null;
  const selectedTags = normalizeSongTags(options?.selectedTags ?? []);
  const tagMatchMode = options?.tagMatchMode === "all" ? "all" : "any";
  const playlistId =
    typeof options?.playlistId === "number" ? Math.trunc(options.playlistId) : null;
  const data = await fetchJson<{
    songs?: Record<string, unknown>[];
    resetRecentHistory?: boolean;
  }>("/api/songs/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      minYear,
      maxYear,
      selectedTags,
      tagMatchMode,
      playlistId,
      excludedSongIds: options?.excludedSongIds ?? [],
      excludedArtistKeys: options?.excludedArtistKeys ?? [],
      recentSongIds: options?.recentSongIds ?? [],
    }),
  });

  return {
    songs: (data.songs ?? []).map((raw) => normalizeSong(raw)),
    resetRecentHistory: data.resetRecentHistory === true,
  };
}

export async function fetchMyCollectionSongs(): Promise<Song[]> {
  const result = await fetchMyCollectionQueue();
  if (!result.songs.length) {
    throw new Error("Tu colección personal no tiene canciones disponibles.");
  }
  return result.songs;
}

export async function fetchMyCollectionQueue(options?: {
  selectedTags?: string[];
  tagMatchMode?: SongTagMatchMode;
  excludedSongIds?: number[];
  excludedArtistKeys?: string[];
  recentSongIds?: number[];
}): Promise<{ songs: Song[]; resetRecentHistory: boolean }> {
  const data = await fetchJsonWithCredentials<{
    songs?: Record<string, unknown>[];
    resetRecentHistory?: boolean;
  }>("/api/admin/my-songs/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selectedTags: normalizeSongTags(options?.selectedTags ?? []),
      tagMatchMode: options?.tagMatchMode === "all" ? "all" : "any",
      excludedSongIds: options?.excludedSongIds ?? [],
      excludedArtistKeys: options?.excludedArtistKeys ?? [],
      recentSongIds: options?.recentSongIds ?? [],
    }),
  });
  return {
    songs: (data.songs ?? []).map(normalizeSong),
    resetRecentHistory: data.resetRecentHistory === true,
  };
}

export async function fetchMyPlaylistSongs(
  playlistId: number,
  options?: {
    selectedTags?: string[];
    tagMatchMode?: SongTagMatchMode;
    excludedSongIds?: number[];
    excludedArtistKeys?: string[];
    recentSongIds?: number[];
  }
): Promise<{ songs: Song[]; resetRecentHistory: boolean }> {
  const data = await fetchJsonWithCredentials<{
    songs?: Record<string, unknown>[];
    resetRecentHistory?: boolean;
  }>("/api/admin/my-playlist-songs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playlistId,
      selectedTags: normalizeSongTags(options?.selectedTags ?? []),
      tagMatchMode: options?.tagMatchMode === "all" ? "all" : "any",
      excludedSongIds: options?.excludedSongIds ?? [],
      excludedArtistKeys: options?.excludedArtistKeys ?? [],
      recentSongIds: options?.recentSongIds ?? [],
    }),
  });
  const collected = (data.songs ?? []).map((raw) => normalizeSong(raw));
  if (!collected.length) {
    throw new Error("La playlist personal seleccionada no tiene canciones.");
  }
  return {
    songs: collected,
    resetRecentHistory: data.resetRecentHistory === true,
  };
}
