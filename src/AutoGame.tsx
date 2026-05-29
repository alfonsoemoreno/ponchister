import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Chip,
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
import CampaignIcon from "@mui/icons-material/Campaign";

import { fetchAllSongs } from "./services/songService";
import {
  fetchMyCollectionSongs,
  fetchMyPlaylistSongs,
} from "./services/songService";
import { createGameSession } from "./services/gameSessionService";
import { extractYoutubeId } from "./lib/autoGameQueue";
import { useAutoGameQueue } from "./hooks/useAutoGameQueue";
import { useArtworkLookup } from "./hooks/useArtworkLookup";
import { useArtworkPalette } from "./hooks/useArtworkPalette";
import { NeonLines } from "./auto-game/NeonLines";
import { YearSpotlight } from "./auto-game/YearSpotlight";
import LocalQrCode from "./components/LocalQrCode";
import { useViewTransition } from "./hooks/useViewTransition";
import { createAdaptiveTheme } from "./auto-game/theme";
import type { GameSource, PlaylistSummary, YearRange } from "./types";
import {
  getSongTagLabel,
  normalizeSongTags,
  songMatchesSelectedTags,
  type SongTagMatchMode,
  type SongTagDefinition,
  type SongTag,
} from "./lib/songTags";

interface InternalPlayer {
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  getVolume?: () => number;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  unMute?: () => void;
  mute?: () => void;
  setVolume?: (volume: number) => void;
  setPlaybackRate?: (rate: number) => void;
  setPlaybackQuality?: (suggestedQuality: string) => void;
}

interface AutoGameProps {
  onExit: () => void;
  yearRange: YearRange;
  availableRange: YearRange;
  availableSongTags: SongTagDefinition[];
  onYearRangeChange: (range: YearRange) => void;
  selectedSongTags: SongTag[];
  onSongTagsChange: (tags: SongTag[]) => void;
  songTagMatchMode: SongTagMatchMode;
  onSongTagMatchModeChange: (mode: SongTagMatchMode) => void;
  timerEnabled: boolean;
  onTimerModeChange: (enabled: boolean) => void;
  mimicaEnabled: boolean;
  onMimicaModeChange: (enabled: boolean) => void;
  tararearEnabled: boolean;
  onTararearModeChange: (enabled: boolean) => void;
  gameSource: GameSource;
  playlist: PlaylistSummary | null;
}

type GameState = "idle" | "loading" | "playing" | "revealed" | "error";

type PlayerRef = YouTube | null;
type SpecialRoundMode = "none" | "mimica" | "tararear";

const TIMER_DURATION_SECONDS = 60;
const SPECIAL_SONG_CHANCE = 0.12;
const SPECIAL_REMOTE_SONG_CHANCE = 0.5;
const SAD_TROMBONE_VIDEO_ID = "CQeezCdF4mk";
const MAIN_PLAYER_DEFAULT_VOLUME = 100;
const SAD_TROMBONE_DUCKED_VOLUME = 5;
const SAD_TROMBONE_VOLUME = 120;
const GOLDEN_BACKDROP =
  "radial-gradient(circle at 20% 18%, rgba(255,212,108,0.85) 0%, rgba(196,137,34,0.72) 38%, rgba(98,58,8,0.75) 70%), radial-gradient(circle at 78% 26%, rgba(255,238,178,0.7) 0%, rgba(200,140,28,0.6) 40%, rgba(96,56,7,0.7) 68%), linear-gradient(180deg, #5a3504 0%, #241100 100%)";
const GOLDEN_OVERLAY = "rgba(66, 38, 6, 0.58)";
const TAG_MATCH_MODE_OPTIONS: Array<{
  value: SongTagMatchMode;
  label: string;
  description: string;
}> = [
  {
    value: "any",
    label: "Cualquiera",
    description:
      "Incluye canciones que tengan una o más de las etiquetas elegidas.",
  },
  {
    value: "all",
    label: "Todas",
    description:
      "Incluye solo canciones que tengan todas las etiquetas elegidas.",
  },
];

