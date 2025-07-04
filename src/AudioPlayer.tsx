import React, { useRef } from "react";
import YouTube from "react-youtube";

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

  const opts = {
    height: "0",
    width: "0",
    playerVars: {
      autoplay: 1,
    },
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
    onBack();
  };

  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light">
      <div className="card p-4 shadow-lg text-center">
        <h2 className="mb-3">Escuchando audio de YouTube</h2>
        {videoId ? (
          <YouTube
            videoId={videoId}
            opts={opts}
            ref={playerRef}
            style={{ display: "none" }}
            className="d-none"
          />
        ) : (
          <p>URL de video no válida</p>
        )}
        <button className="btn btn-secondary mt-4" onClick={handleBack}>
          Volver a escanear
        </button>
      </div>
    </div>
  );
};

export default AudioPlayer;
