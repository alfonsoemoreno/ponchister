import { supabase } from "../lib/supabaseClient";
import type { Song } from "../types";

let cachedSongCount: number | null = null;

const SONG_FIELDS = "id, artist, title, year, youtube_url";
const MAX_RANDOM_ATTEMPTS = 5;
const BULK_FETCH_PAGE_SIZE = 1000;
const YOUTUBE_ID_REGEX =
  /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;

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
  };
}

export async function getSongCount(options?: {
  forceRefresh?: boolean;
}): Promise<number> {
  if (!options?.forceRefresh && cachedSongCount !== null) {
    return cachedSongCount;
  }

  const { count, error } = await supabase
    .from("songs")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(
      error.message || "No se pudo obtener la cantidad de canciones"
    );
  }

  cachedSongCount = typeof count === "number" ? count : 0;
  return cachedSongCount;
}

export function invalidateSongCount(): void {
  cachedSongCount = null;
}

async function fetchSongByOffset(offset: number): Promise<Song | null> {
  const { data, error } = await supabase
    .from("songs")
    .select(SONG_FIELDS)
    .order("id", { ascending: true })
    .range(offset, offset);

  if (error) {
    throw new Error(error.message || "No se pudo obtener la canción");
  }

  const raw = data?.[0];
  if (!raw) return null;
  return normalizeSong(raw as Record<string, unknown>);
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

export async function fetchAllSongs(options?: {
  minYear?: number | null;
  maxYear?: number | null;
}): Promise<Song[]> {
  const minYear =
    typeof options?.minYear === "number" ? Math.floor(options.minYear) : null;
  const maxYear =
    typeof options?.maxYear === "number" ? Math.floor(options.maxYear) : null;
  const hasYearFilter =
    typeof minYear === "number" || typeof maxYear === "number";
  const collected: Song[] = [];

  for (let from = 0; ; from += BULK_FETCH_PAGE_SIZE) {
    const to = from + BULK_FETCH_PAGE_SIZE - 1;
    let query = supabase
      .from("songs")
      .select(SONG_FIELDS)
      .order("id", { ascending: true });

    if (typeof minYear === "number") {
      query = query.gte("year", minYear);
    }
    if (typeof maxYear === "number") {
      query = query.lte("year", maxYear);
    }

    const { data, error } = await query.range(from, to);

    if (error) {
      throw new Error(
        error.message || "No se pudieron cargar las canciones disponibles."
      );
    }

    const batch = (data ?? []).map((raw) =>
      normalizeSong(raw as Record<string, unknown>)
    );

    collected.push(...batch);

    if (batch.length < BULK_FETCH_PAGE_SIZE) {
      break;
    }
  }

  if (!collected.length && hasYearFilter) {
    throw new Error(
      "No hay canciones dentro del rango de años seleccionado. Ajusta la configuración para continuar."
    );
  }

  return collected;
}
