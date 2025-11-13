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

import { fetchRandomSong, getSongCount } from "./services/songService";
import type { Song } from "./types";

interface InternalPlayer {
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  unMute?: () => void;
  setPlaybackRate?: (rate: number) => void;
}

interface AutoGameProps {
  onExit: () => void;
}

type GameState = "idle" | "loading" | "playing" | "revealed" | "error";

type PlayerRef = YouTube | null;

const youtubeOptions: YouTubeProps["opts"] = {
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
  },
};

function extractYoutubeId(url: string): string | null {
  const regExp =
    /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1]?.length === 11 ? match[1] : null;
}

const AutoGame: React.FC<AutoGameProps> = ({ onExit }) => {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [totalSongCount, setTotalSongCount] = useState<number | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const seenSongIdsRef = useRef<Set<number>>(new Set());

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

  const loadRandomSong = useCallback(async () => {
    setErrorMessage(null);
    setGameState("loading");

    try {
      stopPlayback();

      const shouldRefreshCount = seenSongIdsRef.current.size === 0;
      const total =
        totalSongCount !== null && !shouldRefreshCount
          ? totalSongCount
          : await getSongCount({ forceRefresh: shouldRefreshCount });

      if (totalSongCount === null || shouldRefreshCount) {
        setTotalSongCount(total);
      }

      if (total === 0) {
        throw new Error("No hay canciones disponibles en la base de datos");
      }

      if (seenSongIdsRef.current.size >= total) {
        setErrorMessage(
          "Ya escuchaste todas las canciones disponibles en esta partida. Reinicia para volver a jugar."
        );
        setGameState("error");
        return;
      }

      const maxAttempts = Math.min(total, 12);
      let song: Song | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = await fetchRandomSong();
        if (!seenSongIdsRef.current.has(candidate.id)) {
          song = candidate;
          break;
        }
      }

      if (!song) {
        setErrorMessage(
          "No se encontraron canciones nuevas por ahora. Intenta nuevamente."
        );
        setGameState("error");
        return;
      }

      seenSongIdsRef.current.add(song.id);
      setCurrentSong(song);
      setPlayerKey((prev) => prev + 1);
      setGameState("playing");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo obtener una canción nueva"
      );
      setGameState("error");
    }
  }, [stopPlayback, totalSongCount]);

  const handleStart = () => {
    seenSongIdsRef.current.clear();
    setTotalSongCount(null);
    loadRandomSong().catch(() => {
      /* handled in loadRandomSong */
    });
  };

  const handleSkip = () => {
    stopPlayback();
    loadRandomSong().catch(() => {
      /* handled in loadRandomSong */
    });
  };

  const handleReveal = () => {
    setGameState("revealed");
  };

  const handleNextAfterReveal = () => {
    stopPlayback();
    loadRandomSong().catch(() => {
      /* handled in loadRandomSong */
    });
  };

  const handleExit = () => {
    const finalizeExit = () => {
      stopPlayback();
      setCurrentSong(null);
      setGameState("idle");
      seenSongIdsRef.current.clear();
      setTotalSongCount(null);
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
      internalPlayer.unMute?.();
      internalPlayer.playVideo?.();
    }
  };

  const handlePlayerReady: YouTubeProps["onReady"] = (event) => {
    setIsPlaying(false);
    event.target.setPlaybackRate?.(1);
    event.target.pauseVideo?.();
  };

  const handlePlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    const playerState = event.data;
    if (playerState === 1) {
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
            opts={youtubeOptions}
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
