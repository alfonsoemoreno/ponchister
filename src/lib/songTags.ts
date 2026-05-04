export const SONG_TAG_OPTIONS = [
  { value: "espanol", label: "Español" },
  { value: "ingles", label: "Inglés" },
  { value: "instrumental", label: "Instrumental" },
  { value: "musica_clasica", label: "Música clásica" },
  { value: "tropical", label: "Tropical" },
  { value: "dance", label: "Dance" },
  { value: "rock", label: "Rock" },
  { value: "pop", label: "Pop" },
] as const;

export type SongTag = (typeof SONG_TAG_OPTIONS)[number]["value"];

const SONG_TAG_VALUES = new Set<string>(
  SONG_TAG_OPTIONS.map((option) => option.value)
);

const SONG_TAG_LABEL_MAP = new Map<string, string>(
  SONG_TAG_OPTIONS.map((option) => [option.value, option.label])
);

function parseBooleanLike(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;

  return ["1", "true", "t", "yes", "si", "sí", "es"].includes(
    value.trim().toLowerCase()
  );
}

function splitTagString(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      /* noop */
    }
  }

  return trimmed
    .split(/[;,|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTagValue(value: string): SongTag | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return null;

  const aliasMap: Record<string, SongTag> = {
    espanol: "espanol",
    esp: "espanol",
    es: "espanol",
    spanish: "espanol",
    ingles: "ingles",
    english: "ingles",
    en: "ingles",
    instrumental: "instrumental",
    clasica: "musica_clasica",
    musica_clasica: "musica_clasica",
    musicaclasica: "musica_clasica",
    classical: "musica_clasica",
    tropical: "tropical",
    dance: "dance",
    rock: "rock",
    pop: "pop",
  };

  const candidate = aliasMap[normalized] ?? normalized;
  return SONG_TAG_VALUES.has(candidate) ? (candidate as SongTag) : null;
}

export function normalizeSongTags(
  rawTags: unknown,
  legacySpanishFlag?: unknown
): SongTag[] {
  const source = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
    ? splitTagString(rawTags)
    : [];

  const unique = new Set<SongTag>();
  source.forEach((entry) => {
    if (typeof entry !== "string") return;
    const normalized = normalizeTagValue(entry);
    if (normalized) {
      unique.add(normalized);
    }
  });

  if (parseBooleanLike(legacySpanishFlag)) {
    unique.add("espanol");
  }

  return SONG_TAG_OPTIONS.map((option) => option.value).filter((value) =>
    unique.has(value)
  );
}

export function isSpanishTagSelected(tags: readonly string[]): boolean {
  return tags.includes("espanol");
}

export function songMatchesAllTags(
  songTags: readonly string[],
  selectedTags: readonly string[]
): boolean {
  if (!selectedTags.length) return true;
  return selectedTags.every((tag) => songTags.includes(tag));
}

export function getSongTagLabel(tag: string): string {
  return SONG_TAG_LABEL_MAP.get(tag) ?? tag;
}

export function formatSongTags(tags: readonly string[]): string {
  if (!tags.length) return "Sin etiquetas";
  return tags.map((tag) => getSongTagLabel(tag)).join(", ");
}