function pickSpecialRoundMode(
  song: {
    id: number;
    mimica: boolean;
    tararear: boolean;
  } | null,
  options: {
    mimicaEnabled: boolean;
    tararearEnabled: boolean;
  },
  seed: number,
): SpecialRoundMode {
  if (!song) {
    return "none";
  }

  const songHasMimica = song.mimica && options.mimicaEnabled;
  const songHasTararear = song.tararear && options.tararearEnabled;

  if (!songHasMimica && !songHasTararear) {
    return "none";
  }

  if (songHasTararear && !songHasMimica) {
    return "tararear";
  }

  if (songHasMimica && songHasTararear) {
    const modeBase = Math.sin(song.id * 47.129 + seed * 1717.73) * 1717.73;
    const modeNormalized = modeBase - Math.floor(modeBase);
    return modeNormalized < 0.5 ? "mimica" : "tararear";
  }

  const activationBase =
    Math.sin(song.id * 19.331 + seed * 9182.443) * 9182.443;
  const activationNormalized = activationBase - Math.floor(activationBase);
  if (activationNormalized >= SPECIAL_REMOTE_SONG_CHANCE) {
    return "none";
  }

  return "mimica";
}

function playAlarm() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const audioContext = new AudioContextCtor();
  const now = audioContext.currentTime;

  for (let index = 0; index < 3; index += 1) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = now + index * 0.42;
    const stopAt = startAt + 0.28;

    oscillator.type = index % 2 === 0 ? "square" : "sawtooth";
    oscillator.frequency.setValueAtTime(880, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(660, stopAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.18, startAt + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt);
  }

  window.setTimeout(() => {
    void audioContext.close().catch(() => undefined);
  }, 1800);
}

