import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import type { Playlist, PlaylistInput, Song } from "./types";
import { listSongs } from "./services/songService";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  updatePlaylist,
} from "./services/playlistService";
import { listMySongs } from "./services/mySongService";

const SONG_PAGE_SIZE = 50;

interface PlaylistManagementViewProps {
  onFeedback: (payload: {
    severity: "success" | "error";
    message: string;
  }) => void;
}

type FormState = {
  name: string;
  description: string;
  active: boolean;
  songIds: number[];
};

type ViewMode = "list" | "editor";

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  active: true,
  songIds: [],
};

const SCOPE_META = {
  public: {
    title: "Playlists públicas",
    shortLabel: "Público",
    description: "Disponibles para todos en el inicio del juego.",
    summary:
      "Estas playlists forman parte de la oferta general del juego y pueden mezclar canciones del catálogo oficial.",
    editorHint:
      "Estás editando una playlist pública. Lo que guardes quedará disponible para todos.",
    availableSongsLabel: "Catálogo público disponible",
    availableSongsHint:
      "Solo se muestran canciones aprobadas del catálogo oficial.",
    emptyState: "Todavía no hay playlists públicas creadas.",
    chipColor: "success" as const,
    accent: "#fff2ec",
    border: "#ffd1c3",
  },
  personal: {
    title: "Mis playlists",
    shortLabel: "Personal",
    description: "Solo tú las ves y usas al iniciar una partida.",
    summary:
      "Estas playlists usan canciones de tu colección personal y no afectan el catálogo público.",
    editorHint:
      "Estás editando una playlist personal. Solo tú podrás usarla en el modo privado.",
    availableSongsLabel: "Mi colección disponible",
    availableSongsHint:
      "Aquí aparecen únicamente las canciones de tu colección personal.",
    emptyState: "Todavía no has creado playlists personales.",
    chipColor: "info" as const,
    accent: "#e9f9fa",
    border: "#b9e9eb",
  },
};

function songLabel(song: Song): string {
  return `${song.artist} · ${song.title}${song.year ? ` (${song.year})` : ""}`;
}

