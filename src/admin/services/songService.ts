import type {
  Song,
  SongInput,
  SongStatistics,
  SongStatisticsGroup,
} from "../types";

const API_BASE = "/api/admin";

function normalizeSong(raw: Record<string, unknown>): Song {
  const yearValue = raw.year;
  let year: number | null = null;

  if (typeof yearValue === "number" && Number.isFinite(yearValue)) {
    year = yearValue;
  } else if (typeof yearValue === "string" && yearValue.trim() !== "") {
    const parsed = Number.parseInt(yearValue, 10);
    year = Number.isNaN(parsed) ? null : parsed;
  }

  const isSpanishRaw = raw.isspanish;
  const isSpanish =
    typeof isSpanishRaw === "boolean"
      ? isSpanishRaw
      : isSpanishRaw === "true" ||
        isSpanishRaw === "1" ||
        isSpanishRaw === 1 ||
        isSpanishRaw === "t";

  return {
    id: Number(raw.id),
    artist: String(raw.artist ?? ""),
    title: String(raw.title ?? ""),
    year,
    youtube_url: String(raw.youtube_url ?? ""),
    isspanish: isSpanish,
  };
}

function sanitizeInput(payload: SongInput): SongInput {
  const trimmedArtist = payload.artist.trim();
  const trimmedTitle = payload.title.trim();
  const trimmedYoutube = payload.youtube_url.trim();
  const isSpanish = Boolean(payload.isspanish);

  const numericYear =
    typeof payload.year === "number" && Number.isFinite(payload.year)
      ? payload.year
      : null;

  return {
    artist: trimmedArtist,
    title: trimmedTitle,
    youtube_url: trimmedYoutube,
    year: numericYear,
    isspanish: isSpanish,
  };
}

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

export async function listSongs({
  page,
  pageSize,
  search,
  year,
  sortBy = "id",
  sortDirection = "asc",
}: {
  page: number;
  pageSize: number;
  search?: string;
  year?: number | null;
  sortBy?: "id" | "artist" | "title" | "year";
  sortDirection?: "asc" | "desc";
}): Promise<{ songs: Song[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDirection,
  });

  if (typeof year === "number") {
    params.set("year", String(year));
  }
  if (search && search.trim() !== "") {
    params.set("search", search.trim());
  }

  const data = await fetchJson<{
    songs: Record<string, unknown>[];
    total: number;
  }>(`${API_BASE}/songs?${params.toString()}`);

  return {
    songs: data.songs.map((item) => normalizeSong(item)),
    total: data.total,
  };
}

export async function createSong(payload: SongInput): Promise<Song> {
  const sanitized = sanitizeInput(payload);
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/songs`, {
    method: "POST",
    body: JSON.stringify(sanitized),
  });
  return normalizeSong(data);
}

export async function updateSong(
  id: number,
  payload: SongInput
): Promise<Song> {
  const sanitized = sanitizeInput(payload);
  const data = await fetchJson<Record<string, unknown>>(
    `${API_BASE}/songs/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(sanitized),
    }
  );
  return normalizeSong(data);
}

export async function bulkUpsertSongs(payload: SongInput[]): Promise<void> {
  if (payload.length === 0) {
    return;
  }
  const sanitized = payload.map(sanitizeInput);
  await fetchJson(`${API_BASE}/songs/bulk-upsert`, {
    method: "POST",
    body: JSON.stringify({ songs: sanitized }),
  });
}

export async function deleteSong(id: number): Promise<void> {
  await fetchJson(`${API_BASE}/songs/${id}`, { method: "DELETE" });
}

export async function fetchSongStatistics(): Promise<SongStatisticsGroup> {
  const songs = await fetchAllSongs();
  const STAT_LIMIT = 10;

  const computeStats = (collection: Song[]): SongStatistics => {
    const totalSongs = collection.length;
    const missingYearCount = collection.reduce(
      (acc, song) => (song.year === null ? acc + 1 : acc),
      0
    );

    const yearMap = new Map<number, number>();
    const decadeMap = new Map<number, number>();
    const artistMap = new Map<string, number>();

    collection.forEach((song) => {
      const artistKey = song.artist.trim() || "Sin artista";
      artistMap.set(artistKey, (artistMap.get(artistKey) ?? 0) + 1);

      if (song.year === null) {
        return;
      }

      yearMap.set(song.year, (yearMap.get(song.year) ?? 0) + 1);
      const decade = Math.floor(song.year / 10) * 10;
      decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1);
    });

    const yearEntries = Array.from(yearMap.entries()).map(([year, count]) => ({
      label: String(year),
      value: year,
      count,
    }));

    const yearsMostCommon = [...yearEntries]
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.value - b.value;
        }
        return b.count - a.count;
      })
      .slice(0, STAT_LIMIT)
      .map(({ label, count }) => ({ label, count }));

    const yearsLeastCommon = [...yearEntries]
      .sort((a, b) => {
        if (a.count === b.count) {
          return a.value - b.value;
        }
        return a.count - b.count;
      })
      .slice(0, Math.min(STAT_LIMIT, yearEntries.length))
      .map(({ label, count }) => ({ label, count }));

    const decadeEntries = Array.from(decadeMap.entries()).map(
      ([decade, count]) => ({
        label: `${decade}s`,
        value: decade,
        count,
      })
    );

    const decadesLeastCommon = [...decadeEntries]
      .sort((a, b) => {
        if (a.count === b.count) {
          return a.value - b.value;
        }
        return a.count - b.count;
      })
      .slice(0, Math.min(STAT_LIMIT, decadeEntries.length))
      .map(({ label, count }) => ({ label, count }));

    const artistsMostCommon = Array.from(artistMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.label.localeCompare(b.label);
        }
        return b.count - a.count;
      })
      .slice(0, STAT_LIMIT);

    return {
      totalSongs,
      missingYearCount,
      yearsMostCommon,
      yearsLeastCommon,
      decadesLeastCommon,
      artistsMostCommon,
    };
  };

  const overallStats = computeStats(songs);
  const spanishStats = computeStats(songs.filter((song) => song.isspanish));

  return {
    overall: overallStats,
    spanish: spanishStats,
  };
}

export async function fetchAllSongs(): Promise<Song[]> {
  const data = await fetchJson<Record<string, unknown>[]>(
    `${API_BASE}/songs/all`
  );
  return data.map((item) => normalizeSong(item));
}
