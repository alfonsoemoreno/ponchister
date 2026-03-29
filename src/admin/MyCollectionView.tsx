import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube from "react-youtube";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PublishIcon from "@mui/icons-material/Publish";
import RefreshIcon from "@mui/icons-material/Refresh";
import StopIcon from "@mui/icons-material/Stop";
import type { Song, SongInput, SongYoutubeValidationPayload, YoutubeValidationResult } from "./types";
import SongFormDialog from "./SongFormDialog";
import {
  createMySong,
  deleteMySong,
  listMySongs,
  submitMySongToPublic,
  updateMySong,
  updateMySongYoutubeValidation,
} from "./services/mySongService";
import {
  createOperationalYoutubeValidation,
  createUncheckedYoutubeValidation,
  getYoutubeStatusLabel,
  interpretYoutubePlayerError,
  validateYoutubeUrlFormat,
} from "./youtubeValidation";

interface MyCollectionViewProps {
  onFeedback: (payload: {
    severity: "success" | "error";
    message: string;
  }) => void;
}

interface YoutubeStatusState extends YoutubeValidationResult {
  url: string;
}

interface YoutubeProbeRequest {
  id: number;
  songId: number | null;
  url: string;
  videoId: string;
  resolve: (result: YoutubeValidationResult) => void;
}

interface YoutubeProbeView {
  id: number;
  videoId: string;
}

interface AudioPreviewState {
  songId: number;
  songLabel: string;
  videoId: string;
}

