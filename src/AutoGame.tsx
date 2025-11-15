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

      const playableSongs = shuffleSongs(Array.from(uniquePlayable.values()));

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
  }, [selectNextSongFromQueue, stopPlayback]);

  const loadNextSongFromQueue = useCallback(() => {
    setErrorMessage(null);
    setGameState("loading");
    setIsPlaying(false);
    stopPlayback();
    setArtworkError(null);
    setArtworkUrl(null);

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
  }, [selectNextSongFromQueue, stopPlayback]);

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
  };

  const handleNextAfterReveal = () => {
    loadNextSongFromQueue();
  };

  const handleExit = () => {
    const finalizeExit = () => {
      stopPlayback();
      setCurrentSong(null);
      setGameState("idle");
      setErrorMessage(null);
      setArtworkUrl(null);
      setArtworkLoading(false);
      setArtworkError(null);
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

  const renderControls = () => {
    if (gameState === "idle") {
      return (
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
            mt: 4,
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
          Iniciar juego automático
        </Button>
      );
    }

    if (gameState === "loading") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 4 }}>
          <CircularProgress size={56} thickness={4} sx={{ color: "#fff" }} />
          <Typography variant="body1" sx={{ color: "#fff" }}>
            Buscando una canción...
          </Typography>
        </Box>
      );
    }

    if (gameState === "error") {
      return (
        <Box sx={{ mt: 4, maxWidth: 360 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage ?? "Ocurrió un error inesperado"}
          </Alert>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RestartAltIcon />}
            onClick={handleStart}
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
            Reintentar
          </Button>
        </Box>
      );
    }

    if (!currentSong || !videoId) {
      return null;
    }

    if (gameState === "playing") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <IconButton
            onClick={handlePlayPause}
            sx={{
              width: 160,
              height: 160,
              border: "4px solid #ffffff",
              color: "#ffffff",
              borderRadius: "50%",
              alignSelf: "center",
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.15)",
              },
            }}
          >
            {isPlaying ? (
              <PauseIcon sx={{ fontSize: 80 }} />
            ) : (
              <PlayArrowIcon sx={{ fontSize: 80 }} />
            )}
          </IconButton>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SkipNextIcon />}
              onClick={handleSkip}
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
              Pasar canción
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<InfoOutlinedIcon />}
              onClick={handleReveal}
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
              Mostrar artista y canción
            </Button>
          </Box>
        </Box>
      );
    }

    const yearChipLabel =
      typeof currentSong.year === "number"
        ? `Año ${currentSong.year}`
        : "Año desconocido";

    return (
      <Box
        sx={{
          position: "relative",
          width: "min(1100px, 92vw)",
          minHeight: { xs: 460, md: 560 },
          borderRadius: { xs: 4, md: 6 },
          overflow: "hidden",
          boxShadow: "0 50px 120px -40px rgba(9,22,64,0.72)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: artworkUrl
              ? `url(${artworkUrl})`
              : "radial-gradient(circle at 30% 20%, rgba(99,213,245,0.28), rgba(9,12,28,0.95))",
            backgroundSize: artworkUrl ? "cover" : "150% 150%",
            backgroundPosition: artworkUrl ? "center" : "50% 50%",
            filter: artworkUrl ? "blur(22px)" : "none",
            transform: artworkUrl ? "scale(1.12)" : "none",
            opacity: artworkUrl ? 0.95 : 1,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(4,8,18,0.92) 0%, rgba(20,44,110,0.86) 52%, rgba(84,164,255,0.62) 100%)",
            backdropFilter: "blur(8px)",
          }}
        />
        <Stack
          direction={{ xs: "column-reverse", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          sx={{
            position: "relative",
            zIndex: 1,
            p: { xs: 3, sm: 4, md: 6 },
            alignItems: { xs: "stretch", md: "center" },
            gap: { xs: 4, md: 5 },
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: { xs: 2.5, md: 3 },
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
              sx={{ color: "#fff" }}
            >
              <Chip
                label="Ahora suena"
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  color: "#fff",
                  backdropFilter: "blur(10px)",
                }}
              />
              <Chip
                label={yearChipLabel}
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(13,148,255,0.2)",
                  color: "rgba(212,239,255,0.95)",
                  border: "1px solid rgba(148,197,255,0.35)",
                }}
              />
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
              {currentSong.title}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                color: "rgba(204,231,255,0.92)",
                textAlign: "left",
              }}
            >
              {currentSong.artist}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "rgba(224,239,255,0.82)",
                maxWidth: 520,
                textAlign: "left",
              }}
            >
              Captura la magia del momento con visuales envolventes inspirados
              en tu canción. Sigue jugando para descubrir nuevas portadas y
              atmósferas impactantes.
            </Typography>
            {artworkError ? (
              <Typography
                variant="caption"
                sx={{ color: "rgba(255,210,210,0.92)", textAlign: "left" }}
              >
                {artworkError}
              </Typography>
            ) : null}
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ pt: { xs: 1, md: 2 }, flexWrap: "wrap" }}
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
                  {isPlaying ? "Reproduciendo" : "Reanudar previa"}
                </Typography>
                <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                  Usa los botones para pasar o salir de la partida cuando
                  quieras.
                </Typography>
              </Stack>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ pt: { xs: 2, md: 4 } }}
            >
              <Button
                variant="contained"
                color="primary"
                startIcon={<SkipNextIcon />}
                onClick={handleNextAfterReveal}
                sx={{
                  minWidth: 200,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  boxShadow: "0 22px 48px -18px rgba(50,132,255,0.6)",
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #22d3ee 100%)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #06b6d4 100%)",
                    boxShadow: "0 26px 56px -20px rgba(37,99,235,0.7)",
                  },
                }}
              >
                Siguiente canción
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
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  borderColor: "rgba(255,255,255,0.4)",
                  color: "rgba(255,255,255,0.92)",
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.7)",
                    backgroundColor: "rgba(255,255,255,0.12)",
                  },
                }}
              >
                Salir del juego
              </Button>
            </Stack>
          </Box>
          <Box
            sx={{
              width: { xs: "100%", md: 340 },
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: { xs: "72%", sm: 280, md: 320 },
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
              {artworkUrl ? (
                <Box
                  component="img"
                  src={artworkUrl}
                  alt={`Portada de ${currentSong.title}`}
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
                    Visual a la espera
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ textAlign: "center", opacity: 0.8 }}
                  >
                    {artworkLoading
                      ? "Estamos buscando la portada perfecta…"
                      : "No encontramos una portada. Sigue jugando para descubrir más."}
                  </Typography>
                </Stack>
              )}
              {artworkLoading ? (
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

  return (
    <Box
      className={`ocean-background${isPlaying ? " speaker-anim" : ""}`}
      sx={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        textAlign: "center",
        p: 2,
        overflowX: "hidden",
        overflowY: "auto",
        pb: { xs: 6, sm: 4 },
        scrollbarWidth: "thin",
        WebkitOverflowScrolling: "touch",
        fontFamily: "'Poppins', 'Fredoka', Arial, sans-serif",
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
            onError={() => {
              setIsPlaying(false);
              setCurrentSong(null);
              setErrorMessage(
                "No se pudo reproducir el video. Prueba con otra canción."
              );
              setGameState("error");
            }}
            onStateChange={handlePlayerStateChange}
          />
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 2,
          zIndex: 2,
          width: "100%",
        }}
      >
        <Box sx={{ maxWidth: 540, mb: 3, mx: "auto", px: { xs: 1, sm: 0 } }}>
          <Typography
            variant="h5"
            component="h2"
            sx={{
              mb: 1,
              fontWeight: 700,
              textShadow: "0 0 16px rgba(0,0,0,0.4)",
            }}
          >
            Modo automático
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 0 10px rgba(0,0,0,0.35)",
            }}
          >
            Solicita canciones aleatorias desde la base de datos y adivina antes
            de revelar el artista, título y año.
          </Typography>
        </Box>

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
