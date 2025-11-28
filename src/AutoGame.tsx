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
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { fetchAllSongs } from "./services/songService";
import { extractYoutubeId } from "./lib/autoGameQueue";
import { useAutoGameQueue } from "./hooks/useAutoGameQueue";
import { useArtworkLookup } from "./hooks/useArtworkLookup";
import { NeonLines } from "./auto-game/NeonLines";
import { YearSpotlight } from "./auto-game/YearSpotlight";
import { useViewTransition } from "./hooks/useViewTransition";

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

const AutoGame: React.FC<AutoGameProps> = ({ onExit }) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const [yearSpotlightVisible, setYearSpotlightVisible] = useState(false);
  const [spotlightYear, setSpotlightYear] = useState<number | null>(null);
  const yearSpotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const {
    status: queueStatus,
    error: queueError,
    currentSong,
    startQueue,
    advanceQueue,
    resetQueue,
  } = useAutoGameQueue({ fetchSongs: fetchAllSongs });

  const {
    artworkUrl,
    loading: artworkLoading,
    error: artworkError,
  } = useArtworkLookup(currentSong);

  const runViewTransition = useViewTransition();

  const displayedError = errorMessage ?? queueError;

  const clearYearSpotlightTimeout = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      clearTimeout(yearSpotlightTimerRef.current);
      yearSpotlightTimerRef.current = null;
    }
    setYearSpotlightVisible(false);
    setSpotlightYear(null);
  }, []);

  const triggerYearSpotlight = useCallback(
    (year: number) => {
      clearYearSpotlightTimeout();
      setSpotlightYear(year);
      setYearSpotlightVisible(true);
      yearSpotlightTimerRef.current = setTimeout(() => {
        setYearSpotlightVisible(false);
        setSpotlightYear(null);
        yearSpotlightTimerRef.current = null;
      }, 4600);
    },
    [clearYearSpotlightTimeout]
  );

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
    if (!currentSong) {
      return;
    }
    void runViewTransition(() => {
      setPlayerKey((prev) => prev + 1);
      setIsPlaying(false);
      setGameState("playing");
      setErrorMessage(null);
      clearYearSpotlightTimeout();
    });
  }, [currentSong, clearYearSpotlightTimeout, runViewTransition]);

  useEffect(() => {
    if (queueStatus === "loading") {
      setGameState("loading");
    }
    if (queueStatus === "error" || queueStatus === "exhausted") {
      setGameState("error");
    }
    if (queueStatus === "idle" && !currentSong) {
      setGameState("idle");
    }
  }, [currentSong, queueStatus]);

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

  const advanceToNextSong = useCallback(() => {
    void runViewTransition(() => {
      setErrorMessage(null);
      setGameState("loading");
      setIsPlaying(false);
      stopPlayback();
      clearYearSpotlightTimeout();
      advanceQueue();
    });
  }, [
    advanceQueue,
    clearYearSpotlightTimeout,
    runViewTransition,
    stopPlayback,
  ]);

  const handleStart = useCallback(() => {
    void runViewTransition(async () => {
      setErrorMessage(null);
      setGameState("loading");
      setIsPlaying(false);
      stopPlayback();
      clearYearSpotlightTimeout();
      await startQueue();
    });
  }, [clearYearSpotlightTimeout, runViewTransition, startQueue, stopPlayback]);

  const handleSkip = useCallback(() => {
    advanceToNextSong();
  }, [advanceToNextSong]);

  const handleReveal = useCallback(() => {
    void runViewTransition(() => {
      setGameState("revealed");
      if (currentSong && typeof currentSong.year === "number") {
        triggerYearSpotlight(currentSong.year);
      }
    });
  }, [currentSong, runViewTransition, triggerYearSpotlight]);

  const handleRandomYearReveal = useCallback(() => {
    const currentYear = new Date().getFullYear();
    const minYear = 1950;
    const randomYear =
      Math.floor(Math.random() * (currentYear - minYear + 1)) + minYear;
    void runViewTransition(() => {
      triggerYearSpotlight(randomYear);
    });
  }, [runViewTransition, triggerYearSpotlight]);

  const handleNextAfterReveal = useCallback(() => {
    advanceToNextSong();
  }, [advanceToNextSong]);

  const handlePlayerError = useCallback<
    NonNullable<YouTubeProps["onError"]>
  >(() => {
    setIsPlaying(false);
    setErrorMessage(
      "No se pudo reproducir el video de esta canción. Pasamos a otra pista."
    );
    advanceToNextSong();
  }, [advanceToNextSong]);

  const handleExit = useCallback(() => {
    void runViewTransition(() => {
      stopPlayback();
      resetQueue();
      setGameState("idle");
      setErrorMessage(null);
      setIsPlaying(false);
      setYearSpotlightVisible(false);
      setSpotlightYear(null);
      clearYearSpotlightTimeout();
      onExit();
    });
  }, [
    clearYearSpotlightTimeout,
    onExit,
    resetQueue,
    runViewTransition,
    stopPlayback,
  ]);

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

  const renderExperienceView = (
    mode: "guess" | "reveal",
    shouldShowNeon: boolean
  ) => {
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
      "linear-gradient(190deg, rgba(12,44,110,0.75) 0%, rgba(6,26,68,0.88) 55%, rgba(2,12,34,0.92) 100%)";
    const shouldDisplayArtwork = showDetails && Boolean(artworkUrl);
    const hasNumericYear = typeof currentSong.year === "number";
    const spotlightDisplayYear =
      spotlightYear !== null
        ? spotlightYear
        : hasNumericYear
        ? currentSong.year
        : null;

    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: "auto", md: "100%" },
          minHeight: { xs: 520, md: 640 },
          overflow: { xs: "visible", md: "hidden" },
          viewTransitionName: "auto-game-canvas",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: shouldDisplayArtwork
              ? `url(${artworkUrl})`
              : fallbackBackdrop,
            backgroundSize: shouldDisplayArtwork ? "cover" : "140% 140%",
            backgroundPosition: shouldDisplayArtwork ? "center" : "45% 40%",
            filter: shouldDisplayArtwork ? "blur(22px)" : "none",
            transform: shouldDisplayArtwork ? "scale(1.12)" : "none",
            opacity: shouldDisplayArtwork ? 0.95 : 1,
            zIndex: 1,
            viewTransitionName: "auto-game-background",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backdropFilter: "blur(12px)",
            zIndex: 2,
            viewTransitionName: "auto-game-overlay",
          }}
        />
        <NeonLines
          active={shouldShowNeon}
          sx={{ zIndex: 3, viewTransitionName: "auto-game-neon" }}
        />
        <YearSpotlight
          visible={yearSpotlightVisible && spotlightDisplayYear !== null}
          year={spotlightDisplayYear}
        />
        <Stack
          direction={{ xs: "column-reverse", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          sx={{
            position: "relative",
            zIndex: 3,
            p: { xs: 3, sm: 4, md: 6 },
            alignItems: { xs: "stretch", md: "center" },
            gap: { xs: 4, md: 5 },
            height: { xs: "auto", md: "100%" },
            pb: { xs: 6, md: 0 },
            viewTransitionName: "auto-game-panel",
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
              {displayedError ? (
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
                  {displayedError}
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
              viewTransitionName: "auto-game-artwork-frame",
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
                viewTransitionName: "auto-game-artwork-shell",
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
                    viewTransitionName: "auto-game-artwork",
                  }}
                />
              ) : (
                <Stack
                  spacing={1}
                  alignItems="center"
                  sx={{
                    p: 3,
                    color: "rgba(224,239,255,0.85)",
                    viewTransitionName: "auto-game-artwork-fallback",
                  }}
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

  const renderIdleLanding = () => {
    const currentYear = new Date().getFullYear();
    const fallbackBackdrop =
      "linear-gradient(190deg, rgba(12,44,110,0.75) 0%, rgba(6,26,68,0.88) 55%, rgba(2,12,34,0.92) 100%)";

    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: "auto", md: "100%" },
          minHeight: { xs: 560, md: 640 },
          overflow: { xs: "visible", md: "hidden" },
          viewTransitionName: "auto-game-canvas",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: fallbackBackdrop,
            backgroundSize: "140% 140%",
            backgroundPosition: "48% 42%",
            zIndex: 1,
            viewTransitionName: "auto-game-background",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backdropFilter: "blur(12px)",
            zIndex: 2,
            viewTransitionName: "auto-game-overlay",
          }}
        />
        <NeonLines sx={{ zIndex: 3, viewTransitionName: "auto-game-neon" }} />
        <YearSpotlight visible={yearSpotlightVisible} year={spotlightYear} />
        <Stack
          direction={{ xs: "column-reverse", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          sx={{
            position: "relative",
            zIndex: 3,
            p: { xs: 3, sm: 4, md: 6 },
            alignItems: { xs: "stretch", md: "center" },
            gap: { xs: 4, md: 5 },
            height: { xs: "auto", md: "100%" },
            pb: { xs: 6, md: 0 },
            viewTransitionName: "auto-game-panel",
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: { xs: 3, md: 4 },
              justifyContent: { xs: "flex-start", md: "center" },
              alignItems: "flex-start",
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
                label="Modo automático"
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
                label={`Explora ${1950} - ${currentYear}`}
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(13,148,255,0.2)",
                  color: "rgba(212,239,255,0.95)",
                  border: "1px solid rgba(148,197,255,0.35)",
                }}
              />
              <Chip
                label="Visual inmersivo"
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "rgba(230,243,255,0.92)",
                  border: "1px dashed rgba(230,243,255,0.35)",
                }}
              />
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
              Vive la experiencia automática
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                color: "rgba(204,231,255,0.92)",
                textAlign: "left",
              }}
            >
              Canciones, portadas y atmósferas listas para sorprenderte.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "rgba(224,239,255,0.82)",
                maxWidth: 520,
                textAlign: "left",
              }}
            >
              Prepárate para una secuencia equilibrada de pistas que mantiene el
              suspenso. Cuando quieras empezar, solo presiona iniciar y deja que
              el juego haga el resto.
            </Typography>
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
              <Stack spacing={1} sx={{ color: "rgba(224,239,255,0.78)" }}>
                <Typography variant="caption" sx={{ letterSpacing: 1 }}>
                  Listo para comenzar
                </Typography>
                <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                  Inicia o genera un año de referencia en segundos.
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
                variant="contained"
                color="primary"
                startIcon={<PlayArrowIcon />}
                onClick={handleStart}
                sx={{
                  minWidth: 220,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.6,
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
                Iniciar partida automática
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<CalendarMonthIcon />}
                onClick={handleRandomYearReveal}
                sx={{
                  minWidth: 220,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.6,
                  borderColor: "rgba(255,255,255,0.4)",
                  color: "rgba(255,255,255,0.92)",
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.7)",
                    backgroundColor: "rgba(255,255,255,0.12)",
                  },
                }}
              >
                Obtener año de partida
              </Button>
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: "rgba(204,231,255,0.72)",
                textAlign: "left",
              }}
            >
              Cada año sugerido se muestra con la misma animación que la
              revelación de canciones.
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  };

  const renderControls = () => {
    if (gameState === "idle") {
      return renderIdleLanding();
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
              {displayedError ??
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
      return renderExperienceView("reveal", isPlaying);
    }

    return renderExperienceView("guess", isPlaying);
  };

  const isExperienceMode = gameState === "playing" || gameState === "revealed";

  return (
    <Box
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
        p: 0,
        pt: 0,
        overflowX: "hidden",
        overflowY: "auto",
        pb: 0,
        scrollbarWidth: "thin",
        WebkitOverflowScrolling: "touch",
        fontFamily: "'Poppins', 'Fredoka', Arial, sans-serif",
        zIndex: 0,
        background:
          "linear-gradient(190deg, #0a2a6f 0%, #051d4a 52%, #030c26 100%)",
        overscrollBehavior: isExperienceMode ? "contain" : undefined,
        viewTransitionName: "auto-game-root",
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
          minHeight: 0,
        }}
      >
        {renderControls()}
      </Box>
    </Box>
  );
};

export default AutoGame;