export default function PlaylistManagementView({
  onFeedback,
}: PlaylistManagementViewProps) {
  const theme = useTheme();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [availableHasMore, setAvailableHasMore] = useState(false);
  const [songPage, setSongPage] = useState(0);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [songLoadError, setSongLoadError] = useState<string | null>(null);
  const [scope, setScope] = useState<"public" | "personal">("public");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [songSearch, setSongSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const scopeMeta = SCOPE_META[scope];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const playlistData = await listPlaylists(scope);
      setPlaylists(playlistData);
      setSongs([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las playlists."
      );
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const beginCreate = () => {
    setEditingPlaylist(null);
    setForm(EMPTY_FORM);
    setSongSearch("");
    setSongPage(0);
    setSongLoadError(null);
    setViewMode("editor");
  };

  const beginEdit = async (playlist: Playlist) => {
    setSaving(true);
    try {
      const detailedPlaylist = await getPlaylist(playlist.id);
      const songIds = detailedPlaylist.songIds ?? detailedPlaylist.songs?.map((song) => song.id) ?? [];
      const selectedSongsPage = songIds.length
        ? scope === "personal"
          ? await listMySongs({ page: 0, pageSize: songIds.length, ids: songIds })
          : await listSongs({ page: 0, pageSize: songIds.length, ids: songIds, sortBy: "artist" })
        : { songs: [], total: 0 };
      setEditingPlaylist(detailedPlaylist);
      setForm({
        name: detailedPlaylist.name,
        description: detailedPlaylist.description ?? "",
        active: detailedPlaylist.active,
        songIds,
      });
      setSongs((current) => {
        const byId = new Map(current.map((song) => [song.id, song]));
        for (const song of selectedSongsPage.songs) byId.set(song.id, song);
        return [...byId.values()];
      });
      setSongSearch("");
      setSongPage(0);
      setSongLoadError(null);
      setViewMode("editor");
    } catch (err) {
      onFeedback({
        severity: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo cargar la playlist seleccionada.",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelEditor = () => {
    if (saving) return;
    setEditingPlaylist(null);
    setForm(EMPTY_FORM);
    setSongSearch("");
    setSongPage(0);
    setViewMode("list");
  };

  useEffect(() => {
    if (viewMode !== "editor") return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadingSongs(true);
      setSongLoadError(null);
      const request = scope === "personal"
        ? listMySongs({ page: songPage, pageSize: SONG_PAGE_SIZE, search: songSearch, sortBy: "artist", sortDirection: "asc", signal: controller.signal, includeTotal: false })
        : listSongs({ page: songPage, pageSize: SONG_PAGE_SIZE, search: songSearch, catalogStatus: "approved", sortBy: "artist", sortDirection: "asc", signal: controller.signal, includeTotal: false });

      void request.then((result) => {
        if (cancelled) return;
        setAvailableSongs(result.songs);
        setAvailableHasMore(result.hasMore);
        setSongs((current) => {
          const byId = new Map(current.map((song) => [song.id, song]));
          for (const song of result.songs) byId.set(song.id, song);
          return [...byId.values()];
        });
      }).catch((err: unknown) => {
        if (cancelled) return;
        setAvailableSongs([]);
        setAvailableHasMore(false);
        setSongLoadError(err instanceof Error ? err.message : "No se pudieron cargar las canciones.");
      }).finally(() => {
        if (!cancelled) setLoadingSongs(false);
      });
    }, songSearch.trim() ? 250 : 0);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [scope, songPage, songSearch, viewMode]);

  const songMap = useMemo(
    () => new Map(songs.map((song) => [song.id, song])),
    [songs]
  );

  const selectedSongs = useMemo(
    () =>
      form.songIds
        .map((songId) => songMap.get(songId))
        .filter((song): song is Song => Boolean(song))
        .sort((left, right) => songLabel(left).localeCompare(songLabel(right), "es")),
    [form.songIds, songMap]
  );

  const filteredAvailableSongs = useMemo(() => {
    const selectedIds = new Set(form.songIds);
    return availableSongs.filter((song) => !selectedIds.has(song.id));
  }, [availableSongs, form.songIds]);

  const addSong = (songId: number) => {
    setForm((prev) => ({
      ...prev,
      songIds: prev.songIds.includes(songId) ? prev.songIds : [...prev.songIds, songId],
    }));
  };

  const addVisibleSongs = () => {
    setForm((prev) => ({
      ...prev,
      songIds: [...new Set([...prev.songIds, ...filteredAvailableSongs.map((song) => song.id)])],
    }));
  };

  const removeSong = (songId: number) => {
    setForm((prev) => ({
      ...prev,
      songIds: prev.songIds.filter((id) => id !== songId),
    }));
  };

  const clearSongs = () => {
    setForm((prev) => ({ ...prev, songIds: [] }));
  };

  const handleSave = async () => {
    const payload: PlaylistInput = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
      songIds: form.songIds,
    };

    if (!payload.name) {
      onFeedback({
        severity: "error",
        message: "El nombre de la playlist es obligatorio.",
      });
      return;
    }

    if (!payload.songIds.length) {
      onFeedback({
        severity: "error",
        message: "Selecciona al menos una canción para la playlist.",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingPlaylist) {
        const updated = await updatePlaylist(editingPlaylist.id, payload);
        setPlaylists((prev) =>
          prev.map((playlist) =>
            playlist.id === updated.id ? updated : playlist
          )
        );
        setEditingPlaylist(updated);
        onFeedback({
          severity: "success",
          message: "Playlist actualizada correctamente.",
        });
      } else {
        const created = await createPlaylist(payload, scope);
        setPlaylists((prev) =>
          [...prev, created].sort((left, right) =>
            left.name.localeCompare(right.name, "es")
          )
        );
        setEditingPlaylist(created);
        onFeedback({
          severity: "success",
          message: "Playlist creada correctamente.",
        });
      }
      setViewMode("list");
    } catch (err) {
      onFeedback({
        severity: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo guardar la playlist.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    try {
      await deletePlaylist(deleteTarget.id);
      setPlaylists((prev) =>
        prev.filter((playlist) => playlist.id !== deleteTarget.id)
      );
      if (editingPlaylist?.id === deleteTarget.id) {
        setEditingPlaylist(null);
        setForm(EMPTY_FORM);
        setSongSearch("");
        setViewMode("list");
      }
      onFeedback({
        severity: "success",
        message: "Playlist eliminada.",
      });
      setDeleteTarget(null);
    } catch (err) {
      onFeedback({
        severity: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo eliminar la playlist.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderPlaylistCard = (playlist: Playlist) => (
    <Paper
      key={playlist.id}
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
        "&:hover": {
          borderColor: "primary.light",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.07)",
          transform: "translateY(-1px)",
        },
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>
              {playlist.name}
            </Typography>
          </Box>
          <Chip
            label={playlist.active ? "Activa" : "Pausada"}
            color={playlist.active ? "success" : "default"}
            size="small"
            variant={playlist.active ? "filled" : "outlined"}
          />
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            minHeight: 42,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
          }}
        >
          {playlist.description || "Sin descripción"}
        </Typography>
        <Divider />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ minWidth: 0 }}
          >
            <Chip
              label={`${playlist.songCount} ${playlist.songCount === 1 ? "canción" : "canciones"}`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <Avatar
                src={playlist.created_by_user?.avatar_url ?? undefined}
                sx={{ width: 24, height: 24, bgcolor: "primary.main", fontSize: 11 }}
              >
                {(playlist.created_by_user?.display_name || playlist.created_by_user?.email || "U").charAt(0).toUpperCase()}
              </Avatar>
              <Tooltip title={playlist.created_by_user?.display_name || playlist.created_by_user?.email || "Sin registro"}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 180 }}>
                  {playlist.created_by_user?.display_name || playlist.created_by_user?.email || "Sin registro"}
                </Typography>
              </Tooltip>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => void beginEdit(playlist)}
              disabled={saving}
              sx={{ whiteSpace: "nowrap" }}
            >
              Editar
            </Button>
            <Tooltip title={`Eliminar ${playlist.name}`}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  aria-label={`Eliminar playlist ${playlist.name}`}
                  onClick={() => setDeleteTarget(playlist)}
                  disabled={saving}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );

  const renderSongItem = (song: Song, actions: React.ReactNode) => (
    <Paper
      key={song.id}
      variant="outlined"
      sx={{ p: 1.25, borderRadius: 1 }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1.25}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, whiteSpace: "normal", overflowWrap: "anywhere" }}
          >
            {song.artist}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
            {song.title}
            {song.year ? ` · ${song.year}` : ""}
          </Typography>
        </Box>
        {actions}
      </Stack>
    </Paper>
  );

  if (viewMode === "editor") {
    return (
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 1,
            border: "1px solid",
            borderColor: theme.palette.mode === "dark" ? "divider" : scopeMeta.border,
            backgroundColor: theme.palette.mode === "dark" ? "background.paper" : scopeMeta.accent,
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                label={scopeMeta.shortLabel}
                size="small"
                color={scopeMeta.chipColor}
                variant="filled"
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {scopeMeta.title}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {scopeMeta.editorHint}
            </Typography>
          </Stack>
        </Paper>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingPlaylist ? "Editar playlist" : "Nueva playlist"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editingPlaylist
                ? "Ajusta los datos y las canciones incluidas en la playlist."
                : `Crea una ${scope === "personal" ? "playlist personal" : "playlist pública"} en una vista dedicada.`}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={cancelEditor}
              disabled={saving}
            >
              Volver al listado
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.songIds.length}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {editingPlaylist ? "Guardar cambios" : "Crear playlist"}
            </Button>
          </Stack>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(280px, 0.7fr)" },
                alignItems: "stretch",
              }}
            >
              <TextField
                label="Nombre"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                fullWidth
                disabled={saving}
              />
              <TextField
                label="Descripción"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                multiline
                minRows={2}
                fullWidth
                disabled={saving}
                sx={{ gridColumn: { md: "1 / -1" }, gridRow: { md: 2 } }}
              />
              <Paper
                variant="outlined"
                sx={{
                  gridColumn: { md: 2 },
                  gridRow: { md: 1 },
                  p: 1.75,
                  borderRadius: 1.5,
          backgroundColor: form.active && theme.palette.mode === "light" ? "#fff8f4" : "background.paper",
          borderColor: "divider",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Disponible en el juego
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {form.active
                        ? "Los jugadores podrán elegir esta playlist."
                        : "La playlist queda guardada, pero no se ofrecerá al iniciar partidas."}
                    </Typography>
                  </Box>
                  <Switch
                    checked={form.active}
                    inputProps={{ "aria-label": "Disponible en el juego" }}
                    onChange={(_, checked) =>
                      setForm((prev) => ({ ...prev, active: checked }))
                    }
                    disabled={saving}
                  />
                </Stack>
              </Paper>
            </Box>

            <Divider />

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.default",
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Canciones de la playlist
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {scopeMeta.availableSongsHint}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`${form.songIds.length} seleccionadas`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      label={availableSongs.length === 0
                        ? "Sin resultados"
                        : availableHasMore
                        ? `Al menos ${songPage * SONG_PAGE_SIZE + availableSongs.length} resultados`
                        : `${songPage * SONG_PAGE_SIZE + availableSongs.length} resultados`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Stack>

                <TextField
                  label="Buscar canciones"
                  placeholder="Artista o canción"
                  value={songSearch}
                  onChange={(event) => {
                    setSongSearch(event.target.value);
                    setSongPage(0);
                  }}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: songSearch ? (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => { setSongSearch(""); setSongPage(0); }}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                />

                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                      xs: "1fr",
                      lg: "minmax(0, 1fr) minmax(0, 1fr)",
                    },
                  }}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 1,
                      minHeight: 320,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        backgroundColor: theme.palette.mode === "dark" ? "background.paper" : "#fff8f4",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {scopeMeta.availableSongsLabel}
                      </Typography>
                      <Button
                        size="small"
                        onClick={addVisibleSongs}
                        disabled={!filteredAvailableSongs.length || saving}
                      >
                        Agregar resultados visibles
                      </Button>
                    </Stack>
                    <Stack
                      spacing={1}
                      sx={{ p: 1.5, overflowY: "auto", maxHeight: 420 }}
                    >
                      {loadingSongs ? (
                        <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
                          <CircularProgress size={24} />
                          <Typography variant="body2" color="text.secondary">Cargando canciones…</Typography>
                        </Stack>
                      ) : songLoadError ? (
                        <Alert severity="error">{songLoadError}</Alert>
                      ) : filteredAvailableSongs.length ? (
                        filteredAvailableSongs.map((song) =>
                          renderSongItem(
                            song,
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<AddIcon />}
                              onClick={() => addSong(song.id)}
                              disabled={saving}
                            >
                              Agregar
                            </Button>
                          )
                        )
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No hay canciones que coincidan con la búsqueda en este ámbito.
                        </Typography>
                      )}
                    </Stack>
                    {!loadingSongs && !songLoadError && (songPage > 0 || availableHasMore) && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
                        <Typography variant="caption" color="text.secondary">
                          {songPage * SONG_PAGE_SIZE + 1}–{songPage * SONG_PAGE_SIZE + availableSongs.length}
                          {availableHasMore ? " · hay más resultados" : " · fin de resultados"}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" disabled={loadingSongs || songPage === 0} onClick={() => setSongPage((page) => Math.max(0, page - 1))}>Anterior</Button>
                          <Button size="small" disabled={loadingSongs || !availableHasMore} onClick={() => setSongPage((page) => page + 1)}>Siguiente</Button>
                        </Stack>
                      </Stack>
                    )}
                  </Paper>

                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 1,
                      minHeight: 320,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        backgroundColor: theme.palette.mode === "dark" ? "background.paper" : "#fff8f4",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Canciones seleccionadas
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={clearSongs}
                        disabled={!selectedSongs.length || saving}
                      >
                        Vaciar
                      </Button>
                    </Stack>
                    <Stack
                      spacing={1}
                      sx={{ p: 1.5, overflowY: "auto", maxHeight: 420 }}
                    >
                      {selectedSongs.length ? (
                        selectedSongs.map((song) => (
                          <Paper
                            key={song.id}
                            variant="outlined"
                            sx={{ p: 1.25, borderRadius: 1 }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              spacing={1}
                            >
                              <Stack
                                direction="row"
                                spacing={1.25}
                                alignItems="center"
                                sx={{ minWidth: 0 }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
                                  >
                                    {song.artist}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ overflowWrap: "anywhere" }}
                                  >
                                    {song.title}
                                    {song.year ? ` · ${song.year}` : ""}
                                  </Typography>
                                </Box>
                              </Stack>
                              <Stack direction="row" spacing={0.25}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  aria-label={`Quitar ${song.title} de la playlist`}
                                  onClick={() => removeSong(song.id)}
                                  disabled={saving}
                                >
                                  <RemoveCircleOutlineIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            </Stack>
                          </Paper>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Aún no agregas canciones. Selecciónalas desde el panel de la izquierda.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", lg: "center" }}
          justifyContent="space-between"
        >
          <Tabs
            value={scope}
            onChange={(_, value: "public" | "personal") => setScope(value)}
            aria-label="Ámbito de playlists"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 44, "& .MuiTab-root": { minHeight: 44, fontWeight: 700 } }}
          >
            <Tab value="public" label="Públicas" disabled={loading || saving} />
            <Tab value="personal" label="Personales" disabled={loading || saving} />
          </Tabs>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: "left", sm: "right" }, mr: { sm: 0.5 } }}>
              {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
            </Typography>
            <Tooltip title="Actualizar lista">
              <span>
                <IconButton
                  aria-label="Actualizar playlists"
                  onClick={() => void loadData()}
                  disabled={loading || saving}
                  sx={{ alignSelf: { xs: "flex-end", sm: "auto" }, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={beginCreate}
              disabled={saving}
              sx={{ whiteSpace: "nowrap" }}
            >
              Nueva playlist
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, px: { sm: 1 } }}>
          {scopeMeta.description}
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Paper variant="outlined" sx={{ p: 6, borderRadius: 2, textAlign: "center" }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Cargando playlists…
          </Typography>
        </Paper>
      ) : (
        <>
          {playlists.length ? (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                width: "100%",
                maxWidth: 1760,
                mx: "auto",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
              }}
            >
              {playlists.map(renderPlaylistCard)}
            </Box>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 2,
                border: "1px dashed",
                borderColor: "divider",
                textAlign: "center",
              }}
            >
              <Stack spacing={1.25} alignItems="center">
                <Avatar sx={{ width: 48, height: 48, bgcolor: "action.hover", color: "text.secondary" }}>
                  <AddIcon />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {scopeMeta.emptyState}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                  {scopeMeta.summary}
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={beginCreate} disabled={saving} sx={{ mt: 0.5 }}>
                  Crear playlist
                </Button>
              </Stack>
            </Paper>
          )}
        </>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar playlist</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Quieres eliminar “{deleteTarget?.name}”? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleDelete()}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            Eliminar playlist
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
