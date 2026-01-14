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
  IconButton,
  MenuItem,
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
  const supabaseConfigured = true;
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

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const showActionLabels = !isSmallScreen;
  const isSuperAdmin = userRole === "superadmin";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iconActionBaseStyles = {
    minWidth: { xs: "auto", sm: 48 },
    height: { xs: 44, sm: 44 },
    px: { xs: 2.3, sm: 0 },
    borderRadius: 5,
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
        fontSize: 22,
      },
    },
    "& .button-label": {
      display: { xs: "inline", sm: "none" },
    },
  } as const;
  const mobileAccents = useMemo(
    () => [
      {
        gradient:
          "linear-gradient(135deg, rgba(31,60,122,0.92) 0%, rgba(63,142,252,0.88) 60%, rgba(99,213,245,0.9) 100%)",
        border: "1px solid rgba(118,181,255,0.45)",
        shadow: "0 24px 48px rgba(46,124,227,0.35)",
        chipBg: "rgba(255,255,255,0.18)",
        chipColor: "#E8F3FF",
        accentText: "rgba(255,255,255,0.78)",
        buttonGradient:
          "linear-gradient(135deg, rgba(28,54,110,0.92) 0%, rgba(58,131,238,0.9) 55%, rgba(92,201,237,0.92) 100%)",
        buttonHoverGradient:
          "linear-gradient(135deg, rgba(35,66,126,0.96) 0%, rgba(78,151,255,0.94) 55%, rgba(112,219,250,0.95) 100%)",
        buttonShadow: "0 22px 42px rgba(30,72,150,0.48)",
        outlineBorder: "rgba(178,209,255,0.6)",
        outlineHover: "rgba(104,162,255,0.2)",
      },
      {
        gradient:
          "linear-gradient(135deg, rgba(110,67,255,0.95) 0%, rgba(178,106,250,0.85) 50%, rgba(255,165,241,0.9) 100%)",
        border: "1px solid rgba(209,166,255,0.4)",
        shadow: "0 24px 52px rgba(150,93,255,0.4)",
        chipBg: "rgba(27,7,53,0.35)",
        chipColor: "#FFE7FF",
        accentText: "rgba(255,238,255,0.78)",
        buttonGradient:
          "linear-gradient(135deg, rgba(97,54,235,0.95) 0%, rgba(165,90,241,0.9) 55%, rgba(240,150,233,0.95) 100%)",
        buttonHoverGradient:
          "linear-gradient(135deg, rgba(118,73,255,0.98) 0%, rgba(191,108,255,0.94) 55%, rgba(255,183,244,0.98) 100%)",
        buttonShadow: "0 22px 42px rgba(120,63,215,0.48)",
        outlineBorder: "rgba(233,193,255,0.58)",
        outlineHover: "rgba(204,153,255,0.24)",
      },
      {
        gradient:
          "linear-gradient(135deg, rgba(7,94,104,0.9) 0%, rgba(26,167,178,0.88) 50%, rgba(126,233,200,0.93) 100%)",
        border: "1px solid rgba(126,233,200,0.45)",
        shadow: "0 24px 46px rgba(26,167,178,0.32)",
        chipBg: "rgba(4,37,46,0.4)",
        chipColor: "#D8FFF4",
        accentText: "rgba(227,255,247,0.78)",
        buttonGradient:
          "linear-gradient(135deg, rgba(6,86,96,0.95) 0%, rgba(26,158,168,0.92) 55%, rgba(116,222,193,0.95) 100%)",
        buttonHoverGradient:
          "linear-gradient(135deg, rgba(8,108,120,0.98) 0%, rgba(32,182,192,0.95) 55%, rgba(138,235,207,0.98) 100%)",
        buttonShadow: "0 22px 42px rgba(22,142,152,0.44)",
        outlineBorder: "rgba(155,235,214,0.55)",
        outlineHover: "rgba(76,208,189,0.22)",
      },
      {
        gradient:
          "linear-gradient(135deg, rgba(138,43,226,0.92) 0%, rgba(255,105,180,0.9) 60%, rgba(255,188,113,0.9) 100%)",
        border: "1px solid rgba(255,188,213,0.48)",
        shadow: "0 24px 48px rgba(190,85,205,0.38)",
        chipBg: "rgba(29,0,52,0.35)",
        chipColor: "#FFE8F4",
        accentText: "rgba(255,246,255,0.8)",
        buttonGradient:
          "linear-gradient(135deg, rgba(126,34,204,0.95) 0%, rgba(240,98,164,0.92) 55%, rgba(255,179,126,0.95) 100%)",
        buttonHoverGradient:
          "linear-gradient(135deg, rgba(149,52,224,0.98) 0%, rgba(252,125,185,0.95) 55%, rgba(255,197,152,0.98) 100%)",
        buttonShadow: "0 22px 42px rgba(167,55,195,0.46)",
        outlineBorder: "rgba(255,204,226,0.58)",
        outlineHover: "rgba(255,170,210,0.24)",
      },
    ],
    []
  );

  const getMobileAccent = useCallback(
    (id: number) => mobileAccents[id % mobileAccents.length],
    [mobileAccents]
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
      if (!supabaseConfigured) {
        return;
      }

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
    supabaseConfigured,
  ]);

  useEffect(() => {
    if (activeTab !== "stats" || !supabaseConfigured) {
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
  }, [activeTab, reloadToken, supabaseConfigured]);

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
    if (!supabaseConfigured) {
      setFeedback({
        severity: "error",
        message: "Configura Supabase antes de exportar el catálogo.",
      });
      setSnackbarOpen(true);
      return;
    }

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
  }, [exporting, supabaseConfigured]);

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFromExcel = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      if (!supabaseConfigured) {
        setFeedback({
          severity: "error",
          message: "Configura Supabase antes de importar canciones.",
        });
        setSnackbarOpen(true);
        event.target.value = "";
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
    [supabaseConfigured]
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
    if (!supabaseConfigured) {
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
  };

  const renderTableBody = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
            <CircularProgress color="primary" />
          </TableCell>
        </TableRow>
      );
    }

    if (!songs.length) {
      return (
        <TableRow>
          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              {searchTerm
                ? "No hay resultados que coincidan con tu búsqueda."
                : "Todavía no hay canciones registradas."}
            </Typography>
          </TableCell>
        </TableRow>
      );
    }

    return songs.map((song) => (
      <TableRow key={song.id} hover>
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
              !supabaseConfigured || languageToggleId === song.id || loading
            }
            inputProps={{
              "aria-label": `Cambiar estado de idioma para ${song.title}`,
            }}
          />
        </TableCell>
        <TableCell sx={{ minWidth: 200 }}>
          {song.youtube_url ? (
            <Button
              variant="text"
              size="small"
              component="a"
              href={song.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir enlace
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Sin enlace
            </Typography>
          )}
        </TableCell>
        <TableCell align="right" width={140}>
          <Tooltip title="Editar">
            <IconButton color="primary" onClick={() => openEditForm(song)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton color="error" onClick={() => requestDelete(song)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
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

    return songs.map((song) => {
      const accent = getMobileAccent(song.id);
      const yearLabel = song.year ? song.year.toString() : "Sin año";

      return (
        <Paper
          key={song.id}
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 4,
            background: accent.gradient,
            border: accent.border,
            boxShadow: accent.shadow,
            color: "#ffffff",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 15% 15%, rgba(255,255,255,0.18) 0%, rgba(10,10,30,0.1) 35%, rgba(10,10,40,0.55) 100%)",
              opacity: 0.95,
            }}
          />
          <Stack spacing={2.4} sx={{ position: "relative", zIndex: 1, p: 2.8 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography
                variant="overline"
                sx={{
                  letterSpacing: 2.4,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: accent.accentText,
                }}
              >
                #{String(song.id).padStart(3, "0")}
              </Typography>
              <Chip
                label={yearLabel}
                size="small"
                sx={{
                  backgroundColor: accent.chipBg,
                  color: accent.chipColor,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  backdropFilter: "blur(4px)",
                }}
              />
            </Stack>

            <Stack spacing={1.3}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.7)",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Artista
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    lineHeight: 1.2,
                    textShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  }}
                >
                  {song.artist}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.7)",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Canción
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.25,
                    textShadow: "0 10px 32px rgba(0,0,0,0.35)",
                  }}
                >
                  {song.title}
                </Typography>
              </Box>
            </Stack>

            <Divider
              sx={{
                borderColor: "rgba(255,255,255,0.2)",
                borderBottomWidth: 1,
                my: 1,
              }}
            />

            <Stack spacing={1.2}>
              {song.youtube_url ? (
                <Button
                  variant="outlined"
                  component="a"
                  href={song.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<InfoOutlinedIcon />}
                  fullWidth
                  sx={{
                    color: accent.accentText,
                    borderColor: accent.outlineBorder,
                    borderRadius: 2,
                    fontWeight: 600,
                    textTransform: "none",
                    backdropFilter: "blur(3px)",
                    px: 1,
                    py: 1,
                    "&:hover": {
                      borderColor: accent.outlineBorder,
                      backgroundColor: accent.outlineHover,
                    },
                  }}
                >
                  Abrir enlace
                </Button>
              ) : (
                <Chip
                  label="Sin enlace"
                  size="small"
                  sx={{
                    alignSelf: "flex-start",
                    backgroundColor: "rgba(0,0,0,0.35)",
                    color: "rgba(255,255,255,0.75)",
                    fontWeight: 600,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    backdropFilter: "blur(3px)",
                  }}
                />
              )}
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <Typography
                  variant="body2"
                  sx={{
                    color: accent.accentText,
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
                    !supabaseConfigured ||
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
                      opacity: 0.6,
                    },
                  }}
                />
              </Stack>
              <Button
                variant="contained"
                startIcon={<EditIcon fontSize="small" />}
                onClick={() => openEditForm(song)}
                fullWidth
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: "none",
                  backgroundImage: accent.buttonGradient,
                  color: "#ffffff",
                  boxShadow: accent.buttonShadow,
                  py: 1.05,
                  "&:hover": {
                    backgroundImage: accent.buttonHoverGradient,
                    boxShadow: accent.buttonShadow,
                  },
                }}
              >
                Editar canción
              </Button>
              <Button
                variant="outlined"
                startIcon={<DeleteIcon fontSize="small" />}
                onClick={() => requestDelete(song)}
                fullWidth
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: "none",
                  color: "rgba(255,255,255,0.88)",
                  borderColor: "rgba(255,255,255,0.45)",
                  py: 1.05,
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.75)",
                    backgroundColor: "rgba(255,255,255,0.12)",
                  },
                }}
              >
                Eliminar
              </Button>
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
          width: "100vw",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          py: { xs: 3, sm: 4, md: 8 },
          px: { xs: 1.25, sm: 2, md: 4 },
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            position: "relative",
            zIndex: 1,
            px: { xs: 1, sm: 2, md: 4 },
          }}
        >
          <Paper
            elevation={6}
            sx={{
              p: { xs: 2, sm: 3, md: 5 },
              borderRadius: 4,
              backdropFilter: "blur(14px)",
              background:
                "linear-gradient(155deg, rgba(255,255,255,0.94) 0%, rgba(244,249,255,0.9) 42%, rgba(229,240,255,0.86) 100%)",
              border: "1px solid rgba(31,60,122,0.08)",
              boxShadow: "0 42px 68px -32px rgba(31,60,122,0.25)",
            }}
          >
            <Stack spacing={3}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Box>
                  <Typography
                    variant="h4"
                    component="h1"
                    sx={{
                      fontWeight: 700,
                      textAlign: { xs: "left", md: "left" },
                      mb: 1,
                      color: "#1f3c7a",
                    }}
                  >
                    Administrador de canciones
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Gestiona la base de datos de canciones utilizada por
                    Ponchister. Puedes crear, editar o eliminar registros en
                    cualquier momento.
                  </Typography>
                  {userEmail ? (
                    <Typography variant="caption" color="text.secondary">
                      Sesión iniciada como <strong>{userEmail}</strong>
                    </Typography>
                  ) : null}
                </Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Tooltip title="Volver al generador" disableInteractive>
                    <Box component="span" sx={{ display: "inline-flex" }}>
                      <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={onExit}
                        aria-label="Volver al generador"
                        sx={{
                          ...iconActionBaseStyles,
                          borderColor: "rgba(31,60,122,0.55)",
                          color: "rgba(15,23,42,0.9)",
                          backgroundColor: "rgba(248,250,255,0.96)",
                          "&:hover": {
                            borderColor: "rgba(31,60,122,0.95)",
                            backgroundColor: "rgba(236,243,255,0.98)",
                            color: "rgba(15,23,42,0.98)",
                            boxShadow: "0 12px 24px -12px rgba(31,60,122,0.35)",
                          },
                        }}
                      >
                        <Typography component="span" className="button-label">
                          Volver al generador
                        </Typography>
                      </Button>
                    </Box>
                  </Tooltip>
                  <Tooltip title="Cerrar sesión" disableInteractive>
                    <Box component="span" sx={{ display: "inline-flex" }}>
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<LogoutIcon />}
                        onClick={onSignOut}
                        aria-label="Cerrar sesión"
                        sx={{
                          ...iconActionBaseStyles,
                          px: { xs: 2.4, sm: 0 },
                          boxShadow: "0 18px 36px -18px rgba(244,67,54,0.55)",
                          "&:hover": {
                            boxShadow: "0 22px 42px -18px rgba(244,67,54,0.65)",
                          },
                        }}
                      >
                        <Typography component="span" className="button-label">
                          Cerrar sesión
                        </Typography>
                      </Button>
                    </Box>
                  </Tooltip>
                </Stack>
              </Stack>

              {!supabaseConfigured && (
                <Alert severity="warning">
                  Debes definir las variables <code>VITE_SUPABASE_URL</code> y
                  <code> VITE_SUPABASE_ANON_KEY</code> para conectarte a
                  Supabase.
                </Alert>
              )}

              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                textColor="primary"
                indicatorColor="primary"
                variant="scrollable"
                allowScrollButtonsMobile
                sx={{
                  borderBottom: "1px solid rgba(31,60,122,0.15)",
                  mb: -2,
                }}
              >
                <Tab label="Canciones" value="songs" />
                <Tab
                  label="Estadísticas"
                  value="stats"
                  disabled={!supabaseConfigured}
                />
                {isSuperAdmin ? <Tab label="Usuarios" value="users" /> : null}
              </Tabs>

              {activeTab === "songs" ? (
                <>
                  {error && (
                    <Alert severity="error" onClose={() => setError(null)}>
                      {error}
                    </Alert>
                  )}

                  <Box
                    sx={{
                      background: {
                        xs: "linear-gradient(135deg, rgba(63,118,255,0.08) 0%, rgba(31,60,122,0.14) 100%)",
                        md: "transparent",
                      },
                      borderRadius: { xs: 3, md: 2 },
                      px: { xs: 1.5, md: 0 },
                      py: { xs: 1.75, md: 0 },
                      border: {
                        xs: "1px solid rgba(31,60,122,0.2)",
                        md: "none",
                      },
                      boxShadow: {
                        xs: "0 20px 40px -30px rgba(31,60,122,0.45)",
                        md: "none",
                      },
                      backdropFilter: { xs: "blur(16px)", md: "none" },
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
                          placeholder="Busca por artista, canción o enlace"
                          value={searchInput}
                          onChange={(event) =>
                            setSearchInput(event.target.value)
                          }
                          fullWidth
                          disabled={!supabaseConfigured}
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
                              <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                onClick={handleRefresh}
                                disabled={!supabaseConfigured || loading}
                                aria-label="Recargar lista"
                                sx={[
                                  iconActionBaseStyles,
                                  showActionLabels
                                    ? {
                                        "& .button-label": {
                                          display: "inline",
                                        },
                                      }
                                    : {
                                        minWidth: 44,
                                        px: 0,
                                        gap: 0,
                                        "& .MuiButton-startIcon": {
                                          mr: 0,
                                        },
                                      },
                                  {
                                    px: showActionLabels
                                      ? { xs: 2.3, sm: 0 }
                                      : 0,
                                    gap: showActionLabels
                                      ? { xs: 1, sm: 0 }
                                      : 0,
                                    "& .MuiButton-startIcon": {
                                      mr: showActionLabels
                                        ? { xs: 1, sm: 0 }
                                        : 0,
                                    },
                                    borderColor: "rgba(31,60,122,0.45)",
                                    color: "rgba(31,60,122,0.9)",
                                    backgroundColor: "rgba(245,248,255,0.9)",
                                    "&:hover": {
                                      borderColor: "rgba(31,60,122,0.8)",
                                      backgroundColor: "rgba(236,242,255,0.95)",
                                      boxShadow:
                                        "0 16px 32px -18px rgba(31,60,122,0.35)",
                                    },
                                    "&.Mui-disabled": {
                                      opacity: 0.5,
                                      boxShadow: "none",
                                    },
                                  },
                                ]}
                              >
                                {showActionLabels ? (
                                  <Typography
                                    component="span"
                                    className="button-label"
                                  ></Typography>
                                ) : null}
                              </Button>
                            </Box>
                          </Tooltip>
                          <Tooltip title="Importar Excel" disableInteractive>
                            <Box
                              component="span"
                              sx={{ display: "inline-flex" }}
                            >
                              <Button
                                variant="outlined"
                                startIcon={
                                  importing ? (
                                    <CircularProgress
                                      size={18}
                                      color="inherit"
                                    />
                                  ) : (
                                    <UploadFileIcon />
                                  )
                                }
                                onClick={handleImportButtonClick}
                                disabled={!supabaseConfigured || importing}
                                aria-label="Importar catálogo"
                                sx={[
                                  iconActionBaseStyles,
                                  showActionLabels
                                    ? {
                                        "& .button-label": {
                                          display: "inline",
                                        },
                                      }
                                    : {
                                        minWidth: 44,
                                        px: 0,
                                        gap: 0,
                                        "& .MuiButton-startIcon": {
                                          mr: 0,
                                        },
                                      },
                                  {
                                    px: showActionLabels
                                      ? { xs: 2.6, sm: 0 }
                                      : 0,
                                    gap: showActionLabels
                                      ? { xs: 1, sm: 0 }
                                      : 0,
                                    "& .MuiButton-startIcon": {
                                      mr: showActionLabels
                                        ? { xs: 1, sm: 0 }
                                        : 0,
                                    },
                                    borderColor: "rgba(31,60,122,0.45)",
                                    color: "rgba(31,60,122,0.9)",
                                    backgroundColor: "rgba(245,248,255,0.92)",
                                    "&:hover": {
                                      borderColor: "rgba(31,60,122,0.85)",
                                      backgroundColor: "rgba(236,243,255,0.96)",
                                      boxShadow:
                                        "0 18px 36px -18px rgba(31,60,122,0.35)",
                                    },
                                    "&.Mui-disabled": {
                                      opacity: 0.55,
                                      boxShadow: "none",
                                    },
                                  },
                                ]}
                              >
                                {showActionLabels ? (
                                  <Typography
                                    component="span"
                                    className="button-label"
                                  ></Typography>
                                ) : null}
                              </Button>
                            </Box>
                          </Tooltip>
                          <Tooltip title="Descargar Excel" disableInteractive>
                            <Box
                              component="span"
                              sx={{ display: "inline-flex" }}
                            >
                              <Button
                                variant="outlined"
                                startIcon={
                                  exporting ? (
                                    <CircularProgress
                                      size={18}
                                      color="inherit"
                                    />
                                  ) : (
                                    <DownloadIcon />
                                  )
                                }
                                onClick={handleDownloadExcel}
                                disabled={!supabaseConfigured || exporting}
                                aria-label="Descargar catálogo"
                                sx={[
                                  iconActionBaseStyles,
                                  showActionLabels
                                    ? {
                                        "& .button-label": {
                                          display: "inline",
                                        },
                                      }
                                    : {
                                        minWidth: 44,
                                        px: 0,
                                        gap: 0,
                                        "& .MuiButton-startIcon": {
                                          mr: 0,
                                        },
                                      },
                                  {
                                    px: showActionLabels
                                      ? { xs: 2.6, sm: 0 }
                                      : 0,
                                    gap: showActionLabels
                                      ? { xs: 1, sm: 0 }
                                      : 0,
                                    "& .MuiButton-startIcon": {
                                      mr: showActionLabels
                                        ? { xs: 1, sm: 0 }
                                        : 0,
                                    },
                                    borderColor: "rgba(31,60,122,0.45)",
                                    color: "rgba(31,60,122,0.9)",
                                    backgroundColor: "rgba(245,248,255,0.92)",
                                    "&:hover": {
                                      borderColor: "rgba(31,60,122,0.85)",
                                      backgroundColor: "rgba(236,243,255,0.96)",
                                      boxShadow:
                                        "0 18px 36px -18px rgba(31,60,122,0.35)",
                                    },
                                    "&.Mui-disabled": {
                                      opacity: 0.55,
                                      boxShadow: "none",
                                    },
                                  },
                                ]}
                              >
                                {showActionLabels ? (
                                  <Typography
                                    component="span"
                                    className="button-label"
                                  ></Typography>
                                ) : null}
                              </Button>
                            </Box>
                          </Tooltip>
                          <Tooltip title="Nueva canción" disableInteractive>
                            <Box
                              component="span"
                              sx={{ display: "inline-flex" }}
                            >
                              <Button
                                variant="contained"
                                startIcon={<AddCircleIcon />}
                                onClick={openCreateForm}
                                disabled={!supabaseConfigured}
                                aria-label="Nueva canción"
                                sx={{
                                  ...iconActionBaseStyles,
                                  display: { xs: "none", sm: "inline-flex" },
                                  px: { xs: 2.6, sm: 0 },
                                  background:
                                    "linear-gradient(135deg, rgba(31,60,122,0.95) 0%, rgba(63,142,252,0.92) 55%, rgba(99,213,245,0.94) 100%)",
                                  border: "1px solid rgba(118,181,255,0.5)",
                                  boxShadow:
                                    "0 22px 44px -20px rgba(46,124,227,0.5)",
                                  "&:hover": {
                                    background:
                                      "linear-gradient(135deg, rgba(35,66,126,0.98) 0%, rgba(78,151,255,0.96) 55%, rgba(112,219,250,0.96) 100%)",
                                    boxShadow:
                                      "0 26px 52px -20px rgba(46,124,227,0.58)",
                                  },
                                  "&.Mui-disabled": {
                                    backgroundColor: "rgba(191,209,255,0.4)",
                                    boxShadow: "none",
                                    borderColor: "rgba(118,181,255,0.2)",
                                  },
                                }}
                              >
                                <Typography
                                  component="span"
                                  className="button-label"
                                >
                                  Nueva canción
                                </Typography>
                              </Button>
                            </Box>
                          </Tooltip>
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
                          disabled={!supabaseConfigured}
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
                          disabled={!supabaseConfigured}
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
                          disabled={!filtersActive || !supabaseConfigured}
                          fullWidth={isSmallScreen}
                          sx={{
                            alignSelf: { xs: "stretch", md: "flex-start" },
                          }}
                        >
                          Limpiar filtros
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>

                  <Divider sx={{ borderColor: "rgba(31,60,122,0.1)" }} />

                  <Paper
                    elevation={0}
                    sx={{
                      overflow: "hidden",
                      borderRadius: { xs: 4, md: 3 },
                      backgroundColor: {
                        xs: "rgba(255,255,255,0.08)",
                        md: "rgba(255,255,255,0.65)",
                      },
                      border: {
                        xs: "1px solid rgba(255,255,255,0.16)",
                        md: "1px solid rgba(31,60,122,0.08)",
                      },
                      backdropFilter: { xs: "blur(20px)", md: "none" },
                      boxShadow: {
                        xs: "0 24px 52px -36px rgba(31,60,122,0.55)",
                        md: "0 20px 45px -40px rgba(31,60,122,0.4)",
                      },
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
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            fontWeight: 700,
                            fontSize: 12,
                            color: "rgba(31,60,122,0.75)",
                          },
                          "& tbody td": {
                            fontWeight: 500,
                            color: "rgba(15,23,42,0.82)",
                          },
                        }}
                      >
                        <TableHead
                          sx={{
                            background:
                              "linear-gradient(135deg, rgba(31,60,122,0.08) 0%, rgba(99,213,245,0.12) 100%)",
                          }}
                        >
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Artista</TableCell>
                            <TableCell>Canción</TableCell>
                            <TableCell>Año</TableCell>
                            <TableCell align="center">Español</TableCell>
                            <TableCell>Enlace</TableCell>
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
                      disabled={!supabaseConfigured}
                      sx={{
                        display: { xs: "flex", md: "block" },
                        flexDirection: { xs: "column", md: "row" },
                        alignItems: { xs: "stretch", md: "center" },
                        gap: { xs: 1, md: 0 },
                        px: { xs: 1, md: 0 },
                        backgroundColor: {
                          xs: "rgba(255,255,255,0.12)",
                          md: "transparent",
                        },
                        backdropFilter: { xs: "blur(12px)", md: "none" },
                        borderTop: {
                          xs: "1px solid rgba(255,255,255,0.18)",
                          md: "1px solid rgba(31,60,122,0.08)",
                        },
                      }}
                    />
                  </Paper>
                </>
              ) : activeTab === "stats" ? (
                <>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="flex-end"
                    spacing={1.5}
                  >
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleRefresh}
                      disabled={statsLoading || !supabaseConfigured}
                      sx={{
                        alignSelf: { xs: "stretch", sm: "flex-end" },
                        fontWeight: 600,
                        borderColor: "rgba(31,60,122,0.65)",
                        color: "rgba(15,23,42,0.92)",
                        backgroundColor: "rgba(248,250,255,0.92)",
                        "&:hover": {
                          borderColor: "rgba(31,60,122,0.95)",
                          backgroundColor: "rgba(236,243,255,0.96)",
                          color: "rgba(15,23,42,0.98)",
                        },
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
        </Container>
      </Box>

      <Zoom in={isSmallScreen && activeTab === "songs"} unmountOnExit>
        <Fab
          color="primary"
          onClick={openCreateForm}
          aria-label="Agregar canción"
          sx={{
            position: "fixed",
            bottom: { xs: 88, sm: 32 },
            right: { xs: 24, sm: 32 },
            zIndex: 1300,
            background:
              "linear-gradient(135deg, #1f3c7a 0%, #497bff 55%, #63d5f5 100%)",
            boxShadow: "0 26px 48px rgba(49,97,209,0.45)",
            "&:hover": {
              background:
                "linear-gradient(135deg, #23468f 0%, #3b6bff 55%, #4fc8f0 100%)",
              boxShadow: "0 30px 54px rgba(49,97,209,0.55)",
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
        <DialogTitle>Eliminar canción</DialogTitle>
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
          <Button onClick={cancelDelete} disabled={deleteLoading}>
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
