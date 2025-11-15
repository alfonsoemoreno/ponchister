import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
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

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <IconButton
          onClick={handlePlayPause}
          sx={{
            width: 140,
            height: 140,
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
            <PauseIcon sx={{ fontSize: 72 }} />
          ) : (
            <PlayArrowIcon sx={{ fontSize: 72 }} />
          )}
        </IconButton>
        <Box
          sx={{
            bgcolor: "rgba(0,0,0,0.4)",
            borderRadius: 3,
            px: 3,
            py: 2,
            color: "#fff",
            textAlign: "left",
            boxShadow: 2,
            maxHeight: { xs: "50vh", sm: "60vh" },
            overflowY: "auto",
            pr: 2,
            wordBreak: "break-word",
          }}
        >
          <Typography variant="overline" sx={{ color: "#b2ebf2" }}>
            Artista
          </Typography>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, mb: 1, wordBreak: "break-word" }}
          >
            {currentSong.artist}
          </Typography>
          <Typography variant="overline" sx={{ color: "#b2ebf2" }}>
            Canción
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, mb: 1, wordBreak: "break-word" }}
          >
            {currentSong.title}
          </Typography>
          <Typography variant="overline" sx={{ color: "#b2ebf2" }}>
            Año
          </Typography>
          <Typography
            variant="h5"
            sx={{ fontWeight: 600, wordBreak: "break-word" }}
          >
            {currentSong.year ?? "Desconocido"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<SkipNextIcon />}
            onClick={handleNextAfterReveal}
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
            Siguiente canción
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<ExitToAppIcon />}
            onClick={handleExit}
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
            Salir del juego
          </Button>
        </Box>
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
