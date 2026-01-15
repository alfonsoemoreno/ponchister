import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Slider,
  Switch,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

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
  availableRange: YearRange;
  onYearRangeChange: (range: YearRange) => void;
  onlySpanish: boolean;
  onLanguageModeChange: (spanishOnly: boolean) => void;
  timerEnabled: boolean;
  onTimerModeChange: (enabled: boolean) => void;
}

type GameState = "idle" | "loading" | "playing" | "revealed" | "error";

type PlayerRef = YouTube | null;

const TIMER_DURATION_SECONDS = 60;

const AutoGame: React.FC<AutoGameProps> = ({
  onExit,
  yearRange,
  availableRange,
  onYearRangeChange,
  onlySpanish,
  onLanguageModeChange,
  timerEnabled,
  onTimerModeChange,
}) => {
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
  const [timerRemaining, setTimerRemaining] = useState<number>(
    TIMER_DURATION_SECONDS
  );
  const [timerLocked, setTimerLocked] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);
  const [localRange, setLocalRange] = useState<YearRange>(yearRange);
  const [localSpanishOnly, setLocalSpanishOnly] =
    useState<boolean>(onlySpanish);
  const [localTimerEnabled, setLocalTimerEnabled] =
    useState<boolean>(timerEnabled);

  useEffect(() => {
    setLocalRange(yearRange);
  }, [yearRange]);

  useEffect(() => {
    setLocalSpanishOnly(onlySpanish);
  }, [onlySpanish]);

  useEffect(() => {
    setLocalTimerEnabled(timerEnabled);
  }, [timerEnabled]);

  const sliderMarks = useMemo(() => {
    const marks: { value: number; label: string }[] = [
      { value: availableRange.min, label: `${availableRange.min}` },
    ];
    const span = availableRange.max - availableRange.min;
    if (span > 0) {
      const midpoint =
        Math.round((availableRange.min + availableRange.max) / 2 / 10) * 10;
      if (midpoint > availableRange.min && midpoint < availableRange.max) {
        marks.push({ value: midpoint, label: `${midpoint}` });
      }
      marks.push({ value: availableRange.max, label: `${availableRange.max}` });
    }
    return marks;
  }, [availableRange]);

  const handleRangePreview = (_event: Event, value: number | number[]) => {
    if (!Array.isArray(value) || value.length !== 2) return;
    const [min, max] = value;
    setLocalRange({ min, max });
  };

  const handleRangeCommit = (
    _event: Event | SyntheticEvent,
    value: number | number[]
  ) => {
    if (!Array.isArray(value) || value.length !== 2) return;
    const [min, max] = value;
    const next = { min, max };
    setLocalRange(next);
    onYearRangeChange(next);
  };

  const handleResetRange = () => {
    setLocalRange(availableRange);
    onYearRangeChange(availableRange);
  };

  const handleLanguageToggle = (
    _event: ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setLocalSpanishOnly(checked);
    onLanguageModeChange(checked);
  };

  const handleTimerToggle = (
    _event: ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setLocalTimerEnabled(checked);
    onTimerModeChange(checked);
  };

  const fetchSongsForRange = useCallback(
    () =>
      fetchAllSongs({
        minYear: yearRange.min,
        maxYear: yearRange.max,
        onlySpanish,
      }),
    [onlySpanish, yearRange.max, yearRange.min]
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

  const stopPlayback = useCallback(() => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (internalPlayer && typeof internalPlayer.stopVideo === "function") {
      internalPlayer.stopVideo();
    }
    setIsPlaying(false);
  }, []);

  const clearTimerInterval = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const resetTimerState = useCallback(() => {
    clearTimerInterval();
    setTimerRemaining(TIMER_DURATION_SECONDS);
    setTimerLocked(false);
    setTimerStarted(false);
  }, [clearTimerInterval]);

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

  useEffect(() => {
    resetTimerState();
  }, [currentSong, resetTimerState]);

  useEffect(() => {
    if (
      !timerEnabled ||
      gameState !== "playing" ||
      timerLocked ||
      !timerStarted
    ) {
      clearTimerInterval();
      if (!timerEnabled) {
        setTimerRemaining(TIMER_DURATION_SECONDS);
        setTimerLocked(false);
      }
      return;
    }

    if (timerIntervalRef.current !== null) {
      return;
    }

    timerIntervalRef.current = window.setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          clearTimerInterval();
          setTimerLocked(true);
          stopPlayback();
          setErrorMessage(
            "Se acabó el tiempo. Revela la canción para continuar con la partida."
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimerInterval();
    };
  }, [
    clearTimerInterval,
    gameState,
    stopPlayback,
    timerEnabled,
    timerLocked,
    timerStarted,
  ]);

  const videoId = useMemo(
    () => (currentSong ? extractYoutubeId(currentSong.youtube_url) : null),
    [currentSong]
  );

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

  useEffect(
    () => () => {
      clearTimerInterval();
    },
    [clearTimerInterval]
  );

  const advanceToNextSong = useCallback(() => {
    void runViewTransition(() => {
      setErrorMessage(null);
      setGameState("loading");
      setIsPlaying(false);
      stopPlayback();
      clearYearSpotlightTimeout();
      resetTimerState();
      advanceQueue();
    });
  }, [
    advanceQueue,
    clearYearSpotlightTimeout,
    resetTimerState,
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
      resetTimerState();
      await startQueue();
    });
  }, [
    clearYearSpotlightTimeout,
    resetTimerState,
    runViewTransition,
    startQueue,
    stopPlayback,
  ]);

  const handleSkip = useCallback(() => {
    advanceToNextSong();
  }, [advanceToNextSong]);

  const handleReveal = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      return;
    }
    void runViewTransition(() => {
      setGameState("revealed");
      clearTimerInterval();
      setTimerLocked(false);
      setTimerStarted(false);
      if (currentSong && typeof currentSong.year === "number") {
        triggerSpotlight("Año", currentSong.year);
      }
    });
  }, [clearTimerInterval, currentSong, runViewTransition, triggerSpotlight]);

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
      resetTimerState();
      onExit();
    });
  }, [
    clearYearSpotlightTimeout,
    onExit,
    resetTimerState,
    resetQueue,
    runViewTransition,
    stopPlayback,
  ]);

  const handlePlayPause = () => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer) return;

    if (timerEnabled && timerLocked && gameState === "playing") {
      setErrorMessage(
        "Se acabó el tiempo. Revela la canción para continuar con la partida."
      );
      return;
    }

    if (isPlaying) {
      internalPlayer.pauseVideo?.();
    } else {
      setTimerStarted(true);
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
    const heading = showDetails
      ? currentSong.title
      : "¿Puedes adivinar la canción?";
    const subheading = showDetails
      ? currentSong.artist
      : "Escucha, siente y deja que la intuición te guíe.";
    const description = showDetails
      ? "Captura la magia del momento con visuales envolventes inspirados en tu canción. Sigue jugando para descubrir nuevas portadas y atmósferas impactantes."
      : 'Mantén el suspenso: cuando creas tener la respuesta, presiona "Mostrar" para confirmar tu apuesta.';
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
          label: "Siguiente",
          onClick: handleNextAfterReveal,
          variant: "contained" as const,
          color: "primary" as const,
          disabled: false,
        }
      : {
          icon: <InfoOutlinedIcon />,
          label: "Mostrar",
          onClick: handleReveal,
          variant: "contained" as const,
          color: "primary" as const,
          disabled: spotlightVisible,
        };

    const secondaryAction = showDetails
      ? {
          icon: <ExitToAppIcon />,
          label: "Salir",
          onClick: handleExit,
          variant: "outlined" as const,
          color: "inherit" as const,
        }
      : {
          icon: <SkipNextIcon />,
          label: "Saltar",
          onClick: handleSkip,
          variant: "outlined" as const,
          color: "inherit" as const,
        };

    const fallbackTitle = showDetails ? "Visual a la espera" : null;
    const fallbackDescription = artworkLoading
      ? showDetails
        ? "Estamos buscando la portada perfecta…"
        : "Estamos preparando la atmósfera visual…"
      : null;

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
    const shouldShowTimer =
      timerEnabled && gameState === "playing" && timerStarted;
    const timerLabel = timerLocked
      ? "Tiempo agotado"
      : `00:${String(timerRemaining).padStart(2, "0")}`;

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
            height: { xs: "auto", md: "100dvh" },
            minHeight: { md: "100dvh" },
            pb: { xs: 6, md: 6 },
            justifyContent: { md: "center" },
            width: { md: "min(1350px, 100vw)" },
            mx: { md: "auto" },
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
              {artworkLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} sx={{ color: theme.spinner }} />
                  <Typography variant="caption" sx={{ color: theme.text.body }}>
                    Buscando portada...
                  </Typography>
                </Stack>
              ) : null}
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
                disabled={
                  timerEnabled && timerLocked && gameState === "playing"
                }
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
                  md: "min(44vw, 77vh)",
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
                  {fallbackTitle || fallbackDescription ? (
                    <InfoOutlinedIcon
                      sx={{ fontSize: 40, color: theme.fallback.icon }}
                    />
                  ) : null}
                  {fallbackTitle ? (
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
                  ) : null}
                  {shouldShowTimer ? (
                    <Box
                      sx={{
                        px: 3,
                        py: 1.6,
                        borderRadius: 999,
                        backgroundColor: timerLocked
                          ? "rgba(248,113,113,0.34)"
                          : "rgba(94,234,212,0.26)",
                        border: timerLocked
                          ? "2px solid rgba(248,113,113,0.7)"
                          : "2px solid rgba(125,211,252,0.68)",
                        boxShadow: "0 10px 30px rgba(2,10,32,0.4)",
                        color: timerLocked
                          ? "rgba(254,226,226,0.96)"
                          : "rgba(165,243,252,0.98)",
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          m: 0,
                          fontWeight: 900,
                          letterSpacing: 1.6,
                          textTransform: "uppercase",
                          fontSize: { xs: "1.5rem", sm: "1.8rem" },
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        {timerLocked ? null : (
                          <AccessTimeIcon sx={{ fontSize: "1.4em" }} />
                        )}
                        {timerLabel}
                      </Typography>
                    </Box>
                  ) : null}
                  {fallbackDescription ? (
                    <Typography
                      variant="caption"
                      sx={{
                        textAlign: "center",
                        color: theme.fallback.caption,
                      }}
                    >
                      {fallbackDescription}
                    </Typography>
                  ) : null}
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
    const fallbackBackdrop =
      "radial-gradient(circle at 15% 20%, rgba(15,102,255,0.35) 0%, rgba(7,30,82,0.85) 38%, rgba(3,12,34,0.98) 75%), radial-gradient(circle at 85% 20%, rgba(0,209,255,0.32) 0%, rgba(5,24,64,0.5) 35%, rgba(3,12,34,0.9) 70%), linear-gradient(180deg, #06102b 0%, #030a1c 100%)";
    const theme = createAdaptiveTheme(null);

    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          minHeight: "100dvh",
          overflow: "visible",
          viewTransitionName: "auto-game-canvas",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: fallbackBackdrop,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 1,
            viewTransitionName: "auto-game-background",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(4,14,40,0.25)",
            zIndex: 2,
            viewTransitionName: "auto-game-overlay",
          }}
        />
        <YearSpotlight
          visible={spotlightVisible && spotlightValue !== null}
          value={spotlightValue}
          label={spotlightLabel}
          styles={theme.spotlight}
        />
        <Stack
          spacing={{ xs: 3, md: 4 }}
          sx={{
            position: "relative",
            zIndex: 3,
            width: "min(700px, 78vw)",
            mx: "auto",
            pt: {
              xs: "calc(env(safe-area-inset-top, 0px) + 24px)",
              sm: 5,
              md: 6,
            },
            pb: { xs: 8, md: 8 },
            alignItems: "center",
            textAlign: "center",
            viewTransitionName: "auto-game-panel",
            minHeight: { md: "100dvh" },
            justifyContent: { md: "center" },
          }}
        >
          <Box
            component="img"
            src="/ponchister_logo.png"
            alt="Ponchister"
            sx={{
              width: { xs: 140, sm: 160, md: 180 },
              height: { xs: 140, sm: 160, md: 180 },
              objectFit: "contain",
              filter: "drop-shadow(0 18px 40px rgba(2,10,36,0.55))",
            }}
          />
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.02em",
              textShadow: "0 24px 56px rgba(0,0,0,0.55)",
              fontSize: "clamp(1.7rem, 6vw, 3.2rem)",
              lineHeight: { xs: 1.2, sm: 1.15 },
            }}
          >
            Configura tu juego
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: theme.text.body,
              maxWidth: 520,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Ajusta lo esencial y comienza cuando quieras.
          </Typography>
          <Stack
            spacing={2}
            sx={{
              mt: 1,
              width: "100%",
              textAlign: "left",
            }}
          >
            <Box
              sx={{
                borderRadius: 2,
                border: "1px solid rgba(99,216,255,0.12)",
                px: 2,
                py: 1.5,
                backgroundColor: "rgba(5,24,64,0.24)",
              }}
            >
              <Stack spacing={1.6}>
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: 2,
                      fontWeight: 700,
                      color: "rgba(148,216,255,0.86)",
                    }}
                  >
                    Años de música
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(204,231,255,0.78)",
                    }}
                  >
                    {localRange.min} - {localRange.max}
                  </Typography>
                </Box>
                <Slider
                  value={[localRange.min, localRange.max]}
                  onChange={handleRangePreview}
                  onChangeCommitted={handleRangeCommit}
                  min={availableRange.min}
                  max={availableRange.max}
                  step={1}
                  marks={sliderMarks}
                  valueLabelDisplay="auto"
                  getAriaLabel={() => "Rango de años"}
                  sx={{
                    color: "#5eead4",
                    height: 4,
                    mx: 4,
                    "& .MuiSlider-markLabel": {
                      color: "rgba(224,239,255,0.92)",
                      "&[data-index='0']": {
                        transform: "translateX(14px)",
                      },
                      "&[data-index='2']": {
                        transform: "translateX(-32px)",
                      },
                    },
                    "& .MuiSlider-thumb": {
                      width: 20,
                      height: 20,
                      boxShadow: "0 6px 16px rgba(6,18,52,0.4)",
                    },
                    "& .MuiSlider-valueLabel": {
                      backgroundColor: "rgba(5,24,64,0.9)",
                      borderRadius: 1,
                    },
                  }}
                />
                {(localRange.min !== availableRange.min ||
                  localRange.max !== availableRange.max) && (
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={handleResetRange}
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      px: 0,
                      color: "rgba(148,216,255,0.9)",
                      "&:hover": {
                        color: "#5eead4",
                        backgroundColor: "transparent",
                      },
                    }}
                  >
                    Todo el catálogo
                  </Button>
                )}
              </Stack>
            </Box>
            <Box
              sx={{
                borderRadius: 2,
                border: "1px solid rgba(99,216,255,0.12)",
                px: 2,
                py: 1.5,
                backgroundColor: "rgba(5,24,64,0.24)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: 2,
                      fontWeight: 700,
                      color: "rgba(148,216,255,0.86)",
                    }}
                  >
                    Idioma
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(204,231,255,0.78)",
                    }}
                  >
                    Solo español.
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(224,239,255,0.82)" }}
                  >
                    No
                  </Typography>
                  <Switch
                    color="info"
                    checked={localSpanishOnly}
                    onChange={handleLanguageToggle}
                    inputProps={{
                      "aria-label": "Filtrar solo canciones en español",
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(224,239,255,0.9)", fontWeight: 700 }}
                  >
                    Sí
                  </Typography>
                </Stack>
              </Stack>
            </Box>
            <Box
              sx={{
                borderRadius: 2,
                border: "1px solid rgba(99,216,255,0.12)",
                px: 2,
                py: 1.5,
                backgroundColor: "rgba(5,24,64,0.24)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: 2,
                      fontWeight: 700,
                      color: "rgba(148,216,255,0.86)",
                    }}
                  >
                    Tiempo
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(204,231,255,0.78)",
                    }}
                  >
                    60 segundos por canción.
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(224,239,255,0.82)" }}
                  >
                    No
                  </Typography>
                  <Switch
                    color="info"
                    checked={localTimerEnabled}
                    onChange={handleTimerToggle}
                    inputProps={{
                      "aria-label": "Activar temporizador de 60 segundos",
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(224,239,255,0.9)", fontWeight: 700 }}
                  >
                    Sí
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              pt: { xs: 2, md: 3 },
              alignSelf: "center",
              width: "fit-content",
              maxWidth: 520,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={handleStart}
              sx={{
                minWidth: { sm: 220 },
                width: { xs: "100%", sm: 220 },
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
              Iniciar juego
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<CalendarMonthIcon />}
              onClick={handleRandomYearReveal}
              disabled={spotlightVisible}
              sx={{
                minWidth: { sm: 220 },
                width: { xs: "100%", sm: 220 },
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
              Año al azar
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ExitToAppIcon />}
              onClick={handleExit}
              sx={{
                minWidth: { sm: 220 },
                width: { xs: "100%", sm: 220 },
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
              Volver
            </Button>
          </Stack>
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
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: isExperienceMode
          ? { xs: "flex-start", md: "center" }
          : { xs: "flex-start", md: "center" },
        alignItems: isExperienceMode
          ? { xs: "stretch", md: "center" }
          : "center",
        color: rootTheme.text.primary,
        textAlign: "center",
        p: 0,
        pt: isExperienceMode
          ? 0
          : { xs: "calc(env(safe-area-inset-top, 0px) + 8px)", sm: 0 },
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
