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
import {
  YearSpotlight,
  type YearSpotlightStyle,
} from "./auto-game/YearSpotlight";
import { useViewTransition } from "./hooks/useViewTransition";
import { darken, lighten, rgbToCss } from "./lib/color";

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

interface ChipTheme {
  background: string;
  color: string;
  borderColor?: string;
  borderStyle?: "solid" | "dashed";
}

interface IconButtonTheme {
  background: string;
  hoverBackground: string;
  border: string;
  color: string;
  hoverColor: string;
  shadow: string;
  hoverShadow: string;
}

interface PrimaryButtonTheme {
  background: string;
  hoverBackground: string;
  textColor: string;
  shadow: string;
  hoverShadow: string;
}

interface SecondaryButtonTheme {
  border: string;
  textColor: string;
  hoverBorder: string;
  hoverBackground: string;
}

interface StatusTextTheme {
  label: string;
  description: string;
}

interface FallbackTheme {
  text: string;
  caption: string;
  icon: string;
  background: string;
}

interface AlertTheme {
  background: string;
  color: string;
  border: string;
}

interface AdaptiveTheme {
  overlayTint: string;
  text: {
    primary: string;
    secondary: string;
    body: string;
    caption: string;
    muted: string;
  };
  textShadow: string;
  alert: AlertTheme;
  chips: {
    primary: ChipTheme;
    secondary: ChipTheme;
    tertiary: ChipTheme;
  };
  spinner: string;
  iconButton: IconButtonTheme;
  primaryButton: PrimaryButtonTheme;
  secondaryButton: SecondaryButtonTheme;
  status: StatusTextTheme;
  fallback: FallbackTheme;
  warningText: string;
  progressOverlay: string;
  spotlight: YearSpotlightStyle;
}

const DEFAULT_THEME: AdaptiveTheme = {
  overlayTint: "rgba(4, 12, 26, 0.48)",
  text: {
    primary: "#ffffff",
    secondary: "rgba(204,231,255,0.92)",
    body: "rgba(224,239,255,0.82)",
    caption: "rgba(204,231,255,0.72)",
    muted: "rgba(224,239,255,0.78)",
  },
  textShadow: "0 30px 60px rgba(0,0,0,0.55)",
  alert: {
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.94)",
    border: "rgba(255,255,255,0.18)",
  },
  chips: {
    primary: {
      background: "rgba(255,255,255,0.16)",
      color: "#ffffff",
      borderColor: undefined,
    },
    secondary: {
      background: "rgba(13,148,255,0.2)",
      color: "rgba(212,239,255,0.95)",
      borderColor: "rgba(148,197,255,0.35)",
      borderStyle: "solid",
    },
    tertiary: {
      background: "rgba(255,255,255,0.12)",
      color: "rgba(230,243,255,0.92)",
      borderColor: "rgba(230,243,255,0.35)",
      borderStyle: "dashed",
    },
  },
  spinner: "#d7f9ff",
  iconButton: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(99,213,245,0.35) 100%)",
    hoverBackground:
      "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(99,213,245,0.48) 100%)",
    border: "3px solid rgba(255,255,255,0.35)",
    color: "#ffffff",
    hoverColor: "#ffffff",
    shadow: "0 26px 56px -28px rgba(12,38,96,0.8)",
    hoverShadow: "0 30px 64px -30px rgba(12,38,96,0.82)",
  },
  primaryButton: {
    background:
      "linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #22d3ee 100%)",
    hoverBackground:
      "linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #06b6d4 100%)",
    textColor: "#ffffff",
    shadow: "0 22px 48px -18px rgba(50,132,255,0.6)",
    hoverShadow: "0 26px 56px -20px rgba(37,99,235,0.7)",
  },
  secondaryButton: {
    border: "rgba(255,255,255,0.4)",
    textColor: "rgba(255,255,255,0.92)",
    hoverBorder: "rgba(255,255,255,0.7)",
    hoverBackground: "rgba(255,255,255,0.12)",
  },
  status: {
    label: "rgba(224,239,255,0.78)",
    description: "rgba(224,239,255,0.8)",
  },
  fallback: {
    text: "rgba(224,239,255,0.85)",
    caption: "rgba(224,239,255,0.8)",
    icon: "rgba(224,239,255,0.85)",
    background: "transparent",
  },
  warningText: "rgba(255,210,210,0.92)",
  progressOverlay: "rgba(4,10,24,0.45)",
  spotlight: {
    background:
      "radial-gradient(circle at 50% 52%, rgba(255,255,255,0.25) 0%, rgba(10,24,66,0.92) 68%, rgba(3,8,24,0.96) 100%)",
    halo: "radial-gradient(circle at 50% 50%, rgba(86,199,255,0.28) 0%, rgba(25,109,255,0.12) 45%, rgba(0,0,0,0) 70%)",
    borderColor: "rgba(173,215,255,0.22)",
    borderGlow: "0 0 42px rgba(32,139,255,0.25)",
    frameShadow:
      "0 40px 96px -32px rgba(4,12,42,0.76), inset 0 0 42px rgba(45,132,255,0.18)",
    labelColor: "rgba(255,255,255,0.86)",
    valueColor: "#ffffff",
    valueShadow: "0 48px 94px rgba(0,0,0,0.78)",
  },
};

