import type {
  AdminIdentity,
  CatalogStatus,
  Song,
  SongDuplicateMatch,
  SongInput,
  SongYoutubeValidationPayload,
  SongStatistics,
  SongStatisticsGroup,
  YoutubeValidationStatus,
} from "../types";
import {
  isSpanishTagSelected,
  normalizeSongTags,
  syncSongModeTags,
} from "../../lib/songTags";

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

  const tags = normalizeSongTags(raw.tags ?? raw.song_attributes, raw.isspanish);
  const isSpanish = isSpanishTagSelected(tags);

  const youtubeStatusRaw = raw.youtube_status;
  const youtubeStatus: YoutubeValidationStatus | null =
    youtubeStatusRaw === "unchecked" ||
    youtubeStatusRaw === "checking" ||
    youtubeStatusRaw === "operational" ||
    youtubeStatusRaw === "restricted" ||
    youtubeStatusRaw === "unavailable" ||
    youtubeStatusRaw === "invalid"
      ? youtubeStatusRaw
      : null;

  const catalogStatus: CatalogStatus =
    raw.catalog_status === "approved" ? "approved" : "pending";

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
    play_start_seconds:
      typeof raw.play_start_seconds === "number" &&
      Number.isFinite(raw.play_start_seconds)
        ? Math.max(0, Math.trunc(raw.play_start_seconds))
        : 0,
    youtube_url: String(raw.youtube_url ?? ""),
    tags,
    isspanish: isSpanish,
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
    youtube_status: youtubeStatus,
    youtube_validation_message:
      typeof raw.youtube_validation_message === "string"
        ? raw.youtube_validation_message
        : null,
    youtube_validation_code:
      typeof raw.youtube_validation_code === "number" &&
      Number.isFinite(raw.youtube_validation_code)
        ? raw.youtube_validation_code
        : null,
    youtube_validated_at:
      typeof raw.youtube_validated_at === "string"
        ? raw.youtube_validated_at
        : null,
    catalog_status: catalogStatus,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    approved_at: typeof raw.approved_at === "string" ? raw.approved_at : null,
    created_by_user: normalizeIdentity(raw.created_by_user),
    approved_by_user: normalizeIdentity(raw.approved_by_user),
  };
}

function sanitizeInput(payload: SongInput): SongInput {
  const trimmedArtist = payload.artist.trim();
  const trimmedTitle = payload.title.trim();
  const trimmedYoutube = payload.youtube_url.trim();
  const tags = syncSongModeTags(
    normalizeSongTags(payload.tags, payload.isspanish),
    {
      mimica: payload.mimica === true,
      tararear: payload.tararear === true,
    }
  );

  const numericYear =
    typeof payload.year === "number" && Number.isFinite(payload.year)
      ? payload.year
      : null;
  const playStartSeconds =
    typeof payload.play_start_seconds === "number" &&
    Number.isFinite(payload.play_start_seconds)
      ? Math.max(0, Math.trunc(payload.play_start_seconds))
      : 0;
  const karaoke = payload.karaoke === true;
  const karaokePauseSeconds =
    karaoke &&
    typeof payload.karaoke_pause_seconds === "number" &&
    Number.isFinite(payload.karaoke_pause_seconds)
      ? Math.max(0, Math.trunc(payload.karaoke_pause_seconds))
      : 0;
  const karaokeLyric =
    karaoke && typeof payload.karaoke_lyric === "string"
      ? payload.karaoke_lyric.trim() || null
      : null;
  const trivia = payload.trivia === true;
  const triviaQuestion =
    trivia && typeof payload.trivia_question === "string"
      ? payload.trivia_question.trim() || null
      : null;
  const triviaAnswer =
    trivia && typeof payload.trivia_answer === "string"
      ? payload.trivia_answer.trim() || null
      : null;

  return {
    artist: trimmedArtist,
    title: trimmedTitle,
    youtube_url: trimmedYoutube,
    year: numericYear,
    play_start_seconds: playStartSeconds,
    tags,
    isspanish: isSpanishTagSelected(tags),
    mimica: payload.mimica === true,
    tararear: payload.tararear === true,
    karaoke,
    karaoke_pause_seconds: karaokePauseSeconds,
    karaoke_lyric: karaokeLyric,
    trivia,
    trivia_question: triviaQuestion,
    trivia_answer: triviaAnswer,
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
  tags,
  catalogStatus,
  specialMode,
  sortBy = "id",
  sortDirection = "asc",
}: {
  page: number;
  pageSize: number;
  search?: string;
  year?: number | null;
  tags?: string[];
  catalogStatus?: "all" | "pending" | "approved";
  specialMode?: "all" | "mimica" | "tararear" | "karaoke" | "trivia";
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
  const normalizedTags = normalizeSongTags(tags ?? []);
  if (normalizedTags.length) {
    params.set("tags", normalizedTags.join(","));
  }
  if (catalogStatus === "pending" || catalogStatus === "approved") {
    params.set("catalogStatus", catalogStatus);
  }
  if (
    specialMode === "mimica" ||
    specialMode === "tararear" ||
    specialMode === "karaoke" ||
    specialMode === "trivia"
  ) {
    params.set("specialMode", specialMode);
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

export async function createSong(
  payload: SongInput,
  options?: { youtubeValidation?: SongYoutubeValidationPayload | null }
): Promise<Song> {
  const sanitized = sanitizeInput(payload);
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/songs`, {
    method: "POST",
    body: JSON.stringify({
      ...sanitized,
      youtubeValidation: options?.youtubeValidation ?? null,
    }),
  });
  return normalizeSong(data);
}

export async function findSongDuplicates(
  payload: SongInput,
  options?: { excludeId?: number | null }
): Promise<SongDuplicateMatch[]> {
  const sanitized = sanitizeInput(payload);
  const data = await fetchJson<{ matches: Record<string, unknown>[] }>(
    `${API_BASE}/songs/check-duplicates`,
    {
      method: "POST",
      body: JSON.stringify({
        ...sanitized,
        excludeId: options?.excludeId ?? null,
      }),
    }
  );

  return data.matches.map((item) => ({
    ...normalizeSong(item),
    similarity:
      typeof item.similarity === "number" && Number.isFinite(item.similarity)
        ? item.similarity
        : 0,
    matchLabel: item.matchLabel === "high" ? "high" : "medium",
    reason: String(item.reason ?? ""),
  }));
}

export async function updateSong(
  id: number,
  payload: SongInput,
  options?: { youtubeValidation?: SongYoutubeValidationPayload | null }
): Promise<Song> {
  const sanitized = sanitizeInput(payload);
  const data = await fetchJson<Record<string, unknown>>(
    `${API_BASE}/songs/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        ...sanitized,
        youtubeValidation: options?.youtubeValidation ?? null,
      }),
    }
  );
  return normalizeSong(data);
}

