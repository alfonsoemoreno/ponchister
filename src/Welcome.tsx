import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import type { YearRange } from "./types";
import { getReleaseInfo } from "./lib/releaseInfo";

interface WelcomeProps {
  onStartAuto: () => void;
  onOpenAdmin: () => void;
  yearRange: YearRange;
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
  onStartAuto,
  onOpenAdmin,
  yearRange,
}) => {
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const releaseInfo = useMemo(() => getReleaseInfo(), []);
  const releaseEntries = releaseInfo.entries;

  const handleStartAutoMode = () => {
    requestFullscreen();
    onStartAuto();
  };

  const handleOpenAdmin = () => {
    onOpenAdmin();
  };

  const handleOpenReleaseNotes = () => {
    setReleaseModalOpen(true);
  };

  const handleCloseReleaseNotes = () => {
    setReleaseModalOpen(false);
  };

  return (
    <Box
      sx={{
        position: "relative",
        width: "100vw",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        color: "#f8fbff",
        overflowX: "hidden",
        overflowY: "auto",
        fontFamily: "'Poppins', 'Fredoka', Arial, sans-serif",
        background:
          "radial-gradient(circle at 15% 20%, rgba(15,102,255,0.35) 0%, rgba(7,30,82,0.85) 38%, rgba(3,12,34,0.98) 75%), radial-gradient(circle at 85% 20%, rgba(0,209,255,0.32) 0%, rgba(5,24,64,0.5) 35%, rgba(3,12,34,0.9) 70%), linear-gradient(180deg, #06102b 0%, #030a1c 100%)",
        "&::before": {
          content: '""',
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 80%, rgba(94,234,212,0.18), transparent 50%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.22), transparent 55%)",
          opacity: 0.9,
          zIndex: 0,
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(120deg, rgba(255,255,255,0.04) 0%, transparent 35%, rgba(255,255,255,0.03) 60%, transparent 100%)",
          opacity: 0.6,
          zIndex: 0,
          pointerEvents: "none",
        },
      }}
    >
      {/* Sin animaciones pesadas en inicio */}
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
          spacing={{ xs: 1, md: 2 }}
          sx={{
            width: "min(920px, 92vw)",
            pt: {
              xs: "calc(env(safe-area-inset-top, 0px) + 18px)",
              sm: 5,
              md: 9,
            },
            pb: { xs: 4, md: 9 },
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <Box
            component="img"
            src="/ponchister_logo.png"
            alt="Ponchister"
            sx={{
              width: { xs: 252, sm: 288, md: 324 },
              height: { xs: 252, sm: 288, md: 324 },
              objectFit: "contain",
              filter: "drop-shadow(0 24px 50px rgba(2,10,36,0.65))",
            }}
          />
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 2,
              fontWeight: 700,
              color: "rgba(148,216,255,0.86)",
              mt: { xs: -3.5, sm: -3 },
            }}
          >
            Catálogo {yearRange.min} - {yearRange.max}
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.02em",
              textShadow: "0 24px 56px rgba(0,0,0,0.55)",
              maxWidth: 720,
              fontSize: "clamp(1.7rem, 6vw, 3.2rem)",
              lineHeight: { xs: 1.2, sm: 1.15 },
              textAlign: "center",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}
          >
            Ponchister: música y sorpresa
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "rgba(224,239,255,0.82)",
              maxWidth: 540,
              lineHeight: 1.6,
              fontSize: { xs: "1rem", sm: "1.05rem" },
            }}
          >
            Presiona "Ir al juego" y deja que el sistema elija canciones para
            todos. Solo escucha, adivina y disfruta.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              alignSelf: "center",
              justifyContent: "center",
              alignItems: "center",
              rowGap: "10px",
              width: "100%",
              maxWidth: 520,
            }}
          >
            <Button
              variant="contained"
              color="inherit"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleStartAutoMode}
              sx={{
                width: { xs: "100%", sm: "auto" },
                flex: { sm: 1 },
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 999,
                px: 3.5,
                py: 1.6,
                background:
                  "linear-gradient(120deg, #38bdf8 0%, #0ea5e9 50%, #22d3ee 100%)",
                boxShadow: "0 22px 48px -26px rgba(56,189,248,0.85)",
                "&:hover": {
                  background:
                    "linear-gradient(120deg, #22d3ee 0%, #38bdf8 45%, #0ea5e9 100%)",
                },
              }}
            >
              Ir al juego
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<AdminPanelSettingsIcon />}
              onClick={handleOpenAdmin}
              sx={{
                width: { xs: "100%", sm: "auto" },
                flex: { sm: 1 },
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 999,
                px: 3.5,
                py: 1.6,
                borderColor: "rgba(255,255,255,0.32)",
                color: "rgba(224,239,255,0.92)",
                backgroundColor: "rgba(6,24,58,0.4)",
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.6)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              Administración
            </Button>
          </Stack>
        </Stack>
      </Box>
      <Dialog
        open={releaseModalOpen}
        onClose={handleCloseReleaseNotes}
        fullWidth
        maxWidth="sm"
        sx={{
          "& .MuiPaper-root": {
            background: "rgba(5,24,64,0.92)",
            borderRadius: 3,
            border: "1px solid rgba(99,216,255,0.24)",
            backdropFilter: "blur(18px)",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#fff" }}>
          Novedades recientes
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Typography
              variant="body2"
              sx={{ color: "rgba(148,216,255,0.88)", fontWeight: 600 }}
            >
              Versión actual: {releaseInfo.version}
            </Typography>
            {releaseEntries.length > 0 ? (
              releaseEntries.map((entry, index) => (
                <Box
                  key={`${entry.version}-${index}`}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: "rgba(13,45,92,0.6)",
                    border: "1px solid rgba(99,216,255,0.18)",
                    p: 2,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      color: "rgba(212,239,255,0.95)",
                    }}
                  >
                    {entry.version}
                    {entry.date ? ` · ${entry.date}` : ""}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(224,239,255,0.82)",
                      whiteSpace: "pre-wrap",
                      mt: 1,
                    }}
                  >
                    {entry.body || "Sin detalles disponibles."}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography
                variant="body2"
                sx={{ color: "rgba(224,239,255,0.82)" }}
              >
                Aún no hay notas registradas.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            color="inherit"
            onClick={handleCloseReleaseNotes}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 999,
              px: 3,
              background:
                "linear-gradient(135deg, rgba(148,216,255,0.26), rgba(94,234,212,0.32))",
              color: "#fff",
              "&:hover": {
                background:
                  "linear-gradient(135deg, rgba(148,216,255,0.35), rgba(94,234,212,0.42))",
              },
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Welcome;
