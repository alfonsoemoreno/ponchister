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

type MimicaSessionPayload = {
  sessionId: string;
  active: boolean;
  mode: "mimica" | "tararear" | null;
  songId: number | null;
  songTitle: string | null;
  artist: string | null;
  videoId: string | null;
  revealPressed: boolean;
  updatedAt: number;
};

interface InternalPlayer {
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
}

interface MimicaRemoteViewProps {
  sessionId: string;
}

const POLL_INTERVAL_MS = 1200;

async function fetchSession(sessionId: string): Promise<MimicaSessionPayload> {
  const response = await fetch(`/api/mimica/${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error("No se encontró la sesión de mímica.");
  }
  return response.json() as Promise<MimicaSessionPayload>;
}

async function setRevealPressed(sessionId: string, revealPressed: boolean) {
  await fetch(`/api/mimica/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revealPressed }),
  });
}

export default function MimicaRemoteView({ sessionId }: MimicaRemoteViewProps) {
  const [session, setSession] = useState<MimicaSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const pressedRef = useRef(false);
  const playerRef = useRef<YouTube | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchSession(sessionId);
        if (cancelled) return;
        setSession(next);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar la sesión.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sessionId]);

  useEffect(() => {
    const release = () => {
      if (!pressedRef.current) return;
      pressedRef.current = false;
      setIsPressed(false);
      void setRevealPressed(sessionId, false);
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
  }, [sessionId]);

  const isActive = session?.active === true;
  const isTararearMode = session?.mode === "tararear";
  const showInfo = isActive && isPressed;
  const heading = useMemo(() => {
    if (loading) return "Cargando control";
    if (error) return "Sesión no disponible";
    if (!isActive) return "Esperando ronda";
    return isTararearMode
      ? "Mantén apretado para ver y escuchar la canción"
      : "Mantén apretado para mostrar la canción";
  }, [error, isActive, isTararearMode, loading]);

  useEffect(() => {
    const internalPlayer =
      playerRef.current?.getInternalPlayer?.() as unknown as InternalPlayer | null;
    if (!internalPlayer || !isTararearMode || !session?.videoId) {
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
  }, [isTararearMode, session?.videoId, showInfo]);

  const handlePressStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isActive || pressedRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressedRef.current = true;
    setIsPressed(true);
    void setRevealPressed(sessionId, true);
  };

  const handlePressEnd = (event?: React.PointerEvent<HTMLDivElement>) => {
    event?.preventDefault();
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setIsPressed(false);
    void setRevealPressed(sessionId, false);
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
        {loading ? (
          <Stack spacing={2} alignItems="center">
            <CircularProgress sx={{ color: "#7dd3fc" }} />
            <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.8)" }}>
              Conectando el control remoto de mímica.
            </Typography>
          </Stack>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!loading && !error && !isActive ? (
          <Alert severity="info">
            La ronda todavía no está activa. Deja esta pantalla abierta y espera
            a que aparezca el botón.
          </Alert>
        ) : null}
        {!loading && !error && isActive ? (
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
                    {session?.songTitle ?? "Sin título"}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: "rgba(226,232,240,0.84)" }}
                  >
                    {session?.artist ?? "Artista desconocido"}
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
            {isTararearMode && session?.videoId ? (
              <Box sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
                <YouTube
                  ref={playerRef}
                  videoId={session.videoId}
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
        ) : null}
      </Stack>
    </Box>
  );
}
