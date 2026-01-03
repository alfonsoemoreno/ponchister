const RECENT_SONG_HISTORY_KEY = "ponchister_recent_song_ids_v1";
export const RECENT_SONG_HISTORY_LIMIT = 120;

function isBrowserReady(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeIds(candidates: unknown[]): number[] {
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const value of candidates) {
    const parsed =
      typeof value === "number"
        ? Math.trunc(value)
        : Number.parseInt(String(value), 10);

    if (!Number.isFinite(parsed) || parsed <= 0 || seen.has(parsed)) {
      continue;
    }

    seen.add(parsed);
    normalized.push(parsed);
  }

  return normalized;
}

export function loadRecentSongIds(
  options?: Partial<{ limit: number }>
): number[] {
  if (!isBrowserReady()) return [];

  const limit =
    typeof options?.limit === "number" && options.limit > 0
      ? Math.trunc(options.limit)
      : RECENT_SONG_HISTORY_LIMIT;

  try {
    const raw = window.localStorage.getItem(RECENT_SONG_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = normalizeIds(parsed);
    return normalized.slice(0, limit);
  } catch {
    return [];
  }
}

export function rememberRecentSongIds(
  songIds: number[],
  options?: Partial<{ limit: number }>
): void {
  if (!isBrowserReady() || !songIds.length) return;

  const limit =
    typeof options?.limit === "number" && options.limit > 0
      ? Math.trunc(options.limit)
      : RECENT_SONG_HISTORY_LIMIT;

  try {
    const existing = loadRecentSongIds({ limit });
    const merged = normalizeIds([...songIds, ...existing]).slice(0, limit);
    window.localStorage.setItem(
      RECENT_SONG_HISTORY_KEY,
      JSON.stringify(merged)
    );
  } catch {
    // Fallback: if writing fails we silently ignore so the game can proceed.
  }
}
