import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CasinoIcon from "@mui/icons-material/Casino";
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

interface InternalPlayer {
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
  setPlaybackRate?: (rate: number) => void;
  setPlaybackQuality?: (suggestedQuality: string) => void;
}

interface BingoGameProps {
  onExit: () => void;
}

interface BingoCategory {
  id: string;
  label: string;
  description: string;
  color: string;
}

type BingoMode = "beginner" | "expert";
type BingoPhase =
  | "select-mode"
  | "loading"
  | "roulette"
  | "spinning"
  | "playing"
  | "revealed"
  | "error";

type PlayerRef = YouTube | null;

type ModeDictionary = Record<BingoMode, BingoCategory[]>;

type ModeLabels = Record<BingoMode, string>;

const MODE_LABELS: ModeLabels = {
  beginner: "Modo principiantes",
  expert: "Modo experto",
};

const BINGO_MODES: ModeDictionary = {
  beginner: [
    {
      id: "group-or-solo",
      label: "Grupo o solista",
      description: "¿Quién interpreta la canción: un grupo o una sola voz?",
      color: "#22c55e",
    },
    {
      id: "before-2000",
      label: "¿Antes del 2000?",
      description: "Determina si la canción se lanzó antes del año 2000.",
      color: "#ec4899",
    },
    {
      id: "plus-minus-4",
      label: "4 años arriba o abajo",
      description: "Adivina el año con un margen de ±4 años.",
      color: "#facc15",
    },
    {
      id: "decade",
      label: "Década",
      description: "Identifica la década en la que salió la canción.",
      color: "#8b5cf6",
    },
    {
      id: "plus-minus-2",
      label: "2 años arriba o abajo",
      description: "Adivina el año con un margen de ±2 años.",
      color: "#38bdf8",
    },
  ],
  expert: [
    {
      id: "song-title",
      label: "Título de la canción",
      description: "Di el título exacto de la canción que suena.",
      color: "#22c55e",
    },
    {
      id: "exact-year",
      label: "Año exacto",
      description: "Menciona el año exacto de lanzamiento.",
      color: "#ec4899",
    },
    {
      id: "artist-name",
      label: "Nombre del grupo o cantante",
      description: "Identifica al intérprete o la banda.",
      color: "#facc15",
    },
    {
      id: "decade",
      label: "Década",
      description: "Identifica la década en la que salió la canción.",
      color: "#8b5cf6",
    },
    {
      id: "plus-minus-3",
      label: "3 años arriba o abajo",
      description: "Adivina el año con un margen de ±3 años.",
      color: "#38bdf8",
    },
  ],
};

