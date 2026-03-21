import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import type { PlaylistSummary, YearRange } from "./types";

interface WelcomeProps {
  onStartAuto: (playlist: PlaylistSummary | null) => void;
  onOpenAdmin: () => void;
  yearRange: YearRange;
  playlists: PlaylistSummary[];
  selectedPlaylist: PlaylistSummary | null;
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
  playlists,
  selectedPlaylist,
}) => {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [playlistDraftId, setPlaylistDraftId] = useState<string>(
    selectedPlaylist ? String(selectedPlaylist.id) : ""
  );

  const handleStartAutoMode = (playlist: PlaylistSummary | null) => {
    setModeDialogOpen(false);
    requestFullscreen();
    onStartAuto(playlist);
  };

  const handleOpenAdmin = () => {
    onOpenAdmin();
  };

  const handleOpenRules = () => {
    setRulesOpen(true);
  };

  const handleCloseRules = () => {
    setRulesOpen(false);
  };

  const handleOpenModeDialog = () => {
    setPlaylistDraftId(selectedPlaylist ? String(selectedPlaylist.id) : "");
    setModeDialogOpen(true);
  };

  const handleCloseModeDialog = () => {
    setModeDialogOpen(false);
  };

  const playlistSelection = playlists.find(
    (playlist) => String(playlist.id) === playlistDraftId
  );

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
              onClick={handleOpenModeDialog}
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
              onClick={handleOpenRules}
              sx={{
                width: { xs: "100%", sm: "auto" },
                flex: { sm: 1 },
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 999,
                px: 3.5,
                py: 1.6,
                borderColor: "rgba(255,255,255,0.36)",
                color: "rgba(224,239,255,0.92)",
                backgroundColor: "rgba(6,24,58,0.4)",
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.6)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              Ver reglas
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
        open={modeDialogOpen}
        onClose={handleCloseModeDialog}
        fullWidth
        maxWidth="sm"
        sx={{
          "& .MuiPaper-root": {
            background:
              "linear-gradient(180deg, rgba(7,24,56,0.98) 0%, rgba(3,14,38,0.98) 100%)",
            borderRadius: 4,
            border: "1px solid rgba(122,196,255,0.22)",
            boxShadow: "0 28px 80px rgba(0,0,0,0.42)",
            backdropFilter: "blur(22px)",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            color: "#fff",
            pb: 1,
          }}
        >
          Elige cómo jugar
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            borderColor: "rgba(122,196,255,0.14)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.03) 100%)",
          }}
        >
          <Stack spacing={2.5}>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(214,234,255,0.78)",
                lineHeight: 1.7,
              }}
            >
              Puedes seguir con el juego clásico de siempre o partir con una
              playlist preparada para una partida temática.
            </Typography>
            <Box
              sx={{
                borderRadius: 3,
                border: "1px solid rgba(122,196,255,0.26)",
                background:
                  "linear-gradient(180deg, rgba(20,59,122,0.34) 0%, rgba(8,27,64,0.5) 100%)",
                p: 2.25,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <Stack spacing={1.25}>
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: 1.8,
                    fontWeight: 700,
                    color: "rgba(148,216,255,0.88)",
                  }}
                >
                  Opción 1
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 800, color: "#fff", lineHeight: 1.15 }}
                >
                  Juego clásico
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(221,238,255,0.84)", lineHeight: 1.65 }}
                >
                  Usa todo el catálogo disponible y juega exactamente como hasta
                  ahora.
                </Typography>
                <Button
                  variant="contained"
                  color="inherit"
                  onClick={() => handleStartAutoMode(null)}
                  sx={{
                    alignSelf: "flex-start",
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 2.6,
                    background:
                      "linear-gradient(120deg, #38bdf8 0%, #0ea5e9 55%, #22d3ee 100%)",
                    color: "#04111f",
                    "&:hover": {
                      background:
                        "linear-gradient(120deg, #67e8f9 0%, #38bdf8 45%, #0ea5e9 100%)",
                    },
                  }}
                >
                  Jugar clásico
                </Button>
              </Stack>
            </Box>
            <Box
              sx={{
                borderRadius: 3,
                border: "1px solid rgba(94,234,212,0.28)",
                background:
                  "linear-gradient(180deg, rgba(8,71,78,0.3) 0%, rgba(4,30,49,0.58) 100%)",
                p: 2.25,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <Stack spacing={1.35}>
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: 1.8,
                    fontWeight: 700,
                    color: "rgba(153,246,228,0.88)",
                  }}
                >
                  Opción 2
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 800, color: "#fff", lineHeight: 1.15 }}
                >
                  Jugar una playlist
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(221,238,255,0.84)", lineHeight: 1.65 }}
                >
                  Elige una selección curada de canciones para una partida
                  temática o especial.
                </Typography>
                <TextField
                  select
                  label="Playlist"
                  value={playlistDraftId}
                  onChange={(event) => setPlaylistDraftId(event.target.value)}
                  fullWidth
                  disabled={playlists.length === 0}
                  helperText={
                    playlists.length === 0
                      ? "Aún no hay playlists activas disponibles."
                      : playlistSelection?.description ||
                        `${playlistSelection?.songCount ?? 0} canciones disponibles`
                  }
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#fff",
                      backgroundColor: "rgba(3,15,32,0.52)",
                      "& fieldset": {
                        borderColor: "rgba(153,246,228,0.26)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(153,246,228,0.46)",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#5eead4",
                      },
                    },
                    "& .MuiInputBase-root": {
                      color: "#fff",
                    },
                    "& .MuiFormLabel-root": {
                      color: "rgba(219,244,240,0.78)",
                    },
                    "& .MuiFormLabel-root.Mui-focused": {
                      color: "#99f6e4",
                    },
                    "& .MuiFormHelperText-root": {
                      color: "rgba(216,240,236,0.72)",
                    },
                  }}
                >
                  {playlists.map((playlist) => (
                    <MenuItem key={playlist.id} value={String(playlist.id)}>
                      {playlist.name} ({playlist.songCount})
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    if (!playlistSelection) {
                      return;
                    }
                    handleStartAutoMode(playlistSelection);
                  }}
                  disabled={!playlistSelection}
                  sx={{
                    alignSelf: "flex-start",
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 999,
                    px: 2.6,
                    borderColor: "rgba(94,234,212,0.4)",
                    color: "#d1fae5",
                    backgroundColor: "rgba(8,32,37,0.24)",
                    "&:hover": {
                      borderColor: "#5eead4",
                      backgroundColor: "rgba(13,67,72,0.26)",
                    },
                  }}
                >
                  Jugar esta playlist
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2.5,
            pt: 1.5,
            borderTop: "1px solid rgba(122,196,255,0.12)",
          }}
        >
          <Button
            onClick={handleCloseModeDialog}
            color="inherit"
            sx={{
              textTransform: "none",
              fontWeight: 700,
              color: "rgba(224,239,255,0.88)",
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={rulesOpen}
        onClose={handleCloseRules}
        fullWidth
        maxWidth="md"
        sx={{
          "& .MuiPaper-root": {
            background: "rgba(6,22,52,0.95)",
            borderRadius: 4,
            border: "1px solid rgba(122,196,255,0.28)",
            backdropFilter: "blur(18px)",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: "#fff" }}>
          Reglas del juego
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Descubre Ponchister
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Ponchister es un juego musical donde el desafío es ubicar
                canciones en la línea de tiempo correcta. ¡Escucha, piensa y
                coloca cada canción en su lugar!
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Configura tu partida
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Selecciona el rango de años, idioma de las canciones, y si
                usarás un temporizador de 60 segundos. Asigna un año inicial a
                cada jugador con “Año al azar” y anótalo en un post-it.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Empieza a jugar
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Pulsa “Iniciar juego” y, en tu turno, presiona “Play” para
                escuchar la canción. Coloca tu post-it en el año que creas
                correcto. Si aciertas, anota el año. Usa “Mostrar” para revelar
                la canción.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Fichas y jugadas especiales
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Cada jugador inicia con 2 fichas. Usa una ficha para “Saltar”
                una canción. O realiza un “Ponchister”: si crees que otro
                jugador puso mal su post-it, gastas una ficha, corriges el año,
                y si aciertas, robas la tarjeta. Si fallas, pierdes la ficha.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Máximo de fichas
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Puedes tener hasta 5 fichas. Si ya tienes 5, no puedes ganar
                más.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Canciones doradas
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                En canciones doradas, si aciertas canción, artista y año exacto,
                robas una tarjeta.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Cómo ganar fichas
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Para ganar una ficha, debes haber ubicado correctamente el año
                en la línea de tiempo y, antes de mostrar, haber adivinado tanto
                la canción como el artista. Sin un año bien colocado, no se gana
                la ficha, aunque sepas la canción. ¡Usa tus fichas con astucia y
                disfruta completando tu línea de tiempo!
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            color="inherit"
            onClick={handleCloseRules}
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
