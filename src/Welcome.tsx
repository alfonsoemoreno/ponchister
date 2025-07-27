import React from "react";
import Button from "@mui/material/Button";

interface WelcomeProps {
  onAccept: () => void;
}

const requestFullscreen = () => {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  if (el.requestFullscreen) {
    el.requestFullscreen();
  } else if (typeof el.webkitRequestFullscreen === "function") {
    el.webkitRequestFullscreen();
  } else if (typeof el.msRequestFullscreen === "function") {
    el.msRequestFullscreen();
  }
};

const Welcome: React.FC<WelcomeProps> = ({ onAccept }) => (
  <div
    style={{
      height: "100vh",
      width: "100vw",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      backgroundColor: "transparent",
    }}
  >
    {/* Fondo ocean con blur cubriendo todo */}
    <div className="ocean-background ocean-blur" />
    <div
      style={{
        textAlign: "center",
        padding: "2rem",
        width: "100%",
        maxWidth: "400px",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "'Lilita One', 'Poppins', 'Fredoka', Arial, sans-serif",
          fontWeight: 700,
          fontSize: "2.5rem",
          marginBottom: "1rem",
          letterSpacing: 1,
          textShadow:
            "0 0 8px #fff, 0 0 16px #00e6ff, 0 0 32px #00e6ff, 0 0 48px #00e6ff, 0 0 64px #00e6ff, 0 0 80px #00e6ff, 0 0 100px #00e6ff",
          animation: "neon-flicker 1.5s infinite alternate",
        }}
      >
        PONCHISTER
      </h1>
      <style>{`
        @keyframes neon-flicker {
          0%, 100% { text-shadow:
            0 0 8px #fff, 0 0 16px #00e6ff, 0 0 32px #00e6ff, 0 0 48px #00e6ff, 0 0 64px #00e6ff, 0 0 80px #00e6ff, 0 0 100px #00e6ff;
          }
          10%, 90% { text-shadow:
            0 0 4px #fff, 0 0 8px #00e6ff, 0 0 16px #00e6ff, 0 0 24px #00e6ff, 0 0 32px #00e6ff, 0 0 40px #00e6ff, 0 0 50px #00e6ff;
          }
          20%, 80% { text-shadow:
            0 0 12px #fff, 0 0 24px #00e6ff, 0 0 48px #00e6ff, 0 0 72px #00e6ff, 0 0 96px #00e6ff, 0 0 120px #00e6ff, 0 0 150px #00e6ff;
          }
          30%, 50%, 70% { text-shadow:
            0 0 2px #fff, 0 0 4px #00e6ff, 0 0 8px #00e6ff, 0 0 12px #00e6ff, 0 0 16px #00e6ff, 0 0 20px #00e6ff, 0 0 25px #00e6ff;
          }
          40%, 60% { text-shadow:
            0 0 16px #fff, 0 0 32px #00e6ff, 0 0 64px #00e6ff, 0 0 96px #00e6ff, 0 0 128px #00e6ff, 0 0 160px #00e6ff, 0 0 200px #00e6ff;
          }
        }
      `}</style>
      <p
        style={{
          marginBottom: "1rem",
          opacity: 0.9,
          fontSize: "1rem",
          lineHeight: 1.2,
          padding: "0 1.4rem",
        }}
      >
        Escanea un código QR para escuchar la canción.
      </p>
      <Button
        variant="outlined"
        color="primary"
        onClick={() => {
          requestFullscreen();
          onAccept();
        }}
        sx={{
          borderRadius: 2,
          fontWeight: "bold",
          fontSize: "1rem",
          py: 1.2,
          px: 3,
          boxShadow: 1,
          textTransform: "none",
          color: "#FFF !important",
          border: "2px solid #FFF",
          backgroundColor: "rgba(0,0,0,0.05) !important",
          transition: "background 0.2s, color 0.2s",
          mt: "20%",
          "&:hover": {
            backgroundColor: "#FFF !important",
            color: "#28518C !important",
            border: "2px solid #FFF",
          },
          "&:focus": {
            backgroundColor: "rgba(0,0,0,0.05) !important",
            color: "#FFF !important",
          },
          "&:active": {
            backgroundColor: "rgba(0,0,0,0.05) !important",
            color: "#FFF !important",
          },
        }}
      >
        Comenzar
      </Button>
    </div>
  </div>
);

export default Welcome;
