import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  Typography,
  Switch,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import type { YearRange } from "./types";
import { getReleaseInfo } from "./lib/releaseInfo";

interface WelcomeProps {
  onStartAuto: () => void;
  onOpenAdmin: () => void;
  yearRange: YearRange;
  availableRange: YearRange;
  onYearRangeChange: (range: YearRange) => void;
  isSpanishOnly: boolean;
  onLanguageModeChange: (spanishOnly: boolean) => void;
  isTimerEnabled: boolean;
  onTimerModeChange: (enabled: boolean) => void;
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
  availableRange,
  onYearRangeChange,
  isSpanishOnly,
  onLanguageModeChange,
  isTimerEnabled,
  onTimerModeChange,
}) => {
  const [localRange, setLocalRange] = useState<YearRange>(yearRange);
  const [localSpanishOnly, setLocalSpanishOnly] =
    useState<boolean>(isSpanishOnly);
  const [localTimerEnabled, setLocalTimerEnabled] =
    useState<boolean>(isTimerEnabled);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const releaseInfo = useMemo(() => getReleaseInfo(), []);
  const releaseEntries = releaseInfo.entries;

  useEffect(() => {
    setLocalRange(yearRange);
  }, [yearRange]);

  useEffect(() => {
    setLocalSpanishOnly(isSpanishOnly);
  }, [isSpanishOnly]);

  useEffect(() => {
    setLocalTimerEnabled(isTimerEnabled);
  }, [isTimerEnabled]);

  const sliderMarks = useMemo(() => {
    const marks: { value: number; label: string }[] = [
      { value: availableRange.min, label: `${availableRange.min}` },
    ];
    const span = availableRange.max - availableRange.min;
    if (span > 0) {
      const midpoint =
        Math.round((availableRange.min + availableRange.max) / 2 / 10) * 10;
      if (midpoint > availableRange.min && midpoint < availableRange.max) {
        marks.push({ value: midpoint, label: `${midpoint}` });
      }
      marks.push({ value: availableRange.max, label: `${availableRange.max}` });
    }
    return marks;
  }, [availableRange]);

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

  const handleRangePreview = (_event: Event, value: number | number[]) => {
    if (!Array.isArray(value) || value.length !== 2) return;
    const [min, max] = value;
    setLocalRange({ min, max });
  };

  const handleRangeCommit = (
    _event: Event | React.SyntheticEvent,
    value: number | number[]
  ) => {
    if (!Array.isArray(value) || value.length !== 2) return;
    const [min, max] = value;
    const next = { min, max };
    setLocalRange(next);
    onYearRangeChange(next);
  };

  const handleResetRange = () => {
    setLocalRange(availableRange);
    onYearRangeChange(availableRange);
  };

  const handleLanguageToggle = (
    _event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setLocalSpanishOnly(checked);
    onLanguageModeChange(checked);
  };

  const handleTimerToggle = (
    _event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setLocalTimerEnabled(checked);
    onTimerModeChange(checked);
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
        background: "#051d4a",
      }}
    >
      {/* Fondo uniforme para toda la vista; no usar capas absolutas que limiten el scroll */}
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
                label={`Canciones ${yearRange.min} - ${yearRange.max}`}
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
                Lánzate al modo automático para recibir canciones equilibradas,
                portadas y atmósferas envolventes al instante.
              </Typography>
              <Typography
                variant="body1"
                sx={{ color: "rgba(224,239,255,0.82)", maxWidth: 600 }}
              >
                Nuestro algoritmo evita repeticiones, equilibra décadas y revela
                cada canción con animaciones brillantes. Puedes inspirarte con
                un año al azar, explorar nuevas décadas o simplemente dejar que
                la música te sorprenda.
              </Typography>
            </Stack>
            <Box
              sx={{
                background: "rgba(5,24,64,0.42)",
                borderRadius: 3,
                border: "1px solid rgba(99,216,255,0.18)",
                boxShadow: "0 24px 64px -28px rgba(5,18,52,0.65)",
                p: { xs: 3, sm: 3.5 },
                backdropFilter: "blur(18px)",
              }}
            >
              <Stack spacing={2.2}>
                <Stack spacing={0.4}>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: 2,
                      fontWeight: 700,
                      color: "rgba(148,216,255,0.86)",
                    }}
                  >
                    Modo configuración
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    Rango de años
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(204,231,255,0.78)", maxWidth: 540 }}
                  >
                    Ajusta el catálogo musical para enfocarte en décadas
                    específicas o amplía la selección para mezclar toda la
                    historia de Ponchister.
                  </Typography>
                </Stack>
                <Slider
                  value={[localRange.min, localRange.max]}
                  onChange={handleRangePreview}
                  onChangeCommitted={handleRangeCommit}
                  min={availableRange.min}
                  max={availableRange.max}
                  step={1}
                  marks={sliderMarks}
                  valueLabelDisplay="auto"
                  getAriaLabel={() => "Rango de años"}
                  sx={{
                    color: "#5eead4",
                    height: 4,
                    "& .MuiSlider-thumb": {
                      width: 20,
                      height: 20,
                      boxShadow: "0 6px 16px rgba(6,18,52,0.4)",
                    },
                    "& .MuiSlider-valueLabel": {
                      backgroundColor: "rgba(5,24,64,0.9)",
                      borderRadius: 1,
                    },
                    "& .MuiSlider-markLabel": {
                      color: "rgba(224,239,255,0.92)",
                    },
                  }}
                />
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1, sm: 2.5 }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      color: "rgba(212,239,255,0.92)",
                    }}
                  >
                    Estás listo para jugar entre {localRange.min} y{" "}
                    {localRange.max}{" "}
                    {localSpanishOnly ? "(solo en español)." : "(todo el catálogo)."}
                  </Typography>
                  {(localRange.min !== availableRange.min ||
                    localRange.max !== availableRange.max) && (
                    <Button
                      variant="text"
                      color="inherit"
                      onClick={handleResetRange}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        px: 0,
                        color: "rgba(148,216,255,0.9)",
                        "&:hover": {
                          color: "#5eead4",
                          backgroundColor: "transparent",
                        },
                      }}
                    >
                      Usar todo el catálogo
                    </Button>
                    )}
                </Stack>
                <Box
                  sx={{
                    mt: 1,
                    borderRadius: 2,
                    border: "1px solid rgba(99,216,255,0.12)",
                    px: 2,
                    py: 1.5,
                    backgroundColor: "rgba(5,24,64,0.24)",
                  }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{
                          letterSpacing: 2,
                          fontWeight: 700,
                          color: "rgba(148,216,255,0.86)",
                        }}
                      >
                        Idioma
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "rgba(204,231,255,0.78)",
                          maxWidth: 540,
                        }}
                      >
                        Cambia entre todo el catálogo o solo canciones marcadas
                        en español.
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "rgba(224,239,255,0.82)" }}
                      >
                        Todas
                      </Typography>
                      <Switch
                        color="info"
                        checked={localSpanishOnly}
                        onChange={handleLanguageToggle}
                        inputProps={{
                          "aria-label": "Filtrar solo canciones en español",
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ color: "rgba(224,239,255,0.9)", fontWeight: 700 }}
                      >
                        Solo en español
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
                <Box
                  sx={{
                    mt: 1,
                    borderRadius: 2,
                    border: "1px solid rgba(94,234,212,0.14)",
                    px: 2,
                    py: 1.5,
                    backgroundColor: "rgba(5,24,64,0.24)",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{
                          letterSpacing: 2,
                          fontWeight: 700,
                          color: "rgba(148,216,255,0.86)",
                        }}
                      >
                        Temporizador
                      </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(204,231,255,0.78)",
                    maxWidth: 540,
                  }}
                >
                        Muestra un cronómetro de 60 segundos en modo automático.
                        Al agotarse detiene la canción y bloquea el play hasta
                        revelar la información.
                </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "rgba(224,239,255,0.82)" }}
                      >
                        Desactivado
                      </Typography>
                      <Switch
                        color="info"
                        checked={localTimerEnabled}
                        onChange={handleTimerToggle}
                        inputProps={{
                          "aria-label": "Activar temporizador de 60 segundos",
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ color: "rgba(224,239,255,0.9)", fontWeight: 700 }}
                      >
                        Activado
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              </Stack>
            </Box>
            <Stack spacing={3} sx={{ maxWidth: 640 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                  alignSelf: { xs: "stretch", sm: "flex-start" },
                  flexWrap: "wrap",
                  rowGap: "10px",
                }}
              >
                <Button
                  variant="contained"
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
                  Modo automático
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<AdminPanelSettingsIcon />}
                  onClick={handleOpenAdmin}
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
                  Administración
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
              <Box
                sx={{
                  mt: 2,
                  backgroundColor: "rgba(255,255,255,0.02)",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Modos de juego
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(224,239,255,0.82)", mt: 1 }}
                >
                  <strong>Modo automático:</strong> El sistema selecciona
                  canciones equilibradas, muestra portadas y crea atmósferas
                  visuales sin intervención. Perfecto para sesiones continuas y
                  ambientación.
                </Typography>
              </Box>
              <Button
                variant="text"
                color="inherit"
                onClick={handleOpenReleaseNotes}
                sx={{
                  alignSelf: "flex-start",
                  textTransform: "none",
                  fontWeight: 500,
                  px: 0,
                  py: 0.5,
                  color: "rgba(148,216,255,0.65)",
                  minHeight: "auto",
                  "&:hover": {
                    color: "#5eead4",
                    backgroundColor: "transparent",
                  },
                }}
              >
                Ver novedades recientes
              </Button>
            </Stack>
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
