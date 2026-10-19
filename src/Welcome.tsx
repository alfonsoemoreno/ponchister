import React, { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
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
import LogoutIcon from "@mui/icons-material/Logout";
import type { GameSource, PlaylistSummary, YearRange } from "./types";
import type { AdminUser } from "./admin/types";
import AdminAccessDialog from "./admin/AdminAccessDialog";
import { loginAdmin, logoutAdmin } from "./admin/services/adminAuth";

interface WelcomeProps {
  onStartAuto: (payload: {
    source: GameSource;
    playlist: PlaylistSummary | null;
  }) => void;
  onOpenAdmin: () => void;
  onAdminSessionRefresh: () => Promise<void>;
  yearRange: YearRange;
  playlists: PlaylistSummary[];
  personalPlaylists: PlaylistSummary[];
  playlistLoadState: "loading" | "ready" | "error";
  onRetryPlaylists: () => Promise<void>;
  selectedPlaylist: PlaylistSummary | null;
  currentAdminUser: AdminUser | null;
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
  onAdminSessionRefresh,
  yearRange,
  playlists,
  personalPlaylists,
  playlistLoadState,
  onRetryPlaylists,
  selectedPlaylist,
  currentAdminUser,
}) => {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [playlistDraftId, setPlaylistDraftId] = useState<string>(
    selectedPlaylist ? String(selectedPlaylist.id) : "",
  );

  const [personalPlaylistDraftId, setPersonalPlaylistDraftId] =
    useState<string>("");

  const handleStartAutoMode = (
    source: GameSource,
    playlist: PlaylistSummary | null,
  ) => {
    setModeDialogOpen(false);
    requestFullscreen();
    onStartAuto({ source, playlist });
  };

  const handleOpenAdmin = () => {
    onOpenAdmin();
  };

  const handleLogin = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await loginAdmin({ email, password });
      await onAdminSessionRefresh();
      setLoginOpen(false);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
      await onAdminSessionRefresh();
    } catch {
      /* noop */
    }
  };

  const handleOpenRules = () => {
    setRulesOpen(true);
  };

  const handleCloseRules = () => {
    setRulesOpen(false);
  };

  const handleOpenModeDialog = () => {
    setPlaylistDraftId(selectedPlaylist ? String(selectedPlaylist.id) : "");
    setPersonalPlaylistDraftId("");
    setModeDialogOpen(true);
  };

  const handleCloseModeDialog = () => {
    setModeDialogOpen(false);
  };

  const playablePlaylists = playlists.filter((playlist) => playlist.songCount > 0);
  const playablePersonalPlaylists = personalPlaylists.filter(
    (playlist) => playlist.songCount > 0,
  );
  const playlistSelection = playablePlaylists.find(
    (playlist) => String(playlist.id) === playlistDraftId,
  );
  const personalPlaylistSelection = playablePersonalPlaylists.find(
    (playlist) => String(playlist.id) === personalPlaylistDraftId,
  );

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
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
      <Stack
        direction="row"
        spacing={2}
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 4,
          px: { xs: 1, sm: 2, md: 3 },
          pt: {
            xs: "calc(env(safe-area-inset-top, 0px) + 16px)",
            sm: "calc(env(safe-area-inset-top, 0px) + 20px)",
          },
          pb: 0.5,
        }}
      >
        {currentAdminUser ? (
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            sx={{
              minWidth: 0,
              flex: 1,
              maxWidth: {
                xs: "calc(100% - 108px)",
                sm: "calc(100% - 148px)",
              },
              pl: { xs: 1, sm: 1.5 },
            }}
          >
            <Avatar
              src={currentAdminUser.avatar_url ?? undefined}
              sx={{ width: 34, height: 34, bgcolor: "#0ea5e9", fontSize: 14 }}
            >
              {(currentAdminUser.display_name || currentAdminUser.email || "U")
                .charAt(0)
                .toUpperCase()}
            </Avatar>
            <Box sx={{ textAlign: "left", minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {currentAdminUser.display_name || currentAdminUser.email}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "rgba(224,239,255,0.72)" }}
              >
                {currentAdminUser.role === "superadmin"
                  ? "Superadmin"
                  : "Editor"}
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Box sx={{ flex: 1, ml: { xs: 1, sm: 1.5 } }} />
        )}

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 1 }}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ flexShrink: 0, minWidth: "fit-content" }}
        >
          {currentAdminUser ? (
            <Stack
              direction="row"
              spacing={{ xs: 0.5, sm: 1 }}
              alignItems="center"
            >
              <Button
                variant="text"
                color="inherit"
                startIcon={<AdminPanelSettingsIcon />}
                onClick={handleOpenAdmin}
                sx={{
                  borderRadius: 0,
                  textTransform: "none",
                  minWidth: 0,
                  px: 1,
                }}
              >
                Panel
              </Button>
              <Button
                variant="text"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={() => void handleLogout()}
                sx={{ textTransform: "none", borderRadius: 0 }}
              >
                Salir
              </Button>
            </Stack>
          ) : (
            <Button
              variant="text"
              color="inherit"
              startIcon={<AdminPanelSettingsIcon />}
              onClick={() => {
                setLoginError(null);
                setLoginOpen(true);
              }}
              sx={{
                borderRadius: 0,
                textTransform: "none",
                minWidth: 0,
                px: 1,
              }}
            >
              Ingresar
            </Button>
          )}
        </Stack>
      </Stack>
      <Box
        sx={{
          position: "relative",
          zIndex: 3,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          flex: 1,
        }}
      >
        <Stack
          spacing={{ xs: 1, md: 2 }}
          sx={{
            width: "min(920px, 92vw)",
            pt: {
              xs: "calc(env(safe-area-inset-top, 0px) + 72px)",
              sm: 5,
              md: 9,
            },
            pb: {
              xs: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
              md: 9,
            },
            alignItems: "center",
            textAlign: "center",
            justifyContent: { xs: "space-between", md: "center" },
            minHeight: {
              xs: "100dvh",
              md: "auto",
            },
          }}
        >
          <Stack
            spacing={{ xs: 1.25, md: 2 }}
            sx={{
              alignItems: "center",
              width: "100%",
            }}
          >
            <Box
              component="img"
              src="/ponchister_logo.png"
              alt="Ponchister"
              sx={{
                width: { xs: 176, sm: 288, md: 324 },
                height: { xs: 176, sm: 288, md: 324 },
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
                mt: { xs: -2.5, sm: -3 },
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
                lineHeight: { xs: 1.15, sm: 1.15 },
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
                lineHeight: 1.55,
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                px: { xs: 1.5, sm: 0 },
              }}
            >
              Empieza con el catálogo completo o elige una playlist para una
              partida temática.
            </Typography>
          </Stack>
          <Box
            sx={{
              position: { xs: "sticky", md: "static" },
              bottom: {
                xs: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
                md: "auto",
              },
              width: "100%",
              maxWidth: 560,
              px: { xs: 0.5, sm: 0 },
              py: { xs: 0.5, md: 0 },
              borderRadius: { xs: 4, md: 0 },
              background: {
                xs: "linear-gradient(180deg, rgba(5,20,48,0.9) 0%, rgba(5,18,42,0.78) 100%)",
                md: "transparent",
              },
              border: {
                xs: "1px solid rgba(148,216,255,0.16)",
                md: "none",
              },
              backdropFilter: { xs: "blur(18px)", md: "none" },
              boxShadow: {
                xs: "0 22px 60px rgba(0,0,0,0.28)",
                md: "none",
              },
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{
                alignSelf: "center",
                justifyContent: "center",
                alignItems: "center",
                rowGap: "10px",
                width: "100%",
              maxWidth: 600,
                mx: "auto",
              }}
            >
              <Button
                variant="contained"
                color="inherit"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => handleStartAutoMode("classic", null)}
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
                Jugar clásico
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleOpenModeDialog}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  flex: { sm: 1 },
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 3,
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
                Más modos
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleOpenRules}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  flex: { sm: 0.8 },
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
            </Stack>
          </Box>
        </Stack>
      </Box>
      <Dialog
        open={modeDialogOpen}
        onClose={handleCloseModeDialog}
        fullWidth
        maxWidth="md"
        sx={{
          "& .MuiPaper-root": {
            background:
              "linear-gradient(180deg, rgba(7,24,56,0.98) 0%, rgba(3,14,38,0.98) 100%)",
            borderRadius: 4,
            maxHeight: "calc(100dvh - 32px)",
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
          Elige tu modalidad
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            borderColor: "rgba(122,196,255,0.14)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.03) 100%)",
          }}
        >
          <Stack spacing={2}>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(214,234,255,0.78)",
                lineHeight: 1.7,
              }}
            >
              Juega con todo el catálogo, una playlist temática o tu propia colección.
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
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography sx={{ fontWeight: 800, color: "#fff", fontSize: "1.1rem" }}>
                    Juego clásico
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(221,238,255,0.84)", lineHeight: 1.6 }}>
                    Todo el catálogo, con tus ajustes habituales.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="inherit"
                  onClick={() => handleStartAutoMode("classic", null)}
                  sx={{
                    alignSelf: { xs: "stretch", sm: "center" },
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
                  variant="h6"
                  sx={{ fontWeight: 800, color: "#fff", lineHeight: 1.15 }}
                >
                  Playlists públicas
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(221,238,255,0.84)", lineHeight: 1.65 }}
                >
                  Elige una selección curada de canciones para una partida
                  temática o especial.
                </Typography>
                {playlistLoadState === "loading" ? (
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <CircularProgress size={18} sx={{ color: "#5eead4" }} />
                    <Typography variant="body2" color="rgba(221,238,255,0.84)">
                      Cargando playlists disponibles…
                    </Typography>
                  </Stack>
                ) : playlistLoadState === "error" ? (
                  <Alert
                    severity="error"
                    variant="outlined"
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => void onRetryPlaylists()}
                      >
                        Reintentar
                      </Button>
                    }
                    sx={{
                      color: "#ffe4e6",
                      borderColor: "rgba(251,113,133,0.36)",
                      backgroundColor: "rgba(76,20,36,0.24)",
                    }}
                  >
                    No se pudieron cargar las playlists. Puedes reintentar o
                    jugar en modo clásico.
                  </Alert>
                ) : playablePlaylists.length === 0 ? (
                  <Alert
                    severity="info"
                    variant="outlined"
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => handleStartAutoMode("classic", null)}
                      >
                        Jugar clásico
                      </Button>
                    }
                    sx={{
                      color: "#dbeafe",
                      borderColor: "rgba(125,211,252,0.32)",
                      backgroundColor: "rgba(7,35,68,0.32)",
                    }}
                  >
                    Aún no hay playlists públicas disponibles. Puedes empezar
                    ahora con el catálogo clásico.
                  </Alert>
                ) : (
                  <>
                    <TextField
                      select
                      label="Playlist"
                      value={playlistDraftId}
                      onChange={(event) => setPlaylistDraftId(event.target.value)}
                      fullWidth
                      helperText={
                        playlistSelection
                          ? `${playlistSelection.songCount} ${playlistSelection.songCount === 1 ? "canción" : "canciones"}${playlistSelection.description ? ` · ${playlistSelection.description}` : " disponibles"}`
                          : "Selecciona una playlist para ver cuántas canciones tiene."
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
                      {playablePlaylists.map((playlist) => (
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
                        handleStartAutoMode("public_playlist", playlistSelection);
                      }}
                      disabled={!playlistSelection}
                      aria-describedby={!playlistSelection ? "public-playlist-hint" : undefined}
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
                        "&.Mui-disabled": {
                          color: "rgba(225,244,255,0.72)",
                          borderColor: "rgba(180,205,224,0.3)",
                          backgroundColor: "rgba(180,205,224,0.08)",
                        },
                      }}
                    >
                      Jugar esta playlist
                    </Button>
                    {!playlistSelection && (
                      <Typography id="public-playlist-hint" variant="caption" sx={{ color: "rgba(221,238,255,0.72)" }}>
                        Selecciona una playlist para habilitar el botón.
                      </Typography>
                    )}
                  </>
                )}
              </Stack>
            </Box>
            {currentAdminUser ? (
              <Box>
                <Box sx={{ mb: 1.25 }}>
                  <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 800 }}>
                    Tu colección
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(214,234,255,0.72)" }}>
                    Usa todas tus canciones o elige una de tus playlists personales.
                  </Typography>
                </Box>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <Box
                  sx={{
                    flex: 1,
                    borderRadius: 3,
                    border: "1px solid rgba(148,216,255,0.2)",
                    background: "rgba(20,59,122,0.2)",
                    p: 2.25,
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: "#fff", lineHeight: 1.15 }}
                    >
                      Catálogo personal
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(221,238,255,0.84)", lineHeight: 1.65 }}
                    >
                      Juega usando solo las canciones de tu colección personal.
                    </Typography>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() =>
                        handleStartAutoMode("personal_catalog", null)
                      }
                      sx={{
                        alignSelf: "flex-start",
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 999,
                        px: 2.6,
                        borderColor: "rgba(148,216,255,0.42)",
                        color: "#d9f2ff",
                      }}
                    >
                      Jugar mi catálogo
                    </Button>
                  </Stack>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    borderRadius: 3,
                    border: "1px solid rgba(153,246,228,0.22)",
                    background: "rgba(8,71,78,0.2)",
                    p: 2.25,
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: "#fff", lineHeight: 1.15 }}
                    >
                      Playlists personales
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(221,238,255,0.84)", lineHeight: 1.65 }}
                    >
                      Elige una playlist armada con canciones de tu colección
                      personal.
                    </Typography>
                    {playlistLoadState === "loading" ? (
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <CircularProgress size={18} sx={{ color: "#ffd1d1" }} />
                        <Typography
                          variant="body2"
                          color="rgba(221,238,255,0.84)"
                        >
                          Cargando tus playlists…
                        </Typography>
                      </Stack>
                    ) : playlistLoadState === "error" ? (
                      <Alert
                        severity="error"
                        variant="outlined"
                        action={
                          <Button
                            color="inherit"
                            size="small"
                            onClick={() => void onRetryPlaylists()}
                          >
                            Reintentar
                          </Button>
                        }
                        sx={{
                          color: "#ffe4e6",
                          borderColor: "rgba(251,113,133,0.36)",
                          backgroundColor: "rgba(76,20,36,0.24)",
                        }}
                      >
                        No se pudieron cargar tus playlists personales.
                      </Alert>
                    ) : playablePersonalPlaylists.length === 0 ? (
                      <Alert
                        severity="info"
                        variant="outlined"
                        action={
                          <Button
                            color="inherit"
                            size="small"
                            onClick={() =>
                              handleStartAutoMode("personal_catalog", null)
                            }
                          >
                            Jugar mi catálogo
                          </Button>
                        }
                        sx={{
                          color: "#fff1d6",
                          borderColor: "rgba(255,196,122,0.34)",
                          backgroundColor: "rgba(70,45,11,0.28)",
                        }}
                      >
                        Aún no tienes playlists personales. Puedes jugar con
                        todas las canciones de tu catálogo.
                      </Alert>
                    ) : (
                      <>
                        <TextField
                          select
                          label="Playlist personal"
                          value={personalPlaylistDraftId}
                          onChange={(event) =>
                            setPersonalPlaylistDraftId(event.target.value)
                          }
                          fullWidth
                          helperText={
                            personalPlaylistSelection
                              ? `${personalPlaylistSelection.songCount} ${personalPlaylistSelection.songCount === 1 ? "canción" : "canciones"}${personalPlaylistSelection.description ? ` · ${personalPlaylistSelection.description}` : " disponibles"}`
                              : "Selecciona una playlist para ver sus canciones disponibles."
                          }
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              color: "#fff",
                              backgroundColor: "rgba(3,15,32,0.52)",
                              "& fieldset": { borderColor: "rgba(153,246,228,0.26)" },
                              "&:hover fieldset": { borderColor: "rgba(153,246,228,0.46)" },
                              "&.Mui-focused fieldset": { borderColor: "#5eead4" },
                            },
                            "& .MuiFormLabel-root": { color: "rgba(219,244,240,0.78)" },
                            "& .MuiFormLabel-root.Mui-focused": { color: "#99f6e5" },
                            "& .MuiFormHelperText-root": { color: "rgba(216,240,236,0.72)" },
                          }}
                        >
                          {playablePersonalPlaylists.map((playlist) => (
                            <MenuItem
                              key={playlist.id}
                              value={String(playlist.id)}
                            >
                              {playlist.name} ({playlist.songCount})
                            </MenuItem>
                          ))}
                        </TextField>
                        <Button
                          variant="outlined"
                          color="inherit"
                          disabled={!personalPlaylistSelection}
                          onClick={() =>
                            personalPlaylistSelection
                              ? handleStartAutoMode(
                                  "personal_playlist",
                                  personalPlaylistSelection,
                                )
                              : undefined
                          }
                          sx={{
                            alignSelf: "flex-start",
                            textTransform: "none",
                            fontWeight: 700,
                            borderRadius: 999,
                            px: 2.6,
                          borderColor: "rgba(153,246,228,0.42)",
                          color: "#d1fae5",
                          "&.Mui-disabled": {
                            color: "rgba(225,244,255,0.72)",
                            borderColor: "rgba(180,205,224,0.3)",
                            backgroundColor: "rgba(180,205,224,0.08)",
                          },
                          }}
                        >
                          Jugar mi playlist
                        </Button>
                        {!personalPlaylistSelection && (
                          <Typography variant="caption" sx={{ color: "rgba(221,238,255,0.72)" }}>
                            Selecciona una playlist para habilitar el botón.
                          </Typography>
                        )}
                      </>
                    )}
                  </Stack>
                </Box>
                </Stack>
              </Box>
            ) : null}
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
                Canciones con mímica
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                En las canciones con mímica, el usuario debe escanear un código
                QR para ver la canción y el artista, y luego hacer mímica para
                que los demás adivinen. El primero que adivina correctamente,
                gana una ficha. El jugador que hizo la mímica también gana su
                tarjeta si al menos un jugador adivina correctamente.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Canciones con tarareo
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                En las canciones con tarareo, el usuario debe escanear un código
                QR para ver la canción y el artista además de escuchar la
                canción desde su dispositivo, y luego tararear para que los
                demás adivinen. El primero que adivina correctamente, gana una
                ficha. El jugador que hizo el tarareo también gana su tarjeta si
                al menos un jugador adivina correctamente.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Canciones con karaoke
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Si una canción tiene karaoke, aparecerá un botón para activarlo.
                La canción volverá a comenzar y se pausará en el punto
                configurado para que los jugadores continúen la letra. Cuando
                presiones “Mostrar”, se revelará la información de la canción,
                aparecerá la letra cargada y la reproducción continuará desde
                esa pausa.
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "rgba(224,239,255,0.95)" }}
              >
                Canciones con trivia
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(204,231,255,0.82)", mt: 0.6 }}
              >
                Si una canción tiene trivia, verás un botón para abrir la
                pregunta en grande en cualquier momento, incluso mientras la
                canción suena. Al presionar “Mostrar”, además de revelarse la
                canción y el artista, también se mostrará la pregunta con su
                respuesta para comprobar quién acertó.
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
      <AdminAccessDialog
        open={loginOpen}
        loading={loginLoading}
        onClose={() => {
          if (!loginLoading) {
            setLoginOpen(false);
            setLoginError(null);
          }
        }}
        onSubmit={handleLogin}
        error={loginError}
      />
    </Box>
  );
};

export default Welcome;
