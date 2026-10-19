export const MIN_SONG_YEAR = 1000;

export function isValidSongYear(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_SONG_YEAR &&
    value <= new Date().getFullYear()
  );
}

export function parseSongYear(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !isValidSongYear(value)) return undefined;
  return value;
}
