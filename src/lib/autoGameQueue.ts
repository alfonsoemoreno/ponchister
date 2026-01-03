import type { Song } from "../types";

const UNKNOWN_YEAR_KEY = "__unknown_year__";
const YEAR_SOFT_USAGE_LIMIT = 3;

export function extractYoutubeId(url: string): string | null {
  const regExp =
    /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1]?.length === 11 ? match[1] : null;
}

export function shuffleSongs<T>(entries: T[]): T[] {
  const copy = [...entries];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function songYearKey(song: Song): string {
  return typeof song.year === "number" ? String(song.year) : UNKNOWN_YEAR_KEY;
}

type YearBucket = {
  fresh: Song[];
  stale: Song[];
};

type BalancedQueueOptions = {
  recentSongIds?: Iterable<number>;
};

export function buildBalancedQueue(
  songs: Song[],
  options?: BalancedQueueOptions
): Song[] {
  if (!songs.length) {
    return [];
  }

  const recentIds = new Set(options?.recentSongIds ?? []);
  const buckets = new Map<string, YearBucket>();

  songs.forEach((song) => {
    const key = songYearKey(song);
    const existing = buckets.get(key) ?? { fresh: [], stale: [] };
    if (recentIds.has(song.id)) {
      existing.stale.push(song);
    } else {
      existing.fresh.push(song);
    }
    buckets.set(key, existing);
  });

  buckets.forEach((bucket, key) => {
    const shuffledFresh = shuffleSongs(bucket.fresh);
    const shuffledStale = shuffleSongs(bucket.stale);
    // pop() prioriza la pila "fresh" para agotar primero los temas que no
    // aparecieron en partidas recientes, y sólo después recurre a los "stale".
    buckets.set(key, { fresh: shuffledFresh, stale: shuffledStale });
  });

  const usage = new Map<string, number>();
  const queue: Song[] = [];
  const total = songs.length;

  while (queue.length < total) {
    const activeEntries = Array.from(buckets.entries()).filter(
      ([, bucket]) => bucket.fresh.length + bucket.stale.length > 0
    );

    if (!activeEntries.length) {
      break;
    }

    const prioritizedEntries = activeEntries.filter(
      ([, bucket]) => bucket.fresh.length > 0
    );
    const selectionEntries = prioritizedEntries.length
      ? prioritizedEntries
      : activeEntries;

    const usageEntries = selectionEntries.map(([yearKey]) => ({
      yearKey,
      usage: usage.get(yearKey) ?? 0,
    }));

    const underLimit = usageEntries.filter(
      ({ usage: count }) => count < YEAR_SOFT_USAGE_LIMIT
    );
    const minUsage = Math.min(...usageEntries.map(({ usage: count }) => count));
    const baseline = usageEntries.filter(
      ({ usage: count }) => count === minUsage
    );

    const candidatePool = underLimit.length ? underLimit : baseline;
    const selected =
      candidatePool[Math.floor(Math.random() * candidatePool.length)];

    const selectedBucket = buckets.get(selected.yearKey);
    if (!selectedBucket) {
      usage.set(selected.yearKey, selected.usage);
      continue;
    }

    const song =
      selectedBucket.fresh.pop() ??
      selectedBucket.stale.pop() ??
      undefined;
    if (!song) {
      usage.set(selected.yearKey, selected.usage);
      continue;
    }

    queue.push(song);
    usage.set(selected.yearKey, selected.usage + 1);
  }

  return queue;
}

export function dedupePlayableSongs(songs: Song[]): Song[] {
  const uniquePlayable = new Map<string, Song>();

  songs.forEach((song) => {
    const trimmedUrl = song.youtube_url.trim();
    const videoKey = extractYoutubeId(trimmedUrl);

    if (!videoKey) {
      console.info(
        `[queue] songId=${song.id} status=skipped reason=invalid_video`
      );
      return;
    }

    if (!uniquePlayable.has(videoKey)) {
      uniquePlayable.set(videoKey, song);
    }
  });

  return shuffleSongs(Array.from(uniquePlayable.values()));
}
