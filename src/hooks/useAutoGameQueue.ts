import { useCallback, useRef, useState } from "react";
import { buildBalancedQueue, dedupePlayableSongs } from "../lib/autoGameQueue";
import {
  loadRecentSongIds,
  rememberRecentSongIds,
} from "../lib/recentSongsHistory";
import type { Song } from "../types";

export type QueueStatus = "idle" | "loading" | "ready" | "exhausted" | "error";

export interface AutoGameQueueOptions {
  fetchSongs: () => Promise<Song[]>;
}

export interface AutoGameQueueApi {
  status: QueueStatus;
  error: string | null;
  currentSong: Song | null;
  hasMoreSongs: boolean;
  queueSize: number;
  startQueue: () => Promise<void>;
  advanceQueue: () => void;
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

  const startQueue = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setCurrentSong(null);
    seenSongIdsRef.current.clear();
    queueRef.current = [];
    queueIndexRef.current = 0;

    try {
      const songs = await fetchSongs();
      const recentSongIds = loadRecentSongIds();
      const playableSongs = buildBalancedQueue(dedupePlayableSongs(songs), {
        recentSongIds,
      });

      if (!playableSongs.length) {
        throw new Error(
          "No hay canciones reproducibles disponibles en la base de datos."
        );
      }

      queueRef.current = playableSongs;
      queueIndexRef.current = 0;

      const nextSong = selectNextSong();

      if (!nextSong) {
        throw new Error(
          "No se encontraron canciones para iniciar la partida automática."
        );
      }

      seenSongIdsRef.current.add(nextSong.id);
      rememberRecentSongIds([nextSong.id]);
      setCurrentSong(nextSong);
      setStatus("ready");
      console.info(
        `[queue] songId=${nextSong.id} action=start position=1 total=${playableSongs.length}`
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo preparar la partida automática.";
      setError(message);
      setStatus("error");
    }
  }, [fetchSongs, selectNextSong]);

  const advanceQueue = useCallback(() => {
    if (!queueRef.current.length) {
      setStatus("exhausted");
      setCurrentSong(null);
      setError(
        "Ya escuchaste todas las canciones disponibles en esta partida. Reinicia para volver a jugar."
      );
      return;
    }

    const nextSong = selectNextSong();

    if (!nextSong) {
      setStatus("exhausted");
      setCurrentSong(null);
      setError(
        "Ya escuchaste todas las canciones disponibles en esta partida. Reinicia para volver a jugar."
      );
      return;
    }

    seenSongIdsRef.current.add(nextSong.id);
    rememberRecentSongIds([nextSong.id]);
    setCurrentSong(nextSong);
    setStatus("ready");
    console.info(
      `[queue] songId=${nextSong.id} action=advance position=${queueIndexRef.current} total=${queueRef.current.length}`
    );
  }, [selectNextSong]);

  const resetQueue = useCallback(() => {
    queueRef.current = [];
    queueIndexRef.current = 0;
    seenSongIdsRef.current.clear();
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