export default function MyCollectionView({ onFeedback }: MyCollectionViewProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [submittingSongId, setSubmittingSongId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [songMenuAnchorEl, setSongMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [songMenuSong, setSongMenuSong] = useState<Song | null>(null);
  const [audioPreview, setAudioPreview] = useState<AudioPreviewState | null>(null);
  const [audioPreviewPlayerKey, setAudioPreviewPlayerKey] = useState(0);
  const [youtubeStatusBySongId, setYoutubeStatusBySongId] = useState<
    Record<number, YoutubeStatusState>
  >({});
  const [activeYoutubeProbe, setActiveYoutubeProbe] =
    useState<YoutubeProbeView | null>(null);
  const [youtubeProbePlayerKey, setYoutubeProbePlayerKey] = useState(0);
  const [languageToggleId, setLanguageToggleId] = useState<number | null>(null);

  const youtubeValidationQueueRef = useRef<YoutubeProbeRequest[]>([]);
  const activeYoutubeProbeRef = useRef<YoutubeProbeRequest | null>(null);
  const youtubeProbeTimeoutRef = useRef<number | null>(null);
  const youtubeProbeSuccessTimeoutRef = useRef<number | null>(null);
  const youtubeProbeRequestIdRef = useRef(0);
  const autoValidatedUncheckedRef = useRef<Record<string, boolean>>({});

  const filteredSongs = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return songs;
    }

    return songs.filter((song) =>
      [
        song.artist,
        song.title,
        song.youtube_url,
        song.year?.toString() ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [searchTerm, songs]);

  const pageSpanishCount = useMemo(
    () => filteredSongs.filter((song) => song.isspanish).length,
    [filteredSongs]
  );

  const loadSongs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMySongs();
      setSongs(data);
    } catch (err) {
      onFeedback({
        severity: "error",
        message:
          err instanceof Error ? err.message : "No se pudo cargar tu colección.",
      });
    } finally {
      setLoading(false);
    }
  }, [onFeedback]);

  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(handler);
  }, [searchInput]);

  const toPersistedYoutubeValidation = useCallback(
    (result: YoutubeValidationResult): SongYoutubeValidationPayload | null => {
      if (
        result.status !== "operational" &&
        result.status !== "restricted" &&
        result.status !== "unavailable" &&
        result.status !== "invalid"
      ) {
        return null;
      }

      return {
        status: result.status,
        message: result.message,
        code: result.code,
        validatedAt: new Date().toISOString(),
      };
    },
    []
  );

  const clearYoutubeProbeTimers = useCallback(() => {
    if (youtubeProbeTimeoutRef.current) {
      window.clearTimeout(youtubeProbeTimeoutRef.current);
      youtubeProbeTimeoutRef.current = null;
    }
    if (youtubeProbeSuccessTimeoutRef.current) {
      window.clearTimeout(youtubeProbeSuccessTimeoutRef.current);
      youtubeProbeSuccessTimeoutRef.current = null;
    }
  }, []);

  const finishYoutubeProbe = useCallback(
    (result: YoutubeValidationResult) => {
      const activeRequest = activeYoutubeProbeRef.current;
      if (!activeRequest) {
        return;
      }

      clearYoutubeProbeTimers();
      activeYoutubeProbeRef.current = null;
      setActiveYoutubeProbe(null);

      if (activeRequest.songId !== null) {
        setYoutubeStatusBySongId((prev) => ({
          ...prev,
          [activeRequest.songId as number]: {
            ...result,
            url: activeRequest.url,
          },
        }));
      }

      activeRequest.resolve(result);

      window.setTimeout(() => {
        if (activeYoutubeProbeRef.current) {
          return;
        }

        const nextRequest = youtubeValidationQueueRef.current.shift();
        if (!nextRequest) {
          return;
        }

        activeYoutubeProbeRef.current = nextRequest;
        setActiveYoutubeProbe({ id: nextRequest.id, videoId: nextRequest.videoId });
        setYoutubeProbePlayerKey((prev) => prev + 1);

        if (nextRequest.songId !== null) {
          setYoutubeStatusBySongId((prev) => ({
            ...prev,
            [nextRequest.songId as number]: {
              status: "checking",
              message: "Validando enlace de YouTube...",
              code: null,
              videoId: nextRequest.videoId,
              url: nextRequest.url,
            },
          }));
        }

        youtubeProbeTimeoutRef.current = window.setTimeout(() => {
          finishYoutubeProbe(
            interpretYoutubePlayerError(null, nextRequest.videoId)
          );
        }, 8000);
      }, 0);
    },
    [clearYoutubeProbeTimers]
  );

  const startNextYoutubeProbe = useCallback(() => {
    if (activeYoutubeProbeRef.current) {
      return;
    }

    const nextRequest = youtubeValidationQueueRef.current.shift();
    if (!nextRequest) {
      return;
    }

    activeYoutubeProbeRef.current = nextRequest;
    setActiveYoutubeProbe({ id: nextRequest.id, videoId: nextRequest.videoId });
    setYoutubeProbePlayerKey((prev) => prev + 1);

    if (nextRequest.songId !== null) {
      setYoutubeStatusBySongId((prev) => ({
        ...prev,
        [nextRequest.songId as number]: {
          status: "checking",
          message: "Validando enlace de YouTube...",
          code: null,
          videoId: nextRequest.videoId,
          url: nextRequest.url,
        },
      }));
    }

    youtubeProbeTimeoutRef.current = window.setTimeout(() => {
      finishYoutubeProbe(interpretYoutubePlayerError(null, nextRequest.videoId));
    }, 8000);
  }, [finishYoutubeProbe]);

  const enqueueYoutubeValidation = useCallback(
    (
      url: string,
      options?: { songId?: number | null; priority?: "high" | "normal" }
    ): Promise<YoutubeValidationResult> => {
      const normalizedUrl = url.trim();
      const initialValidation = validateYoutubeUrlFormat(normalizedUrl);

      if (initialValidation.status === "invalid" || !initialValidation.videoId) {
        if (options?.songId !== undefined && options.songId !== null) {
          setYoutubeStatusBySongId((prev) => ({
            ...prev,
            [options.songId as number]: {
              ...initialValidation,
              url: normalizedUrl,
            },
          }));
        }
        return Promise.resolve(initialValidation);
      }

      return new Promise((resolve) => {
        const request: YoutubeProbeRequest = {
          id: youtubeProbeRequestIdRef.current + 1,
          songId: options?.songId ?? null,
          url: normalizedUrl,
          videoId: initialValidation.videoId as string,
          resolve,
        };
        youtubeProbeRequestIdRef.current = request.id;

        if (options?.priority === "high") {
          youtubeValidationQueueRef.current.unshift(request);
        } else {
          youtubeValidationQueueRef.current.push(request);
        }

        startNextYoutubeProbe();
      });
    },
    [startNextYoutubeProbe]
  );

  const getYoutubeStatusState = useCallback(
    (song: Song): YoutubeStatusState => {
      const currentState = youtubeStatusBySongId[song.id];
      if (currentState && currentState.url === song.youtube_url.trim()) {
        return currentState;
      }

      const urlValidation = validateYoutubeUrlFormat(song.youtube_url);
      if (urlValidation.status === "invalid") {
        return {
          ...urlValidation,
          url: song.youtube_url.trim(),
        };
      }

      const persistedValidation =
        song.youtube_status !== null
          ? {
              status: song.youtube_status,
              message:
                song.youtube_validation_message ??
                createUncheckedYoutubeValidation().message,
              code: song.youtube_validation_code,
              videoId: urlValidation.videoId,
            }
          : createUncheckedYoutubeValidation();

      return {
        ...persistedValidation,
        url: song.youtube_url.trim(),
      };
    },
    [youtubeStatusBySongId]
  );

  const getYoutubeStatusChipProps = useCallback(
    (song: Song) => {
      const state = getYoutubeStatusState(song);

      switch (state.status) {
        case "operational":
          return {
            label: getYoutubeStatusLabel(state.status),
            color: "success" as const,
            variant: "filled" as const,
            tooltip: state.message,
          };
        case "restricted":
          return {
            label: getYoutubeStatusLabel(state.status),
            color: "warning" as const,
            variant: "filled" as const,
            tooltip: state.message,
          };
        case "unavailable":
        case "invalid":
          return {
            label: getYoutubeStatusLabel(state.status),
            color: "error" as const,
            variant: "filled" as const,
            tooltip: state.message,
          };
        default:
          return {
            label: getYoutubeStatusLabel(state.status),
            color: "default" as const,
            variant: "outlined" as const,
            tooltip: state.message,
          };
      }
    },
    [getYoutubeStatusState]
  );

  const handleValidateSongLink = useCallback(
    async (song: Song, options?: { showFeedback?: boolean }) => {
      const result = await enqueueYoutubeValidation(song.youtube_url, {
        songId: song.id,
        priority: "high",
      });
      const persistedValidation = toPersistedYoutubeValidation(result);

      if (persistedValidation) {
        const updatedSong = await updateMySongYoutubeValidation(song.id, persistedValidation);
        setSongs((prev) =>
          prev.map((item) => (item.id === song.id ? updatedSong : item))
        );
        setSongMenuSong((prev) => (prev?.id === song.id ? updatedSong : prev));
        if (editingSong?.id === song.id) {
          setEditingSong(updatedSong);
        }
      }

      if (options?.showFeedback === false) {
        return result;
      }

      onFeedback({
        severity: result.status === "operational" ? "success" : "error",
        message:
          result.status === "operational"
            ? `El enlace de "${song.title}" está operativo.`
            : result.message,
      });

      return result;
    },
    [editingSong, enqueueYoutubeValidation, onFeedback, toPersistedYoutubeValidation]
  );

  useEffect(() => {
    const uncheckedSongs = songs.filter(
      (song) => song.youtube_status === null || song.youtube_status === "unchecked"
    );

    uncheckedSongs.forEach((song) => {
      const key = `${song.id}:${song.youtube_url.trim()}`;
      if (autoValidatedUncheckedRef.current[key]) {
        return;
      }

      autoValidatedUncheckedRef.current[key] = true;
      void handleValidateSongLink(song, { showFeedback: false });
    });
  }, [handleValidateSongLink, songs]);

  useEffect(
    () => () => {
      clearYoutubeProbeTimers();
    },
    [clearYoutubeProbeTimers]
  );

  const handlePreviewSong = useCallback(
    (song: Song) => {
      if (audioPreview?.songId === song.id) {
        setAudioPreview(null);
        return;
      }

      const validation = validateYoutubeUrlFormat(song.youtube_url);
      if (validation.status === "invalid" || !validation.videoId) {
        onFeedback({
          severity: "error",
          message:
            "El enlace de YouTube de esta canción no es válido para reproducirse.",
        });
        return;
      }

      setAudioPreview({
        songId: song.id,
        songLabel: `${song.artist} · ${song.title}`,
        videoId: validation.videoId,
      });
      setAudioPreviewPlayerKey((prev) => prev + 1);
    },
    [audioPreview, onFeedback]
  );

  const stopAudioPreview = useCallback(() => {
    setAudioPreview(null);
  }, []);

  const handleSongMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    song: Song
  ) => {
    setSongMenuAnchorEl(event.currentTarget);
    setSongMenuSong(song);
  };

  const handleSongMenuClose = () => {
    setSongMenuAnchorEl(null);
    setSongMenuSong(null);
  };

  const handleSongMenuOpenLink = () => {
    if (songMenuSong?.youtube_url) {
      window.open(songMenuSong.youtube_url, "_blank", "noopener,noreferrer");
    }
    handleSongMenuClose();
  };

  const openCreateForm = () => {
    setFormMode("create");
    setEditingSong(null);
    setFormOpen(true);
  };

  const openEditForm = (song: Song) => {
    setFormMode("edit");
    setEditingSong(song);
    setFormOpen(true);
  };

  const handleSubmit = async (payload: SongInput) => {
    setSaving(true);
    try {
      const youtubeValidation = await enqueueYoutubeValidation(payload.youtube_url, {
        priority: "high",
      });
      const persistedValidation = toPersistedYoutubeValidation(youtubeValidation);
      if (formMode === "create") {
        await createMySong(payload, { youtubeValidation: persistedValidation });
      } else if (editingSong) {
        await updateMySong(editingSong.id, payload, {
          youtubeValidation: persistedValidation,
        });
      }
      setFormOpen(false);
      setEditingSong(null);
      await loadSongs();
      onFeedback({
        severity: "success",
        message:
          formMode === "create"
            ? "Canción agregada a tu colección."
            : "Canción personal actualizada.",
      });
      return true;
    } catch (err) {
      onFeedback({
        severity: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo guardar la canción personal.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSpanish = useCallback(
    async (song: Song) => {
      setLanguageToggleId(song.id);
      try {
        await updateMySong(song.id, {
          artist: song.artist,
          title: song.title,
          year: song.year,
          youtube_url: song.youtube_url,
          isspanish: !song.isspanish,
        });
        setSongs((prev) =>
          prev.map((item) =>
            item.id === song.id ? { ...item, isspanish: !song.isspanish } : item
          )
        );
        setSongMenuSong((prev) =>
          prev?.id === song.id ? { ...prev, isspanish: !song.isspanish } : prev
        );
      } catch (err) {
        onFeedback({
          severity: "error",
          message:
            err instanceof Error
              ? err.message
              : "No se pudo actualizar el idioma de la canción.",
        });
      } finally {
        setLanguageToggleId(null);
      }
    },
    [onFeedback]
  );

  const renderDesktopTable = () => (
    <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
      <Table
        size="medium"
        sx={{
          "& th": {
            textTransform: "none",
            letterSpacing: 0.2,
            fontWeight: 600,
            fontSize: 12,
            color: "text.secondary",
          },
          "& tbody td": {
            fontWeight: 500,
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Artista</TableCell>
            <TableCell>Canción</TableCell>
            <TableCell>Año</TableCell>
            <TableCell align="center">YouTube</TableCell>
            <TableCell align="center">Español</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredSongs.map((song, index) => {
            const youtubeStatus = getYoutubeStatusChipProps(song);
            const isPlaying = audioPreview?.songId === song.id;

            return (
              <TableRow
                key={song.id}
                hover
                sx={{
                  animation: "admin-row-in 360ms ease",
                  animationDelay: `${Math.min(index * 20, 240)}ms`,
                  animationFillMode: "both",
                }}
              >
                <TableCell width={80}>{song.id}</TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {song.artist}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  <Typography variant="body2" noWrap>
                    {song.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    Mi colección
                  </Typography>
                </TableCell>
                <TableCell width={120}>{song.year ?? "-"}</TableCell>
                <TableCell width={160} align="center">
                  <Tooltip title={youtubeStatus.tooltip} disableInteractive>
                    <Chip
                      label={youtubeStatus.label}
                      color={youtubeStatus.color}
                      variant={youtubeStatus.variant}
                      size="small"
                    />
                  </Tooltip>
                </TableCell>
                <TableCell width={140} align="center">
                  <Switch
                    checked={song.isspanish}
                    onChange={() => handleToggleSpanish(song)}
                    color="primary"
                    size="small"
                    disabled={languageToggleId === song.id || loading}
                    inputProps={{
                      "aria-label": `Cambiar estado de idioma para ${song.title}`,
                    }}
                  />
                </TableCell>
                <TableCell align="right" width={176}>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    justifyContent="flex-end"
                    alignItems="center"
                  >
                    <Tooltip title={isPlaying ? "Detener audio" : "Reproducir audio"}>
                      <span>
                        <IconButton
                          aria-label={
                            isPlaying
                              ? `Detener ${song.title}`
                              : `Reproducir ${song.title}`
                          }
                          onClick={() => handlePreviewSong(song)}
                          disabled={!song.youtube_url}
                        >
                          {isPlaying ? (
                            <StopIcon fontSize="small" />
                          ) : (
                            <PlayArrowIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton
                      aria-label="Opciones de canción"
                      onClick={(event) => handleSongMenuOpen(event, song)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderMobileCards = () => (
    <Box
      sx={{
        display: { xs: "flex", md: "none" },
        flexDirection: "column",
        gap: 2,
        py: 1,
      }}
    >
      {filteredSongs.map((song, index) => {
        const yearLabel = song.year ? song.year.toString() : "Sin año";
        const youtubeStatus = getYoutubeStatusChipProps(song);
        const isPlaying = audioPreview?.songId === song.id;

        return (
          <Paper
            key={song.id}
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 0,
              backgroundColor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "none",
              animation: "admin-card-in 420ms ease",
              animationDelay: `${Math.min(index * 60, 360)}ms`,
              animationFillMode: "both",
            }}
          >
            <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1, p: 2.5 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: 1.8,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "text.secondary",
                  }}
                >
                  #{String(song.id).padStart(3, "0")}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={yearLabel}
                    size="small"
                    sx={{
                      backgroundColor: "#f1f5f9",
                      fontWeight: 600,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      borderRadius: 0,
                    }}
                  />
                  <Tooltip title={youtubeStatus.tooltip} disableInteractive>
                    <Chip
                      label={youtubeStatus.label}
                      size="small"
                      color={youtubeStatus.color}
                      variant={youtubeStatus.variant}
                      sx={{ borderRadius: 0, fontWeight: 600 }}
                    />
                  </Tooltip>
                  <Chip
                    label="Mi colección"
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ borderRadius: 0, fontWeight: 600 }}
                  />
                  <IconButton
                    aria-label="Opciones de canción"
                    onClick={(event) => handleSongMenuOpen(event, song)}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 0,
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <Stack spacing={1.3}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Artista
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {song.artist}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Canción
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                    {song.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Biblioteca privada
                  </Typography>
                </Box>
              </Stack>

              <Divider
                sx={{
                  borderColor: "divider",
                  borderBottomWidth: 1,
                  my: 1,
                }}
              />

              <Stack spacing={1.2}>
                <Stack direction="row" alignItems="center" spacing={1.2}>
                  <Typography variant="body2" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                    Español
                  </Typography>
                  <Switch
                    checked={song.isspanish}
                    onChange={() => handleToggleSpanish(song)}
                    color="default"
                    disabled={languageToggleId === song.id || loading}
                    inputProps={{
                      "aria-label": `Cambiar idioma de ${song.title}`,
                    }}
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={isPlaying ? <StopIcon /> : <PlayArrowIcon />}
                    onClick={() => handlePreviewSong(song)}
                    disabled={!song.youtube_url}
                    fullWidth
                  >
                    {isPlaying ? "Detener audio" : "Reproducir audio"}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      window.open(song.youtube_url, "_blank", "noopener,noreferrer")
                    }
                    disabled={!song.youtube_url}
                    fullWidth
                  >
                    Ir al enlace
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 0,
          border: "1px solid",
          borderColor: "#bfdbfe",
          backgroundColor: "#eff6ff",
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label="Personal" size="small" color="info" />
            <Typography variant="subtitle1" fontWeight={700}>
              Biblioteca privada
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Estas canciones son tuyas, no requieren aprobación y solo se usan en
            tu catálogo o en tus playlists personales.
          </Typography>
        </Stack>
      </Paper>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Mi colección
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona tus canciones privadas y postúlalas al catálogo público cuando quieras.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateForm}>
          Nueva canción
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(3, 1fr)",
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 0,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Canciones totales
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {songs.length}
          </Typography>
        </Paper>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 0,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Resultados visibles
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {filteredSongs.length}
          </Typography>
        </Paper>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 0,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            En español
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {pageSpanishCount}
          </Typography>
        </Paper>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 0,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "#fbfcfe",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <TextField
            label="Buscar canciones"
            placeholder="Busca por artista, canción o enlace"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            fullWidth
            size="small"
            sx={{
              width: { xs: "100%", md: 320 },
              flexShrink: 0,
            }}
            InputProps={{
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Limpiar búsqueda"
                    onClick={() => setSearchInput("")}
                    edge="end"
                    size="small"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
          <Tooltip title="Recargar lista" disableInteractive>
            <Box component="span" sx={{ display: "inline-flex" }}>
              <IconButton
                onClick={() => void loadSongs()}
                disabled={loading}
                aria-label="Recargar lista"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  color: "text.primary",
                  backgroundColor: "background.paper",
                  borderRadius: 0,
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>
          </Tooltip>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filteredSongs.length === 0 ? (
        <Alert severity="info">
          {searchTerm
            ? "No hay resultados que coincidan con tu búsqueda."
            : "Tu colección aún no tiene canciones."}
        </Alert>
      ) : (
        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            borderRadius: 0,
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "none",
          }}
        >
          {renderMobileCards()}
          {renderDesktopTable()}
        </Paper>
      )}

      <Menu
        anchorEl={songMenuAnchorEl}
        open={Boolean(songMenuAnchorEl)}
        onClose={handleSongMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (songMenuSong) {
              handlePreviewSong(songMenuSong);
            }
            handleSongMenuClose();
          }}
          disabled={!songMenuSong?.youtube_url}
        >
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reproducir aquí</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={handleSongMenuOpenLink}
          disabled={!songMenuSong?.youtube_url}
        >
          <ListItemIcon>
            <InfoOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Abrir enlace</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (songMenuSong) {
              void handleValidateSongLink(songMenuSong);
            }
            handleSongMenuClose();
          }}
          disabled={!songMenuSong?.youtube_url}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Validar enlace</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (songMenuSong) {
              openEditForm(songMenuSong);
            }
            handleSongMenuClose();
          }}
          disabled={!songMenuSong}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (songMenuSong) {
              setDeleteTarget(songMenuSong);
            }
            handleSongMenuClose();
          }}
          disabled={!songMenuSong}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Eliminar</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const targetSong = songMenuSong;
            handleSongMenuClose();
            if (!targetSong) {
              return;
            }

            setSubmittingSongId(targetSong.id);
            void submitMySongToPublic(targetSong.id)
              .then(() => {
                onFeedback({
                  severity: "success",
                  message: "Se creó una copia pendiente para el catálogo público.",
                });
              })
              .catch((err) => {
                onFeedback({
                  severity: "error",
                  message:
                    err instanceof Error
                      ? err.message
                      : "No se pudo solicitar la publicación.",
                });
              })
              .finally(() => {
                setSubmittingSongId(null);
              });
          }}
          disabled={!songMenuSong || submittingSongId === songMenuSong.id}
        >
          <ListItemIcon>
            <PublishIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Solicitar al catálogo público</ListItemText>
        </MenuItem>
      </Menu>

      {activeYoutubeProbe ? (
        <Box
          sx={{
            position: "fixed",
            width: 1,
            height: 1,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <YouTube
            key={youtubeProbePlayerKey}
            videoId={activeYoutubeProbe.videoId}
            opts={{
              width: "1",
              height: "1",
              playerVars: {
                autoplay: 0,
                controls: 0,
                rel: 0,
                playsinline: 1,
                origin:
                  typeof window !== "undefined"
                    ? window.location.origin
                    : undefined,
              },
            }}
            onReady={() => {
              clearYoutubeProbeTimers();
              youtubeProbeSuccessTimeoutRef.current = window.setTimeout(() => {
                const activeRequest = activeYoutubeProbeRef.current;
                finishYoutubeProbe(
                  createOperationalYoutubeValidation(
                    activeRequest?.videoId ?? null
                  )
                );
              }, 600);
            }}
            onStateChange={(event) => {
              if (![1, 2, 3, 5].includes(event.data)) {
                return;
              }

              clearYoutubeProbeTimers();
              youtubeProbeSuccessTimeoutRef.current = window.setTimeout(() => {
                const activeRequest = activeYoutubeProbeRef.current;
                finishYoutubeProbe(
                  createOperationalYoutubeValidation(
                    activeRequest?.videoId ?? null
                  )
                );
              }, 300);
            }}
            onError={(event) => {
              const activeRequest = activeYoutubeProbeRef.current;
              finishYoutubeProbe(
                interpretYoutubePlayerError(
                  typeof event.data === "number" ? event.data : null,
                  activeRequest?.videoId ?? null
                )
              );
            }}
          />
        </Box>
      ) : null}

      {audioPreview ? (
        <Box
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            width: { xs: "calc(100% - 32px)", sm: 280 },
            zIndex: (theme) => theme.zIndex.snackbar + 1,
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: 6,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ px: 1.5, py: 1 }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, minWidth: 0 }}
              noWrap
            >
              Reproduciendo: {audioPreview.songLabel}
            </Typography>
            <IconButton
              size="small"
              onClick={stopAudioPreview}
              aria-label="Detener audio"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <YouTube
            key={audioPreviewPlayerKey}
            videoId={audioPreview.videoId}
            opts={{
              width: "100%",
              height: "158",
              playerVars: {
                autoplay: 1,
                controls: 1,
                rel: 0,
                playsinline: 1,
                origin:
                  typeof window !== "undefined"
                    ? window.location.origin
                    : undefined,
              },
            }}
            onReady={(event) => {
              event.target.unMute?.();
              event.target.playVideo();
            }}
            onEnd={stopAudioPreview}
            onError={(event) => {
              onFeedback({
                severity: "error",
                message:
                  typeof event.data === "number" &&
                  (event.data === 101 || event.data === 150)
                    ? "No es posible reproducir este enlace aquí por restricciones de YouTube."
                    : `No se pudo reproducir "${audioPreview.songLabel}".`,
              });
              stopAudioPreview();
            }}
          />
        </Box>
      ) : null}

      <SongFormDialog
        open={formOpen}
        mode={formMode}
        initialValue={editingSong}
        onClose={() => {
          if (!saving) {
            setFormOpen(false);
            setEditingSong(null);
          }
        }}
        onSubmit={handleSubmit}
        loading={saving}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Eliminar canción personal</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar {deleteTarget ? `"${deleteTarget.title}"` : "esta canción"} de tu colección?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!deleteTarget) return;
              try {
                await deleteMySong(deleteTarget.id);
                setDeleteTarget(null);
                await loadSongs();
                onFeedback({
                  severity: "success",
                  message: "Canción eliminada de tu colección.",
                });
              } catch (err) {
                onFeedback({
                  severity: "error",
                  message:
                    err instanceof Error
                      ? err.message
                      : "No se pudo eliminar la canción.",
                });
              }
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