export async function updateSongYoutubeValidation(
  id: number,
  payload: SongYoutubeValidationPayload
): Promise<Song> {
  const data = await fetchJson<Record<string, unknown>>(
    `${API_BASE}/songs/${id}/youtube-validation`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
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

export async function approveSong(id: number): Promise<Song> {
  const data = await fetchJson<Record<string, unknown>>(
    `${API_BASE}/songs/${id}/approve`,
    { method: "POST" }
  );
  return normalizeSong(data);
}

export async function bulkApproveSongs(songIds: number[]): Promise<number> {
  const data = await fetchJson<{ count: number }>(`${API_BASE}/songs/bulk-approve`, {
    method: "POST",
    body: JSON.stringify({ songIds }),
  });
  return typeof data.count === "number" ? data.count : 0;
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
    const tagMap = new Map<string, number>();
    const toSongEntries = (filteredSongs: Song[]) =>
      filteredSongs
        .map((song) => ({
          label: `${song.artist.trim() || "Sin artista"} - ${
            song.title.trim() || "Sin canción"
          }`,
          count: 1,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
        .slice(0, STAT_LIMIT);

    collection.forEach((song) => {
      const artistKey = song.artist.trim() || "Sin artista";
      artistMap.set(artistKey, (artistMap.get(artistKey) ?? 0) + 1);
      song.tags.forEach((tag) => {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      });

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

    const tagsMostCommon = Array.from(tagMap.entries())
      .map(([tag, count]) => ({
        label: tag,
        count,
      }))
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
      mimicaCount: collection.filter((song) => song.mimica).length,
      tararearCount: collection.filter((song) => song.tararear).length,
      karaokeCount: collection.filter((song) => song.karaoke).length,
      triviaCount: collection.filter((song) => song.trivia).length,
      yearsMostCommon,
      yearsLeastCommon,
      decadesLeastCommon,
      artistsMostCommon,
      tagsMostCommon,
      mimicaSongs: toSongEntries(collection.filter((song) => song.mimica)),
      tararearSongs: toSongEntries(collection.filter((song) => song.tararear)),
      karaokeSongs: toSongEntries(collection.filter((song) => song.karaoke)),
      triviaSongs: toSongEntries(collection.filter((song) => song.trivia)),
    };
  };

  const overallStats = computeStats(songs);
  const spanishStats = computeStats(
    songs.filter((song) => song.tags.includes("espanol"))
  );

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
