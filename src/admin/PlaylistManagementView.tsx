import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import type { Playlist, PlaylistInput, Song } from "./types";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  updatePlaylist,
} from "./services/playlistService";
import { fetchAllSongs } from "./services/songService";
import { listMySongs } from "./services/mySongService";

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
    accent: "#ecfdf5",
    border: "#bbf7d0",
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
    accent: "#eff6ff",
    border: "#bfdbfe",
  },
};

function songLabel(song: Song): string {
  return `${song.artist} · ${song.title}${song.year ? ` (${song.year})` : ""}`;
}

export default function PlaylistManagementView({
  onFeedback,
}: PlaylistManagementViewProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
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
      const [playlistData, songData] = await Promise.all([
        listPlaylists(scope),
        scope === "personal" ? listMySongs() : fetchAllSongs(),
      ]);
      setPlaylists(playlistData);
      setSongs(songData);
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
    setViewMode("editor");
  };

  const beginEdit = async (playlist: Playlist) => {
    setSaving(true);
    try {
      const detailedPlaylist = await getPlaylist(playlist.id);
      setEditingPlaylist(detailedPlaylist);
      setForm({
        name: detailedPlaylist.name,
        description: detailedPlaylist.description ?? "",
        active: detailedPlaylist.active,
        songIds: detailedPlaylist.songs?.map((song) => song.id) ?? [],
      });
      setSongSearch("");
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
    setViewMode("list");
  };

  const songMap = useMemo(
    () => new Map(songs.map((song) => [song.id, song])),
    [songs]
  );

  const sortedSongs = useMemo(
    () =>
      [...songs].sort((left, right) =>
        songLabel(left).localeCompare(songLabel(right), "es")
      ),
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

  const availableSongs = useMemo(() => {
    const selectedIds = new Set(form.songIds);
    return sortedSongs.filter((song) => !selectedIds.has(song.id));
  }, [form.songIds, sortedSongs]);

  const filteredAvailableSongs = useMemo(() => {
    const query = songSearch.trim().toLowerCase();
    if (!query) return availableSongs;

    return availableSongs.filter((song) => {
      const haystack = `${song.artist} ${song.title} ${song.year ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [availableSongs, songSearch]);

  const addSong = (songId: number) => {
    setForm((prev) => ({
      ...prev,
      songIds: [...prev.songIds, songId],
    }));
  };

  const addVisibleSongs = () => {
    setForm((prev) => ({
      ...prev,
      songIds: [...prev.songIds, ...filteredAvailableSongs.map((song) => song.id)],
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
        p: 2,
        borderRadius: 0,
        border: "1px solid",
        borderColor:
          editingPlaylist?.id === playlist.id ? "text.primary" : "divider",
        backgroundColor:
          editingPlaylist?.id === playlist.id ? "#f8fafc" : "background.paper",
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1.5}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Avatar
                src={playlist.created_by_user?.avatar_url ?? undefined}
                sx={{ width: 28, height: 28, bgcolor: "#0f172a", fontSize: 12 }}
              >
                {(
                  playlist.created_by_user?.display_name ||
                  playlist.created_by_user?.email ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()}
              </Avatar>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {playlist.name}
              </Typography>
              <Chip
                label={playlist.scope === "personal" ? "Personal" : "Pública"}
                size="small"
                color={playlist.scope === "personal" ? "info" : "success"}
                variant="outlined"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {playlist.description || "Sin descripción"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Creada por{" "}
              {playlist.created_by_user?.display_name ||
                playlist.created_by_user?.email ||
                "Sin registro"}
            </Typography>
          </Box>
          <Chip
            label={playlist.active ? "Activa" : "Pausada"}
            color={playlist.active ? "success" : "default"}
            size="small"
          />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            label={`${playlist.songCount} canciones`}
            size="small"
            variant="outlined"
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => void beginEdit(playlist)}
            disabled={saving}
            fullWidth
          >
            Editar
          </Button>
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteTarget(playlist)}
            disabled={saving}
            fullWidth
          >
            Eliminar
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );

  const renderSongItem = (song: Song, actions: React.ReactNode) => (
    <Paper
      key={song.id}
      variant="outlined"
      sx={{ p: 1.25, borderRadius: 0 }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1.25}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {song.artist}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
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
            borderRadius: 0,
            border: "1px solid",
            borderColor: scopeMeta.border,
            backgroundColor: scopeMeta.accent,
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
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {editingPlaylist ? "Guardar cambios" : "Crear playlist"}
            </Button>
          </Stack>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 0,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={2.5}>
            <Stack spacing={2}>
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
              />
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Playlist activa
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Solo las playlists activas se ofrecen antes de iniciar una
                    partida.
                  </Typography>
                </Box>
                <Switch
                  checked={form.active}
                  onChange={(_, checked) =>
                    setForm((prev) => ({ ...prev, active: checked }))
                  }
                  disabled={saving}
                />
              </Stack>
            </Stack>

            <Divider />

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 0,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: "#fbfcfe",
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
                      label={`${selectedSongs.length} seleccionadas`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      label={`${filteredAvailableSongs.length} disponibles`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Stack>

                <TextField
                  label="Buscar canciones"
                  placeholder="Artista, canción o año"
                  value={songSearch}
                  onChange={(event) => setSongSearch(event.target.value)}
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
                          onClick={() => setSongSearch("")}
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
                      borderRadius: 0,
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
                        backgroundColor: "#f8fafc",
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
                        Agregar visibles
                      </Button>
                    </Stack>
                    <Stack
                      spacing={1}
                      sx={{ p: 1.5, overflowY: "auto", maxHeight: 420 }}
                    >
                      {filteredAvailableSongs.length ? (
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
                  </Paper>

                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 0,
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
                        backgroundColor: "#f8fafc",
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
                            sx={{ p: 1.25, borderRadius: 0 }}
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
                                    sx={{ fontWeight: 700 }}
                                    noWrap
                                  >
                                    {song.artist}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    noWrap
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
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 0,
          border: "1px solid",
          borderColor: scopeMeta.border,
          backgroundColor: scopeMeta.accent,
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
            {scopeMeta.summary}
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
              {scope === "personal" ? "Mis playlists" : "Playlists públicas"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {scopeMeta.description}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant={scope === "public" ? "contained" : "outlined"}
              onClick={() => setScope("public")}
              disabled={loading || saving}
            >
              Públicas
            </Button>
            <Button
              variant={scope === "personal" ? "contained" : "outlined"}
              onClick={() => setScope("personal")}
              disabled={loading || saving}
            >
              Personales
            </Button>
            <Button
              variant="outlined"
              onClick={() => void loadData()}
            disabled={loading || saving}
          >
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={beginCreate}
            disabled={saving}
          >
            Nueva playlist
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 0,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={1}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Playlists existentes
                </Typography>
                <Chip
                  label={`${playlists.length}`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {scopeMeta.summary}
              </Typography>
            </Stack>
          </Paper>
          {playlists.length ? (
            <Box
              sx={{
                display: "grid",
                gap: 2,
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
                borderRadius: 0,
                border: "1px dashed",
                borderColor: "divider",
                textAlign: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {scopeMeta.emptyState}
              </Typography>
            </Paper>
          )}
        </Stack>
      )}

      {deleteTarget ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 0,
            border: "1px solid",
            borderColor: "error.main",
            backgroundColor: "#fff5f5",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Typography>
              ¿Seguro que deseas eliminar
              {deleteTarget ? ` "${deleteTarget.name}"` : ""}?
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleDelete()}
                color="error"
                variant="contained"
                disabled={deleteLoading}
              >
                Eliminar
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
