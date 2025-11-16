import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/system";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { fetchAllSongs } from "./services/songService";
import type { Song } from "./types";

interface InternalPlayer {
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
  setPlaybackRate?: (rate: number) => void;
  setPlaybackQuality?: (suggestedQuality: string) => void;
}

interface AutoGameProps {
  onExit: () => void;
}

type GameState = "idle" | "loading" | "playing" | "revealed" | "error";

type PlayerRef = YouTube | null;

function extractYoutubeId(url: string): string | null {
  const regExp =
    /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1]?.length === 11 ? match[1] : null;
}

function shuffleSongs<T>(entries: T[]): T[] {
  const copy = [...entries];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

const UNKNOWN_YEAR_KEY = "__unknown_year__";
const YEAR_SOFT_USAGE_LIMIT = 3;

function songYearKey(song: Song): string {
  return typeof song.year === "number" ? String(song.year) : UNKNOWN_YEAR_KEY;
}

function buildBalancedQueue(songs: Song[]): Song[] {
  if (!songs.length) {
    return [];
  }

  const buckets = new Map<string, Song[]>();

  songs.forEach((song) => {
    const key = songYearKey(song);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(song);
    } else {
      buckets.set(key, [song]);
    }
  });

  buckets.forEach((bucket, key) => {
    buckets.set(key, shuffleSongs(bucket));
  });

  const usage = new Map<string, number>();
  const queue: Song[] = [];
  const total = songs.length;

  while (queue.length < total) {
    const activeEntries = Array.from(buckets.entries()).filter(
      ([, bucket]) => bucket.length > 0
    );

    if (!activeEntries.length) {
      break;
    }

    const usageEntries = activeEntries.map(([yearKey]) => ({
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
    if (!selectedBucket || !selectedBucket.length) {
      usage.set(selected.yearKey, selected.usage);
      continue;
    }

    const song = selectedBucket.pop();
    if (!song) {
      usage.set(selected.yearKey, selected.usage);
      continue;
    }

    queue.push(song);
    usage.set(selected.yearKey, selected.usage + 1);
  }

  return queue;
}

async function preloadImage(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    image.src = url;
  });
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

const yearSpotlightPulse = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.6);
    filter: blur(18px);
  }
  22% {
    opacity: 1;
    transform: scale(0.95);
    filter: blur(3px);
  }
  55% {
    opacity: 1;
    transform: scale(1.4);
    filter: blur(0px);
  }
  82% {
    opacity: 0.85;
    transform: scale(1.9);
    filter: blur(9px);
  }
  100% {
    opacity: 0;
    transform: scale(2.2);
    filter: blur(18px);
  }
