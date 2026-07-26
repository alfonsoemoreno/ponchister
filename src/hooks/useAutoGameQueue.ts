import { useCallback, useRef, useState } from "react";
import { getSongArtistKey } from "../lib/autoGameQueue";
import {
  forgetRecentSongIds,
  loadRecentSongIds,
  rememberRecentSongIds,
} from "../lib/recentSongsHistory";
import type { Song } from "../types";

export type QueueStatus = "idle" | "loading" | "ready" | "exhausted" | "error";

export interface AutoGameQueueOptions {
  fetchSongs: (options: {
    excludedSongIds: number[];
    excludedArtistKeys: string[];
    recentSongIds: number[];
  }) => Promise<{ songs: Song[]; resetRecentHistory: boolean }>;
}

export interface AutoGameQueueApi {
  status: QueueStatus;
  error: string | null;
  currentSong: Song | null;
  hasMoreSongs: boolean;
  queueSize: number;
  startQueue: () => Promise<boolean>;
  advanceQueue: () => Promise<void>;
  resetQueue: () => void;
}

export function useAutoGameQueue({
  fetchSongs,
}: AutoGameQueueOptions): AutoGameQueueApi {
  const [status, setStatus] = useState<QueueStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const queueRef = useRef<Song[]>([]);
  const queueIndexRef = useRef(0);
  const seenSongIdsRef = useRef<Set<number>>(new Set());
  const seenArtistKeysRef = useRef<Set<string>>(new Set());

  const selectNextSong = useCallback((): Song | null => {
    const queue = queueRef.current;
    const seen = seenSongIdsRef.current;

    while (queueIndexRef.current < queue.length) {
      const candidate = queue[queueIndexRef.current];
      queueIndexRef.current += 1;
      if (!seen.has(candidate.id)) {
        return candidate;
      }
    }

    return null;
  }, []);

  const loadNextBatch = useCallback(async (): Promise<boolean> => {
    const recentSongIds = loadRecentSongIds();
    const result = await fetchSongs({
      excludedSongIds: Array.from(seenSongIdsRef.current),
      excludedArtistKeys: Array.from(seenArtistKeysRef.current),
      recentSongIds,
    });

    if (result.resetRecentHistory) {
      forgetRecentSongIds(recentSongIds);
    }

    queueRef.current = result.songs;
    queueIndexRef.current = 0;
    return result.songs.length > 0;
  }, [fetchSongs]);

  const startQueue = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setCurrentSong(null);
    seenSongIdsRef.current.clear();
    seenArtistKeysRef.current.clear();
    queueRef.current = [];
    queueIndexRef.current = 0;

    try {
      const hasSongs = await loadNextBatch();
      if (!hasSongs) {
        throw new Error(
          "No hay canciones reproducibles disponibles en la base de datos."
        );
      }

      const nextSong = selectNextSong();

      if (!nextSong) {
        throw new Error(
          "No se encontraron canciones para iniciar la partida automática."
        );
      }

      seenSongIdsRef.current.add(nextSong.id);
      seenArtistKeysRef.current.add(getSongArtistKey(nextSong.artist));
      rememberRecentSongIds([nextSong.id]);
      setCurrentSong(nextSong);
      setStatus("ready");
      console.info(
        `[queue] songId=${nextSong.id} action=start position=1 total=${queueRef.current.length}`
      );
      return true;
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo preparar la partida automática.";
      setError(message);
      setStatus("error");
      return false;
    }
  }, [loadNextBatch, selectNextSong]);

  const advanceQueue = useCallback(async () => {
    let nextSong = selectNextSong();

    if (!nextSong) {
      try {
        const hasSongs = await loadNextBatch();
        nextSong = hasSongs ? selectNextSong() : null;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar el siguiente grupo de canciones.";
        setStatus("error");
        setCurrentSong(null);
        setError(message);
        return;
      }
    }

    if (!nextSong) {
      setStatus("exhausted");
      setCurrentSong(null);
      setError(
        "Ya escuchaste todas las canciones disponibles en esta partida. Reinicia para volver a jugar."
      );
      return;
    }

    seenSongIdsRef.current.add(nextSong.id);
    seenArtistKeysRef.current.add(getSongArtistKey(nextSong.artist));
    rememberRecentSongIds([nextSong.id]);
    setCurrentSong(nextSong);
    setStatus("ready");
    console.info(
      `[queue] songId=${nextSong.id} action=advance position=${queueIndexRef.current} total=${queueRef.current.length}`
    );
  }, [loadNextBatch, selectNextSong]);

  const resetQueue = useCallback(() => {
    queueRef.current = [];
    queueIndexRef.current = 0;
    seenSongIdsRef.current.clear();
    seenArtistKeysRef.current.clear();
    setCurrentSong(null);
    setError(null);
    setStatus("idle");
    console.info("[queue] action=reset");
  }, []);

  const hasMoreSongs =
    queueRef.current.length > 0 &&
    queueIndexRef.current < queueRef.current.length;

  return {
    status,
    error,
    currentSong,
    hasMoreSongs,
    queueSize: queueRef.current.length,
    startQueue,
    advanceQueue,
    resetQueue,
  };
}
