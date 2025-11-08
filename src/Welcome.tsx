import React from "react";
import Button from "@mui/material/Button";

interface WelcomeProps {
  onAccept: () => void;
  onStartAuto: () => void;
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

const Welcome: React.FC<WelcomeProps> = ({ onAccept, onStartAuto }) => (
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
      <img
        src="/ponchister_logo.png"
        alt="Ponchister"
        style={{
          width: "100%",
          maxWidth: "300px",
          marginBottom: "1rem",
        }}
      />
      <p
        style={{
          marginBottom: "1rem",
          opacity: 0.9,
          fontSize: "1rem",
          lineHeight: 1.2,
          padding: "0 1.4rem",
        }}
      >
        Escanea un código QR para escuchar una pista o activa el modo automático
        para recibir canciones aleatorias.
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
          boxShadow: 0,
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
      <Button
        variant="outlined"
        color="secondary"
        onClick={() => {
          requestFullscreen();
          onStartAuto();
        }}
        sx={{
          borderRadius: 2,
          fontWeight: "bold",
          fontSize: "1rem",
          py: 1.2,
          px: 3,
          boxShadow: 0,
          textTransform: "none",
          color: "#FFF !important",
          border: "2px solid #FFF",
          backgroundColor: "rgba(0,0,0,0.05) !important",
          transition: "background 0.2s, color 0.2s",
          mt: 2,
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
        Modo automático
      </Button>
      {/* Botón para generar tarjetas */}
      <Button
        variant="outlined"
        color="primary"
        onClick={() =>
          window.open("https://ponchistercards.vercel.app", "_blank")
        }
        sx={{
          borderRadius: 2,
          fontWeight: "bold",
          fontSize: "1rem",
          py: 1.2,
          px: 3,
          boxShadow: 0,
          textTransform: "none",
          color: "#FFF !important",
          border: "2px solid #FFF",
          backgroundColor: "rgba(0,0,0,0.05) !important",
          transition: "background 0.2s, color 0.2s",
          mt: 2,
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
        Generar tarjetas y fichas
      </Button>
    </div>
  </div>
);

export default Welcome;
