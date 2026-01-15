import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  InputAdornment,
  IconButton,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  Paper,
  Chip,
  Fab,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
  Zoom,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LibraryMusicOutlinedIcon from "@mui/icons-material/LibraryMusicOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ClearIcon from "@mui/icons-material/Clear";
import * as XLSX from "xlsx";

import AdminUsersPanel from "./AdminUsersPanel";
import SongFormDialog from "./SongFormDialog";
import SongStatisticsView from "./SongStatisticsView";
import {
  createSong,
  deleteSong,
  listSongs,
  fetchSongStatistics,
  fetchAllSongs,
  bulkUpsertSongs,
  updateSong,
} from "./services/songService";
import type { Song, SongInput, SongStatisticsGroup } from "./types";

interface FeedbackState {
  severity: "success" | "error";
  message: string;
}

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

type SortOption =
  | "id_asc"
  | "id_desc"
  | "artist_asc"
  | "artist_desc"
  | "title_asc"
  | "title_desc"
  | "year_desc"
  | "year_asc";

const DEFAULT_SORT_OPTION: SortOption = "id_asc";

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "id_asc", label: "ID ascendente" },
  { value: "id_desc", label: "ID descendente" },
  { value: "artist_asc", label: "Artista A → Z" },
  { value: "artist_desc", label: "Artista Z → A" },
  { value: "title_asc", label: "Canción A → Z" },
  { value: "title_desc", label: "Canción Z → A" },
  { value: "year_desc", label: "Año más reciente" },
  { value: "year_asc", label: "Año más antiguo" },
];

interface AdminDashboardProps {
  onExit: () => void;
  onSignOut: () => void;
  userEmail?: string | null;
  userRole?: "superadmin" | "editor";
}