const hexToRgba = (hex: string, alpha = 1): string => {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const value = Number.parseInt(sanitized, 16);
  if (Number.isNaN(value)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const BingoGame: React.FC<BingoGameProps> = ({ onExit }) => {
  const [phase, setPhase] = useState<BingoPhase>("select-mode");
  const [selectedMode, setSelectedMode] = useState<BingoMode | null>(null);
  const [currentCategory, setCurrentCategory] = useState<BingoCategory | null>(
    null
  );
  const [highlightedCategory, setHighlightedCategory] =
    useState<BingoCategory | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [yearSpotlightVisible, setYearSpotlightVisible] = useState(false);
  const [spotlightYear, setSpotlightYear] = useState<number | null>(null);

  const playerRef = useRef<PlayerRef>(null);
  const spinIntervalRef = useRef<number | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);
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
  const { palette: artworkPalette } = useArtworkPalette(artworkUrl);

  const runViewTransition = useViewTransition();

  const clearSpinScheduling = useCallback(() => {
    if (spinIntervalRef.current !== null) {
      window.clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    if (spinTimeoutRef.current !== null) {
      window.clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
    }
  }, []);

  const clearYearSpotlightTimeout = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      clearTimeout(yearSpotlightTimerRef.current);
      yearSpotlightTimerRef.current = null;
    }
    setYearSpotlightVisible(false);
    setSpotlightYear(null);
  }, []);

  const triggerYearSpotlight = useCallback((year: number) => {
    if (yearSpotlightTimerRef.current) {
      return;
    }
    setSpotlightYear(year);
    setYearSpotlightVisible(true);
    yearSpotlightTimerRef.current = setTimeout(() => {
      setYearSpotlightVisible(false);
      setSpotlightYear(null);
      yearSpotlightTimerRef.current = null;
    }, 4600);
  }, []);

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
      clearSpinScheduling();
    },
    [clearSpinScheduling]
  );

  useEffect(
    () => () => {
      clearYearSpotlightTimeout();
    },
    [clearYearSpotlightTimeout]
  );

  useEffect(
    () => () => {
      stopPlayback();
    },
    [stopPlayback]
  );

  useEffect(() => {
    if (!currentSong) {
      return;
    }
    setPlayerKey((prev) => prev + 1);
    setIsPlaying(false);
    setErrorMessage(null);
    clearYearSpotlightTimeout();
    if (
      selectedMode &&
      phase !== "playing" &&
      phase !== "revealed" &&
      phase !== "spinning"
    ) {
      setPhase("roulette");
    }
  }, [currentSong, clearYearSpotlightTimeout, phase, selectedMode]);

  useEffect(() => {
    if (!selectedMode) {
      return;
    }
    if (queueStatus === "loading" && phase !== "loading") {
      setPhase("loading");
    }
    if (queueStatus === "error" || queueStatus === "exhausted") {
      setPhase("error");
    }
  }, [queueStatus, selectedMode, phase]);

  const videoId = useMemo(
    () => (currentSong ? extractYoutubeId(currentSong.youtube_url) : null),
    [currentSong]
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

  const handleSelectMode = useCallback(
    (mode: BingoMode) => {
      void runViewTransition(async () => {
        clearSpinScheduling();
        setSelectedMode(mode);
        setPhase("loading");
        setErrorMessage(null);
        setCurrentCategory(null);
        setHighlightedCategory(null);
        setIsPlaying(false);
        stopPlayback();
        clearYearSpotlightTimeout();
        await startQueue();
      });
    },
    [
      clearSpinScheduling,
      clearYearSpotlightTimeout,
      runViewTransition,
      startQueue,
      stopPlayback,
    ]
  );

  const handleResetToModeSelection = useCallback(() => {
    void runViewTransition(() => {
      clearSpinScheduling();
      stopPlayback();
      resetQueue();
      clearYearSpotlightTimeout();
      setSelectedMode(null);
      setCurrentCategory(null);
      setHighlightedCategory(null);
      setPhase("select-mode");
      setErrorMessage(null);
      setIsPlaying(false);
    });
  }, [
    clearSpinScheduling,
    clearYearSpotlightTimeout,
    resetQueue,
    runViewTransition,
    stopPlayback,
  ]);

  const handleSpin = useCallback(() => {
    if (!selectedMode || !currentSong || phase === "spinning") {
      return;
    }
    const categories = BINGO_MODES[selectedMode];
    if (!categories.length) {
      return;
    }
    clearSpinScheduling();
    clearYearSpotlightTimeout();
    setPhase("spinning");
    setCurrentCategory(null);
    setErrorMessage(null);
    setYearSpotlightVisible(false);

    let index = Math.floor(Math.random() * categories.length);
    setHighlightedCategory(categories[index]);

    spinIntervalRef.current = window.setInterval(() => {
      index = (index + 1) % categories.length;
      setHighlightedCategory(categories[index]);
    }, 120);

    spinTimeoutRef.current = window.setTimeout(() => {
      clearSpinScheduling();
      const finalCategory =
        categories[Math.floor(Math.random() * categories.length)];
      setHighlightedCategory(finalCategory);
      setCurrentCategory(finalCategory);
      setPhase("playing");
    }, 2600);
  }, [
    clearSpinScheduling,
    clearYearSpotlightTimeout,
    currentSong,
    phase,
    selectedMode,
  ]);

  const handleReveal = useCallback(() => {
    if (!currentSong || yearSpotlightTimerRef.current) {
      return;
    }
    void runViewTransition(() => {
      setPhase("revealed");
      if (typeof currentSong.year === "number") {
        triggerYearSpotlight(currentSong.year);
      }
    });
  }, [currentSong, runViewTransition, triggerYearSpotlight]);

  const handleRandomYearReveal = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      return;
    }
    const currentYear = new Date().getFullYear();
    const minYear = 1950;
    const randomYear =
      Math.floor(Math.random() * (currentYear - minYear + 1)) + minYear;
    void runViewTransition(() => {
      triggerYearSpotlight(randomYear);
    });
  }, [runViewTransition, triggerYearSpotlight]);

  const handleReturnToRoulette = useCallback(() => {
    if (!selectedMode) {
      return;
    }
    void runViewTransition(() => {
      clearSpinScheduling();
      clearYearSpotlightTimeout();
      setPhase("loading");
      setCurrentCategory(null);
      setHighlightedCategory(null);
      setErrorMessage(null);
      setIsPlaying(false);
      stopPlayback();
      advanceQueue();
    });
  }, [
    advanceQueue,
    clearSpinScheduling,
    clearYearSpotlightTimeout,
    runViewTransition,
    selectedMode,
    stopPlayback,
  ]);

  const handlePlayerError = useCallback<
    NonNullable<YouTubeProps["onError"]>
  >(() => {
    setIsPlaying(false);
    setErrorMessage(
      "No pudimos reproducir el video de esta canción. Pasamos a la siguiente pista."
    );
    if (selectedMode) {
      clearSpinScheduling();
      clearYearSpotlightTimeout();
      setPhase("loading");
      setCurrentCategory(null);
      setHighlightedCategory(null);
      advanceQueue();
    } else {
      setPhase("error");
    }
  }, [
    advanceQueue,
    clearSpinScheduling,
    clearYearSpotlightTimeout,
    selectedMode,
  ]);

  const handleExit = useCallback(() => {
    void runViewTransition(() => {
      clearSpinScheduling();
      clearYearSpotlightTimeout();
      stopPlayback();
      resetQueue();
      setSelectedMode(null);
      setCurrentCategory(null);
      setHighlightedCategory(null);
      setPhase("select-mode");
      setErrorMessage(null);
      setIsPlaying(false);
      setYearSpotlightVisible(false);
      setSpotlightYear(null);
      onExit();
    });
  }, [
    clearSpinScheduling,
    clearYearSpotlightTimeout,
    onExit,
    resetQueue,
    runViewTransition,
    stopPlayback,
  ]);

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

  const handlePlayPause = useCallback(() => {
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
  }, [applyPlaybackOptimizations, isPlaying]);

  const displayedError = errorMessage ?? queueError;
  const categories = selectedMode ? BINGO_MODES[selectedMode] : [];
  const modeLabel = selectedMode ? MODE_LABELS[selectedMode] : null;

  const renderModeSelection = () => (
    <Stack
      spacing={6}
      alignItems="center"
      justifyContent="center"
      sx={{ width: "100%", py: { xs: 6, md: 8 } }}
    >
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Typography
          variant="h3"
          sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}
        >
          Bingo Ponchister
        </Typography>
        <Typography
          variant="h6"
          sx={{ color: "rgba(224,239,255,0.82)", maxWidth: 720 }}
        >
          Elige la dificultad, gira la ruleta y responde a la categoría
          seleccionada antes de revelar la canción. En el modo bingo no puedes
          saltar canciones, cada pista cuenta para completar tu cartón.
        </Typography>
      </Stack>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={3.5}
        sx={{ width: "min(960px, 92vw)" }}
      >
        {(Object.keys(BINGO_MODES) as BingoMode[]).map((mode) => (
          <Box
            key={mode}
            sx={{
              flex: 1,
              borderRadius: 4,
              p: { xs: 3, md: 4 },
              background:
                mode === "beginner"
                  ? "linear-gradient(140deg, rgba(34,197,94,0.22) 0%, rgba(59,130,246,0.12) 100%)"
                  : "linear-gradient(140deg, rgba(236,72,153,0.22) 0%, rgba(79,70,229,0.16) 100%)",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 34px 68px -32px rgba(5,18,52,0.68)",
              backdropFilter: "blur(16px)",
            }}
          >
            <Stack spacing={2.5}>
              <Stack spacing={0.5}>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, color: "#fff" }}
                >
                  {MODE_LABELS[mode]}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: "rgba(224,239,255,0.78)" }}
                >
                  {mode === "beginner"
                    ? "Categorías pensadas para romper el hielo y animar a todos a jugar."
                    : "Desafíos para quienes quieren probar su memoria musical al máximo."}
                </Typography>
              </Stack>
              <Stack spacing={1.2}>
                {BINGO_MODES[mode].map((category) => (
                  <Chip
                    key={category.id}
                    label={`${category.label} · ${category.description}`}
                    sx={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      whiteSpace: "normal",
                      lineHeight: 1.3,
                      backgroundColor: hexToRgba(category.color, 0.22),
                      color: "rgba(255,255,255,0.92)",
                      border: `1px solid ${hexToRgba(category.color, 0.48)}`,
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      px: 1.5,
                      py: 1.1,
                    }}
                  />
                ))}
              </Stack>
              <Button
                variant="contained"
                endIcon={<CasinoIcon />}
                onClick={() => handleSelectMode(mode)}
                disabled={phase === "loading" && selectedMode === mode}
                sx={{
                  mt: 1,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.5,
                  alignSelf: "flex-start",
                  background:
                    mode === "beginner"
                      ? "linear-gradient(135deg, #22c55e 0%, #10b981 50%, #38bdf8 100%)"
                      : "linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #6366f1 100%)",
                  boxShadow:
                    mode === "beginner"
                      ? "0 24px 52px -20px rgba(34,197,94,0.55)"
                      : "0 24px 52px -20px rgba(236,72,153,0.55)",
                  "&:hover": {
                    background:
                      mode === "beginner"
                        ? "linear-gradient(135deg, #16a34a 0%, #0ea5e9 100%)"
                        : "linear-gradient(135deg, #db2777 0%, #7c3aed 100%)",
                  },
                }}
              >
                Elegir{" "}
                {mode === "beginner" ? "modo principiantes" : "modo experto"}
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Stack>
  );

  const renderLoadingView = () => (
    <Stack
      spacing={3}
      alignItems="center"
      justifyContent="center"
      sx={{ width: "100%", py: { xs: 6, md: 8 } }}
    >
      <CircularProgress thickness={4} size={80} sx={{ color: "#d7f9ff" }} />
      <Stack spacing={1} alignItems="center" textAlign="center">
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Preparando tu ruleta musical…
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "rgba(224,239,255,0.78)", maxWidth: 540 }}
        >
          Estamos equilibrando las canciones para que cada giro tenga una pista
          distinta. Mantén la pantalla lista para girar cuando aparezca la
          ruleta.
        </Typography>
      </Stack>
    </Stack>
  );

  const renderRouletteView = () => (
    <Stack
      spacing={4}
      alignItems="center"
      justifyContent="center"
      sx={{ width: "100%", py: { xs: 6, md: 8 } }}
    >
      {modeLabel && (
        <Chip
          label={modeLabel}
          sx={{
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 600,
            backgroundColor: "rgba(255,255,255,0.16)",
            color: "#fff",
            backdropFilter: "blur(10px)",
          }}
        />
      )}
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Gira la ruleta para elegir la categoría
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "rgba(224,239,255,0.78)", maxWidth: 620 }}
        >
          Cuando aparezca el color ganador, escucha la canción y responde según
          la consigna. No hay saltos en el modo bingo, así que asegúrate de
          dejar registro antes de revelar la pista.
        </Typography>
      </Stack>
      <Stack spacing={1.2} sx={{ width: "min(680px, 92vw)" }}>
        {categories.map((category) => {
          const isActive = highlightedCategory?.id === category.id;
          return (
            <Box
              key={category.id}
              sx={{
                borderRadius: 999,
                border: `2px solid ${hexToRgba(
                  category.color,
                  isActive ? 0.9 : 0.45
                )}`,
                background: isActive
                  ? `linear-gradient(135deg, ${hexToRgba(
                      category.color,
                      0.65
                    )} 0%, rgba(4,12,26,0.65) 100%)`
                  : `linear-gradient(135deg, ${hexToRgba(
                      category.color,
                      0.22
                    )} 0%, rgba(4,12,26,0.55) 100%)`,
                boxShadow: isActive
                  ? `0 22px 48px -20px ${hexToRgba(category.color, 0.55)}`
                  : "none",
                transition: "all 180ms ease-out",
                px: 3,
                py: 1.6,
              }}
            >
              <Stack spacing={0.3}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  {category.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(224,239,255,0.78)" }}
                >
                  {category.description}
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Stack spacing={2} alignItems="center">
        <Button
          variant="contained"
          size="large"
          startIcon={<CasinoIcon />}
          onClick={handleSpin}
          disabled={phase === "spinning" || !currentSong}
          sx={{
            minWidth: 240,
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 999,
            px: 3.5,
            py: 1.6,
            background:
              phase === "spinning"
                ? "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)"
                : "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #22d3ee 100%)",
            boxShadow: "0 24px 52px -20px rgba(37,99,235,0.66)",
            "&:hover": {
              background:
                "linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #06b6d4 100%)",
            },
          }}
        >
          {phase === "spinning" ? "Girando la ruleta…" : "Girar ruleta"}
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={handleResetToModeSelection}
          sx={{
            textTransform: "none",
            color: "rgba(224,239,255,0.78)",
            fontWeight: 600,
          }}
        >
          Cambiar dificultad
        </Button>
      </Stack>
      {displayedError && (
        <Alert
          severity="warning"
          sx={{
            mt: 2,
            width: "min(520px, 92vw)",
            backgroundColor: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.28)",
            backdropFilter: "blur(12px)",
            textAlign: "left",
          }}
        >
          {displayedError}
        </Alert>
      )}
    </Stack>
  );

  const renderErrorView = () => (
    <Stack
      spacing={3.5}
      alignItems="center"
      justifyContent="center"
      sx={{ width: "100%", py: { xs: 6, md: 8 } }}
    >
      <Alert
        severity="error"
        icon={false}
        sx={{
          width: "min(520px, 92vw)",
          backgroundColor: "rgba(255,255,255,0.08)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.24)",
          backdropFilter: "blur(12px)",
          fontWeight: 500,
          textAlign: "left",
        }}
      >
        {displayedError ??
          "No pudimos continuar la partida bingo. Intenta reiniciarla o vuelve al menú principal."}
      </Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {selectedMode ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<RestartAltIcon />}
            onClick={() => handleSelectMode(selectedMode)}
            sx={{
              minWidth: 200,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 999,
              px: 3.5,
              py: 1.5,
            }}
          >
            Reintentar partida
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={<RestartAltIcon />}
            onClick={handleResetToModeSelection}
            sx={{
              minWidth: 200,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 999,
              px: 3.5,
              py: 1.5,
            }}
          >
            Volver a elegir modo
          </Button>
        )}
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
          Salir
        </Button>
      </Stack>
    </Stack>
  );

  const renderExperienceView = (mode: "guess" | "reveal") => {
    if (!currentSong || !currentCategory) {
      return null;
    }

    const showDetails = mode === "reveal";

    const theme = createAdaptiveTheme(
      showDetails && artworkUrl ? artworkPalette : null
    );

    const overlayBackground = currentCategory
      ? `linear-gradient(135deg, ${hexToRgba(
          currentCategory.color,
          0.56
        )} 0%, ${theme.overlayTint} 55%, rgba(3,10,24,0.88) 100%)`
      : theme.overlayTint;

    const primaryChipLabel = currentCategory.label;
    const secondaryChipLabel = showDetails
      ? typeof currentSong.year === "number"
        ? `Año ${currentSong.year}`
        : "Año no disponible"
      : currentCategory.description;
    const tertiaryChipLabel = showDetails
      ? "Vuelve a la ruleta para la siguiente categoría"
      : "En este modo no puedes saltar canciones";

    const heading = showDetails
      ? currentSong.title
      : currentCategory.description;
    const subheading = showDetails
      ? currentSong.artist
      : "Escucha atentamente y anota tu respuesta antes de revelar la canción.";
    const description = showDetails
      ? "Comparte la respuesta, marca tu cartón y prepárate para volver a la ruleta."
      : "Cuando todos tengan su apuesta lista, pulsa el botón para revelar artista y canción.";

    const statusCaptionLabel = showDetails
      ? "Información revelada"
      : "En juego";
    const statusCaptionDescription = showDetails
      ? 'Presiona "Volver a la ruleta" para girar por una nueva categoría.'
      : "Puedes pausar la pista, mostrar un año al azar o revelar la canción cuando estén listos.";

    const primaryAction = showDetails
      ? {
          icon: <CasinoIcon />,
          label: "Volver a la ruleta",
          onClick: handleReturnToRoulette,
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
          disabled: yearSpotlightVisible,
        };

    const secondaryAction = {
      icon: <ExitToAppIcon />,
      label: "Salir del bingo",
      onClick: handleExit,
      variant: "outlined" as const,
      color: "inherit" as const,
    };

    const fallbackTitle = showDetails
      ? "Visual a la espera"
      : "Escucha en suspenso";
    const fallbackDescription = artworkLoading
      ? showDetails
        ? "Buscando la portada ideal para tu revelación…"
        : "Estamos preparando la atmósfera visual mientras suena la pista."
      : "Sigue escuchando, pronto llegará la inspiración visual.";

    const displayedArtworkError = artworkError
      ? showDetails
        ? artworkError
        : "No encontramos una portada precisa. Imagina la escena mientras resuelves la categoría."
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
          viewTransitionName: "bingo-game-canvas",
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
            viewTransitionName: "bingo-game-background",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            backdropFilter: "blur(12px)",
            background: overlayBackground,
            viewTransitionName: "bingo-game-overlay",
          }}
        />
        <NeonLines
          active={phase === "playing" || phase === "revealed"}
          sx={{ zIndex: 3, viewTransitionName: "bingo-game-neon" }}
        />
        <YearSpotlight
          visible={yearSpotlightVisible && spotlightDisplayYear !== null}
          year={spotlightDisplayYear}
          styles={theme.spotlight}
        />
        <Stack
          direction={{ xs: "column-reverse", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          sx={{
            position: "relative",
            zIndex: 3,
            minHeight: { xs: "auto", md: 640 },
            px: { xs: 2.5, sm: 4, md: 6 },
            py: { xs: 6, sm: 7, md: 8 },
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Stack
            spacing={{ xs: 2.4, md: 3 }}
            sx={{ flex: { xs: "auto", md: 1 }, maxWidth: { md: 420 } }}
          >
            <Stack spacing={1.2}>
              <Chip
                label={primaryChipLabel}
                sx={{
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  backgroundColor: hexToRgba(currentCategory.color, 0.35),
                  color: "#fff",
                  border: `1px solid ${hexToRgba(currentCategory.color, 0.6)}`,
                  backdropFilter: "blur(10px)",
                }}
              />
              <Chip
                label={secondaryChipLabel}
                sx={{
                  fontWeight: 600,
                  backgroundColor: "rgba(13,148,255,0.2)",
                  color: "rgba(212,239,255,0.95)",
                  border: "1px solid rgba(148,197,255,0.35)",
                }}
              />
              <Chip
                label={tertiaryChipLabel}
                sx={{
                  fontWeight: 600,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "rgba(230,243,255,0.92)",
                  border: "1px dashed rgba(230,243,255,0.35)",
                }}
              />
            </Stack>
            <Stack spacing={2.2}>
              <Stack spacing={0.8}>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: theme.text.primary,
                    textShadow: theme.textShadow,
                  }}
                >
                  {heading}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: theme.text.secondary,
                  }}
                >
                  {subheading}
                </Typography>
              </Stack>
              <Typography
                variant="body1"
                sx={{
                  color: theme.text.body,
                  lineHeight: 1.6,
                }}
              >
                {description}
              </Typography>
            </Stack>
            <Stack spacing={{ xs: 2, sm: 2.4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <IconButton
                  size="large"
                  onClick={handlePlayPause}
                  sx={{
                    width: 68,
                    height: 68,
                    borderRadius: "50%",
                    background: theme.iconButton.background,
                    border: theme.iconButton.border,
                    boxShadow: theme.iconButton.shadow,
                    color: theme.iconButton.color,
                    "&:hover": {
                      background: theme.iconButton.hoverBackground,
                      color: theme.iconButton.hoverColor,
                      boxShadow: theme.iconButton.hoverShadow,
                    },
                  }}
                >
                  {isPlaying ? (
                    <PauseIcon fontSize="large" />
                  ) : (
                    <PlayArrowIcon fontSize="large" />
                  )}
                </IconButton>
                <Button
                  variant={primaryAction.variant}
                  color={primaryAction.color}
                  startIcon={primaryAction.icon}
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 3.2,
                    py: 1.4,
                    boxShadow: theme.primaryButton.shadow,
                    background: theme.primaryButton.background,
                    color: theme.primaryButton.textColor,
                    "&:hover": {
                      background: theme.primaryButton.hoverBackground,
                      boxShadow: theme.primaryButton.hoverShadow,
                    },
                  }}
                >
                  {primaryAction.label}
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant={secondaryAction.variant}
                  color={secondaryAction.color}
                  startIcon={secondaryAction.icon}
                  onClick={secondaryAction.onClick}
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 3,
                    py: 1.3,
                    borderColor: theme.secondaryButton.border,
                    color: theme.secondaryButton.textColor,
                    "&:hover": {
                      borderColor: theme.secondaryButton.hoverBorder,
                      backgroundColor: theme.secondaryButton.hoverBackground,
                    },
                  }}
                >
                  {secondaryAction.label}
                </Button>
                <IconButton
                  onClick={handleRandomYearReveal}
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    border: "2px dashed rgba(255,255,255,0.4)",
                    color: theme.text.caption,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    "&:hover": {
                      backgroundColor: "rgba(255,255,255,0.16)",
                    },
                  }}
                >
                  <CalendarMonthIcon />
                </IconButton>
              </Stack>
            </Stack>
            <Stack spacing={0.4}>
              <Typography
                variant="subtitle2"
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  fontWeight: 600,
                  color: theme.status.label,
                }}
              >
                {statusCaptionLabel}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.status.description }}
              >
                {statusCaptionDescription}
              </Typography>
            </Stack>
            {displayedError && (
              <Alert
                severity="warning"
                sx={{
                  backgroundColor: theme.alert.background,
                  color: theme.alert.color,
                  border: `1px solid ${theme.alert.border}`,
                  backdropFilter: "blur(12px)",
                  textAlign: "left",
                }}
              >
                {displayedError}
              </Alert>
            )}
          </Stack>
          <Box
            sx={{
              position: "relative",
              flex: { xs: "auto", md: 1.1 },
              minHeight: { xs: 320, md: 420 },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              viewTransitionName: "bingo-game-visual",
            }}
          >
            {shouldDisplayArtwork ? (
              <Box
                component="img"
                src={artworkUrl ?? undefined}
                alt={currentSong.title}
                sx={{
                  width: { xs: "80%", sm: "72%", md: "78%" },
                  maxWidth: 440,
                  borderRadius: 4,
                  boxShadow:
                    "0 38px 84px -32px rgba(5,18,52,0.72), 0 0 0 1px rgba(255,255,255,0.18)",
                  objectFit: "cover",
                }}
              />
            ) : (
              <Box
                sx={{
                  width: { xs: "80%", sm: "70%", md: "74%" },
                  maxWidth: 420,
                  aspectRatio: "1/1",
                  borderRadius: 4,
                  border: "1px dashed rgba(255,255,255,0.32)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  px: 3,
                  py: 3,
                  color: theme.fallback.text,
                  background: theme.fallback.background,
                }}
              >
                <Stack spacing={1.2}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: theme.fallback.text }}
                  >
                    {fallbackTitle}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: theme.fallback.caption }}
                  >
                    {fallbackDescription}
                  </Typography>
                  {displayedArtworkError && (
                    <Typography
                      variant="caption"
                      sx={{ color: theme.warningText }}
                    >
                      {displayedArtworkError}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        </Stack>
      </Box>
    );
  };

  const renderControls = () => {
    if (phase === "select-mode") {
      return renderModeSelection();
    }

    if (phase === "loading") {
      return renderLoadingView();
    }

    if (phase === "error") {
      return renderErrorView();
    }

    if (phase === "roulette" || phase === "spinning") {
      return renderRouletteView();
    }

    if (phase === "revealed") {
      return renderExperienceView("reveal");
    }

    return renderExperienceView("guess");
  };

  const isExperienceMode = phase === "playing" || phase === "revealed";

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
        color: "#fff",
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
        viewTransitionName: "bingo-game-root",
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
        }}
      >
        {renderControls()}
      </Box>
    </Box>
  );
};

export default BingoGame;
