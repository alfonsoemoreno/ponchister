import React from "react";

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
      <button
        onClick={onAccept}
        style={{
          background: "linear-gradient(to right, #4b6cb7, #182848)",
          border: "none",
          color: "#fff",
          padding: "1rem 2rem",
          borderRadius: "999px",
          fontSize: "1rem",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Comenzar
      </button>
    </div>
  </div>
);

export default Welcome;
