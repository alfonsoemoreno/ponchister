import { useCallback, useEffect, useState } from "react";
import { selectBestArtworkCandidate } from "../lib/artwork";
import type { Song } from "../types";

export interface ArtworkLookupOptions {
  fetcher?: typeof fetch;
}

export interface ArtworkLookupState {
  artworkUrl: string | null;
  loading: boolean;
  error: string | null;
  confidenceScore: number | null;
  refetch: () => void;
}

const DEFAULT_ERROR_MESSAGE = "No se pudo cargar la portada de la canción.";

export function useArtworkLookup(
  song: Song | null,
  { fetcher = fetch }: ArtworkLookupOptions = {}
): ArtworkLookupState {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const refetch = useCallback(() => {
    setRetryToken((token) => token + 1);
    setArtworkUrl(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!song) {
      setArtworkUrl(null);
      setLoading(false);
      setError(null);
      setConfidenceScore(null);
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setArtworkUrl(null);
        setConfidenceScore(null);

        console.info(`[artwork] songId=${song.id} status=request`);
        const { selected, candidates } = await selectBestArtworkCandidate(
          song,
          fetcher,
          abortController.signal
        );

        if (cancelled || abortController.signal.aborted) {
          return;
        }

        if (selected) {
          setArtworkUrl(selected.url);
          setConfidenceScore(selected.score);
          setError(null);
          console.info(
            `[artwork] songId=${song.id} status=success url=${
              selected.url
            } score=${selected.score.toFixed(2)} candidates=${
              candidates.length
            }`
          );
        } else {
          setArtworkUrl(null);
          setError(
            "No encontramos una portada que coincidiera bien con la canción."
          );
          console.info(
            `[artwork] songId=${song.id} status=unmatched candidates=${candidates.length}`
          );
        }
      } catch (caught) {
        if (cancelled || abortController.signal.aborted) {
          return;
        }
        const message =
          caught instanceof Error ? caught.message : DEFAULT_ERROR_MESSAGE;
        setError(message);
        setArtworkUrl(null);
        setConfidenceScore(null);
        console.error(
          `[artwork] songId=${song.id} status=error message="${message}"`
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [song, fetcher, retryToken]);

  return { artworkUrl, loading, error, confidenceScore, refetch };
}