const adjustBaseTone = (colorValue: number): number =>
  Math.max(0, Math.min(255, colorValue));

const withSafeBase = (paletteColor: { r: number; g: number; b: number }) => ({
  r: adjustBaseTone(paletteColor.r),
  g: adjustBaseTone(paletteColor.g),
  b: adjustBaseTone(paletteColor.b),
});

const createAdaptiveTheme = (
  palette: {
    color: { r: number; g: number; b: number };
    brightness: number;
  } | null
): AdaptiveTheme => {
  if (!palette) {
    return DEFAULT_THEME;
  }

  const safeBase = withSafeBase(palette.color);
  const brightness = palette.brightness;
  const adjustedBase =
    brightness < 0.22
      ? lighten(safeBase, 0.32)
      : brightness > 0.82
      ? darken(safeBase, 0.22)
      : safeBase;

  if (brightness > 0.62) {
    const midTone = darken(adjustedBase, 0.25);
    const deepTone = darken(adjustedBase, 0.45);
    const hoverTone = darken(adjustedBase, 0.55);
    const lightTone = darken(adjustedBase, 0.15);
    const spotlightInner = lighten(adjustedBase, 0.38);
    const spotlightCore = darken(adjustedBase, 0.32);
    const spotlightOuter = darken(adjustedBase, 0.58);

    return {
      ...DEFAULT_THEME,
      overlayTint: "rgba(5, 12, 26, 0.64)",
      text: {
        primary: "#061223",
        secondary: "rgba(12,32,60,0.88)",
        body: "rgba(14,38,68,0.78)",
        caption: "rgba(12,32,60,0.65)",
        muted: "rgba(14,38,68,0.72)",
      },
      textShadow: "0 30px 60px rgba(0,0,0,0.35)",
      alert: {
        background: "rgba(255,255,255,0.78)",
        color: "#061223",
        border: "rgba(6,22,44,0.18)",
      },
      chips: {
        primary: {
          background: "rgba(8,22,46,0.12)",
          color: "#061223",
          borderColor: "rgba(6,22,44,0.16)",
          borderStyle: "solid",
        },
        secondary: {
          background: rgbToCss(lightTone, 0.22),
          color: rgbToCss(hoverTone),
          borderColor: rgbToCss(deepTone, 0.32),
          borderStyle: "solid",
        },
        tertiary: {
          background: "rgba(255,255,255,0.74)",
          color: "#061223",
          borderColor: "rgba(6,22,44,0.18)",
          borderStyle: "dashed",
        },
      },
      spinner: rgbToCss(deepTone),
      iconButton: {
        background: `linear-gradient(135deg, ${rgbToCss(
          lighten(adjustedBase, 0.48),
          0.82
        )} 0%, ${rgbToCss(lighten(adjustedBase, 0.32), 0.88)} 100%)`,
        hoverBackground: `linear-gradient(135deg, ${rgbToCss(
          lighten(adjustedBase, 0.42),
          0.92
        )} 0%, ${rgbToCss(lighten(adjustedBase, 0.22), 0.98)} 100%)`,
        border: "3px solid rgba(6,22,44,0.22)",
        color: rgbToCss(darken(adjustedBase, 0.78)),
        hoverColor: rgbToCss(darken(adjustedBase, 0.85)),
        shadow: "0 26px 56px -28px rgba(8,22,48,0.5)",
        hoverShadow: "0 30px 64px -26px rgba(6,18,38,0.58)",
      },
      primaryButton: {
        background: `linear-gradient(135deg, ${rgbToCss(
          lightTone
        )} 0%, ${rgbToCss(midTone)} 50%, ${rgbToCss(deepTone)} 100%)`,
        hoverBackground: `linear-gradient(135deg, ${rgbToCss(
          darken(adjustedBase, 0.18)
        )} 0%, ${rgbToCss(deepTone)} 50%, ${rgbToCss(hoverTone)} 100%)`,
        textColor: "#f8fbff",
        shadow: `0 22px 48px -18px ${rgbToCss(
          darken(adjustedBase, 0.62),
          0.6
        )}`,
        hoverShadow: `0 26px 56px -20px ${rgbToCss(
          darken(adjustedBase, 0.68),
          0.68
        )}`,
      },
      secondaryButton: {
        border: "rgba(6,22,44,0.35)",
        textColor: "rgba(6,22,44,0.92)",
        hoverBorder: "rgba(6,22,44,0.45)",
        hoverBackground: "rgba(6,22,44,0.12)",
      },
      status: {
        label: "rgba(14,38,68,0.78)",
        description: "rgba(14,38,68,0.72)",
      },
      fallback: {
        text: "rgba(14,38,68,0.78)",
        caption: "rgba(12,32,60,0.62)",
        icon: rgbToCss(deepTone),
        background: "transparent",
      },
      warningText: "rgba(172,58,58,0.88)",
      progressOverlay: rgbToCss(darken(adjustedBase, 0.6), 0.45),
      spotlight: {
        background: `radial-gradient(circle at 50% 52%, ${rgbToCss(
          spotlightInner,
          0.34
        )} 0%, ${rgbToCss(spotlightCore, 0.94)} 68%, ${rgbToCss(
          spotlightOuter,
          0.98
        )} 100%)`,
        halo: `radial-gradient(circle at 50% 50%, ${rgbToCss(
          lighten(adjustedBase, 0.52),
          0.26
        )} 0%, ${rgbToCss(
          lighten(adjustedBase, 0.32),
          0.14
        )} 45%, rgba(0,0,0,0) 70%)`,
        borderColor: rgbToCss(lighten(adjustedBase, 0.4), 0.45),
        borderGlow: `0 0 42px ${rgbToCss(lighten(adjustedBase, 0.38), 0.28)}`,
        frameShadow: `0 40px 96px -32px ${rgbToCss(
          darken(adjustedBase, 0.72),
          0.7
        )}, inset 0 0 42px ${rgbToCss(lighten(adjustedBase, 0.18), 0.26)}`,
        labelColor: rgbToCss(darken(adjustedBase, 0.68), 0.92),
        valueColor: rgbToCss(darken(adjustedBase, 0.78)),
        valueShadow: `0 48px 94px ${rgbToCss(darken(adjustedBase, 0.9), 0.42)}`,
      },
    };
  }

  const accentBase =
    brightness < 0.32 ? lighten(adjustedBase, 0.18) : adjustedBase;
  const accentLift = lighten(accentBase, 0.24);
  const accentDeep = darken(accentBase, 0.22);
  const accentHover = darken(accentBase, 0.32);
  const accentShadow = rgbToCss(darken(accentBase, 0.58), 0.58);
  const accentHoverShadow = rgbToCss(darken(accentBase, 0.64), 0.64);
  const spotlightInner = lighten(accentBase, 0.6);
  const spotlightCore = darken(accentBase, 0.25);
  const spotlightOuter = darken(accentBase, 0.55);

  return {
    ...DEFAULT_THEME,
    overlayTint:
      brightness < 0.28 ? "rgba(2, 8, 22, 0.55)" : DEFAULT_THEME.overlayTint,
    chips: {
      primary: {
        background: rgbToCss(lighten(accentBase, 0.55), 0.16),
        color: DEFAULT_THEME.text.primary,
        borderColor: rgbToCss(lighten(accentBase, 0.45), 0.22),
        borderStyle: "solid",
      },
      secondary: {
        background: rgbToCss(lighten(accentBase, 0.15), 0.22),
        color: rgbToCss(lighten(accentBase, 0.7)),
        borderColor: rgbToCss(lighten(accentBase, 0.08), 0.35),
        borderStyle: "solid",
      },
      tertiary: {
        background: rgbToCss(lighten(accentBase, 0.35), 0.18),
        color: rgbToCss(lighten(accentBase, 0.8)),
        borderColor: rgbToCss(lighten(accentBase, 0.25), 0.26),
        borderStyle: "dashed",
      },
    },
    spinner: rgbToCss(lighten(accentBase, 0.55)),
    iconButton: {
      background: `linear-gradient(135deg, ${rgbToCss(
        lighten(accentBase, 0.4),
        0.28
      )} 0%, ${rgbToCss(lighten(accentBase, 0.22), 0.4)} 100%)`,
      hoverBackground: `linear-gradient(135deg, ${rgbToCss(
        lighten(accentBase, 0.45),
        0.35
      )} 0%, ${rgbToCss(lighten(accentBase, 0.25), 0.48)} 100%)`,
      border: "3px solid rgba(255,255,255,0.28)",
      color: DEFAULT_THEME.iconButton.color,
      hoverColor: DEFAULT_THEME.iconButton.hoverColor,
      shadow: DEFAULT_THEME.iconButton.shadow,
      hoverShadow: DEFAULT_THEME.iconButton.hoverShadow,
    },
    primaryButton: {
      background: `linear-gradient(135deg, ${rgbToCss(
        accentLift
      )} 0%, ${rgbToCss(accentBase)} 50%, ${rgbToCss(accentDeep)} 100%)`,
      hoverBackground: `linear-gradient(135deg, ${rgbToCss(
        lighten(accentBase, 0.12)
      )} 0%, ${rgbToCss(accentDeep)} 50%, ${rgbToCss(accentHover)} 100%)`,
      textColor: DEFAULT_THEME.primaryButton.textColor,
      shadow: `0 22px 48px -18px ${accentShadow}`,
      hoverShadow: `0 26px 56px -20px ${accentHoverShadow}`,
    },
    secondaryButton: {
      border: rgbToCss(lighten(accentBase, 0.3), 0.35),
      textColor: DEFAULT_THEME.secondaryButton.textColor,
      hoverBorder: rgbToCss(lighten(accentBase, 0.45), 0.55),
      hoverBackground: rgbToCss(lighten(accentBase, 0.25), 0.15),
    },
    status: DEFAULT_THEME.status,
    fallback: {
      ...DEFAULT_THEME.fallback,
      icon: rgbToCss(lighten(accentBase, 0.55)),
    },
    warningText: DEFAULT_THEME.warningText,
    progressOverlay: DEFAULT_THEME.progressOverlay,
    spotlight: {
      background: `radial-gradient(circle at 50% 52%, ${rgbToCss(
        spotlightInner,
        0.32
      )} 0%, ${rgbToCss(spotlightCore, 0.94)} 68%, ${rgbToCss(
        spotlightOuter,
        0.98
      )} 100%)`,
      halo: `radial-gradient(circle at 50% 50%, ${rgbToCss(
        lighten(accentBase, 0.45),
        0.28
      )} 0%, ${rgbToCss(
        lighten(accentBase, 0.22),
        0.14
      )} 45%, rgba(0,0,0,0) 70%)`,
      borderColor: rgbToCss(lighten(accentBase, 0.58), 0.24),
      borderGlow: `0 0 42px ${rgbToCss(lighten(accentBase, 0.58), 0.23)}`,
      frameShadow: `0 40px 96px -32px ${rgbToCss(
        darken(accentBase, 0.65),
        0.76
      )}, inset 0 0 42px ${rgbToCss(lighten(accentBase, 0.22), 0.32)}`,
      labelColor: "rgba(255,255,255,0.86)",
      valueColor: "#ffffff",
      valueShadow: `0 48px 94px ${rgbToCss(darken(accentBase, 0.85), 0.7)}`,
    },
  };
};

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
  const { palette: artworkPalette } = useArtworkPalette(artworkUrl);

  const runViewTransition = useViewTransition();
  const rootTheme = createAdaptiveTheme(artworkPalette);

  const displayedError = errorMessage ?? queueError;

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
    const theme = createAdaptiveTheme(
      shouldDisplayArtwork ? artworkPalette : null
    );

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
              minHeight: { md: 0 },
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
          visible={yearSpotlightVisible}
          year={spotlightYear}
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
                disabled={yearSpotlightVisible}
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
              minHeight: { md: 0 },
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
                  "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(99,213,245,0.26) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Stack
                spacing={2}
                alignItems="center"
                sx={{
                  p: { xs: 3, md: 5 },
                  color: theme.fallback.text,
                  textAlign: "center",
                }}
              >
                <InfoOutlinedIcon
                  sx={{
                    fontSize: { xs: 48, md: 64 },
                    color: theme.fallback.icon,
                  }}
                />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: theme.fallback.text }}
                >
                  Portada lista para desplegarse
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: theme.fallback.caption }}
                >
                  Cuando empieces la partida automática, la carátula ocupará el
                  máximo espacio disponible para sumergirte por completo.
                </Typography>
              </Stack>
            </Box>
          </Box>
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
