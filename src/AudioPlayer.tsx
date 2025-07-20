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

  const opts = {
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
    },
  };

  const handlePlayPause = () => {
    if (
      playerRef.current &&
      typeof playerRef.current.getInternalPlayer === "function"
    ) {
      const internalPlayer = playerRef.current.getInternalPlayer();
      if (playing) {
        if (internalPlayer && typeof internalPlayer.pauseVideo === "function") {
          internalPlayer.pauseVideo();
        }
      } else {
        if (internalPlayer && typeof internalPlayer.playVideo === "function") {
          internalPlayer.playVideo();
        }
        if (internalPlayer && typeof internalPlayer.unMute === "function") {
          internalPlayer.unMute();
        }
      }
      setPlaying((p) => !p);
    }
  };

  const handleBack = () => {
    if (
      playerRef.current &&
      typeof playerRef.current.getInternalPlayer === "function"
    ) {
      const internalPlayer = playerRef.current.getInternalPlayer();
      if (internalPlayer && typeof internalPlayer.stopVideo === "function") {
        internalPlayer.stopVideo();
      }
    }
    setPlaying(false);
    onBack();
  };

  // Manejar el estado del reproductor para mostrar/ocultar el botón
  const onPlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    // 1 = playing, 2 = paused, 0 = ended
    if (event.data === 1) {
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
            onReady={() => setVideoStatus("ok")}
            onError={() => setVideoStatus("error")}
          />
        </Box>
      )}

      {/* Espacio flexible para centrar el botón play/pause */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
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
      </Box>

      {/* Botón fijo abajo */}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          position: "absolute",
          bottom: 72, // 50% más arriba que antes
          left: 0,
        }}
      >
        <Button
          variant="outlined"
          color="inherit"
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
            color: "#FFF",
            border: "2px solid #FFF",
            backgroundColor: "rgba(0,0,0,0.05)",
            "&:hover": {
              backgroundColor: "#FFF",
              color: "#28518C",
              border: "2px solid #FFF",
            },
          }}
        >
          Volver a escanear
        </Button>
      </Box>
    </Box>
  );
};

export default AudioPlayer;
