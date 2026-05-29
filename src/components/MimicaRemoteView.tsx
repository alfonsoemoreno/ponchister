import { useEffect, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import {
  Alert,
  Box,
  CircularProgress,
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
      internalPlayer.setVolume?.(50);
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
        px: 3,
        py: 5,
        background:
          "radial-gradient(circle at top, rgba(255, 214, 102, 0.22), transparent 40%), linear-gradient(180deg, #091223 0%, #030814 100%)",
        color: "#f8fbff",
      }}
    >
      <Stack
        spacing={3}
        sx={{ maxWidth: 520, mx: "auto", textAlign: "center" }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ letterSpacing: 3, color: "#7dd3fc" }}
          >
            Ponchister
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>
            {heading}
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
                minHeight: 220,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 3,
                cursor: "pointer",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                background:
                  "linear-gradient(135deg, rgba(251,191,36,0.96), rgba(249,115,22,0.96))",
                color: "#1c1917",
                boxShadow: "0 24px 60px rgba(249,115,22,0.34)",
                outline: "none",
                border: isPressed
                  ? "3px solid rgba(255,255,255,0.72)"
                  : "3px solid transparent",
                transform: isPressed ? "scale(0.985)" : "scale(1)",
                transition: "transform 100ms ease, border-color 100ms ease",
              }}
            >
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, textAlign: "center", color: "inherit" }}
              >
                Mantener apretado
              </Typography>
            </Box>
            <Box
              sx={{
                minHeight: 140,
                borderRadius: 4,
                border: "1px solid rgba(125,211,252,0.28)",
                backgroundColor: "rgba(15,23,42,0.72)",
                p: 3,
              }}
            >
              {showInfo ? (
                <Stack spacing={1}>
                  <Typography
                    variant="overline"
                    sx={{ letterSpacing: 2, color: "#7dd3fc" }}
                  >
                    Ahora sí
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {songTitle || "Sin título"}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: "rgba(226,232,240,0.84)" }}
                  >
                    {artist || "Artista desconocido"}
                  </Typography>
                  {isTararearMode ? (
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(253,224,71,0.95)", fontWeight: 700 }}
                    >
                      La canción está sonando a medio volumen en este celular.
                    </Typography>
                  ) : null}
                </Stack>
              ) : (
                <Typography
                  variant="body1"
                  sx={{ color: "rgba(226,232,240,0.8)" }}
                >
                  {isTararearMode
                    ? "Mantén el botón presionado para revelar la canción y escucharla a medio volumen."
                    : "Mantén el botón presionado para revelar la canción."}
                </Typography>
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
                    internalPlayer?.setVolume?.(50);
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