export default function AdminDashboard({
  onExit,
  onSignOut,
  userEmail,
  userRole,
}: AdminDashboardProps) {
  const dataReady = true;
  const [songs, setSongs] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>(DEFAULT_SORT_OPTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formLoading, setFormLoading] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"songs" | "stats" | "users">(
    "songs"
  );
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<SongStatisticsGroup | null>(
    null
  );
  const [languageToggleId, setLanguageToggleId] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [songMenuAnchorEl, setSongMenuAnchorEl] =
    useState<null | HTMLElement>(null);
  const [songMenuSong, setSongMenuSong] = useState<Song | null>(null);

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const showActionLabels = !isSmallScreen;
  const isSuperAdmin = userRole === "superadmin";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iconActionBaseStyles = {
    minWidth: { xs: "auto", sm: 44 },
    height: { xs: 42, sm: 42 },
    px: { xs: 2, sm: 0 },
    borderRadius: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: { xs: 1, sm: 0 },
    transition: "all 180ms ease",
    fontWeight: 600,
    "& .MuiButton-startIcon": {
      mr: { xs: 1, sm: 0 },
      ml: { sm: 0 },
      "& svg": {
        fontSize: 20,
      },
    },
    "& .button-label": {
      display: { xs: "inline", sm: "none" },
    },
  } as const;

  const tabConfig = useMemo(
    () => [
      {
        value: "songs" as const,
        label: "Canciones",
        description: "Gestiona el catalogo y sus detalles clave.",
        icon: <LibraryMusicOutlinedIcon fontSize="small" />,
      },
      {
        value: "stats" as const,
        label: "Estadisticas",
        description: "Analitica y tendencias del catalogo.",
        icon: <BarChartOutlinedIcon fontSize="small" />,
      },
      {
        value: "users" as const,
        label: "Usuarios",
        description: "Controla accesos y roles.",
        icon: <PeopleAltOutlinedIcon fontSize="small" />,
      },
    ],
    []
  );

  const activeTabMeta = tabConfig.find((tab) => tab.value === activeTab);
  const visibleTabs = isSuperAdmin
    ? tabConfig
    : tabConfig.filter((tab) => tab.value !== "users");

  const pageSpanishCount = useMemo(
    () => songs.filter((song) => song.isspanish).length,
    [songs]
  );

  const sortConfig = useMemo<{
    sortBy: "id" | "artist" | "title" | "year";
    direction: "asc" | "desc";
  }>(() => {
    switch (sortOption) {
      case "id_desc":
        return { sortBy: "id", direction: "desc" };
      case "artist_asc":
        return { sortBy: "artist", direction: "asc" };
      case "artist_desc":
        return { sortBy: "artist", direction: "desc" };
      case "title_asc":
        return { sortBy: "title", direction: "asc" };
      case "title_desc":
        return { sortBy: "title", direction: "desc" };
      case "year_desc":
        return { sortBy: "year", direction: "desc" };
      case "year_asc":
        return { sortBy: "year", direction: "asc" };
      default:
        return { sortBy: "id", direction: "asc" };
    }
  }, [sortOption]);

  const filtersActive = useMemo(
    () =>
      yearFilter !== null ||
      sortOption !== DEFAULT_SORT_OPTION ||
      yearInput.trim() !== "",
    [yearFilter, sortOption, yearInput]
  );

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setPage(0);
      setSearchTerm(searchInput.trim());
    }, 400);

    return () => window.clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      const trimmed = yearInput.trim();

      if (trimmed === "") {
        setYearFilter((prev) => {
          if (prev !== null) {
            setPage(0);
          }
          return null;
        });
        return;
      }
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) {
        return;
      }

      setYearFilter((prev) => {
        if (prev !== parsed) {
          setPage(0);
          return parsed;
        }
        return prev;
      });
    }, 400);

    return () => window.clearTimeout(handler);
  }, [yearInput]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const { songs: fetchedSongs, total: fetchedTotal } = await listSongs({
          page,
          pageSize: rowsPerPage,
          search: searchTerm || undefined,
          year: yearFilter,
          sortBy: sortConfig.sortBy,
          sortDirection: sortConfig.direction,
        });

        if (!cancelled) {
          setSongs(fetchedSongs);
          setTotal(fetchedTotal);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las canciones.";
          setError(message);
          setSongs([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run().catch(() => {
      /* handled in run */
    });

    return () => {
      cancelled = true;
    };
  }, [
    page,
    rowsPerPage,
    searchTerm,
    sortConfig,
    yearFilter,
    reloadToken,
    dataReady,
  ]);

  useEffect(() => {
    if (activeTab !== "stats") {
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const data = await fetchSongStatistics();
        if (!cancelled) {
          setStatistics(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "No se pudieron obtener las estadísticas.";
          setStatsError(message);
          setStatistics(null);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    loadStats().catch(() => {
      /* handled above */
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, reloadToken]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextRows = Number(event.target.value);
    setRowsPerPage(nextRows);
    setPage(0);
  };

  const handleYearInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setYearInput(event.target.value);
  };

  const handleSortOptionChange = (value: SortOption) => {
    if (value === sortOption) {
      return;
    }
    setSortOption(value);
    setPage(0);
  };

  const handleClearFilters = () => {
    const hadYear = yearFilter !== null || yearInput.trim() !== "";
    const hadSort = sortOption !== DEFAULT_SORT_OPTION;

    if (hadYear) {
      setYearFilter(null);
      setYearInput("");
    }

    if (hadSort) {
      setSortOption(DEFAULT_SORT_OPTION);
    }

    if (hadYear || hadSort) {
      setPage(0);
    }
  };

  const handleRefresh = () => {
    setReloadToken((prev) => prev + 1);
  };

  const handleDownloadExcel = useCallback(async () => {
    if (exporting) {
      return;
    }

    setExporting(true);
    try {
      const allSongs = await fetchAllSongs();

      if (allSongs.length === 0) {
        setFeedback({
          severity: "error",
          message: "No hay canciones disponibles para exportar.",
        });
        setSnackbarOpen(true);
        return;
      }

      const rows = allSongs.map((song) => [
        song.artist,
        song.title,
        song.year ?? "",
        song.youtube_url,
        song.isspanish ? "SI" : "NO",
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([
        ["ARTISTA", "CANCION", "LANZAMIENTO", "YOUTUBE", "ESPANOL"],
        ...rows,
      ]);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Canciones");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const timestamp = new Date().toISOString().split("T")[0];
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ponchocards-canciones-${timestamp}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      setFeedback({
        severity: "success",
        message: "Exportación generada correctamente.",
      });
      setSnackbarOpen(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo generar el archivo de canciones.";
      setFeedback({ severity: "error", message });
      setSnackbarOpen(true);
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFromExcel = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setImporting(true);

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const [firstSheet] = workbook.SheetNames;

        if (!firstSheet) {
          throw new Error("El archivo no contiene hojas válidas.");
        }

        const sheet = workbook.Sheets[firstSheet];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });

        if (matrix.length === 0) {
          throw new Error("El archivo está vacío.");
        }

        const headerRow = (matrix[0] ?? []).map((cell) =>
          String(cell ?? "")
            .trim()
            .toUpperCase()
        );

        const findIndex = (label: string) =>
          headerRow.findIndex((value) => value === label);

        const artistIndex = findIndex("ARTISTA");
        const titleIndex = findIndex("CANCION");
        const yearIndex = findIndex("LANZAMIENTO");
        const youtubeIndex = findIndex("YOUTUBE");
        const spanishIndex = findIndex("ESPANOL");
        const spanishAltIndex = findIndex("ESPAÑOL");
        const languageIndex =
          spanishIndex !== -1 ? spanishIndex : spanishAltIndex;

        if (artistIndex === -1 || titleIndex === -1 || youtubeIndex === -1) {
          throw new Error(
            "La plantilla debe incluir las columnas ARTISTA, CANCION y YOUTUBE."
          );
        }

        const rows = matrix.slice(1);
        const payload: SongInput[] = [];
        let skipped = 0;

        rows.forEach((entry) => {
          const cells = Array.isArray(entry) ? entry : [];
          const artist = String(cells[artistIndex] ?? "").trim();
          const title = String(cells[titleIndex] ?? "").trim();
          const youtubeUrl = String(cells[youtubeIndex] ?? "").trim();

          if (!artist || !title || !youtubeUrl) {
            if (
              !cells.every((value) => String(value ?? "").trim().length === 0)
            ) {
              skipped += 1;
            }
            return;
          }

          let year: number | null = null;
          if (yearIndex !== -1) {
            const rawYear = cells[yearIndex];
            if (typeof rawYear === "number") {
              year = Number.isFinite(rawYear) ? Math.trunc(rawYear) : null;
            } else if (
              typeof rawYear === "string" &&
              rawYear.trim().length > 0
            ) {
              const parsed = Number.parseInt(rawYear.trim(), 10);
              year = Number.isNaN(parsed) ? null : parsed;
            }
          }

          let isspanish = false;
          if (languageIndex !== -1) {
            const rawLanguage = cells[languageIndex];
            if (typeof rawLanguage === "boolean") {
              isspanish = rawLanguage;
            } else if (typeof rawLanguage === "number") {
              isspanish = rawLanguage === 1;
            } else if (
              typeof rawLanguage === "string" &&
              rawLanguage.trim().length > 0
            ) {
              const normalized = rawLanguage.trim().toLowerCase();
              isspanish = ["si", "sí", "yes", "true", "1", "x", "es"].includes(
                normalized
              );
            }
          }

          payload.push({
            artist,
            title,
            youtube_url: youtubeUrl,
            year,
            isspanish,
          });
        });

        if (payload.length === 0) {
          throw new Error(
            "No se encontraron registros válidos en el archivo proporcionado."
          );
        }

        await bulkUpsertSongs(payload);

        const skippedMessage = skipped
          ? `, ${skipped} filas omitidas por datos incompletos`
          : "";

        setFeedback({
          severity: "success",
          message: `Importación completada: ${payload.length} canciones procesadas${skippedMessage}.`,
        });
        setSnackbarOpen(true);
        setReloadToken((prev) => prev + 1);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo importar el catálogo desde Excel.";
        setFeedback({ severity: "error", message });
        setSnackbarOpen(true);
      } finally {
        setImporting(false);
        event.target.value = "";
      }
    },
    []
  );

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

  const closeForm = () => {
    if (formLoading) {
      return;
    }
    setFormOpen(false);
    setEditingSong(null);
  };

  const handleFormSubmit = async (payload: SongInput) => {
    setFormLoading(true);

    try {
      if (formMode === "create") {
        await createSong(payload);
        setFeedback({
          severity: "success",
          message: "Canción creada correctamente.",
        });
        setPage(0);
      } else if (editingSong) {
        await updateSong(editingSong.id, payload);
        setFeedback({ severity: "success", message: "Canción actualizada." });
      }
      setFormOpen(false);
      setEditingSong(null);
      setSnackbarOpen(true);
      setReloadToken((prev) => prev + 1);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error guardando la canción.";
      setFeedback({ severity: "error", message });
      setSnackbarOpen(true);
    } finally {
      setFormLoading(false);
    }
  };

  const requestDelete = (song: Song) => {
    setDeleteTarget(song);
  };

  const cancelDelete = () => {
    if (deleteLoading) {
      return;
    }
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);

    try {
      await deleteSong(deleteTarget.id);
      setFeedback({ severity: "success", message: "Canción eliminada." });
      setSnackbarOpen(true);
      setDeleteTarget(null);
      setReloadToken((prev) => prev + 1);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo eliminar la canción seleccionada.";
      setFeedback({ severity: "error", message });
      setSnackbarOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleSpanish = async (song: Song) => {
    if (!dataReady) {
      return;
    }

    const nextValue = !song.isspanish;
    setLanguageToggleId(song.id);
    setSongs((prev) =>
      prev.map((item) =>
        item.id === song.id ? { ...item, isspanish: nextValue } : item
      )
    );

    try {
      await updateSong(song.id, {
        artist: song.artist,
        title: song.title,
        youtube_url: song.youtube_url,
        year: song.year,
        isspanish: nextValue,
      });
      setFeedback({
        severity: "success",
        message: nextValue
          ? "Marcada como canción en español."
          : "Marcada como canción en otro idioma.",
      });
      setSnackbarOpen(true);
    } catch (err) {
      setSongs((prev) =>
        prev.map((item) =>
          item.id === song.id ? { ...item, isspanish: song.isspanish } : item
        )
      );
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el estado de idioma.";
      setFeedback({ severity: "error", message });
      setSnackbarOpen(true);
    } finally {
      setLanguageToggleId(null);
    }
  };

  const handleSnackbarClose = (
    _event?: SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    setSnackbarOpen(false);
    setFeedback(null);
  };

  const handleTabChange = (
    _event: SyntheticEvent,
    value: "songs" | "stats" | "users"
  ) => {
    setActiveTab(value);
    if (!isDesktop) {
      setNavOpen(false);
    }
  };

  const handleActionsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setActionsAnchorEl(event.currentTarget);
  };

  const handleActionsClose = () => {
    setActionsAnchorEl(null);
  };

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

  const renderTableBody = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
            <CircularProgress color="primary" />
          </TableCell>
        </TableRow>
      );
    }

    if (!songs.length) {
      return (
        <TableRow>
          <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              {searchTerm
                ? "No hay resultados que coincidan con tu búsqueda."
                : "Todavía no hay canciones registradas."}
            </Typography>
          </TableCell>
        </TableRow>
      );
    }

    return songs.map((song, index) => (
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
        </TableCell>
        <TableCell width={120}>{song.year ?? "-"}</TableCell>
        <TableCell width={140} align="center">
          <Switch
            checked={song.isspanish}
            onChange={() => handleToggleSpanish(song)}
            color="primary"
            size="small"
            disabled={
              !dataReady || languageToggleId === song.id || loading
            }
            inputProps={{
              "aria-label": `Cambiar estado de idioma para ${song.title}`,
            }}
          />
        </TableCell>
        <TableCell align="right" width={140}>
          <IconButton
            aria-label="Opciones de canción"
            onClick={(event) => handleSongMenuOpen(event, song)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    ));
  };

  const renderMobileSongCards = () => {
    if (loading) {
      return (
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress color="primary" />
        </Box>
      );
    }

    if (!songs.length) {
      return (
        <Paper elevation={0} sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            {searchTerm
              ? "No hay resultados que coincidan con tu búsqueda."
              : "Todavía no hay canciones registradas."}
          </Typography>
        </Paper>
      );
    }

    return songs.map((song, index) => {
      const yearLabel = song.year ? song.year.toString() : "Sin año";

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
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
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
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    lineHeight: 1.25,
                  }}
                >
                  {song.title}
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
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: 0.4,
                  }}
                >
                  Español
                </Typography>
                <Switch
                  checked={song.isspanish}
                  onChange={() => handleToggleSpanish(song)}
                  color="default"
                  disabled={
                    !dataReady ||
                    languageToggleId === song.id ||
                    loading
                  }
                  inputProps={{
                    "aria-label": `Cambiar idioma de ${song.title}`,
                  }}
                  sx={{
                    "& .MuiSwitch-thumb": {
                      backgroundColor: "#fff",
                    },
                    "& .MuiSwitch-track": {
                      opacity: 0.4,
                    },
                  }}
                />
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      );
    });
  };

  return (
    <>
      <input
        hidden
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportFromExcel}
      />
      <div className="admin-ocean-background" />
      <div className="admin-ocean-blur" />
      <Box
        sx={{
          position: "relative",
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          py: { xs: 3, sm: 4, md: 8 },
          px: { xs: 0, sm: 2, md: 4 },
          overflowX: "hidden",
          boxSizing: "border-box",
        }}
      >
        <Container
          maxWidth={false}
          disableGutters
          sx={{
            position: "relative",
            zIndex: 1,
            px: { xs: 0, sm: 2, md: 3 },
            maxWidth: { md: "1200px", lg: "1400px" },
            mx: { md: "auto" },
            boxSizing: "border-box",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
              gap: { xs: 2, md: 3 },
              width: "100%",
              boxSizing: "border-box",
              animation: "admin-fade-in 520ms ease",
              "@keyframes admin-fade-in": {
                from: { opacity: 0, transform: "translateY(12px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 0,
                position: { xs: "relative", md: "sticky" },
                top: { md: 24 },
                height: "fit-content",
                backgroundColor: "background.paper",
                display: { xs: "none", md: "block" },
              }}
            >
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Panel administrativo
                  </Typography>
                  <Box
                    component="img"
                    src="/ponchister_logo.png"
                    alt="Ponchister"
                    sx={{
                      width: "100%",
                      maxWidth: 120,
                      height: "auto",
                      display: "block",
                      mt: 1,
                      mb: 0.5,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {userEmail
                      ? `Sesion activa: ${userEmail}`
                      : "Acceso seguro al catalogo."}
                  </Typography>
                </Box>

                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  orientation="vertical"
                  variant="standard"
                  textColor="primary"
                  indicatorColor="primary"
                  sx={{
                    minHeight: "auto",
                    "& .MuiTabs-flexContainer": {
                      gap: 0.5,
                    },
                    "& .MuiTab-root": {
                      justifyContent: "flex-start",
                      minHeight: 42,
                      gap: 1,
                      px: 1.5,
                      borderRadius: 0,
                      alignItems: "center",
                      "&.Mui-selected": {
                        backgroundColor: "#f1f5f9",
                      },
                    },
                    "& .MuiTabs-indicator": {
                      display: "none",
                    },
                  }}
                >
                  {visibleTabs.map((tab) =>
                    tab.value === "stats" && !dataReady ? (
                      <Tab
                        key={tab.value}
                        value={tab.value}
                        label={tab.label}
                        icon={tab.icon}
                        iconPosition="start"
                        disabled
                      />
                    ) : (
                      <Tab
                        key={tab.value}
                        value={tab.value}
                        label={tab.label}
                        icon={tab.icon}
                        iconPosition="start"
                      />
                    )
                  )}
                </Tabs>

                {activeTab === "songs" ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 0,
                      border: "1px solid",
                      borderColor: "divider",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        Resumen rapido
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {total}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          label={
                            filtersActive ? "Filtros activos" : "Sin filtros"
                          }
                          size="small"
                          sx={{ backgroundColor: "#e2e8f0", fontWeight: 600 }}
                        />
                        <Chip
                          label={`Pagina ${page + 1}`}
                          size="small"
                          sx={{ backgroundColor: "#e2e8f0", fontWeight: 600 }}
                        />
                      </Stack>
                    </Stack>
                  </Paper>
                ) : null}
                <Divider />
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={onExit}
                    sx={{
                      borderRadius: 0,
                      borderColor: "divider",
                      color: "text.primary",
                      backgroundColor: "background.paper",
                      "&:hover": {
                        borderColor: "rgba(100,116,139,0.65)",
                        backgroundColor: "#f8fafc",
                      },
                    }}
                  >
                    Volver al inicio
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<LogoutIcon />}
                    onClick={onSignOut}
                    sx={{ borderRadius: 0 }}
                  >
                    Cerrar sesión
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Drawer
              anchor="left"
              open={navOpen}
              onClose={() => setNavOpen(false)}
              PaperProps={{
                sx: {
                  width: 280,
                  borderRadius: 0,
                  backgroundColor: "background.paper",
                  height: "100%",
                  overflowY: "auto",
                },
              }}
              sx={{ display: { xs: "block", md: "none" } }}
            >
              <Box
                sx={{
                  minHeight: "100%",
                  display: "flex",
                  flexDirection: "column",
                  p: 2,
                  pb: 4,
                  boxSizing: "border-box",
                }}
              >
              <Stack spacing={2} sx={{ flex: 1 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Menu
                  </Typography>
                  <IconButton
                    aria-label="Cerrar menu"
                    onClick={() => setNavOpen(false)}
                  >
                    <CloseIcon />
                  </IconButton>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Panel administrativo
                  </Typography>
                  <Box
                    component="img"
                    src="/ponchister_logo.png"
                    alt="Ponchister"
                    sx={{
                      width: "100%",
                      maxWidth: 120,
                      height: "auto",
                      display: "block",
                      mt: 0.5,
                      mb: 0.5,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {userEmail
                      ? `Sesion activa: ${userEmail}`
                      : "Acceso seguro al catalogo."}
                  </Typography>
                </Stack>

                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  orientation="vertical"
                  variant="standard"
                  textColor="primary"
                  indicatorColor="primary"
                  sx={{
                    minHeight: "auto",
                    "& .MuiTabs-flexContainer": {
                      gap: 0.5,
                    },
                    "& .MuiTab-root": {
                      justifyContent: "flex-start",
                      minHeight: 42,
                      gap: 1,
                      px: 1.5,
                      borderRadius: 0,
                      alignItems: "center",
                      "&.Mui-selected": {
                        backgroundColor: "#f1f5f9",
                      },
                    },
                    "& .MuiTabs-indicator": {
                      display: "none",
                    },
                  }}
                >
                  {visibleTabs.map((tab) =>
                    tab.value === "stats" && !dataReady ? (
                      <Tab
                        key={tab.value}
                        value={tab.value}
                        label={tab.label}
                        icon={tab.icon}
                        iconPosition="start"
                        disabled
                      />
                    ) : (
                      <Tab
                        key={tab.value}
                        value={tab.value}
                        label={tab.label}
                        icon={tab.icon}
                        iconPosition="start"
                      />
                    )
                  )}
                </Tabs>

                {activeTab === "songs" ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 0,
                      border: "1px solid",
                      borderColor: "divider",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        Resumen rapido
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {total}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          label={
                            filtersActive ? "Filtros activos" : "Sin filtros"
                          }
                          size="small"
                          sx={{ backgroundColor: "#e2e8f0", fontWeight: 600 }}
                        />
                        <Chip
                          label={`Pagina ${page + 1}`}
                          size="small"
                          sx={{ backgroundColor: "#e2e8f0", fontWeight: 600 }}
                        />
                      </Stack>
                    </Stack>
                  </Paper>
                ) : null}
                <Divider />
                <Stack spacing={1} sx={{ mt: "auto" }}>
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={onExit}
                    sx={{
                      borderRadius: 0,
                      borderColor: "divider",
                      color: "text.primary",
                      backgroundColor: "background.paper",
                      "&:hover": {
                        borderColor: "rgba(100,116,139,0.65)",
                        backgroundColor: "#f8fafc",
                      },
                    }}
                  >
                    Volver al inicio
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<LogoutIcon />}
                    onClick={onSignOut}
                    sx={{ borderRadius: 0 }}
                  >
                    Cerrar sesión
                  </Button>
                </Stack>
              </Stack>
              </Box>
            </Drawer>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3, md: 4 },
                borderRadius: 0,
                backgroundColor: "background.paper",
                boxShadow: "none",
                width: "100%",
                mx: { xs: 0, sm: "auto" },
                boxSizing: "border-box",
              }}
            >
              <Stack spacing={3}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                  >
                    <IconButton
                      aria-label="Abrir menu"
                      onClick={() => setNavOpen(true)}
                      sx={{
                        display: { xs: "inline-flex", md: "none" },
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 0,
                      }}
                    >
                      <MenuIcon />
                    </IconButton>
                    <Box>
                    <Typography variant="caption" color="text.secondary">
                      {activeTabMeta?.label ?? "Administracion"}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {activeTabMeta?.label ?? "Panel"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activeTabMeta?.description ??
                        "Gestion y control de contenidos."}
                    </Typography>
                    </Box>
                  </Stack>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                  </Stack>
                </Stack>

                {activeTab === "songs" ? (
                  <>
                    {error && (
                      <Alert severity="error" onClose={() => setError(null)}>
                        {error}
                      </Alert>
                    )}

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
                          Resultados totales
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          {total}
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
                          En espanol (pagina)
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
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          justifyContent="space-between"
                          alignItems={{ xs: "stretch", md: "center" }}
                        >
                          <TextField
                            label="Buscar canciones"
                            placeholder="Busca por artista, cancion o enlace"
                            value={searchInput}
                            onChange={(event) =>
                              setSearchInput(event.target.value)
                            }
                            fullWidth
                            disabled={!dataReady}
                            size="small"
                            sx={{
                              width: { xs: "100%", md: 320 },
                              flexShrink: 0,
                            }}
                            InputProps={{
                              endAdornment: searchInput ? (
                                <InputAdornment position="end">
                                  <IconButton
                                    aria-label="Limpiar busqueda"
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
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                            sx={{
                              width: { xs: "100%", md: "auto" },
                              flexWrap: "wrap",
                              gap: { xs: 1, md: 0 },
                            }}
                          >
                          <Tooltip title="Recargar lista" disableInteractive>
                            <Box
                              component="span"
                              sx={{ display: "inline-flex" }}
                            >
                              <IconButton
                                onClick={handleRefresh}
                                disabled={!dataReady || loading}
                                aria-label="Recargar lista"
                                sx={{
                                  border: "1px solid",
                                  borderColor: "divider",
                                  color: "text.primary",
                                  backgroundColor: "background.paper",
                                  borderRadius: 0,
                                  "&:hover": {
                                    borderColor: "rgba(100,116,139,0.55)",
                                    backgroundColor: "#f8fafc",
                                  },
                                  "&.Mui-disabled": {
                                    opacity: 0.5,
                                  },
                                }}
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Tooltip>
                          <Tooltip title="Opciones" disableInteractive>
                            <Box
                              component="span"
                              sx={{ display: "inline-flex" }}
                            >
                              <IconButton
                                aria-label="Opciones de catalogo"
                                onClick={handleActionsOpen}
                                disabled={!dataReady}
                                sx={{
                                  border: "1px solid",
                                  borderColor: "divider",
                                  color: "text.primary",
                                  backgroundColor: "background.paper",
                                  borderRadius: 0,
                                }}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Tooltip>
                          <Menu
                            anchorEl={actionsAnchorEl}
                            open={Boolean(actionsAnchorEl)}
                            onClose={handleActionsClose}
                          >
                            <MenuItem
                              onClick={() => {
                                handleActionsClose();
                                handleImportButtonClick();
                              }}
                              disabled={!dataReady || importing}
                            >
                              <ListItemIcon>
                                {importing ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <UploadFileIcon fontSize="small" />
                                )}
                              </ListItemIcon>
                              <ListItemText>Importar Excel</ListItemText>
                            </MenuItem>
                            <MenuItem
                              onClick={() => {
                                handleActionsClose();
                                void handleDownloadExcel();
                              }}
                              disabled={!dataReady || exporting}
                            >
                              <ListItemIcon>
                                {exporting ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <DownloadIcon fontSize="small" />
                                )}
                              </ListItemIcon>
                              <ListItemText>Descargar Excel</ListItemText>
                            </MenuItem>
                          </Menu>
                          </Stack>
                        </Stack>

                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          alignItems={{ xs: "stretch", md: "center" }}
                        >
                          <TextField
                            label="Filtrar por año"
                            type="number"
                            value={yearInput}
                            onChange={handleYearInputChange}
                            placeholder="Ej: 1994"
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ min: 0 }}
                            sx={{
                              width: { xs: "100%", md: "auto" },
                              maxWidth: { md: 220 },
                            }}
                            disabled={!dataReady}
                            size="small"
                          />
                          <TextField
                            select
                            label="Ordenar por"
                            value={sortOption}
                            onChange={(event) =>
                              handleSortOptionChange(
                                event.target.value as SortOption
                              )
                            }
                            sx={{
                              width: { xs: "100%", md: "auto" },
                              minWidth: { md: 220 },
                            }}
                            disabled={!dataReady}
                            size="small"
                          >
                            {SORT_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Button
                            variant="outlined"
                            onClick={handleClearFilters}
                            disabled={!filtersActive || !dataReady}
                            fullWidth={isSmallScreen}
                            sx={{
                              alignSelf: { xs: "stretch", md: "flex-start" },
                            }}
                          >
                            Limpiar filtros
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>

                    <Paper
                      elevation={0}
                      sx={{
                        overflow: "hidden",
                        borderRadius: { xs: 0, md: 0 },
                        backgroundColor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        boxShadow: "none",
                      }}
                    >
                      <Box
                        sx={{
                          display: { xs: "flex", md: "none" },
                          flexDirection: "column",
                          gap: 2,
                          py: 1,
                        }}
                      >
                        {renderMobileSongCards()}
                      </Box>
                      <TableContainer
                        sx={{ display: { xs: "none", md: "block" } }}
                      >
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
                              <TableCell align="center">Español</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>{renderTableBody()}</TableBody>
                        </Table>
                      </TableContainer>
                    <TablePagination
                      component="div"
                      count={total}
                      page={page}
                      rowsPerPage={rowsPerPage}
                      onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                        labelRowsPerPage="Registros por página"
                        labelDisplayedRows={({ from, to, count }) =>
                          `${from}-${to} de ${
                            count !== -1 ? count : `más de ${to}`
                          }`
                        }
                        disabled={!dataReady}
                        sx={{
                          display: { xs: "flex", md: "block" },
                          flexDirection: { xs: "column", md: "row" },
                          alignItems: { xs: "stretch", md: "center" },
                          gap: { xs: 1, md: 0 },
                          px: { xs: 1, md: 0 },
                          backgroundColor: {
                            xs: "#f8fafc",
                            md: "transparent",
                          },
                        borderTop: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                    <Menu
                      anchorEl={songMenuAnchorEl}
                      open={Boolean(songMenuAnchorEl)}
                      onClose={handleSongMenuClose}
                    >
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
                            requestDelete(songMenuSong);
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
                    </Menu>
                  </Paper>
                </>
              ) : activeTab === "stats" ? (
                  <>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      spacing={1.5}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Indicadores clave del catalogo.
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={handleRefresh}
                        disabled={statsLoading || !dataReady}
                        sx={{
                          alignSelf: { xs: "stretch", sm: "flex-end" },
                          fontWeight: 600,
                        }}
                      >
                        Actualizar estadísticas
                      </Button>
                    </Stack>
                    <SongStatisticsView
                      loading={statsLoading}
                      error={statsError}
                      stats={statistics}
                    />
                  </>
                ) : (
                  <AdminUsersPanel isSuperAdmin={isSuperAdmin} />
                )}
              </Stack>
            </Paper>
          </Box>
        </Container>
      </Box>

      <Zoom in={activeTab === "songs"} unmountOnExit>
        <Fab
          color="primary"
          onClick={openCreateForm}
          aria-label="Agregar canción"
          sx={{
            position: "fixed",
            bottom: { xs: 88, sm: 32 },
            right: { xs: 24, sm: 32 },
            zIndex: 1300,
            backgroundColor: "text.primary",
            borderRadius: "50%",
            "&:hover": {
              backgroundColor: "#0f172a",
            },
          }}
        >
          <AddIcon />
        </Fab>
      </Zoom>

      <SongFormDialog
        open={formOpen}
        mode={formMode}
        initialValue={editingSong}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        loading={formLoading}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={cancelDelete}
        fullScreen={isSmallScreen}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Eliminar canción</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Seguro que deseas eliminar el registro
            {deleteTarget
              ? ` "${deleteTarget.title}" de ${deleteTarget.artist}`
              : ""}
            ? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} disabled={deleteLoading} variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen && Boolean(feedback)}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {feedback ? (
          <Alert
            onClose={handleSnackbarClose}
            severity={feedback.severity}
            sx={{ width: "100%" }}
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
