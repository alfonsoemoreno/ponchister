import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CasinoIcon from "@mui/icons-material/Casino";
import ClearIcon from "@mui/icons-material/Clear";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShuffleIcon from "@mui/icons-material/Shuffle";
// import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { fetchAllSongs } from "./services/songService";
import { extractYoutubeId } from "./lib/autoGameQueue";
import { useAutoGameQueue } from "./hooks/useAutoGameQueue";
import { useArtworkLookup } from "./hooks/useArtworkLookup";
import { useArtworkPalette } from "./hooks/useArtworkPalette";
import { NeonLines } from "./auto-game/NeonLines";
// import NeonRouletteLights from "./auto-game/NeonRouletteLights";
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
  | "card-editor"
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
  // Inyecta los keyframes de animación solo una vez en el navegador
  useEffect(() => {
    if (
      typeof document !== "undefined" &&
      !document.getElementById("roulette-glow-keyframes")
    ) {
      const style = document.createElement("style");
      style.id = "roulette-glow-keyframes";
      style.innerHTML = `
@keyframes roulette-glow {
  0% { box-shadow: 0 0 32px 8px #fffbe7, 0 0 64px 0px #fffbe7, 0 0 0 4px rgba(255,255,180,0.25); }
  100% { box-shadow: 0 0 64px 24px #fffbe7, 0 0 128px 0px #fffbe7, 0 0 0 8px rgba(255,255,180,0.32); }
}
@keyframes roulette-flash {
  0% { opacity: 0.7; }
  100% { opacity: 0.2; }
}
`;
      document.head.appendChild(style);
    }
  }, []);
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
  const [spotlightVisible, setSpotlightVisible] = useState(false);
  const [spotlightValue, setSpotlightValue] = useState<string | number | null>(
    null
  );
  const [spotlightLabel, setSpotlightLabel] = useState<string>("Año");

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
    if (selectedMode) {
      setPhase((prevPhase) => {
        if (
          prevPhase === "playing" ||
          prevPhase === "revealed" ||
          prevPhase === "spinning"
        ) {
          return prevPhase;
        }
        return "roulette";
      });
    }
  }, [currentSong, clearYearSpotlightTimeout, selectedMode]);

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
      let label: string | null = null;
      let value: string | number | null = null;

      if (currentCategory) {
        const categoryId = currentCategory.id;
        const songYear =
          typeof currentSong.year === "number" ? currentSong.year : null;

        if (
          categoryId === "plus-minus-4" ||
          categoryId === "plus-minus-2" ||
          categoryId === "plus-minus-3" ||
          categoryId === "exact-year"
        ) {
          if (songYear !== null) {
            label = "Año";
            value = songYear;
          }
        } else if (categoryId === "before-2000") {
          if (songYear !== null) {
            label = "¿Antes del 2000?";
            value = songYear < 2000 ? "Sí" : "No";
          }
        } else if (categoryId === "decade") {
          if (songYear !== null) {
            const decadeStart = Math.floor(songYear / 10) * 10;
            label = "Década";
            value = `${decadeStart}s`;
          }
        } else if (categoryId === "artist-name") {
          if (currentSong.artist) {
            label = "Artista";
            value = currentSong.artist;
          }
        } else if (categoryId === "song-title") {
          if (currentSong.title) {
            label = "Canción";
            value = currentSong.title;
          }
        }
      }

      if (label && value !== null && value !== "") {
        triggerSpotlight(label, value);
      }
    });
  }, [currentCategory, currentSong, runViewTransition, triggerSpotlight]);

  // handleRandomYearReveal removido porque el botón de calendario ya no está en la vista

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
      setSpotlightVisible(false);
      setSpotlightValue(null);
      setSpotlightLabel("Año");
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

  // Card editor state: 5x5 grid and editor text
  type CardCell = { color: string; checked: boolean };
  const [cardCells, setCardCells] = useState<CardCell[] | null>(null);
  const [editorText, setEditorText] = useState<string>("");
  const [confirmRandomizeOpen, setConfirmRandomizeOpen] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);

  const randomizeCard = (mode: BingoMode) => {
    const palette = BINGO_MODES[mode].map((c) => c.color);
    const cells: CardCell[] = Array.from({ length: 25 }).map(() => ({
      color: palette[Math.floor(Math.random() * palette.length)],
      checked: false,
    }));
    setCardCells(cells);
    try {
      localStorage.setItem(
        `ponchister_carton_${mode}`,
        JSON.stringify({ cells, text: editorText ?? "" })
      );
    } catch {
      // ignore storage errors
    }
  };

  const handleOpenCardEditor = (mode: BingoMode) => {
    setSelectedMode(mode);
    randomizeCard(mode);
    setEditorText("");
    setPhase("card-editor");
  };

  const toggleCell = (index: number) => {
    if (!cardCells) return;
    const next = cardCells.slice();
    next[index] = { ...next[index], checked: !next[index].checked };
    setCardCells(next);
    if (selectedMode) {
      try {
        localStorage.setItem(
          `ponchister_carton_${selectedMode}`,
          JSON.stringify({ cells: next, text: editorText ?? "" })
        );
      } catch {
        /* noop */
      }
    }
  };

  const clearEditorText = () => setEditorText("");

  // persist text changes
  useEffect(() => {
    if (!selectedMode) return;
    if (!cardCells) return;
    try {
      localStorage.setItem(
        `ponchister_carton_${selectedMode}`,
        JSON.stringify({ cells: cardCells, text: editorText ?? "" })
      );
    } catch {
      /* noop */
    }
  }, [editorText, cardCells, selectedMode]);

  const renderModeSelection = () => (
    <Stack
      spacing={6}
      alignItems="center"
      justifyContent="center"
      sx={{ width: "100%", py: { xs: 6, md: 8 } }}
    >
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Typography
          variant="h6"
          sx={{
            color: "rgba(224,239,255,0.82)",
            maxWidth: 720,
            fontSize: { xs: "1rem", sm: "1.1rem", md: "1.2rem" },
            lineHeight: { xs: 1.45, sm: 1.5 },
            px: { xs: 2, sm: 0 },
          }}
        ></Typography>
      </Stack>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={3.5}
        sx={{
          width: "min(960px, 92vw)",
          mx: "auto",
          justifyContent: { md: "center" },
        }}
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
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => handleOpenCardEditor(mode)}
                sx={{
                  mt: 1,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.2,
                  alignSelf: "flex-start",
                  color: "rgba(255,255,255,0.92)",
                  borderColor: "rgba(255,255,255,0.16)",
                }}
              >
                Ir a mi cartón
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
      sx={{
        width: "100%",
        py: { xs: 6, md: 8 },
        position: "relative",
        minHeight: 320,
      }}
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
                border: `2.5px solid ${hexToRgba(
                  category.color,
                  isActive ? 1 : 0.45
                )}`,
                background: isActive
                  ? hexToRgba(category.color, 0.85)
                  : hexToRgba(category.color, 0.22),
                boxShadow: "none",
                transition:
                  "background 220ms cubic-bezier(.4,2,.6,1), border 180ms",
                px: 3,
                py: 1.6,
                position: "relative",
                overflow: "hidden",
                animation: "none",
                zIndex: isActive ? 2 : 1,
              }}
            >
              <Stack spacing={0.3} sx={{ position: "relative", zIndex: 2 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 800,
                    color: isActive ? "#fffbe7" : "#fff",
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    textShadow: "none",
                    transition: "color 180ms",
                  }}
                >
                  {category.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: isActive ? "#fffbe7" : "rgba(224,239,255,0.78)",
                    textShadow: "none",
                    fontWeight: isActive ? 700 : 400,
                    transition: "color 180ms",
                  }}
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

  const handleCloseCardEditor = () => {
    setCardCells(null);
    setEditorText("");
    setPhase("select-mode");
  };

  const renderCardEditor = () => {
    if (!cardCells) {
      return (
        <Stack spacing={2} alignItems="center" sx={{ width: "100%", py: 6 }}>
          <CircularProgress size={64} sx={{ color: "#d7f9ff" }} />
          <Typography>Todavía preparando el cartón…</Typography>
          <Button onClick={() => selectedMode && randomizeCard(selectedMode)}>
            Generar
          </Button>
        </Stack>
      );
    }

    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          px: { xs: 2, sm: 3, md: 4 },
          pt: {
            xs: "calc(env(safe-area-inset-top, 0px) + 48px)",
            sm: 2.5,
            md: 3,
          },
          pb: { xs: 2, sm: 2.5, md: 3 },
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: { xs: "100%", md: 1200 },
            mx: "auto",
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            height: "100%",
            gap: { xs: 2, md: 4 },
            alignItems: { xs: "center", md: "center" },
            justifyContent: { xs: "flex-start", md: "center" },
          }}
        >
          {/* Grid de 5x5 - tamaño fijo */}
          <Box
            sx={{
              flex: "0 0 auto",
              width: {
                xs: "min(90vw, 400px)",
                sm: "min(70vw, 450px)",
                md: 450,
              },
              maxHeight: {
                xs: "min(90vw, 400px)",
                sm: "min(70vw, 450px)",
                md: 450,
              },
              aspectRatio: "1 / 1",
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: { xs: 1.2, md: 1.5 },
                width: "100%",
                height: "100%",
              }}
            >
              {cardCells.map((cell, i) => (
                <Box
                  key={i}
                  onClick={() => toggleCell(i)}
                  role="button"
                  aria-pressed={cell.checked}
                  sx={{
                    background: hexToRgba(cell.color, 0.92),
                    borderRadius: { xs: 1, md: 1.2 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    outline: cell.checked
                      ? `4px solid ${hexToRgba("#ffffff", 0.18)}`
                      : `2px solid rgba(0,0,0,0.12)`,
                    position: "relative",
                    userSelect: "none",
                    aspectRatio: "1 / 1",
                  }}
                >
                  {cell.checked && (
                    <Typography
                      sx={{
                        color: "#fff",
                        fontWeight: 900,
                        fontSize: "clamp(1.6rem, 6vw, 3.2rem)",
                        lineHeight: 1,
                        textShadow: "0 6px 14px rgba(0,0,0,0.45)",
                        pointerEvents: "none",
                      }}
                    >
                      X
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Campo de texto y botones - se adaptan al espacio restante */}
          <Box
            sx={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              gap: { xs: 1.5, md: 2 },
              minHeight: 0,
              minWidth: 0,
              width: { xs: "100%", md: "auto" },
              height: { xs: "auto", md: 450 },
              maxHeight: { xs: "auto", md: 450 },
            }}
          >
            {/* Campo de texto que crece */}
            <Box
              sx={{
                flex: "1 1 auto",
                minHeight: 0,
                overflow: { xs: "hidden", md: "auto" },
                maxHeight: { xs: "none", md: 450 },
                // El Box contendrá el scroll en desktop
              }}
            >
              <TextField
                multiline
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                placeholder=""
                variant="outlined"
                fullWidth
                inputProps={{
                  style: {
                    padding: "16px 12px",
                    fontSize: "clamp(32px, 8vw, 72px)",
                    fontWeight: 700,
                    textAlign: "center",
                    color: "#fff",
                    lineHeight: 1.05,
                    height: "100%",
                    overflow: "auto",
                    maxHeight: 450,
                  },
                }}
                sx={{
                  height: "100%",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderRadius: 2,
                  overflow: { xs: "hidden", md: "auto" },
                  maxHeight: { xs: "none", md: 450 },
                  "& .MuiOutlinedInput-root": {
                    height: "100%",
                    alignItems: "flex-start",
                    overflow: { xs: "hidden", md: "auto" },
                    maxHeight: { xs: "none", md: 450 },
                  },
                  "& .MuiOutlinedInput-input": {
                    overflow: { xs: "hidden", md: "auto" },
                    maxHeight: { xs: "none", md: 450 },
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.08)",
                  },
                }}
              />
            </Box>

            {/* Botones */}
            <Box sx={{ flex: "0 0 auto" }}>
              <Stack
                direction="row"
                spacing={1}
                justifyContent={{ xs: "center", sm: "space-between" }}
                alignItems="center"
                flexWrap="nowrap"
              >
                <Button
                  variant="contained"
                  onClick={() => setConfirmBackOpen(true)}
                  startIcon={<ArrowBackIcon />}
                  aria-label="Volver"
                  sx={{
                    textTransform: "none",
                    justifyContent: "center",
                    minWidth: { xs: "48px", sm: "120px" },
                    width: { xs: "48px", sm: "auto" },
                    height: { xs: "48px", sm: "auto" },
                    px: { xs: 0, sm: 2.5 },
                    borderRadius: { xs: "50%", sm: 999 },
                    "& .MuiButton-startIcon": {
                      marginRight: { xs: 0, sm: 0.75 },
                      marginLeft: { xs: 0, sm: -0.5 },
                    },
                  }}
                >
                  <Box
                    component="span"
                    sx={{ display: { xs: "none", sm: "inline" } }}
                  >
                    Volver
                  </Box>
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setConfirmRandomizeOpen(true)}
                  startIcon={<ShuffleIcon />}
                  aria-label="Randomizar"
                  sx={{
                    textTransform: "none",
                    justifyContent: "center",
                    minWidth: { xs: "48px", sm: "120px" },
                    width: { xs: "48px", sm: "auto" },
                    height: { xs: "48px", sm: "auto" },
                    px: { xs: 0, sm: 2.5 },
                    borderRadius: { xs: "50%", sm: 999 },
                    "& .MuiButton-startIcon": {
                      marginRight: { xs: 0, sm: 0.75 },
                      marginLeft: { xs: 0, sm: -0.5 },
                    },
                  }}
                >
                  <Box
                    component="span"
                    sx={{ display: { xs: "none", sm: "inline" } }}
                  >
                    Randomizar
                  </Box>
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<ClearIcon />}
                  onClick={clearEditorText}
                  aria-label="Borrar texto"
                  sx={{
                    textTransform: "none",
                    justifyContent: "center",
                    minWidth: { xs: "48px", sm: "140px" },
                    width: { xs: "48px", sm: "auto" },
                    height: { xs: "48px", sm: "auto" },
                    px: { xs: 0, sm: 2.5 },
                    borderRadius: { xs: "50%", sm: 999 },
                    "& .MuiButton-startIcon": {
                      marginRight: { xs: 0, sm: 0.75 },
                      marginLeft: { xs: 0, sm: -0.5 },
                    },
                  }}
                >
                  <Box
                    component="span"
                    sx={{ display: { xs: "none", sm: "inline" } }}
                  >
                    Borrar texto
                  </Box>
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  const handleConfirmRandomize = () => {
    if (selectedMode) randomizeCard(selectedMode);
    setConfirmRandomizeOpen(false);
  };

  const handleCancelRandomize = () => setConfirmRandomizeOpen(false);

  const handleConfirmBack = () => {
    handleCloseCardEditor();
    setConfirmBackOpen(false);
  };

  const handleCancelBack = () => setConfirmBackOpen(false);

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

  // Confirmation dialogs for card editor actions (declared later before return)

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
          disabled: spotlightVisible,
        };

    // secondaryAction removido porque el botón 'Salir del bingo' ya no está en la vista

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
    return (
      <Box
        sx={{
          position: "relative",
          width: "100vw",
          height: { xs: "auto", md: "100vh" },
          minHeight: { xs: 520, md: "100vh" },
          overflow: { xs: "visible", md: "hidden" },
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          justifyContent: "center",
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
          visible={spotlightVisible}
          value={spotlightValue}
          label={spotlightLabel}
          styles={theme.spotlight}
        />
        <Stack
          direction={{ xs: "column-reverse", md: "row" }}
          spacing={{ xs: 3, md: 8 }}
          sx={{
            position: { xs: "relative", md: "absolute" },
            top: { md: "50%" },
            left: { md: "50%" },
            transform: { md: "translate(-50%, -50%)" },
            zIndex: 3,
            minHeight: { xs: "auto", md: 640 },
            px: { xs: 2.5, sm: 4, md: 0 },
            py: { xs: 6, sm: 7, md: 0 },
            alignItems: "center",
            justifyContent: "center",
            width: { xs: "100%", md: "auto" },
            maxWidth: { md: "100vw" },
            mx: { xs: "auto", md: 0 },
            flex: 1,
            gap: { xs: 3, md: 8 },
          }}
        >
          <Stack
            spacing={{ xs: 2.4, md: 3 }}
            sx={{ flex: { xs: "auto", md: 1.25 }, maxWidth: { md: 520 } }}
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
              {/* Botones 'Salir del bingo' y calendario removidos de la vista de reproducción */}
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
              flex: { xs: "auto", md: 1.2 },
              minHeight: { xs: 320, md: 640 },
              height: { xs: "auto", md: "80vh" },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: { xs: "stretch", md: "center" },
              viewTransitionName: "bingo-game-visual",
            }}
          >
            {shouldDisplayArtwork ? (
              <Box
                component="img"
                src={artworkUrl ?? undefined}
                alt={currentSong.title}
                sx={{
                  width: {
                    xs: "90vw",
                    sm: 360,
                    md: "min(56vw, 88vh)",
                  },
                  maxWidth: { xs: 540, md: 720 },
                  aspectRatio: "1 / 1",
                  borderRadius: { xs: 4, md: 5 },
                  boxShadow: "0 38px 78px -32px rgba(5,18,52,0.82)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(148,197,255,0.12) 100%)",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <Box
                sx={{
                  width: {
                    xs: "90vw",
                    sm: 360,
                    md: "min(56vw, 88vh)",
                  },
                  maxWidth: { xs: 540, md: 720 },
                  aspectRatio: "1 / 1",
                  borderRadius: { xs: 4, md: 5 },
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

    if (phase === "card-editor") {
      return renderCardEditor();
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
  // Confirmation dialogs for card editor actions
  const confirmationDialogs = (
    <>
      <Dialog open={confirmRandomizeOpen} onClose={handleCancelRandomize}>
        <DialogTitle>Randomizar cartón</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres randomizar el cartón? Se perderán las
            marcas actuales.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRandomize}>Cancelar</Button>
          <Button onClick={handleConfirmRandomize} autoFocus>
            Randomizar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmBackOpen} onClose={handleCancelBack}>
        <DialogTitle>Volver</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Deseas volver al menú? Se perderá el cartón no guardado.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelBack}>Cancelar</Button>
          <Button onClick={handleConfirmBack} autoFocus>
            Volver
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

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
      {phase !== "card-editor" && (
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
      )}

      {confirmationDialogs}

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
            videoId={videoId ?? undefined}
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