`;

const AutoGame: React.FC<AutoGameProps> = ({ onExit }) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const seenSongIdsRef = useRef<Set<number>>(new Set());
  const songQueueRef = useRef<Song[]>([]);
  const queueIndexRef = useRef(0);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [yearSpotlightVisible, setYearSpotlightVisible] = useState(false);
  const yearSpotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearYearSpotlightTimeout = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      clearTimeout(yearSpotlightTimerRef.current);
      yearSpotlightTimerRef.current = null;
    }
  }, []);

  const triggerYearSpotlight = useCallback(() => {
    clearYearSpotlightTimeout();
    setYearSpotlightVisible(true);
    yearSpotlightTimerRef.current = setTimeout(() => {
      setYearSpotlightVisible(false);
      yearSpotlightTimerRef.current = null;
    }, 3600);
  }, [clearYearSpotlightTimeout]);

  const playerOptions = useMemo<YouTubeProps["opts"]>(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;

    return {
      height: "20",
      width: "40",
      playerVars: {
        autoplay: 0,
        mute: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: 1,
        playsinline: 1,
        origin,
      },
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!currentSong) {
      setArtworkUrl(null);
      setArtworkLoading(false);
      setArtworkError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        setArtworkLoading(true);
        setArtworkError(null);
        setArtworkUrl(null);

        const searchTerms = [
          `${currentSong.artist} ${currentSong.title}`,
          currentSong.artist,
        ];

        const entities = ["album", "musicTrack"] as const;
        const normalizedArtist = normalizeText(currentSong.artist);
        const normalizedTitle = normalizeText(currentSong.title);
        const artistTokens = tokenize(currentSong.artist);
        const titleTokens = tokenize(currentSong.title);

        const evaluateScore = (parts: Array<string | undefined>): number => {
          const validParts = parts.filter((value): value is string =>
            Boolean(value && value.trim())
          );

          if (!validParts.length) {
            return 0;
          }

          const tokenPool = new Set<string>();
          const normalizedParts = validParts.map((part) => {
            const tokens = tokenize(part);
            tokens.forEach((token) => tokenPool.add(token));
            return normalizeText(part);
          });

          let score = 0;

          const artistMatches = artistTokens.filter((token) =>
            tokenPool.has(token)
          );
          const titleMatches = titleTokens.filter((token) =>
            tokenPool.has(token)
          );

          if (artistMatches.length) {
            score += 3 + artistMatches.length * 1.5;
          }
          if (
            artistMatches.length === artistTokens.length &&
            artistTokens.length > 0
          ) {
            score += 2;
          }

          if (titleMatches.length) {
            score += 4 + titleMatches.length * 2;
          }
          if (
            titleMatches.length === titleTokens.length &&
            titleTokens.length
          ) {
            score += 3;
          }

          const combined = normalizedParts.join(" ");
          if (normalizedArtist && combined.includes(normalizedArtist)) {
            score += 2;
          }
          if (normalizedTitle && combined.includes(normalizedTitle)) {
            score += 2;
          }

          return score;
        };

        const candidateMap = new Map<
          string,
          { url: string; score: number; source: string }
        >();

        for (const term of searchTerms) {
          const encodedTerm = encodeURIComponent(term);
          for (const entity of entities) {
            const endpoint = `https://itunes.apple.com/search?term=${encodedTerm}&entity=${entity}&limit=5`;
            const response = await fetch(endpoint, {
              signal: controller.signal,
            });

            if (!response.ok) {
              continue;
            }

            const payload: {
              results?: Array<{
                artworkUrl100?: string;
                artistName?: string;
                trackName?: string;
                collectionName?: string;
                collectionCensoredName?: string;
                collectionArtistName?: string;
              }>;
            } = await response.json();

            (payload.results ?? []).forEach((item, index) => {
              if (!item?.artworkUrl100) {
                return;
              }

              const score = evaluateScore([
                item.artistName,
                item.trackName,
                item.collectionName,
                item.collectionCensoredName,
                item.collectionArtistName,
              ]);

              if (score <= 0) {
                return;
              }

              let weightedScore = score;
              if (entity === "album") {
                weightedScore += 1.5;
              }
              if (term === searchTerms[0]) {
                weightedScore += 1;
              }
              if (index === 0) {
                weightedScore += 0.5;
              }

              const highRes = item.artworkUrl100.replace(
                /100x100bb\.jpg$/i,
                "1000x1000bb.jpg"
              );

              const existing = candidateMap.get(highRes);
              if (!existing || weightedScore > existing.score) {
                candidateMap.set(highRes, {
                  url: highRes,
                  score: weightedScore,
                  source: `${entity}-${term}`,
                });
              }
            });
          }
        }

        const candidates = Array.from(candidateMap.values()).sort(
          (a, b) => b.score - a.score
        );

        const MIN_CONFIDENCE_SCORE = titleTokens.length ? 7 : 5.5;

        let selectedArtwork: string | null = null;
        let selectedScore = 0;

        for (const candidate of candidates) {
          try {
            await preloadImage(candidate.url);
            selectedArtwork = candidate.url;
            selectedScore = candidate.score;
            break;
          } catch {
            // Try next candidate if the image fails to load.
          }
        }

        if (!cancelled) {
          if (selectedArtwork && selectedScore >= MIN_CONFIDENCE_SCORE) {
            setArtworkUrl(selectedArtwork);
            setArtworkError(null);
          } else {
            setArtworkUrl(null);
            setArtworkError(
              "No encontramos una portada que coincidiera bien con la canción."
            );
          }
          setArtworkLoading(false);
        }
      } catch (error) {
        if (controller.signal.aborted || cancelled) {
          return;
        }
        setArtworkLoading(false);
        setArtworkUrl(null);
        setArtworkError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la portada de la canción."
        );
      }
    };

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentSong]);

  const videoId = useMemo(
    () => (currentSong ? extractYoutubeId(currentSong.youtube_url) : null),
    [currentSong]
  );

  const stopPlayback = useCallback(() => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (internalPlayer && typeof internalPlayer.stopVideo === "function") {
      internalPlayer.stopVideo();
    }
    setIsPlaying(false);
  }, []);

  const applyPlaybackOptimizations = useCallback(
    (player: InternalPlayer | null) => {
      if (!player) return;
      player.setPlaybackQuality?.("small");
      player.setPlaybackRate?.(1);
    },
    []
  );

  const selectNextSongFromQueue = useCallback((): Song | null => {
    const queue = songQueueRef.current;
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

  const prepareQueueAndStart = useCallback(async () => {
    setErrorMessage(null);
    setGameState("loading");
    setIsPlaying(false);
    stopPlayback();
    setArtworkUrl(null);
    setArtworkError(null);
    clearYearSpotlightTimeout();
    setYearSpotlightVisible(false);

    seenSongIdsRef.current.clear();
    songQueueRef.current = [];
    queueIndexRef.current = 0;

    try {
      const songs = await fetchAllSongs();
      const uniquePlayable = new Map<string, Song>();

      songs.forEach((song: Song) => {
        const trimmedUrl = song.youtube_url.trim();
        const videoKey = extractYoutubeId(trimmedUrl);
        if (!videoKey) {
          return;
        }
        if (!uniquePlayable.has(videoKey)) {
          uniquePlayable.set(videoKey, song);
        }
      });

      const dedupedSongs = shuffleSongs(Array.from(uniquePlayable.values()));
      const playableSongs = buildBalancedQueue(dedupedSongs);

      if (!playableSongs.length) {
        throw new Error(
          "No hay canciones reproducibles disponibles en la base de datos."
        );
      }

      songQueueRef.current = playableSongs;
      queueIndexRef.current = 0;

      const nextSong = selectNextSongFromQueue();

      if (!nextSong) {
        throw new Error(
          "No se encontraron canciones para iniciar la partida automática."
        );
      }

      seenSongIdsRef.current.add(nextSong.id);
      setCurrentSong(nextSong);
      setPlayerKey((prev) => prev + 1);
      setGameState("playing");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la partida automática."
      );
      setGameState("error");
    }
  }, [clearYearSpotlightTimeout, selectNextSongFromQueue, stopPlayback]);

  const loadNextSongFromQueue = useCallback(() => {
    setErrorMessage(null);
    setGameState("loading");
    setIsPlaying(false);
    stopPlayback();
    setArtworkError(null);
    setArtworkUrl(null);
    clearYearSpotlightTimeout();
    setYearSpotlightVisible(false);

    const nextSong = selectNextSongFromQueue();

    if (!nextSong) {
      setErrorMessage(
        "Ya escuchaste todas las canciones disponibles en esta partida. Reinicia para volver a jugar."
      );
      setGameState("error");
      return;
    }

    seenSongIdsRef.current.add(nextSong.id);
    setCurrentSong(nextSong);
    setPlayerKey((prev) => prev + 1);
    setGameState("playing");
  }, [clearYearSpotlightTimeout, selectNextSongFromQueue, stopPlayback]);

  const handleStart = () => {
    prepareQueueAndStart().catch(() => {
      /* handled in prepareQueueAndStart */
    });
  };

  const handleSkip = () => {
    loadNextSongFromQueue();
  };

  const handleReveal = () => {
    setGameState("revealed");
    triggerYearSpotlight();
  };

  const handleNextAfterReveal = () => {
    loadNextSongFromQueue();
  };

  const handlePlayerError = useCallback<
    NonNullable<YouTubeProps["onError"]>
  >(() => {
    setIsPlaying(false);
    loadNextSongFromQueue();
    setErrorMessage(
      "No se pudo reproducir el video de esta canción. Pasamos a otra pista."
    );
  }, [loadNextSongFromQueue]);

  const handleExit = () => {
    const finalizeExit = () => {
      stopPlayback();
      setCurrentSong(null);
      setGameState("idle");
      setErrorMessage(null);
      setArtworkUrl(null);
      setArtworkLoading(false);
      setArtworkError(null);
      clearYearSpotlightTimeout();
      setYearSpotlightVisible(false);
      seenSongIdsRef.current.clear();
      songQueueRef.current = [];
      queueIndexRef.current = 0;
      onExit();
    };

    finalizeExit();
  };

  const handlePlayPause = () => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer) return;

    if (isPlaying) {
      internalPlayer.pauseVideo?.();
    } else {
      applyPlaybackOptimizations(internalPlayer);
      internalPlayer.unMute?.();
      internalPlayer.setVolume?.(100);
      const maybePromise = internalPlayer.playVideo?.();
      if (
        maybePromise &&
        typeof maybePromise === "object" &&
        typeof (maybePromise as Promise<unknown>).catch === "function"
      ) {
        (maybePromise as Promise<unknown>).catch(() => {
          setErrorMessage(
            "El reproductor bloqueó el inicio automático. Toca nuevamente para intentar reproducir."
          );
        });
      }
    }
  };

  const handlePlayerReady: YouTubeProps["onReady"] = (event) => {
    setIsPlaying(false);
    applyPlaybackOptimizations(
      (event.target as unknown as InternalPlayer) ?? null
    );
    event.target.setPlaybackRate?.(1);
    event.target.pauseVideo?.();
    const iframe = event.target.getIframe?.();
    iframe?.setAttribute("allow", "autoplay; clipboard-write");
  };

  const handlePlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    const playerState = event.data;
    if (playerState === 1) {
      applyPlaybackOptimizations(
        (event.target as unknown as InternalPlayer) ?? null
      );
      setIsPlaying(true);
    } else if (playerState === 2 || playerState === 0) {
      setIsPlaying(false);
    }
  };

  useEffect(
    () => () => {
      stopPlayback();
    },
    [stopPlayback]
  );

  useEffect(
    () => () => {
      clearYearSpotlightTimeout();
    },
    [clearYearSpotlightTimeout]
  );

  const renderExperienceView = (mode: "guess" | "reveal") => {
    if (!currentSong) {
      return null;
    }

    const showDetails = mode === "reveal";
    const baseChipLabel = showDetails ? "Ahora suena" : null;
    const secondaryChipLabel = showDetails
      ? typeof currentSong.year === "number"
        ? `Año ${currentSong.year}`
        : "Año desconocido"
      : "¿Qué año crees?";
    const tertiaryChipLabel = showDetails
      ? null
      : "Revela sólo cuando estés listo";

    const heading = showDetails
      ? currentSong.title
      : "¿Puedes adivinar la canción?";
    const subheading = showDetails
      ? currentSong.artist
      : "Escucha, siente y deja que la intuición te guíe.";
    const description = showDetails
      ? "Captura la magia del momento con visuales envolventes inspirados en tu canción. Sigue jugando para descubrir nuevas portadas y atmósferas impactantes."
      : 'Mantén el suspenso: cuando creas tener la respuesta, presiona "Mostrar artista y canción" para confirmar tu apuesta.';

    const statusCaptionLabel = showDetails
      ? "Reproduciendo"
      : "En modo sorpresa";
    const statusCaptionDescription = showDetails
      ? "Usa los controles para pasar o salir de la partida cuando quieras."
      : "Puedes pausar, saltar o revelar en cualquier momento.";

    const primaryAction = showDetails
      ? {
          icon: <SkipNextIcon />,
          label: "Siguiente canción",
          onClick: handleNextAfterReveal,
          variant: "contained" as const,
          color: "primary" as const,
        }
      : {
          icon: <InfoOutlinedIcon />,
          label: "Mostrar artista y canción",
          onClick: handleReveal,
          variant: "contained" as const,
          color: "primary" as const,
        };

    const secondaryAction = showDetails
      ? {
          icon: <ExitToAppIcon />,
          label: "Salir del juego",
          onClick: handleExit,
          variant: "outlined" as const,
          color: "inherit" as const,
        }
      : {
          icon: <SkipNextIcon />,
          label: "Pasar canción",
          onClick: handleSkip,
          variant: "outlined" as const,
          color: "inherit" as const,
        };

    const fallbackTitle = showDetails
      ? "Visual a la espera"
      : "Escenario en preparación";
    const fallbackDescription = artworkLoading
      ? showDetails
        ? "Estamos buscando la portada perfecta…"
        : "Estamos preparando la atmósfera visual…"
      : "Sigue escuchando, pronto llegará la inspiración visual.";

    const displayedArtworkError = artworkError
      ? showDetails
        ? artworkError
        : "No encontramos una portada perfecta, deja volar tu imaginación mientras suena la música."
      : null;
    const fallbackBackdrop =
      "radial-gradient(circle at 30% 20%, rgba(99,213,245,0.28), rgba(9,12,28,0.95))";
    const shouldDisplayArtwork = showDetails && Boolean(artworkUrl);
    const hasNumericYear = typeof currentSong.year === "number";

    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: "auto", md: "100%" },
          minHeight: { xs: 520, md: 640 },
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: shouldDisplayArtwork
              ? `url(${artworkUrl})`
              : fallbackBackdrop,
            backgroundSize: shouldDisplayArtwork ? "cover" : "150% 150%",
            backgroundPosition: shouldDisplayArtwork ? "center" : "50% 50%",
            filter: shouldDisplayArtwork ? "blur(22px)" : "none",
            transform: shouldDisplayArtwork ? "scale(1.12)" : "none",
            opacity: shouldDisplayArtwork ? 0.95 : 1,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(4,8,18,0.92) 0%, rgba(20,44,110,0.86) 52%, rgba(84,164,255,0.62) 100%)",
            backdropFilter: "blur(12px)",
          }}
        />
        {showDetails && yearSpotlightVisible && hasNumericYear ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                width: { xs: "90vw", sm: "78vw", md: "62vw" },
                height: { xs: "90vh", sm: "78vh", md: "62vh" },
                maxWidth: 980,
                maxHeight: 720,
                minWidth: 260,
                minHeight: 260,
                borderRadius: { xs: 6, md: 8 },
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.22), rgba(5,18,52,0.9))",
                boxShadow: "0 52px 120px -34px rgba(2,8,34,0.88)",
                color: "#ffffff",
                textAlign: "center",
                animation: `${yearSpotlightPulse} 3.4s ease-in-out forwards`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  letterSpacing: { xs: 10, sm: 16 },
                  textTransform: "uppercase",
                  opacity: 0.86,
                  fontWeight: 600,
                  fontSize: { xs: "1.05rem", sm: "1.35rem" },
                }}
              >
                Año
              </Typography>
              <Typography
                variant="h1"
                sx={{
                  fontWeight: 800,
                  lineHeight: 0.92,
                  letterSpacing: "-0.03em",
                  textShadow: "0 48px 90px rgba(0,0,0,0.75)",
                  fontSize: {
                    xs: "clamp(3.8rem, 18vw, 9rem)",
                    sm: "clamp(5rem, 16vw, 10.5rem)",
                    md: "clamp(6rem, 14vw, 11.5rem)",
                  },
                }}
              >
                {currentSong.year}
              </Typography>
            </Box>
          </Box>
        ) : null}
        <Stack
          direction={{ xs: "column-reverse", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          sx={{
            position: "relative",
            zIndex: 1,
            p: { xs: 3, sm: 4, md: 6 },
            alignItems: { xs: "stretch", md: "center" },
            gap: { xs: 4, md: 5 },
            height: { xs: "auto", md: "100%" },
            pb: { xs: 6, md: 0 },
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              height: { xs: "auto", md: "100%" },
              gap: { xs: 3, md: 4 },
              justifyContent: { xs: "flex-start", md: "center" },
              alignItems: "flex-start",
              py: { xs: 0, md: 2 },
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: { xs: 2.5, md: 3 },
                flexGrow: { xs: 0, md: 0 },
                justifyContent: "flex-start",
                maxWidth: 520,
                width: "100%",
              }}
            >
              {errorMessage ? (
                <Alert
                  severity="warning"
                  icon={false}
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.94)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    backdropFilter: "blur(12px)",
                    fontWeight: 500,
                  }}
                >
                  {errorMessage}
                </Alert>
              ) : null}
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                flexWrap="wrap"
                sx={{ color: "#fff" }}
              >
                {baseChipLabel ? (
                  <Chip
                    label={baseChipLabel}
                    sx={{
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      backgroundColor: "rgba(255,255,255,0.16)",
                      color: "#fff",
                      backdropFilter: "blur(10px)",
                    }}
                  />
                ) : null}
                <Chip
                  label={secondaryChipLabel}
                  sx={{
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    backgroundColor: "rgba(13,148,255,0.2)",
                    color: "rgba(212,239,255,0.95)",
                    border: "1px solid rgba(148,197,255,0.35)",
                  }}
                />
                {tertiaryChipLabel ? (
                  <Chip
                    label={tertiaryChipLabel}
                    sx={{
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      backgroundColor: "rgba(255,255,255,0.12)",
                      color: "rgba(230,243,255,0.92)",
                      border: "1px dashed rgba(230,243,255,0.35)",
                    }}
                  />
                ) : null}
                {artworkLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} sx={{ color: "#d7f9ff" }} />
                    <Typography
                      variant="caption"
                      sx={{ color: "rgba(224,239,255,0.85)" }}
                    >
                      Buscando portada...
                    </Typography>
                  </Stack>
                ) : null}
              </Stack>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "-0.015em",
                  textAlign: "left",
                  color: "#ffffff",
                  textShadow: "0 30px 60px rgba(0,0,0,0.55)",
                }}
              >
                {heading}
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  color: "rgba(204,231,255,0.92)",
                  textAlign: "left",
                }}
              >
                {subheading}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: "rgba(224,239,255,0.82)",
                  maxWidth: 520,
                  textAlign: "left",
                }}
              >
                {description}
              </Typography>
              {displayedArtworkError ? (
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,210,210,0.92)",
                    textAlign: "left",
                  }}
                >
                  {displayedArtworkError}
                </Typography>
              ) : null}
            </Box>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{
                pt: { xs: 1, md: 3 },
                flexWrap: "wrap",
                alignSelf: { xs: "stretch", md: "flex-start" },
              }}
            >
              <IconButton
                onClick={handlePlayPause}
                sx={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.35)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(99,213,245,0.35) 100%)",
                  boxShadow: "0 26px 56px -28px rgba(12,38,96,0.8)",
                  color: "#ffffff",
                  transition: "transform 160ms ease",
                  "&:hover": {
                    transform: "translateY(-4px) scale(1.02)",
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(99,213,245,0.48) 100%)",
                  },
                }}
              >
                {isPlaying ? (
                  <PauseIcon sx={{ fontSize: 44 }} />
                ) : (
                  <PlayArrowIcon sx={{ fontSize: 48 }} />
                )}
              </IconButton>
              <Stack spacing={1} sx={{ color: "rgba(224,239,255,0.78)" }}>
                <Typography variant="caption" sx={{ letterSpacing: 1 }}>
                  {statusCaptionLabel}
                </Typography>
                <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                  {statusCaptionDescription}
                </Typography>
              </Stack>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                pt: { xs: 2, md: 4 },
                alignSelf: { xs: "stretch", md: "flex-start" },
              }}
            >
              <Button
                variant={primaryAction.variant}
                color={primaryAction.color}
                startIcon={primaryAction.icon}
                onClick={primaryAction.onClick}
                sx={{
                  minWidth: 200,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  boxShadow: "0 22px 48px -18px rgba(50,132,255,0.6)",
                  background:
                    primaryAction.variant === "contained"
                      ? "linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #22d3ee 100%)"
                      : undefined,
                  "&:hover":
                    primaryAction.variant === "contained"
                      ? {
                          background:
                            "linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #06b6d4 100%)",
                          boxShadow: "0 26px 56px -20px rgba(37,99,235,0.7)",
                        }
                      : undefined,
                }}
              >
                {primaryAction.label}
              </Button>
              <Button
                variant={secondaryAction.variant}
                color={secondaryAction.color}
                startIcon={secondaryAction.icon}
                onClick={secondaryAction.onClick}
                sx={{
                  minWidth: 200,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  borderColor:
                    secondaryAction.variant === "outlined"
                      ? "rgba(255,255,255,0.4)"
                      : undefined,
                  color:
                    secondaryAction.variant === "outlined"
                      ? "rgba(255,255,255,0.92)"
                      : undefined,
                  "&:hover":
                    secondaryAction.variant === "outlined"
                      ? {
                          borderColor: "rgba(255,255,255,0.7)",
                          backgroundColor: "rgba(255,255,255,0.12)",
                        }
                      : undefined,
                }}
              >
                {secondaryAction.label}
              </Button>
            </Stack>
          </Box>
          <Box
            sx={{
              width: { xs: "100%", md: 420 },
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: { xs: "72%", sm: 300, md: 380 },
                aspectRatio: "1 / 1",
                borderRadius: { xs: 4, md: 5 },
                overflow: "hidden",
                boxShadow: "0 38px 78px -32px rgba(5,18,52,0.82)",
                border: "1px solid rgba(255,255,255,0.14)",
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(148,197,255,0.12) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {shouldDisplayArtwork ? (
                <Box
                  component="img"
                  src={artworkUrl ?? undefined}
                  alt={
                    showDetails
                      ? `Portada de ${currentSong.title}`
                      : "Portada sugerida"
                  }
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <Stack
                  spacing={1}
                  alignItems="center"
                  sx={{ p: 3, color: "rgba(224,239,255,0.85)" }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 40, opacity: 0.75 }} />
                  <Typography
                    variant="subtitle2"
                    sx={{ textAlign: "center", fontWeight: 600 }}
                  >
                    {fallbackTitle}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ textAlign: "center", opacity: 0.8 }}
                  >
                    {fallbackDescription}
                  </Typography>
                </Stack>
              )}
              {artworkLoading && showDetails ? (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(4,10,24,0.45)",
                  }}
                >
                  <CircularProgress size={38} sx={{ color: "#d7f9ff" }} />
                </Box>
              ) : null}
            </Box>
          </Box>
        </Stack>
      </Box>
    );
  };

  const renderControls = () => {
    if (gameState === "idle") {
      return (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={handleStart}
            startIcon={<RestartAltIcon />}
            sx={{
              fontWeight: "bold",
              fontSize: "1rem",
              py: 1.2,
              px: 3,
              textTransform: "none",
              color: "#FFF !important",
              border: "2px solid #FFF",
              backgroundColor: "rgba(0,0,0,0.05) !important",
              "&:hover": {
                backgroundColor: "#FFF !important",
                color: "#28518C !important",
                border: "2px solid #FFF",
              },
            }}
          >
            Iniciar partida automática
          </Button>
        </Box>
      );
    }

    if (gameState === "loading") {
      return (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stack
            spacing={3}
            alignItems="center"
            sx={{
              color: "rgba(255,255,255,0.9)",
            }}
          >
            <CircularProgress sx={{ color: "#d7f9ff" }} />
            <Typography variant="body1">
              Preparando la atmósfera para la próxima canción...
            </Typography>
          </Stack>
        </Box>
      );
    }

    if (gameState === "error") {
      return (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
          }}
        >
          <Stack
            spacing={3}
            alignItems="center"
            sx={{
              width: "min(520px, 92vw)",
            }}
          >
            <Alert
              severity="error"
              icon={false}
              sx={{
                width: "100%",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.94)",
                border: "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(12px)",
                fontWeight: 500,
                textAlign: "left",
              }}
            >
              {errorMessage ??
                "No pudimos continuar la partida automática. Intenta reiniciarla o vuelve al menú principal."}
            </Alert>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RestartAltIcon />}
                onClick={handleStart}
                sx={{
                  minWidth: 200,
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                Reintentar partida
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<ExitToAppIcon />}
                onClick={handleExit}
                sx={{
                  minWidth: 200,
                  textTransform: "none",
                  fontWeight: 700,
                  borderColor: "rgba(255,255,255,0.45)",
                  color: "rgba(255,255,255,0.92)",
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.7)",
                    backgroundColor: "rgba(255,255,255,0.12)",
                  },
                }}
              >
                Salir
              </Button>
            </Stack>
          </Stack>
        </Box>
      );
    }

    if (!currentSong) {
      return null;
    }

    if (gameState === "revealed") {
      return renderExperienceView("reveal");
    }

    return renderExperienceView("guess");
  };

  const isExperienceMode = gameState === "playing" || gameState === "revealed";

  return (
    <Box
      className={isExperienceMode ? undefined : "ocean-background"}
      sx={{
        position: "relative",
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: isExperienceMode
          ? { xs: "flex-start", md: "center" }
          : "center",
        alignItems: isExperienceMode
          ? { xs: "stretch", md: "center" }
          : "center",
        color: "white",
        textAlign: "center",
        p: isExperienceMode ? 0 : 2,
        pt: isExperienceMode ? { xs: 4, sm: 3, md: 0 } : undefined,
        overflowX: "hidden",
        overflowY: "auto",
        pb: isExperienceMode ? { xs: 6, sm: 5, md: 4 } : { xs: 6, sm: 4 },
        scrollbarWidth: "thin",
        WebkitOverflowScrolling: "touch",
        fontFamily: "'Poppins', 'Fredoka', Arial, sans-serif",
        backgroundColor: isExperienceMode ? "#040812" : undefined,
        overscrollBehavior: isExperienceMode ? "contain" : undefined,
      }}
    >
      <Box sx={{ position: "absolute", top: 24, right: 24, zIndex: 10 }}>
        <Button
          variant="outlined"
          color="error"
          onClick={handleExit}
          startIcon={<ExitToAppIcon />}
          sx={{
            fontWeight: "bold",
            textTransform: "none",
            color: "#FFF !important",
            border: "2px solid #FFF",
            backgroundColor: "rgba(0,0,0,0.05) !important",
            "&:hover": {
              backgroundColor: "#FFF !important",
              color: "#28518C !important",
              border: "2px solid #FFF",
            },
          }}
        >
          Salir
        </Button>
      </Box>

      {videoId && (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 40,
            height: 20,
            zIndex: 1,
            opacity: 0.01,
            pointerEvents: "none",
          }}
        >
          <YouTube
            key={playerKey}
            videoId={videoId}
            opts={playerOptions}
            ref={playerRef}
            onReady={handlePlayerReady}
            onError={handlePlayerError}
            onStateChange={handlePlayerStateChange}
          />
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          zIndex: 2,
          width: "100%",
          height: "100%",
        }}
      >
        {renderControls()}
      </Box>

      {isPlaying && (
        <Box className="neon-lines">
          <Box
            className="neon-line"
            sx={{
              top: "18%",
              background: "linear-gradient(90deg, #00fff7, #0ff, #fff)",
              boxShadow: "0 0 16px #00fff7",
              animation: "neon-move-right 2.5s linear infinite",
            }}
          />
          <Box
            className="neon-line"
            sx={{
              top: "32%",
              background: "linear-gradient(90deg, #ff00ea, #fff, #ff0)",
              boxShadow: "0 0 16px #ff00ea",
              animation: "neon-move-left 3.2s linear infinite",
            }}
          />
          <Box
            className="neon-line"
            sx={{
              top: "46%",
              background: "linear-gradient(90deg, #fff200, #fff, #00ff6a)",
              boxShadow: "0 0 16px #fff200",
              animation: "neon-move-right 2.1s linear infinite",
            }}
          />
          <Box
            className="neon-line"
            sx={{
              top: "60%",
              background: "linear-gradient(90deg, #00ff6a, #fff, #00fff7)",
              boxShadow: "0 0 16px #00ff6a",
              animation: "neon-move-left 2.8s linear infinite",
            }}
          />
          <Box
            className="neon-line"
            sx={{
              top: "74%",
              background: "linear-gradient(90deg, #ff0, #fff, #ff00ea)",
              boxShadow: "0 0 16px #ff0",
              animation: "neon-move-right 3.5s linear infinite",
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default AutoGame;
