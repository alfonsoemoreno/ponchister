import type { Song, SongInput, SongYoutubeValidationPayload } from "../types";
import {
  isSpanishTagSelected,
  normalizeSongTags,
  syncSongModeTags,
} from "../../lib/songTags";

const API_BASE = "/api/admin/my-songs";

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
    isspanish: isSpanishTagSelected(tags),
    mimica: raw.mimica === true,
    tararear: raw.tararear === true,
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
      typeof raw.youtube_validated_at === "string" ? raw.youtube_validated_at : null,
    catalog_status: "approved",
    scope: "personal",
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    approved_at: typeof raw.approved_at === "string" ? raw.approved_at : null,
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
    created_by_user:
      raw.created_by_user && typeof raw.created_by_user === "object"
        ? (raw.created_by_user as Song["created_by_user"])
        : null,
    approved_by_user: null,
  };
}

function sanitizeInput(payload: SongInput): SongInput {
  const tags = syncSongModeTags(
    normalizeSongTags(payload.tags, payload.isspanish),
    {
      mimica: payload.mimica === true,
      tararear: payload.tararear === true,
    }
  );
  return {
    artist: payload.artist.trim(),
    title: payload.title.trim(),
    youtube_url: payload.youtube_url.trim(),
    year:
      typeof payload.year === "number" && Number.isFinite(payload.year)
        ? payload.year
        : null,
    play_start_seconds:
      typeof payload.play_start_seconds === "number" &&
      Number.isFinite(payload.play_start_seconds)
        ? Math.max(0, Math.trunc(payload.play_start_seconds))
        : 0,
    tags,
    isspanish: isSpanishTagSelected(tags),
    mimica: payload.mimica === true,
    tararear: payload.tararear === true,
    karaoke: payload.karaoke === true,
    karaoke_pause_seconds:
      payload.karaoke === true &&
      typeof payload.karaoke_pause_seconds === "number" &&
      Number.isFinite(payload.karaoke_pause_seconds)
        ? Math.max(0, Math.trunc(payload.karaoke_pause_seconds))
        : 0,
    karaoke_lyric:
      payload.karaoke === true && typeof payload.karaoke_lyric === "string"
        ? payload.karaoke_lyric.trim() || null
        : null,
    trivia: payload.trivia === true,
    trivia_question:
      payload.trivia === true && typeof payload.trivia_question === "string"
        ? payload.trivia_question.trim() || null
        : null,
    trivia_answer:
      payload.trivia === true && typeof payload.trivia_answer === "string"
        ? payload.trivia_answer.trim() || null
        : null,
  };
}

export async function listMySongs(): Promise<Song[]> {
  const data = await fetchJson<Record<string, unknown>[]>(API_BASE);
  return data.map(normalizeSong);
}

export async function createMySong(
  payload: SongInput,
  options?: { youtubeValidation?: SongYoutubeValidationPayload | null }
): Promise<Song> {
  const data = await fetchJson<Record<string, unknown>>(API_BASE, {
    method: "POST",
    body: JSON.stringify({
      ...sanitizeInput(payload),
      youtubeValidation: options?.youtubeValidation ?? null,
    }),
  });
  return normalizeSong(data);
}

export async function updateMySong(
  id: number,
  payload: SongInput,
  options?: { youtubeValidation?: SongYoutubeValidationPayload | null }
): Promise<void> {
  await fetchJson(`${API_BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...sanitizeInput(payload),
      youtubeValidation: options?.youtubeValidation ?? null,
    }),
  });
}

export async function updateMySongYoutubeValidation(
  id: number,
  payload: SongYoutubeValidationPayload
): Promise<Song> {
  const data = await fetchJson<Record<string, unknown>>(
    `${API_BASE}/${id}/youtube-validation`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
  return normalizeSong(data);
}

export async function deleteMySong(id: number): Promise<void> {
  await fetchJson(`${API_BASE}/${id}`, { method: "DELETE" });
}

export async function copyPublicSongToMyCollection(songId: number): Promise<void> {
  await fetchJson(`${API_BASE}/copy-public`, {
    method: "POST",
    body: JSON.stringify({ songId }),
  });
}

export async function submitMySongToPublic(songId: number): Promise<void> {
  await fetchJson(`${API_BASE}/${songId}/submit-public`, {
    method: "POST",
  });
}