const AutoGame: React.FC<AutoGameProps> = ({
  onExit,
  yearRange,
  availableRange,
  availableSongTags,
  onYearRangeChange,
  selectedSongTags,
  onSongTagsChange,
  songTagMatchMode,
  onSongTagMatchModeChange,
  timerEnabled,
  onTimerModeChange,
  mimicaEnabled,
  onMimicaModeChange,
  tararearEnabled,
  onTararearModeChange,
  gameSource,
  playlist,
}) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const sadTrombonePlayerRef = useRef<PlayerRef>(null);
  const [spotlightVisible, setSpotlightVisible] = useState(false);
  const [spotlightValue, setSpotlightValue] = useState<string | number | null>(
    null,
  );
  const [spotlightLabel, setSpotlightLabel] = useState<string>("Año");
  const yearSpotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [timerRemaining, setTimerRemaining] = useState<number>(
    TIMER_DURATION_SECONDS,
  );
  const [timerLocked, setTimerLocked] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);
  const [localRange, setLocalRange] = useState<YearRange>(yearRange);
  const [localSelectedTags, setLocalSelectedTags] =
    useState<SongTag[]>(selectedSongTags);
  const [localTagMatchMode, setLocalTagMatchMode] =
    useState<SongTagMatchMode>(songTagMatchMode);
  const [localTimerEnabled, setLocalTimerEnabled] =
    useState<boolean>(timerEnabled);
  const [localMimicaEnabled, setLocalMimicaEnabled] =
    useState<boolean>(mimicaEnabled);
  const [localTararearEnabled, setLocalTararearEnabled] =
    useState<boolean>(tararearEnabled);
  const [specialTimerRunning, setSpecialTimerRunning] = useState(false);
  const specialSongSeedRef = useRef(Math.random());
  const mimicaSeedRef = useRef(Math.random());
  const preDuckVolumeRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalRange(yearRange);
  }, [yearRange]);

  useEffect(() => {
    setLocalSelectedTags(selectedSongTags);
  }, [selectedSongTags]);

  useEffect(() => {
    setLocalTagMatchMode(songTagMatchMode);
  }, [songTagMatchMode]);

  useEffect(() => {
    setLocalTimerEnabled(timerEnabled);
  }, [timerEnabled]);

  useEffect(() => {
    setLocalMimicaEnabled(mimicaEnabled);
  }, [mimicaEnabled]);

  useEffect(() => {
    setLocalTararearEnabled(tararearEnabled);
  }, [tararearEnabled]);

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
    value: number | number[],
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

  const handleTagToggle = (tag: SongTag) => {
    const nextTags = localSelectedTags.includes(tag)
      ? localSelectedTags.filter((entry) => entry !== tag)
      : normalizeSongTags([...localSelectedTags, tag]);
    setLocalSelectedTags(nextTags);
    onSongTagsChange(nextTags);
  };

  const handleTagMatchModeChange = (value: SongTagMatchMode) => {
    setLocalTagMatchMode(value);
    onSongTagMatchModeChange(value);
  };

  const handleTimerToggle = (
    _event: ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    setLocalTimerEnabled(checked);
    onTimerModeChange(checked);
  };

  const handleMimicaToggle = (
    _event: ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    setLocalMimicaEnabled(checked);
    onMimicaModeChange(checked);
  };

  const handleTararearToggle = (
    _event: ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    setLocalTararearEnabled(checked);
    onTararearModeChange(checked);
  };

  const fetchSongsForRange = useCallback(() => {
    if (gameSource === "personal_catalog") {
      return fetchMyCollectionSongs().then((songs) => {
        const filtered = songs.filter((song) =>
          songMatchesSelectedTags(
            song.tags,
            localSelectedTags,
            localTagMatchMode,
          ),
        );
        if (!filtered.length) {
          throw new Error(
            "Tu colección personal no tiene canciones para las etiquetas seleccionadas.",
          );
        }
        return filtered;
      });
    }
    if (gameSource === "personal_playlist" && playlist) {
      return fetchMyPlaylistSongs(playlist.id).then((songs) => {
        const filtered = songs.filter((song) =>
          songMatchesSelectedTags(
            song.tags,
            localSelectedTags,
            localTagMatchMode,
          ),
        );
        if (!filtered.length) {
          throw new Error(
            "La playlist personal seleccionada no tiene canciones para las etiquetas seleccionadas.",
          );
        }
        return filtered;
      });
    }
    return fetchAllSongs({
      minYear: playlist ? null : yearRange.min,
      maxYear: playlist ? null : yearRange.max,
      selectedTags: localSelectedTags,
      tagMatchMode: localTagMatchMode,
      playlistId: playlist?.scope === "public" ? playlist.id : null,
    });
  }, [
    gameSource,
    localSelectedTags,
    localTagMatchMode,
    playlist,
    yearRange.max,
    yearRange.min,
  ]);

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
  const isSpecialSong = useMemo(() => {
    if (!currentSong) return false;
    const seed = specialSongSeedRef.current;
    const base =
      Math.sin(currentSong.id * 12.9898 + seed * 43758.5453) * 43758.5453;
    const normalized = base - Math.floor(base);
    return normalized < SPECIAL_SONG_CHANCE;
  }, [currentSong]);
  const specialRoundMode = useMemo(
    () =>
      pickSpecialRoundMode(
        currentSong,
        {
          mimicaEnabled: localMimicaEnabled,
          tararearEnabled: localTararearEnabled,
        },
        mimicaSeedRef.current,
      ),
    [currentSong, localMimicaEnabled, localTararearEnabled],
  );
  const hasSpecialRemoteRound = specialRoundMode !== "none";
  const videoId = useMemo(
    () => (currentSong ? extractYoutubeId(currentSong.youtube_url) : null),
    [currentSong],
  );
  const mimicaJoinUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const url = new URL(window.location.origin);
    if (!currentSong) {
      return "";
    }
    url.searchParams.set("remoteMode", specialRoundMode);
    url.searchParams.set("songTitle", currentSong.title);
    url.searchParams.set("artist", currentSong.artist);
    if (videoId) {
      url.searchParams.set("videoId", videoId);
    }
    return url.toString();
  }, [currentSong, specialRoundMode, videoId]);
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
    [],
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

  const sadTrombonePlayerOptions = useMemo<YouTubeProps["opts"]>(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;

    return {
      height: "1",
      width: "1",
      playerVars: {
        autoplay: 0,
        mute: 0,
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

  const restoreMainPlayerVolume = useCallback(() => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer) return;

    const restoredVolume =
      preDuckVolumeRef.current ?? MAIN_PLAYER_DEFAULT_VOLUME;
    internalPlayer.setVolume?.(restoredVolume);
    preDuckVolumeRef.current = null;
  }, []);

  const duckMainPlayerVolume = useCallback(() => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer || !isPlaying) return;

    if (preDuckVolumeRef.current === null) {
      const currentVolume = internalPlayer.getVolume?.();
      preDuckVolumeRef.current =
        typeof currentVolume === "number" && Number.isFinite(currentVolume)
          ? currentVolume
          : MAIN_PLAYER_DEFAULT_VOLUME;
    }

    internalPlayer.setVolume?.(SAD_TROMBONE_DUCKED_VOLUME);
  }, [isPlaying]);

  const stopSadTrombone = useCallback(() => {
    const internalPlayer =
      sadTrombonePlayerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    internalPlayer?.stopVideo?.();
    restoreMainPlayerVolume();
  }, [restoreMainPlayerVolume]);

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
    setSpecialTimerRunning(false);
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
    const shouldUseTimer = timerEnabled || hasSpecialRemoteRound;
    if (
      !shouldUseTimer ||
      gameState !== "playing" ||
      timerLocked ||
      !timerStarted ||
      (hasSpecialRemoteRound && !specialTimerRunning)
    ) {
      clearTimerInterval();
      if (!shouldUseTimer) {
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
          setSpecialTimerRunning(false);
          stopPlayback();
          playAlarm();
          setErrorMessage(
            "Se acabó el tiempo. Revela la canción para continuar con la partida.",
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
    hasSpecialRemoteRound,
    specialTimerRunning,
    stopPlayback,
    timerEnabled,
    timerLocked,
    timerStarted,
  ]);

  const applyPlaybackOptimizations = useCallback(
    (player: InternalPlayer | null) => {
      if (!player) return;
      player.setPlaybackQuality?.("small");
      player.setPlaybackRate?.(1);
    },
    [],
  );

  useEffect(
    () => () => {
      stopPlayback();
      stopSadTrombone();
    },
    [stopPlayback, stopSadTrombone],
  );

  useEffect(
    () => () => {
      clearYearSpotlightTimeout();
    },
    [clearYearSpotlightTimeout],
  );

  useEffect(
    () => () => {
      clearTimerInterval();
    },
    [clearTimerInterval],
  );

  const advanceToNextSong = useCallback(() => {
    void runViewTransition(() => {
      setErrorMessage(null);
      setGameState("loading");
      setIsPlaying(false);
      stopPlayback();
      stopSadTrombone();
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
    stopSadTrombone,
  ]);

  const handleStart = useCallback(() => {
    void runViewTransition(async () => {
      setErrorMessage(null);
      setGameState("loading");
      setIsPlaying(false);
      stopPlayback();
      clearYearSpotlightTimeout();
      resetTimerState();
      const started = await startQueue();
      if (!started) {
        return;
      }
      try {
        await createGameSession({
          mode: "auto",
          yearMin: playlist ? null : yearRange.min,
          yearMax: playlist ? null : yearRange.max,
          selectedTags: localSelectedTags,
          tagMatchMode: localTagMatchMode,
          timerEnabled,
          playlistId: playlist?.id ?? null,
          playlistName: playlist?.name ?? null,
        });
      } catch (err) {
        console.info(
          "[game-session] No se pudo registrar la partida:",
          err instanceof Error ? err.message : err,
        );
      }
    });
  }, [
    clearYearSpotlightTimeout,
    localSelectedTags,
    localTagMatchMode,
    playlist,
    resetTimerState,
    runViewTransition,
    startQueue,
    stopPlayback,
    timerEnabled,
    yearRange.max,
    yearRange.min,
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
      setSpecialTimerRunning(false);
      if (currentSong && typeof currentSong.year === "number") {
        triggerSpotlight("Año", currentSong.year);
      }
    });
  }, [
    clearTimerInterval,
    currentSong,
    runViewTransition,
    triggerSpotlight,
  ]);

  const handleRandomYearReveal = useCallback(() => {
    if (yearSpotlightTimerRef.current) {
      return;
    }
    const minYear = Math.min(localRange.min, localRange.max);
    const maxYear = Math.max(localRange.min, localRange.max);
    const randomYear =
      Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
    void runViewTransition(() => {
      triggerSpotlight("Año", randomYear);
    });
  }, [localRange.max, localRange.min, runViewTransition, triggerSpotlight]);

  const handleNextAfterReveal = useCallback(() => {
    advanceToNextSong();
  }, [advanceToNextSong]);

  const handlePlayerError = useCallback<
    NonNullable<YouTubeProps["onError"]>
  >(() => {
    setIsPlaying(false);
    setErrorMessage(
      "No se pudo reproducir el video de esta canción. Pasamos a otra pista.",
    );
    advanceToNextSong();
  }, [advanceToNextSong]);

  const handleExit = useCallback(() => {
    void runViewTransition(() => {
      stopPlayback();
      stopSadTrombone();
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
    stopSadTrombone,
  ]);

  const handlePlayPause = () => {
    if (timerEnabled && timerLocked && gameState === "playing") {
      setErrorMessage(
        "Se acabó el tiempo. Revela la canción para continuar con la partida.",
      );
      return;
    }

    if (hasSpecialRemoteRound && gameState === "playing") {
      if (timerStarted) {
        return;
      }
      setTimerStarted(true);
      setSpecialTimerRunning(true);
      setErrorMessage(
        specialRoundMode === "tararear"
          ? "La ronda de tararear está corriendo. En el celular verán la canción y además sonará a medio volumen mientras mantengan el botón apretado."
          : "La ronda de mímica está corriendo. El botón remoto solo mostrará la información de la canción.",
      );
      return;
    }

    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer) return;

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
            "El reproductor bloqueó el inicio automático. Toca nuevamente para intentar reproducir.",
          );
        });
      }
    }
  };

  const handleSadTrombone = useCallback(() => {
    const internalPlayer =
      sadTrombonePlayerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer) return;

    duckMainPlayerVolume();
    internalPlayer.unMute?.();
    internalPlayer.setVolume?.(SAD_TROMBONE_VOLUME);
    internalPlayer.seekTo?.(0, true);
    internalPlayer.playVideo?.();
  }, [duckMainPlayerVolume]);

  const handlePlayerReady: YouTubeProps["onReady"] = (event) => {
    setIsPlaying(false);
    applyPlaybackOptimizations(
      (event.target as unknown as InternalPlayer) ?? null,
    );
    event.target.setPlaybackRate?.(1);
    event.target.pauseVideo?.();
    const iframe = event.target.getIframe?.();
    iframe?.setAttribute("allow", "autoplay; clipboard-write");
  };

  const handleSadTrombonePlayerReady: YouTubeProps["onReady"] = (event) => {
    const internalPlayer = (event.target as unknown as InternalPlayer) ?? null;
    internalPlayer?.pauseVideo?.();
    internalPlayer?.unMute?.();
    internalPlayer?.setVolume?.(SAD_TROMBONE_VOLUME);
    const iframe = event.target.getIframe?.();
    iframe?.setAttribute("allow", "autoplay; clipboard-write");
  };

  const handleSadTrombonePlayerStateChange: YouTubeProps["onStateChange"] = (
    event,
  ) => {
    const playerState = event.data;
    if (playerState === 1) {
      duckMainPlayerVolume();
      return;
    }

    if (playerState === 0 || playerState === 2) {
      restoreMainPlayerVolume();
    }
  };

  const handlePlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    const playerState = event.data;
    if (playerState === 1) {
      applyPlaybackOptimizations(
        (event.target as unknown as InternalPlayer) ?? null,
      );
      setIsPlaying(true);
    } else if (playerState === 2 || playerState === 0) {
      setIsPlaying(false);
    }
  };

  const renderExperienceView = (
    mode: "guess" | "reveal",
    shouldShowNeon: boolean,
  ) => {
    if (!currentSong) {
      return null;
    }

    const showDetails = mode === "reveal";
    const showRemoteQr = !showDetails && hasSpecialRemoteRound && !timerStarted;
    const remoteModeLabel =
      specialRoundMode === "tararear" ? "tararear" : "mímica";
    const songYear =
      typeof currentSong.year === "number" ? currentSong.year : null;
    const heading = showDetails
      ? currentSong.title
      : showRemoteQr
        ? specialRoundMode === "tararear"
          ? "Ronda de tararear"
          : "Ronda de mímica"
        : "¿Puedes adivinar la canción?";
    const subheading = showDetails
      ? currentSong.artist
      : showRemoteQr
        ? "Escanea el QR y controla la pista desde otro dispositivo."
        : "Escucha, siente y deja que la intuición te guíe.";
    const description = showDetails
      ? "Disfruta visuales envolventes inspirados en tu canción. Sigue jugando para descubrir nuevas portadas y ambientes memorables."
      : showRemoteQr
        ? specialRoundMode === "tararear"
          ? "Cuando alguien mantenga presionado el botón en el celular verá el título y el artista, y además la canción sonará ahí a medio volumen."
          : "Cuando alguien mantenga presionado el botón en el celular verá el título y el artista."
        : 'Mantén el suspenso: cuando creas tener la respuesta, presiona "Mostrar" para confirmar tu apuesta.';
    const highlightedYear = showDetails && songYear !== null ? songYear : null;

    const statusCaptionLabel = showDetails
      ? "Reproduciendo"
      : showRemoteQr
        ? specialRoundMode === "tararear"
          ? "Tararear activo"
          : "Mímica activa"
        : "En modo sorpresa";
    const statusCaptionDescription = showDetails
      ? "Usa los controles para pasar o salir de la partida cuando quieras."
      : showRemoteQr
        ? timerStarted
          ? specialRoundMode === "tararear"
            ? "El temporizador ya corre. El audio solo suena en el celular mientras mantienen el botón apretado."
            : "El temporizador ya corre. La información depende del botón remoto."
          : "Presiona play para iniciar los 60 segundos."
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
    const shouldShowGoldenBackdrop = isSpecialSong && !showDetails;
    const theme = createAdaptiveTheme(
      shouldDisplayArtwork ? artworkPalette : null,
    );
    const spotlightDisplayValue = spotlightValue;
    const spotlightDisplayLabel = spotlightLabel;
    const shouldShowTimer =
      (timerEnabled || hasSpecialRemoteRound) &&
      gameState === "playing" &&
      timerStarted;
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
            backgroundImage: shouldShowGoldenBackdrop
              ? GOLDEN_BACKDROP
              : shouldDisplayArtwork
                ? `url(${artworkUrl})`
                : fallbackBackdrop,
            backgroundSize: shouldShowGoldenBackdrop
              ? "cover"
              : shouldDisplayArtwork
                ? "cover"
                : "140% 140%",
            backgroundPosition: shouldShowGoldenBackdrop
              ? "center"
              : shouldDisplayArtwork
                ? "center"
                : "45% 40%",
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
            backgroundColor: shouldShowGoldenBackdrop
              ? GOLDEN_OVERLAY
              : theme.overlayTint,
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
                      gap: 1,
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
                    <IconButton
                      aria-label="Reproducir sad trombone"
                      title="Reproducir sad trombone"
                      onClick={handleSadTrombone}
                      size="small"
                      sx={{
                        color: "inherit",
                        border: "1px solid rgba(255,255,255,0.22)",
                        backgroundColor: "rgba(255,255,255,0.08)",
                        "&:hover": {
                          backgroundColor: "rgba(255,255,255,0.18)",
                        },
                      }}
                    >
                      <CampaignIcon sx={{ fontSize: 20 }} />
                    </IconButton>
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
                {isPlaying && !showRemoteQr ? (
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
                  {showRemoteQr ? (
                    <>
                      <Box
                        sx={{
                          width: "82%",
                          maxWidth: 280,
                          borderRadius: 3,
                          backgroundColor: "#fff",
                          p: 1.2,
                          boxShadow: "0 18px 42px rgba(15,23,42,0.38)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          "& img": {
                            width: "100%",
                            height: "auto",
                            display: "block",
                          },
                        }}
                      >
                        <LocalQrCode value={mimicaJoinUrl} />
                      </Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: theme.fallback.text,
                        }}
                      >
                        Escanea para controlar {remoteModeLabel}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          textAlign: "center",
                          color: theme.fallback.caption,
                          px: 2,
                        }}
                      >
                        {specialRoundMode === "tararear"
                          ? "Abre el enlace, mantén apretado el botón y la canción se revelará y sonará a medio volumen en el celular."
                          : "Abre el enlace, mantén apretado el botón y ahí se revelará la canción en el celular."}
                      </Typography>
                    </>
                  ) : null}
                  {!showRemoteQr && (fallbackTitle || fallbackDescription) ? (
                    <InfoOutlinedIcon
                      sx={{ fontSize: 40, color: theme.fallback.icon }}
                    />
                  ) : null}
                  {!showRemoteQr && fallbackTitle ? (
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
                  {!showRemoteQr && fallbackDescription ? (
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
                    {playlist ? "Modo de canciones" : "Años de música"}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(204,231,255,0.78)",
                    }}
                  >
                    {playlist
                      ? `${playlist.name} · ${playlist.songCount} canciones`
                      : `${localRange.min} - ${localRange.max}`}
                  </Typography>
                </Box>
                {playlist ? (
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(204,231,255,0.78)" }}
                  >
                    Esta partida usará solo las canciones incluidas en la
                    playlist elegida antes de comenzar.
                  </Typography>
                ) : (
                  <>
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
                  </>
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
                    Etiquetas
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(204,231,255,0.78)",
                    }}
                  >
                    {playlist
                      ? "Puedes filtrar la playlist por una o más etiquetas."
                      : localSelectedTags.length
                        ? localTagMatchMode === "all"
                          ? "Se mostrarán canciones que tengan todas las etiquetas elegidas."
                          : "Se mostrarán canciones que tengan al menos una de las etiquetas elegidas."
                        : "Sin filtro por etiquetas."}
                  </Typography>
                </Box>
                <Stack
                  spacing={1.25}
                  sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                  <Box
                    sx={{
                      borderRadius: 2,
                      border: "1px solid rgba(99,216,255,0.12)",
                      backgroundColor: "rgba(4,17,29,0.28)",
                      p: 0.75,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        px: 0.75,
                        pb: 0.75,
                        color: "rgba(204,231,255,0.72)",
                        fontWeight: 700,
                      }}
                    >
                      Cómo combinar etiquetas
                    </Typography>
                    <Stack direction="row" spacing={0.75}>
                      {TAG_MATCH_MODE_OPTIONS.map((option) => {
                        const selected = localTagMatchMode === option.value;
                        return (
                          <Button
                            key={option.value}
                            size="small"
                            variant={selected ? "contained" : "text"}
                            color="info"
                            onClick={() =>
                              handleTagMatchModeChange(option.value)
                            }
                            sx={{
                              minWidth: 112,
                              borderRadius: 999,
                              px: 1.75,
                              textTransform: "none",
                              fontWeight: 700,
                              color: selected
                                ? "#04111d"
                                : "rgba(224,239,255,0.88)",
                              backgroundColor: selected
                                ? "#63d8ff"
                                : "rgba(7,33,57,0.3)",
                              border: selected
                                ? "1px solid rgba(99,216,255,0.58)"
                                : "1px solid rgba(99,216,255,0.14)",
                              "&:hover": {
                                backgroundColor: selected
                                  ? "#7ce2ff"
                                  : "rgba(10,43,72,0.42)",
                              },
                            }}
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </Stack>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      maxWidth: 320,
                      color: "rgba(204,231,255,0.72)",
                      lineHeight: 1.5,
                    }}
                  >
                    {
                      TAG_MATCH_MODE_OPTIONS.find(
                        (option) => option.value === localTagMatchMode,
                      )?.description
                    }
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {availableSongTags.map((option) => {
                      const selected = localSelectedTags.includes(option.slug);
                      return (
                        <Chip
                          key={option.slug}
                          label={getSongTagLabel(
                            option.slug,
                            availableSongTags,
                          )}
                          clickable
                          onClick={() => handleTagToggle(option.slug)}
                          color={selected ? "info" : "default"}
                          variant={selected ? "filled" : "outlined"}
                          sx={{ color: selected ? "#04111d" : "#dfeeff" }}
                        />
                      );
                    })}
                  </Stack>
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
                    Modos especiales
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(204,231,255,0.78)",
                    }}
                  >
                    Decide si esta partida puede incluir rondas de mímica o tarareo.
                  </Typography>
                </Box>
                <Stack spacing={1.2} sx={{ minWidth: { sm: 280 } }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: "rgba(224,239,255,0.9)" }}>
                      Incluir mímica
                    </Typography>
                    <Switch
                      color="info"
                      checked={localMimicaEnabled}
                      onChange={handleMimicaToggle}
                      inputProps={{
                        "aria-label": "Incluir rondas de mímica",
                      }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: "rgba(224,239,255,0.9)" }}>
                      Incluir tarareo
                    </Typography>
                    <Switch
                      color="info"
                      checked={localTararearEnabled}
                      onChange={handleTararearToggle}
                      inputProps={{
                        "aria-label": "Incluir rondas de tarareo",
                      }}
                    />
                  </Stack>
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
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <YouTube
          videoId={SAD_TROMBONE_VIDEO_ID}
          opts={sadTrombonePlayerOptions}
          ref={sadTrombonePlayerRef}
          onReady={handleSadTrombonePlayerReady}
          onStateChange={handleSadTrombonePlayerStateChange}
        />
      </Box>

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
