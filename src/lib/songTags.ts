export type SongTag = string;
export type SongTagMatchMode = "any" | "all";

export const MIMICA_SONG_TAG: SongTag = "mimica";
export const TARAREO_SONG_TAG: SongTag = "tarareo";

export interface SongTagDefinition {
  id: number;
  slug: SongTag;
  label: string;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export const DEFAULT_SONG_TAG_DEFINITIONS: SongTagDefinition[] = [
  { id: 1, slug: "espanol", label: "Español", active: true },
  { id: 2, slug: "ingles", label: "Inglés", active: true },
  { id: 3, slug: "instrumental", label: "Instrumental", active: true },
  { id: 4, slug: "musica_clasica", label: "Música clásica", active: true },
  { id: 5, slug: "tropical", label: "Tropical", active: true },
  { id: 6, slug: "dance", label: "Dance", active: true },
  { id: 7, slug: "rock", label: "Rock", active: true },
  { id: 8, slug: "pop", label: "Pop", active: true },
  { id: 9, slug: MIMICA_SONG_TAG, label: "Mímica", active: true },
  { id: 10, slug: TARAREO_SONG_TAG, label: "Tarareo", active: true },
] as const;

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

export function slugifySongTag(value: string): SongTag {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTagValue(value: string): SongTag | null {
  const normalized = slugifySongTag(value);
  if (!normalized) return null;

  const aliasMap: Record<string, SongTag> = {
    esp: "espanol",
    es: "espanol",
    spanish: "espanol",
    english: "ingles",
    en: "ingles",
    clasica: "musica_clasica",
    musicaclasica: "musica_clasica",
    classical: "musica_clasica",
  };

  return aliasMap[normalized] ?? normalized;
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

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export function syncSongModeTags(
  rawTags: readonly string[],
  options: {
    mimica?: boolean;
    tararear?: boolean;
  }
): SongTag[] {
  const unique = new Set(normalizeSongTags(rawTags));

  if (options.mimica) {
    unique.add(MIMICA_SONG_TAG);
  } else {
    unique.delete(MIMICA_SONG_TAG);
  }

  if (options.tararear) {
    unique.add(TARAREO_SONG_TAG);
  } else {
    unique.delete(TARAREO_SONG_TAG);
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export function mergeSongTagDefinitions(
  definitions: readonly SongTagDefinition[]
): SongTagDefinition[] {
  const merged = new Map<SongTag, SongTagDefinition>();

  DEFAULT_SONG_TAG_DEFINITIONS.forEach((definition) => {
    merged.set(definition.slug, definition);
  });

  definitions.forEach((definition) => {
    merged.set(definition.slug, definition);
  });

  return Array.from(merged.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es")
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

export function songMatchesAnyTag(
  songTags: readonly string[],
  selectedTags: readonly string[]
): boolean {
  if (!selectedTags.length) return true;
  return selectedTags.some((tag) => songTags.includes(tag));
}

export function songMatchesSelectedTags(
  songTags: readonly string[],
  selectedTags: readonly string[],
  mode: SongTagMatchMode
): boolean {
  return mode === "all"
    ? songMatchesAllTags(songTags, selectedTags)
    : songMatchesAnyTag(songTags, selectedTags);
}

export function getSongTagLabel(
  tag: string,
  definitions: readonly SongTagDefinition[] = DEFAULT_SONG_TAG_DEFINITIONS
): string {
  const match = definitions.find((entry) => entry.slug === tag);
  if (match) return match.label;

  return tag
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatSongTags(
  tags: readonly string[],
  definitions: readonly SongTagDefinition[] = DEFAULT_SONG_TAG_DEFINITIONS
): string {
  if (!tags.length) return "Sin etiquetas";
  return tags.map((tag) => getSongTagLabel(tag, definitions)).join(", ");
}
