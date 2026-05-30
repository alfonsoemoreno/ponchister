import { useEffect, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Box,
  Stack,
  Typography,
} from "@mui/material";

interface InternalPlayer {
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
}

interface MimicaRemoteViewProps {
  mode: "mimica" | "tararear";
  songTitle: string;
  artist: string;
  videoId?: string;
}

export default function MimicaRemoteView({
  mode,
  songTitle,
  artist,
  videoId = "",
}: MimicaRemoteViewProps) {
  const [isPressed, setIsPressed] = useState(false);
  const pressedRef = useRef(false);
  const playerRef = useRef<YouTube | null>(null);

  useEffect(() => {
    const release = () => {
      if (!pressedRef.current) return;
      pressedRef.current = false;
      setIsPressed(false);
    };

    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);

    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, []);

  const isTararearMode = mode === "tararear";
  const showInfo = isPressed;
  const heading = useMemo(() => {
    return isTararearMode
      ? "Mantén apretado para ver y escuchar la canción"
      : "Mantén apretado para mostrar la canción";
  }, [isTararearMode]);

  useEffect(() => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer || !isTararearMode || !videoId) {
      return;
    }

    if (showInfo) {
      internalPlayer.unMute?.();
      internalPlayer.setVolume?.(30);
      internalPlayer.seekTo?.(0, true);
      internalPlayer.playVideo?.();
      return;
    }

    internalPlayer.pauseVideo?.();
  }, [isTararearMode, videoId, showInfo]);

  const handlePressStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (pressedRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressedRef.current = true;
    setIsPressed(true);
  };

  const handlePressEnd = (event?: React.PointerEvent<HTMLDivElement>) => {
    event?.preventDefault();
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setIsPressed(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        px: 2.5,
        py: 3,
        background:
          isTararearMode
            ? "radial-gradient(circle at 20% 15%, rgba(255, 196, 87, 0.30), transparent 28%), radial-gradient(circle at 82% 18%, rgba(56, 189, 248, 0.20), transparent 26%), linear-gradient(180deg, #160f2e 0%, #07111f 48%, #030814 100%)"
            : "radial-gradient(circle at 18% 14%, rgba(34, 211, 238, 0.26), transparent 26%), radial-gradient(circle at 84% 18%, rgba(250, 204, 21, 0.18), transparent 24%), linear-gradient(180deg, #071a2f 0%, #061120 50%, #030814 100%)",
        color: "#f8fbff",
        overflow: "hidden",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.06), transparent 30%, transparent 70%, rgba(255,255,255,0.03))",
          pointerEvents: "none",
        },
      }}
    >
      <Stack
        spacing={2.5}
        sx={{ position: "relative", maxWidth: 520, mx: "auto", textAlign: "center", zIndex: 1 }}
      >
        <Box
          sx={{
            px: 2,
            py: 2.5,
            borderRadius: 5,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(180deg, rgba(8,15,33,0.72), rgba(8,15,33,0.36))",
            backdropFilter: "blur(18px)",
            boxShadow: "0 24px 70px rgba(2,8,23,0.35)",
          }}
        >
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 4,
              color: isTararearMode ? "#fcd34d" : "#67e8f9",
              fontWeight: 800,
            }}
          >
            {isTararearMode ? "Modo Tarareo" : "Modo Mímica"}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              lineHeight: 0.98,
              fontSize: { xs: "2.2rem", sm: "2.8rem" },
              textWrap: "balance",
            }}
          >
            {heading}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mt: 1.25,
              color: "rgba(226,232,240,0.82)",
            }}
          >
            {isTararearMode
              ? "Presiona y sostén para revelar la canción y escuchar una pista breve."
              : "Presiona y sostén para revelar la canción solo cuando te toque actuar."}
          </Typography>
        </Box>
        {!songTitle || !artist ? (
          <Alert severity="error">Faltan datos para abrir este modo remoto.</Alert>
        ) : (
          <>
            <Box
              role="button"
              tabIndex={0}
              aria-label="Mantener apretado"
              onPointerDown={handlePressStart}
              onPointerUp={handlePressEnd}
              onPointerCancel={handlePressEnd}
              onLostPointerCapture={handlePressEnd}
              onContextMenu={(event) => event.preventDefault()}
              sx={{
                position: "relative",
                minHeight: 290,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 3,
                cursor: "pointer",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                background: isPressed
                  ? isTararearMode
                    ? "linear-gradient(145deg, rgba(251,191,36,1), rgba(244,114,182,0.96))"
                    : "linear-gradient(145deg, rgba(103,232,249,0.96), rgba(45,212,191,0.96))"
                  : isTararearMode
                    ? "linear-gradient(145deg, rgba(251,191,36,0.94), rgba(249,115,22,0.94))"
                    : "linear-gradient(145deg, rgba(59,130,246,0.92), rgba(34,211,238,0.92))",
                color: "#08111f",
                boxShadow: isPressed
                  ? "0 28px 80px rgba(251,191,36,0.34)"
                  : isTararearMode
                    ? "0 28px 80px rgba(249,115,22,0.28)"
                    : "0 28px 80px rgba(34,211,238,0.24)",
                outline: "none",
                border: isPressed
                  ? "3px solid rgba(255,255,255,0.72)"
                  : "3px solid transparent",
                transform: isPressed ? "scale(0.982)" : "scale(1)",
                transition:
                  "transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background 180ms ease",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 14,
                  borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.28)",
                  opacity: 0.9,
                },
              }}
            >
              <Stack spacing={1.5} sx={{ position: "relative", zIndex: 1 }}>
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: 3, fontWeight: 800, color: "rgba(8,17,31,0.72)" }}
                >
                  {showInfo ? "Revelando" : "Acción remota"}
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    textAlign: "center",
                    color: "inherit",
                    fontSize: { xs: "2rem", sm: "2.4rem" },
                  }}
                >
                  {showInfo ? "Sigue presionando" : "Mantén apretado"}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 700, color: "rgba(8,17,31,0.72)" }}
                >
                  {isTararearMode
                    ? "Verás el título y sonará al 30%"
                    : "Solo mostrará la canción mientras lo sostengas"}
                </Typography>
              </Stack>
            </Box>
            <Box
              sx={{
                minHeight: 176,
                borderRadius: 5,
                border: "1px solid rgba(255,255,255,0.14)",
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.82), rgba(15,23,42,0.56))",
                backdropFilter: "blur(16px)",
                p: 3,
                boxShadow: "0 18px 40px rgba(2,8,23,0.26)",
              }}
            >
              {showInfo ? (
                <Stack spacing={1.2}>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: 3,
                      color: isTararearMode ? "#fcd34d" : "#67e8f9",
                      fontWeight: 800,
                    }}
                  >
                    Ahora sí
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 900, lineHeight: 1.05, textWrap: "balance" }}
                  >
                    {songTitle || "Sin título"}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: "rgba(226,232,240,0.84)", fontWeight: 600 }}
                  >
                    {artist || "Artista desconocido"}
                  </Typography>
                  {isTararearMode ? (
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(253,224,71,0.95)", fontWeight: 800 }}
                    >
                      La canción está sonando al 30% en este celular.
                    </Typography>
                  ) : null}
                </Stack>
              ) : (
                <Stack spacing={1.2}>
                  <Typography
                    variant="body1"
                    sx={{ color: "rgba(226,232,240,0.86)", fontWeight: 700 }}
                  >
                    {isTararearMode
                      ? "Cuando mantengas el botón presionado, aparecerá el título y sonará una guía suave."
                      : "Cuando mantengas el botón presionado, aparecerá el título para ayudarte en la ronda."}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(226,232,240,0.62)" }}
                  >
                    Suelta el botón y la información desaparecerá al instante.
                  </Typography>
                </Stack>
              )}
            </Box>
            {isTararearMode && videoId ? (
              <Box
                sx={{
                  position: "fixed",
                  left: -9999,
                  top: -9999,
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  pointerEvents: "none",
                  opacity: 0,
                }}
              >
                <YouTube
                  ref={playerRef}
                  videoId={videoId}
                  opts={{
                    height: "1",
                    width: "1",
                    playerVars: {
                      autoplay: 0,
                      controls: 0,
                      modestbranding: 1,
                      rel: 0,
                      fs: 0,
                      playsinline: 1,
                    },
                  }}
                  onReady={(event) => {
                    const internalPlayer =
                      (event.target as unknown as InternalPlayer) ?? null;
                    internalPlayer?.pauseVideo?.();
                    internalPlayer?.setVolume?.(30);
                  }}
                  onStateChange={(() => undefined) as YouTubeProps["onStateChange"]}
                />
              </Box>
            ) : null}
          </>
        )}
      </Stack>
    </Box>
  );
}
