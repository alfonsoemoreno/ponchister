import React, { useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";

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
  const [showPlay, setShowPlay] = useState(true);

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

  const handlePlay = () => {
    if (
      playerRef.current &&
      typeof playerRef.current.getInternalPlayer === "function"
    ) {
      const internalPlayer = playerRef.current.getInternalPlayer();
      if (internalPlayer && typeof internalPlayer.playVideo === "function") {
        internalPlayer.playVideo();
      }
      if (internalPlayer && typeof internalPlayer.unMute === "function") {
        internalPlayer.unMute();
      }
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
    setShowPlay(true);
    onBack();
  };

  // Manejar el estado del reproductor para mostrar/ocultar el botón
  const onPlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    // 1 = playing, 2 = paused, 0 = ended
    if (event.data === 1) {
      setShowPlay(false);
    } else if (event.data === 2 || event.data === 0) {
      setShowPlay(true);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #FF5F6D 0%, #FFC371 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      {!showPlay && (
        <>
          <h1
            style={{
              fontSize: "2.9rem",
              marginBottom: "1rem",
              fontFamily: "'Fredoka', sans-serif",
              fontWeight: 700,
              letterSpacing: 1,
              textShadow:
                "0 0 8px #fff, 0 0 16px #ff00de, 0 0 32px #ff00de, 0 0 48px #ff00de, 0 0 64px #ff00de, 0 0 80px #ff00de, 0 0 100px #ff00de",
              animation:
                "neon-bounce 0.35s infinite cubic-bezier(.36,.07,.19,.97) both",
            }}
          >
            ON AIR
          </h1>
          <style>{`
            @keyframes neon-bounce {
              0% {
                transform: scale(1) translateY(0);
                filter: brightness(1.2);
              }
              10% {
                transform: scale(1.08, 0.95) translateY(-2px);
                filter: brightness(1.4);
              }
              20% {
                transform: scale(0.98, 1.05) translateY(2px);
                filter: brightness(1.1);
              }
              30% {
                transform: scale(1.12, 0.92) translateY(-4px);
                filter: brightness(1.5);
              }
              40% {
                transform: scale(0.95, 1.1) translateY(3px);
                filter: brightness(1.1);
              }
              50% {
                transform: scale(1.15, 0.9) translateY(-6px);
                filter: brightness(1.6);
              }
              60% {
                transform: scale(0.97, 1.08) translateY(2px);
                filter: brightness(1.2);
              }
              70% {
                transform: scale(1.08, 0.95) translateY(-2px);
                filter: brightness(1.3);
              }
              80% {
                transform: scale(1, 1) translateY(0);
                filter: brightness(1.2);
              }
              100% {
                transform: scale(1) translateY(0);
                filter: brightness(1.2);
              }
            }
          `}</style>
        </>
      )}

      {videoId ? (
        <div
          style={{
            width: 40,
            height: 20,
            overflow: "hidden",
            margin: "0 auto",
          }}
        >
          <YouTube
            videoId={videoId}
            opts={opts}
            ref={playerRef}
            onStateChange={onPlayerStateChange}
          />
        </div>
      ) : (
        <p>URL de video no válida</p>
      )}

      {showPlay && videoId && (
        <button
          onClick={handlePlay}
          style={{
            marginTop: "2rem",
            backgroundColor: "#fff",
            color: "#FF5F6D",
            padding: "1rem 2.5rem",
            fontSize: "1.2rem",
            borderRadius: "2rem",
            border: "none",
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            cursor: "pointer",
            transition: "background 0.2s, color 0.2s",
          }}
        >
          Escuchar
        </button>
      )}

      <button
        onClick={handleBack}
        style={{
          marginTop: "2rem",
          backgroundColor: "#fff",
          color: "#FF5F6D",
          padding: "1rem 2.5rem",
          fontSize: "1rem",
          borderRadius: "2rem",
          border: "none",
          fontWeight: 700,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          cursor: "pointer",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        Volver a escanear
      </button>
    </div>
  );
};

export default AudioPlayer;
