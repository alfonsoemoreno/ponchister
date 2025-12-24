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
import { useArtworkPalette } from "./hooks/useArtworkPalette";
import { NeonLines } from "./auto-game/NeonLines";
import { YearSpotlight } from "./auto-game/YearSpotlight";
import { useViewTransition } from "./hooks/useViewTransition";
import { createAdaptiveTheme } from "./auto-game/theme";
import type { YearRange } from "./types";

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
  yearRange: YearRange;
}

type GameState = "idle" | "loading" | "playing" | "revealed" | "error";

type PlayerRef = YouTube | null;

const AutoGame: React.FC<AutoGameProps> = ({ onExit, yearRange }) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const [spotlightVisible, setSpotlightVisible] = useState(false);
  const [spotlightValue, setSpotlightValue] = useState<string | number | null>(
    null
  );
  const [spotlightLabel, setSpotlightLabel] = useState<string>("Año");
  const yearSpotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const fetchSongsForRange = useCallback(
    () =>
      fetchAllSongs({
        minYear: yearRange.min,
        maxYear: yearRange.max,
      }),
    [yearRange.max, yearRange.min]
  );

  const {
    status: queueStatus,
    error: queueError,
    currentSong,
    startQueue,
    advanceQueue,
    resetQueue,
  } = useAutoGameQueue({ fetchSongs: fetchSongsForRange });

  const {
    artworkUrl,
    loading: artworkLoading,
    error: artworkError,
  } = useArtworkLookup(currentSong);
  const { palette: artworkPalette } = useArtworkPalette(artworkUrl);

  const runViewTransition = useViewTransition();
  const rootTheme = createAdaptiveTheme(artworkPalette);

  const displayedError = errorMessage ?? queueError;

  const clearYearSpotlightTimeout = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      clearTimeout(yearSpotlightTimerRef.current);
      yearSpotlightTimerRef.current = null;
    }
    setSpotlightVisible(false);
    setSpotlightValue(null);
    setSpotlightLabel("Año");
  }, []);

  const triggerSpotlight = useCallback(
    (label: string, value: string | number) => {
      if (yearSpotlightTimerRef.current) {
        return;
      }
      setSpotlightLabel(label);
      setSpotlightValue(value);
      setSpotlightVisible(true);
      yearSpotlightTimerRef.current = setTimeout(() => {
        setSpotlightVisible(false);
        setSpotlightValue(null);
        setSpotlightLabel("Año");
        yearSpotlightTimerRef.current = null;
      }, 4600);
    },
    []
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
    if (yearSpotlightTimerRef.current) {
      return;
    }
    void runViewTransition(() => {
      setGameState("revealed");
      if (currentSong && typeof currentSong.year === "number") {
        triggerSpotlight("Año", currentSong.year);
      }
    });
  }, [currentSong, runViewTransition, triggerSpotlight]);

  const handleRandomYearReveal = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      return;
    }
    const currentYear = new Date().getFullYear();
    const minYear = 1950;
    const randomYear =
      Math.floor(Math.random() * (currentYear - minYear + 1)) + minYear;
    void runViewTransition(() => {
      triggerSpotlight("Año", randomYear);
    });
  }, [runViewTransition, triggerSpotlight]);

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
    const songYear =
      typeof currentSong.year === "number" ? currentSong.year : null;
    const baseChipLabel = showDetails ? "Ahora suena" : null;
    const secondaryChipLabel = showDetails
      ? songYear !== null
        ? `Año ${songYear}`
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
    const highlightedYear = showDetails && songYear !== null ? songYear : null;

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
          disabled: false,
        }
      : {
          icon: <InfoOutlinedIcon />,
          label: "Mostrar artista y canción",
          onClick: handleReveal,
          variant: "contained" as const,
          color: "primary" as const,
          disabled: spotlightVisible,
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
    const theme = createAdaptiveTheme(
      shouldDisplayArtwork ? artworkPalette : null
    );
    const spotlightDisplayValue = spotlightValue;
    const spotlightDisplayLabel = spotlightLabel;

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
            transform: "none",
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
            backgroundColor: theme.overlayTint,
            zIndex: 2,
            viewTransitionName: "auto-game-overlay",
          }}
        />
        <NeonLines
          active={shouldShowNeon}
          sx={{ zIndex: 3, viewTransitionName: "auto-game-neon" }}
        />
        <YearSpotlight
          visible={spotlightVisible && spotlightDisplayValue !== null}
          value={spotlightDisplayValue}
          label={spotlightDisplayLabel}
          styles={theme.spotlight}
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
                    backgroundColor: theme.alert.background,
                    color: theme.alert.color,
                    border: `1px solid ${theme.alert.border}`,
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
                sx={{ color: theme.text.primary }}
              >
                {baseChipLabel ? (
                  <Chip
                    label={baseChipLabel}
                    sx={{
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      backgroundColor: theme.chips.primary.background,
                      color: theme.chips.primary.color,
                      border: theme.chips.primary.borderColor
                        ? `${theme.chips.primary.borderStyle ?? "solid"} 1px ${
                            theme.chips.primary.borderColor
                          }`
                        : undefined,
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
                    backgroundColor: theme.chips.secondary.background,
                    color: theme.chips.secondary.color,
                    border: theme.chips.secondary.borderColor
                      ? `${theme.chips.secondary.borderStyle ?? "solid"} 1px ${
                          theme.chips.secondary.borderColor
                        }`
                      : undefined,
                  }}
                />
                {tertiaryChipLabel ? (
                  <Chip
                    label={tertiaryChipLabel}
                    sx={{
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      backgroundColor: theme.chips.tertiary.background,
                      color: theme.chips.tertiary.color,
                      border: theme.chips.tertiary.borderColor
                        ? `${theme.chips.tertiary.borderStyle ?? "solid"} 1px ${
                            theme.chips.tertiary.borderColor
                          }`
                        : undefined,
                    }}
                  />
                ) : null}
                {artworkLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} sx={{ color: theme.spinner }} />
                    <Typography
                      variant="caption"
                      sx={{ color: theme.text.body }}
                    >
                      Buscando portada...
                    </Typography>
                  </Stack>
                ) : null}
              </Stack>
              <Stack spacing={0.8} sx={{ alignItems: "flex-start" }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: "-0.015em",
                    textAlign: "left",
                    color: theme.text.primary,
                    textShadow: theme.textShadow,
                  }}
                >
                  {heading}
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 600,
                    color: theme.text.secondary,
                    textAlign: "left",
                  }}
                >
                  {subheading}
                </Typography>
                {highlightedYear ? (
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      px: { xs: 1.6, sm: 2.2 },
                      py: { xs: 0.5, sm: 0.7 },
                      borderRadius: 999,
                      background: theme.yearBadge.background,
                      color: theme.yearBadge.color,
                      border: theme.yearBadge.border,
                      boxShadow: theme.yearBadge.shadow,
                      mt: { xs: 0.4, sm: 0.6 },
                    }}
                  >
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 800,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "inherit",
                        lineHeight: 1,
                        fontSize: { xs: "1.35rem", sm: "1.55rem" },
                        minWidth: { xs: "fit-content", sm: "fit-content" },
                      }}
                    >
                      {highlightedYear}
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
              <Typography
                variant="body1"
                sx={{
                  color: theme.text.body,
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
                    color: theme.warningText,
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
                  border: theme.iconButton.border,
                  background: theme.iconButton.background,
                  boxShadow: theme.iconButton.shadow,
                  color: theme.iconButton.color,
                  transition: "transform 160ms ease",
                  "&:hover": {
                    transform: "translateY(-4px) scale(1.02)",
                    background: theme.iconButton.hoverBackground,
                    boxShadow: theme.iconButton.hoverShadow,
                    color: theme.iconButton.hoverColor,
                  },
                }}
              >
                {isPlaying ? (
                  <PauseIcon sx={{ fontSize: 44 }} />
                ) : (
                  <PlayArrowIcon sx={{ fontSize: 48 }} />
                )}
              </IconButton>
              <Stack spacing={1}>
                <Typography
                  variant="caption"
                  sx={{ letterSpacing: 1, color: theme.status.label }}
                >
                  {statusCaptionLabel}
                </Typography>
                <Typography
                  variant="subtitle2"
                  sx={{ color: theme.status.description }}
                >
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
                disabled={primaryAction.disabled}
                sx={{
                  minWidth: 200,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  boxShadow:
                    primaryAction.variant === "contained"
                      ? theme.primaryButton.shadow
                      : undefined,
                  background:
                    primaryAction.variant === "contained"
                      ? theme.primaryButton.background
                      : undefined,
                  color:
                    primaryAction.variant === "contained"
                      ? theme.primaryButton.textColor
                      : undefined,
                  "&:hover":
                    primaryAction.variant === "contained"
                      ? {
                          background: theme.primaryButton.hoverBackground,
                          boxShadow: theme.primaryButton.hoverShadow,
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
                      ? theme.secondaryButton.border
                      : undefined,
                  color:
                    secondaryAction.variant === "outlined"
                      ? theme.secondaryButton.textColor
                      : undefined,
                  "&:hover":
                    secondaryAction.variant === "outlined"
                      ? {
                          borderColor: theme.secondaryButton.hoverBorder,
                          backgroundColor:
                            theme.secondaryButton.hoverBackground,
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
              width: { xs: "100%", md: "100%" },
              flex: { xs: "0 0 auto", md: 1 },
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: { xs: "auto", md: "100%" },
              viewTransitionName: "auto-game-artwork-frame",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: {
                  xs: "72%",
                  sm: 300,
                  md: "min(48vw, 78vh)",
                },
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
                    color: theme.fallback.text,
                    viewTransitionName: "auto-game-artwork-fallback",
                  }}
                >
                  <InfoOutlinedIcon
                    sx={{ fontSize: 40, color: theme.fallback.icon }}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{
                      textAlign: "center",
                      fontWeight: 600,
                      color: theme.fallback.text,
                    }}
                  >
                    {fallbackTitle}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ textAlign: "center", color: theme.fallback.caption }}
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
                    backgroundColor: theme.progressOverlay,
                  }}
                >
                  <CircularProgress size={38} sx={{ color: theme.spinner }} />
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
    const theme = createAdaptiveTheme(null);

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
            backgroundColor: theme.overlayTint,
            zIndex: 2,
            viewTransitionName: "auto-game-overlay",
          }}
        />
        <NeonLines sx={{ zIndex: 3, viewTransitionName: "auto-game-neon" }} />
        <YearSpotlight
          visible={spotlightVisible && spotlightValue !== null}
          value={spotlightValue}
          label={spotlightLabel}
          styles={theme.spotlight}
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
              sx={{ color: theme.text.primary }}
            >
              <Chip
                label="Modo automático"
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: theme.chips.primary.background,
                  color: theme.chips.primary.color,
                  border: theme.chips.primary.borderColor
                    ? `${theme.chips.primary.borderStyle ?? "solid"} 1px ${
                        theme.chips.primary.borderColor
                      }`
                    : undefined,
                  backdropFilter: "blur(10px)",
                }}
              />
              <Chip
                label={`Explora ${1950} - ${currentYear}`}
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: theme.chips.secondary.background,
                  color: theme.chips.secondary.color,
                  border: theme.chips.secondary.borderColor
                    ? `${theme.chips.secondary.borderStyle ?? "solid"} 1px ${
                        theme.chips.secondary.borderColor
                      }`
                    : undefined,
                }}
              />
              <Chip
                label="Visual inmersivo"
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: theme.chips.tertiary.background,
                  color: theme.chips.tertiary.color,
                  border: theme.chips.tertiary.borderColor
                    ? `${theme.chips.tertiary.borderStyle ?? "solid"} 1px ${
                        theme.chips.tertiary.borderColor
                      }`
                    : undefined,
                }}
              />
            </Stack>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.015em",
                textAlign: "left",
                color: theme.text.primary,
                textShadow: theme.textShadow,
              }}
            >
              Vive la experiencia automática
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                color: theme.text.secondary,
                textAlign: "left",
              }}
            >
              Canciones, portadas y atmósferas listas para sorprenderte.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: theme.text.body,
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
              <Stack spacing={1}>
                <Typography
                  variant="caption"
                  sx={{ letterSpacing: 1, color: theme.status.label }}
                >
                  Listo para comenzar
                </Typography>
                <Typography
                  variant="subtitle2"
                  sx={{ color: theme.status.description }}
                >
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
                  boxShadow: theme.primaryButton.shadow,
                  background: theme.primaryButton.background,
                  color: theme.primaryButton.textColor,
                  "&:hover": {
                    background: theme.primaryButton.hoverBackground,
                    boxShadow: theme.primaryButton.hoverShadow,
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
                disabled={spotlightVisible}
                sx={{
                  minWidth: 220,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.6,
                  borderColor: theme.secondaryButton.border,
                  color: theme.secondaryButton.textColor,
                  "&:hover": {
                    borderColor: theme.secondaryButton.hoverBorder,
                    backgroundColor: theme.secondaryButton.hoverBackground,
                  },
                }}
              >
                Obtener año de partida
              </Button>
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: theme.text.caption,
                textAlign: "left",
              }}
            >
              Cada año sugerido se muestra con la misma animación que la
              revelación de canciones.
            </Typography>
          </Box>
          <Box
            sx={{
              width: { xs: "100%", md: "100%" },
              flex: { xs: "0 0 auto", md: 1 },
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: { xs: "auto", md: "100%" },
              viewTransitionName: "auto-game-artwork-frame",
            }}
          ></Box>
        </Stack>
      </Box>
    );
  };

  const renderControls = () => {
    const theme = createAdaptiveTheme(artworkPalette);
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
              color: theme.text.primary,
            }}
          >
            <CircularProgress sx={{ color: theme.spinner }} />
            <Typography variant="body1" sx={{ color: theme.text.body }}>
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
                backgroundColor: theme.alert.background,
                color: theme.alert.color,
                border: `1px solid ${theme.alert.border}`,
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
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  boxShadow: theme.primaryButton.shadow,
                  background: theme.primaryButton.background,
                  color: theme.primaryButton.textColor,
                  "&:hover": {
                    background: theme.primaryButton.hoverBackground,
                    boxShadow: theme.primaryButton.hoverShadow,
                  },
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
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  borderColor: theme.secondaryButton.border,
                  color: theme.secondaryButton.textColor,
                  "&:hover": {
                    borderColor: theme.secondaryButton.hoverBorder,
                    backgroundColor: theme.secondaryButton.hoverBackground,
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
        color: rootTheme.text.primary,
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
      <Box
        sx={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <span style={{ pointerEvents: "auto" }}>
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
        </span>
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
        }}
      >
        {renderControls()}
      </Box>
    </Box>
  );
};

export default AutoGame;
