const RECENT_SONG_HISTORY_KEY = "ponchister_recent_song_ids_v1";

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

export function loadRecentSongIds(): number[] {
  if (!isBrowserReady()) return [];

  try {
    const raw = window.localStorage.getItem(RECENT_SONG_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeIds(parsed);
  } catch {
    return [];
  }
}

export function rememberRecentSongIds(songIds: number[]): void {
  if (!isBrowserReady() || !songIds.length) return;

  try {
    const existing = loadRecentSongIds();
    const merged = normalizeIds([...songIds, ...existing]);
    window.localStorage.setItem(
      RECENT_SONG_HISTORY_KEY,
      JSON.stringify(merged)
    );
  } catch {
    // Fallback: if writing fails we silently ignore so the game can proceed.
  }
}

export function forgetRecentSongIds(songIds: Iterable<number>): void {
  if (!isBrowserReady()) return;

  const idsToForget = new Set(normalizeIds(Array.from(songIds)));
  if (!idsToForget.size) return;

  try {
    const remaining = loadRecentSongIds().filter((id) => !idsToForget.has(id));
    window.localStorage.setItem(
      RECENT_SONG_HISTORY_KEY,
      JSON.stringify(remaining)
    );
  } catch {
    // Fallback: if writing fails we silently ignore so the game can proceed.
  }
}
