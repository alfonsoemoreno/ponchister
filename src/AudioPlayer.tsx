import React, { useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import Box from "@mui/material/Box";

interface AudioPlayerProps {
  videoUrl: string;
  onBack: () => void;
}

type InternalPlayer = {
  playVideo?: () => unknown;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
  setPlaybackQuality?: (suggestedQuality: string) => void;
  setPlaybackRate?: (rate: number) => void;
};

function getYouTubeId(url: string): string | null {
  const regExp =
    /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ videoUrl, onBack }) => {
  const playerRef = useRef<YouTube | null>(null);
  const videoId = getYouTubeId(videoUrl);
  const [playing, setPlaying] = useState(false);
  const [videoStatus, setVideoStatus] = useState<"ok" | "error" | "pending">(
    videoId ? "pending" : "error"
  );

  const applyPlaybackOptimizations = (player: InternalPlayer | null) => {
    if (!player) return;
    // Forzar calidad baja y velocidad normal para reducir carga en dispositivos móviles
    player.setPlaybackQuality?.("small");
    player.setPlaybackRate?.(1);
  };

  const opts: YouTubeProps["opts"] = {
    height: "20",
    width: "40",
    playerVars: {
      autoplay: 0,
      mute: 1,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      fs: 0,
      iv_load_policy: 3,
      disablekb: 1,
      playsinline: 1,
      cc_load_policy: 0,
    },
  };

  const handlePlayPause = () => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as InternalPlayer | null;
    if (!internalPlayer) return;

    if (playing) {
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
          setVideoStatus("error");
        });
      }
    }

    setPlaying((p) => !p);
  };

  const handleBack = () => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as InternalPlayer | null;
    internalPlayer?.stopVideo?.();
    setPlaying(false);
    onBack();
  };

  // Manejar el estado del reproductor para mostrar/ocultar el botón
  const onPlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    // 1 = playing, 2 = paused, 0 = ended
    if (event.data === 1) {
      applyPlaybackOptimizations(
        (event.target as unknown as InternalPlayer) ?? null
      );
      setPlaying(true);
    } else if (event.data === 2 || event.data === 0) {
      setPlaying(false);
    }
  };

  return (
    <Box
      className={`ocean-background${playing ? " speaker-anim" : ""}`}
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
        overflow: "hidden",
        fontFamily: "'Poppins', 'Fredoka', Arial, sans-serif",
      }}
    >
      {/* Indicador de estado de video */}
      <Box sx={{ position: "absolute", top: 24, right: 24, zIndex: 10 }}>
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor:
              videoStatus === "ok"
                ? "#4caf50"
                : videoStatus === "error"
                ? "#f44336"
                : "#ffeb3b",
            border: "2px solid #fff",
            boxShadow: 1,
          }}
        />
      </Box>

      {/* Video de fondo invisible pero detrás */}
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
            videoId={videoId}
            opts={opts}
            ref={playerRef}
            onStateChange={onPlayerStateChange}
            onReady={(event) => {
              applyPlaybackOptimizations(
                (event.target as unknown as InternalPlayer) ?? null
              );
              setVideoStatus("ok");
              const iframe = event.target.getIframe?.();
              iframe?.setAttribute("allow", "autoplay; clipboard-write");
              if (typeof event.target.mute === "function") {
                event.target.mute();
              }
            }}
            onError={() => setVideoStatus("error")}
          />
        </Box>
      )}

      {/* Contenedor centrado para botones play/pause y volver a escanear */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {videoId && (
          <IconButton
            onClick={handlePlayPause}
            sx={{
              width: 160,
              height: 160,
              border: "4px solid #ffffff",
              color: "#ffffff",
              borderRadius: "50%",
              mb: 2,
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.15)",
              },
            }}
          >
            {playing ? (
              <PauseIcon sx={{ fontSize: 80 }} />
            ) : (
              <PlayArrowIcon sx={{ fontSize: 80 }} />
            )}
          </IconButton>
        )}
        {/* Botón volver a escanear debajo y centrado */}
        <Button
          variant="outlined"
          color="primary"
          onClick={handleBack}
          size="large"
          startIcon={<QrCodeScannerIcon sx={{ fontSize: 32, color: "#fff" }} />}
          sx={{
            borderRadius: 2,
            fontWeight: "bold",
            fontSize: "1rem",
            py: 1.2,
            px: 3,
            boxShadow: 1,
            textTransform: "none",
            color: "#FFF !important",
            border: "2px solid #FFF !important",
            backgroundColor: "rgba(0,0,0,0.05) !important",
            transition: "background 0.2s, color 0.2s",
            mt: 6,
            "&:hover, &:focus, &:active": {
              backgroundColor: "rgba(0,0,0,0.15) !important",
              color: "#FFF !important",
              border: "2px solid #FFF !important",
            },
          }}
        >
          Volver a escanear
        </Button>
      </Box>

      {/* Líneas neon animadas cuando está reproduciendo */}
      {playing && (
        <Box className="neon-lines">
          {/* 5 líneas, alternando animación y color */}
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

export default AudioPlayer;
