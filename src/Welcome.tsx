import React from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CasinoIcon from "@mui/icons-material/Casino";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface WelcomeProps {
  onAccept: () => void;
  onStartAuto: () => void;
  onStartBingo: () => void;
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

const Welcome: React.FC<WelcomeProps> = ({
  onAccept,
  onStartAuto,
  onStartBingo,
}) => {
  const currentYear = new Date().getFullYear();

  const handleStartScan = () => {
    requestFullscreen();
    onAccept();
  };

  const handleStartAutoMode = () => {
    requestFullscreen();
    onStartAuto();
  };

  const handleStartBingoMode = () => {
    requestFullscreen();
    onStartBingo();
  };

  const handleOpenCards = () => {
    window.open("https://ponchistercards.vercel.app", "_blank");
  };

  const neonLines = (
    <Box className="neon-lines" sx={{ zIndex: 2 }}>
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
  );

  return (
    <Box
      sx={{
        position: "relative",
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        color: "#fff",
        overflowX: "hidden",
        overflowY: "auto",
        fontFamily: "'Poppins', 'Fredoka', Arial, sans-serif",
        background:
          "linear-gradient(190deg, #0a2a6f 0%, #051d4a 52%, #030c26 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 24% 12%, rgba(56,136,255,0.32), rgba(6,18,44,0) 38%)",
          opacity: 0.9,
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(125deg, rgba(4,10,24,0.82) 0%, rgba(4,18,50,0.78) 52%, rgba(16,46,112,0.7) 100%)",
          backdropFilter: "blur(18px)",
          zIndex: 1,
        }}
      />
      {neonLines}
      <Box
        sx={{
          position: "relative",
          zIndex: 3,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 5, md: 6 }}
          sx={{
            width: "min(1080px, 92vw)",
            py: { xs: 6, md: 8 },
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Box
            sx={{
              width: { xs: "78%", sm: 320, md: 380 },
              alignSelf: { xs: "center", md: "flex-start" },
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: { xs: 4, md: 5 },
                overflow: "hidden",
                boxShadow: "0 38px 78px -32px rgba(5,18,52,0.82)",
                border: "1px solid rgba(255,255,255,0.14)",
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(148,197,255,0.12) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: { xs: 4, md: 5 },
              }}
            >
              <Box
                component="img"
                src="/ponchister_logo.png"
                alt="Ponchister"
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 22px 40px rgba(2,10,36,0.55))",
                }}
              />
            </Box>
          </Box>
          <Stack
            spacing={{ xs: 4, md: 5 }}
            sx={{ flex: 1, alignSelf: { xs: "center", md: "flex-start" } }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
            >
              <Chip
                label="Experiencia Ponchister"
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  color: "#fff",
                  backdropFilter: "blur(10px)",
                }}
              />
              <Chip
                label={`Canciones ${1950} - ${currentYear}`}
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(13,148,255,0.2)",
                  color: "rgba(212,239,255,0.95)",
                  border: "1px solid rgba(148,197,255,0.35)",
                }}
              />
              <Chip
                label="Escucha inmersiva"
                sx={{
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "rgba(230,243,255,0.92)",
                  border: "1px dashed rgba(230,243,255,0.35)",
                }}
              />
            </Stack>
            <Stack spacing={2.5} sx={{ maxWidth: 620 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  textShadow: "0 40px 80px rgba(0,0,0,0.6)",
                }}
              >
                Descubre Ponchister en su forma más cinematográfica
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: "rgba(204,231,255,0.92)",
                }}
              >
                Escanea un código QR para escuchar una pista o lánzate al modo
                automático para recibir canciones equilibradas, portadas y
                atmósferas envolventes al instante.
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: "rgba(224,239,255,0.82)", maxWidth: 600 }}
              >
                Nuestro algoritmo evita repeticiones, equilibra décadas y revela
                cada canción con animaciones brillantes. Puedes inspirarte con
                un año al azar, explorar tarjetas impresas o simplemente dejar
                que la música te sorprenda.
              </Typography>
            </Stack>
            <Stack spacing={3} sx={{ maxWidth: 640 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                  alignSelf: { xs: "stretch", sm: "flex-start" },
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="contained"
                  startIcon={<QrCodeScannerIcon />}
                  onClick={handleStartScan}
                  sx={{
                    minWidth: 220,
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 3.5,
                    py: 1.6,
                    boxShadow: "0 22px 48px -18px rgba(50,132,255,0.6)",
                    background:
                      "linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #22d3ee 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #06b6d4 100%)",
                      boxShadow: "0 26px 56px -20px rgba(37,99,235,0.7)",
                    },
                  }}
                >
                  Comenzar con QR
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleStartAutoMode}
                  sx={{
                    minWidth: 220,
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 3.5,
                    py: 1.6,
                    borderColor: "rgba(255,255,255,0.4)",
                    color: "rgba(255,255,255,0.92)",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.7)",
                      backgroundColor: "rgba(255,255,255,0.12)",
                    },
                  }}
                >
                  Activar modo automático
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<CasinoIcon />}
                  onClick={handleStartBingoMode}
                  sx={{
                    minWidth: 220,
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 3.5,
                    py: 1.6,
                    borderColor: "rgba(34,197,94,0.4)",
                    color: "rgba(212,255,244,0.92)",
                    "&:hover": {
                      borderColor: "rgba(34,197,94,0.7)",
                      backgroundColor: "rgba(34,197,94,0.12)",
                    },
                  }}
                >
                  Activar modo bingo
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<OpenInNewIcon />}
                  onClick={handleOpenCards}
                  sx={{
                    minWidth: 220,
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 3.5,
                    py: 1.6,
                    borderColor: "rgba(255,255,255,0.24)",
                    color: "rgba(224,239,255,0.92)",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.5)",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    },
                  }}
                >
                  Generar tarjetas y fichas
                </Button>
              </Stack>
              <Typography
                variant="caption"
                sx={{
                  color: "rgba(204,231,255,0.74)",
                  letterSpacing: 0.4,
                }}
              >
                Sugerencia: activa pantalla completa para disfrutar al máximo
                las animaciones y el ambiente sonoro.
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};

export default Welcome;
