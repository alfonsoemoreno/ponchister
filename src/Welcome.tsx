import React from "react";
import Button from "@mui/material/Button";

interface WelcomeProps {
  onAccept: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onAccept }) => (
  <div
    style={{
      background: "#0b0d1c",
      color: "#ffffff",
      height: "100vh",
      width: "100vw",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <div
      style={{
        textAlign: "center",
        padding: "2rem",
        width: "100%",
        maxWidth: "400px",
      }}
    >
      <h1
        style={{
          fontFamily: "'Fredoka', sans-serif",
          fontWeight: 700,
          fontSize: "3rem",
          marginBottom: "1rem",
          letterSpacing: 1,
          textShadow:
            "0 0 8px #fff, 0 0 16px #00e6ff, 0 0 32px #00e6ff, 0 0 48px #00e6ff, 0 0 64px #00e6ff, 0 0 80px #00e6ff, 0 0 100px #00e6ff",
          animation: "neon-flicker 1.5s infinite alternate",
        }}
      >
        Ponchister
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
      <p style={{ marginBottom: "2rem", opacity: 0.9 }}>
        Escanea un código QR para escuchar la canción.
      </p>
      <Button
        variant="contained"
        onClick={onAccept}
        sx={{
          borderRadius: 2,
          fontWeight: "bold",
          fontSize: "1rem",
          py: 1.5,
          px: 4,
          boxShadow: "0 0 16px #00e6ff, 0 0 32px #00e6ff",
          background: "linear-gradient(90deg, #00e6ff 0%, #0b0d1c 100%)",
          color: "#fff",
          textShadow: "0 0 8px #fff, 0 0 16px #00e6ff",
          textTransform: "none",
          transition: "background 0.2s, color 0.2s",
          "&:hover": {
            background: "linear-gradient(90deg, #00bfff 0%, #0b0d1c 100%)",
            boxShadow: "0 0 32px #00e6ff, 0 0 64px #00e6ff",
          },
        }}
      >
        Comenzar
      </Button>
    </div>
  </div>
);

export default Welcome;
