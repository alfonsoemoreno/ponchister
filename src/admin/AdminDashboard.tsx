import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react";
import YouTube from "react-youtube";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
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
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LibraryMusicOutlinedIcon from "@mui/icons-material/LibraryMusicOutlined";
import QueueMusicOutlinedIcon from "@mui/icons-material/QueueMusicOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ClearIcon from "@mui/icons-material/Clear";
import * as XLSX from "xlsx";

import AdminUsersPanel from "./AdminUsersPanel";
import PlaylistManagementView from "./PlaylistManagementView";
import ProfilePanel from "./ProfilePanel";
import MyCollectionView from "./MyCollectionView";
import SongFormDialog from "./SongFormDialog";
import SongStatisticsView from "./SongStatisticsView";
import GameSessionStatisticsView from "./GameSessionStatisticsView";
import {
  createSong,
  deleteSong,
  listSongs,
  approveSong,
  bulkApproveSongs,
  fetchSongStatistics,
  fetchAllSongs,
  bulkUpsertSongs,
  findSongDuplicates,
  updateSongYoutubeValidation,
  updateSong,
} from "./services/songService";
import { copyPublicSongToMyCollection } from "./services/mySongService";
import { fetchGameSessionStatistics } from "./services/gameSessionService";
import {
  createUncheckedYoutubeValidation,
  createOperationalYoutubeValidation,
  getYoutubeStatusLabel,
  interpretYoutubePlayerError,
  validateYoutubeUrlFormat,
} from "./youtubeValidation";
import type {
  GameSessionStatistics,
  AdminUser,
  Song,
  SongDuplicateMatch,
  SongInput,
  SongStatisticsGroup,
  SongYoutubeValidationPayload,
  YoutubeValidationResult,
} from "./types";

interface FeedbackState {
  severity: "success" | "error";
  message: string;
}

interface DuplicateReviewState {
  payload: SongInput;
  matches: SongDuplicateMatch[];
  youtubeValidation: SongYoutubeValidationPayload | null;
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
  currentUser?: AdminUser | null;
  userEmail?: string | null;
  userRole?: "superadmin" | "editor";
  onSessionRefresh?: () => Promise<void>;
}

export default function AdminDashboard({
  onExit,
  onSignOut,
  currentUser,
  userEmail,
  userRole,
  onSessionRefresh,
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
  const [duplicateReview, setDuplicateReview] =
    useState<DuplicateReviewState | null>(null);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "songs" | "playlists" | "stats" | "users" | "profile"
    | "my-collection"
  >(
    "songs"
  );
  const [sessionUser, setSessionUser] = useState<AdminUser | null>(
    currentUser ?? null
  );
  const [approvingSongId, setApprovingSongId] = useState<number | null>(null);
  const [selectedSongIds, setSelectedSongIds] = useState<number[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [songStatistics, setSongStatistics] = useState<SongStatisticsGroup | null>(
    null
  );
  const [gameStatistics, setGameStatistics] =
    useState<GameSessionStatistics | null>(null);
  const [languageToggleId, setLanguageToggleId] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [songMenuAnchorEl, setSongMenuAnchorEl] =
    useState<null | HTMLElement>(null);
  const [songMenuSong, setSongMenuSong] = useState<Song | null>(null);
  const [audioPreview, setAudioPreview] = useState<AudioPreviewState | null>(
    null
  );
  const [audioPreviewPlayerKey, setAudioPreviewPlayerKey] = useState(0);
  const [youtubeStatusBySongId, setYoutubeStatusBySongId] = useState<
    Record<number, YoutubeStatusState>
  >({});
  const [activeYoutubeProbe, setActiveYoutubeProbe] =
    useState<YoutubeProbeView | null>(null);
  const [youtubeProbePlayerKey, setYoutubeProbePlayerKey] = useState(0);

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isSuperAdmin = userRole === "superadmin";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const youtubeValidationQueueRef = useRef<YoutubeProbeRequest[]>([]);
  const activeYoutubeProbeRef = useRef<YoutubeProbeRequest | null>(null);
  const youtubeProbeTimeoutRef = useRef<number | null>(null);
  const youtubeProbeSuccessTimeoutRef = useRef<number | null>(null);
  const youtubeProbeRequestIdRef = useRef(0);
  const autoValidatedUncheckedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setSessionUser(currentUser ?? null);
  }, [currentUser]);

  useEffect(() => {
    setSelectedSongIds((prev) =>
      prev.filter((songId) => songs.some((song) => song.id === songId))
    );
  }, [songs]);

  const tabConfig = useMemo(
    () => [
      {
        value: "songs" as const,
        label: "Catálogo público",
        description: "Gestiona las canciones oficiales y sus aprobaciones.",
        icon: <LibraryMusicOutlinedIcon fontSize="small" />,
      },
      {
        value: "playlists" as const,
        label: "Playlists",
        description: "Administra playlists públicas y personales.",
        icon: <QueueMusicOutlinedIcon fontSize="small" />,
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
      {
        value: "profile" as const,
        label: "Perfil",
        description: "Gestiona tu identidad visible dentro del panel.",
        icon: <AccountCircleOutlinedIcon fontSize="small" />,
      },
      {
        value: "my-collection" as const,
        label: "Mis canciones",
        description: "Administra tu colección personal y sus publicaciones.",
        icon: <LibraryMusicOutlinedIcon fontSize="small" />,
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
        const [songData, gameData] = await Promise.all([
          fetchSongStatistics(),
          fetchGameSessionStatistics(),
        ]);
        if (!cancelled) {
          setSongStatistics(songData);
          setGameStatistics(gameData);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "No se pudieron obtener las estadísticas.";
          setStatsError(message);
          setSongStatistics(null);
          setGameStatistics(null);
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

  useEffect(
    () => () => {
      clearYoutubeProbeTimers();
    },
    [clearYoutubeProbeTimers]
  );

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

  const handleValidateSongLink = useCallback(
    async (song: Song, options?: { showFeedback?: boolean }) => {
      const result = await enqueueYoutubeValidation(song.youtube_url, {
        songId: song.id,
        priority: "high",
      });
      const persistedValidation = toPersistedYoutubeValidation(result);

      if (persistedValidation) {
        const updatedSong = await updateSongYoutubeValidation(
          song.id,
          persistedValidation
        );

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

      setFeedback({
        severity: result.status === "operational" ? "success" : "error",
        message:
          result.status === "operational"
            ? `El enlace de "${song.title}" está operativo.`
            : result.message,
      });
      setSnackbarOpen(true);

      return result;
    },
    [editingSong, enqueueYoutubeValidation, toPersistedYoutubeValidation]
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
    setDuplicateReview(null);
    setFormOpen(false);
    setEditingSong(null);
  };

  const persistSong = async (
    payload: SongInput,
    youtubeValidation?: SongYoutubeValidationPayload | null
  ) => {
    if (formMode === "create") {
      await createSong(payload, { youtubeValidation });
      setFeedback({
        severity: "success",
        message: "Canción creada correctamente.",
      });
      setPage(0);
    } else if (editingSong) {
      await updateSong(editingSong.id, payload, { youtubeValidation });
      setFeedback({ severity: "success", message: "Canción actualizada." });
    }

    setDuplicateReview(null);
    setFormOpen(false);
    setEditingSong(null);
    setSnackbarOpen(true);
    setReloadToken((prev) => prev + 1);
  };

  const handleFormSubmit = async (payload: SongInput) => {
    setFormLoading(true);

    try {
      const currentYoutubeUrl = editingSong?.youtube_url.trim() ?? null;
      const nextYoutubeUrl = payload.youtube_url.trim();
      const shouldValidateYoutube =
        formMode === "create" || currentYoutubeUrl !== nextYoutubeUrl;

      let persistedYoutubeValidation: SongYoutubeValidationPayload | null = null;

      if (shouldValidateYoutube) {
      const youtubeValidation = await enqueueYoutubeValidation(
        payload.youtube_url,
        { priority: "high" }
      );

      if (youtubeValidation.status !== "operational") {
        setFeedback({
          severity: "error",
          message: youtubeValidation.message,
        });
        setSnackbarOpen(true);
        return false;
      }
        persistedYoutubeValidation = toPersistedYoutubeValidation(youtubeValidation);
      } else if (
        editingSong?.youtube_status === "operational" ||
        editingSong?.youtube_status === "restricted" ||
        editingSong?.youtube_status === "unavailable" ||
        editingSong?.youtube_status === "invalid"
      ) {
        persistedYoutubeValidation = {
          status: editingSong.youtube_status,
          message: editingSong.youtube_validation_message ?? "",
          code: editingSong.youtube_validation_code,
          validatedAt:
            editingSong.youtube_validated_at ?? new Date().toISOString(),
        };
      }

      if (formMode === "create" && !persistedYoutubeValidation) {
        setFeedback({
          severity: "error",
          message:
            "No hay una validación de YouTube disponible para este enlace. Vuelve a validar antes de guardar.",
        });
        setSnackbarOpen(true);
        return false;
      }

      const matches = await findSongDuplicates(payload, {
        excludeId: formMode === "edit" ? editingSong?.id ?? null : null,
      });

      if (matches.length > 0) {
        setDuplicateReview({
          payload,
          matches,
          youtubeValidation: persistedYoutubeValidation,
        });
        return false;
      }

      await persistSong(payload, persistedYoutubeValidation);
      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error guardando la canción.";
      setFeedback({ severity: "error", message });
      setSnackbarOpen(true);
      return false;
    } finally {
      setFormLoading(false);
    }
  };

  const handleDuplicateDialogClose = () => {
    if (formLoading) {
      return;
    }
    setDuplicateReview(null);
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateReview) {
      return;
    }

    setFormLoading(true);

    try {
      await persistSong(
        duplicateReview.payload,
        duplicateReview.youtubeValidation
      );
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
    if (!isSuperAdmin && song.catalog_status === "approved") {
      setFeedback({
        severity: "error",
        message: "Los editores no pueden eliminar canciones del catálogo oficial.",
      });
      setSnackbarOpen(true);
      return;
    }
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

  const handleApproveSong = async (song: Song) => {
    if (!isSuperAdmin) {
      return;
    }

    setApprovingSongId(song.id);
    try {
      const updated = await approveSong(song.id);
      setSongs((prev) => prev.map((entry) => (entry.id === song.id ? updated : entry)));
      if (editingSong?.id === song.id) {
        setEditingSong(updated);
      }
      setFeedback({
        severity: "success",
        message: `"${song.title}" ya forma parte del catálogo oficial.`,
      });
      setSnackbarOpen(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo aprobar la canción.";
      setFeedback({ severity: "error", message });
      setSnackbarOpen(true);
    } finally {
      setApprovingSongId(null);
    }
  };

  const toggleSongSelection = useCallback((songId: number) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((entry) => entry !== songId)
        : [...prev, songId]
    );
  }, []);

  const selectableSongs = useMemo(
    () => songs.filter((song) => song.catalog_status !== "approved"),
    [songs]
  );

  const allSelectableSelected =
    selectableSongs.length > 0 &&
    selectableSongs.every((song) => selectedSongIds.includes(song.id));

  const someSelectableSelected =
    selectableSongs.some((song) => selectedSongIds.includes(song.id)) &&
    !allSelectableSelected;

  const handleToggleSelectAllSongs = useCallback(() => {
    if (allSelectableSelected) {
      setSelectedSongIds((prev) =>
        prev.filter((songId) => !selectableSongs.some((song) => song.id === songId))
      );
      return;
    }

    setSelectedSongIds((prev) =>
      Array.from(new Set([...prev, ...selectableSongs.map((song) => song.id)]))
    );
  }, [allSelectableSelected, selectableSongs]);

  const handleBulkApproveSongs = async () => {
    if (!isSuperAdmin || selectedSongIds.length === 0) {
      return;
    }

    setBulkApproving(true);
    try {
      const approvedCount = await bulkApproveSongs(selectedSongIds);
      setSelectedSongIds([]);
      setFeedback({
        severity: "success",
        message: `${approvedCount} canción(es) aprobadas para el catálogo oficial.`,
      });
      setSnackbarOpen(true);
      setReloadToken((prev) => prev + 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudieron aprobar las canciones.";
      setFeedback({ severity: "error", message });
      setSnackbarOpen(true);
    } finally {
      setBulkApproving(false);
    }
  };

  const handleTabChange = (
    _event: SyntheticEvent,
    value: "songs" | "playlists" | "stats" | "users" | "profile" | "my-collection"
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

  const handlePreviewSong = useCallback(
    (song: Song) => {
      if (audioPreview?.songId === song.id) {
        setAudioPreview(null);
        return;
      }

      const validation = validateYoutubeUrlFormat(song.youtube_url);
      if (validation.status === "invalid" || !validation.videoId) {
        setFeedback({
          severity: "error",
          message:
            "El enlace de YouTube de esta canción no es válido para reproducirse.",
        });
        setSnackbarOpen(true);
        return;
      }

      setAudioPreview({
        songId: song.id,
        songLabel: `${song.artist} · ${song.title}`,
        videoId: validation.videoId,
      });
      setAudioPreviewPlayerKey((prev) => prev + 1);
    },
    [audioPreview]
  );

  const stopAudioPreview = useCallback(() => {
    setAudioPreview(null);
  }, []);

  const getSongOwnerLabel = useCallback((song: Song) => {
    return (
      song.created_by_user?.display_name ||
      song.created_by_user?.email ||
      "Sin registro"
    );
  }, []);

  const getCatalogChipProps = useCallback((song: Song) => {
    if (song.catalog_status === "approved") {
      return {
        label: "Oficial",
        color: "success" as const,
        variant: "filled" as const,
      };
    }

    return {
      label: "Pendiente",
      color: "warning" as const,
      variant: "outlined" as const,
    };
  }, []);

  const handleProfileUpdated = useCallback(
    (user: AdminUser) => {
      setSessionUser(user);
      void onSessionRefresh?.();
    },
    [onSessionRefresh]
  );

  const renderTableBody = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
            <CircularProgress color="primary" />
          </TableCell>
        </TableRow>
      );
    }

    if (!songs.length) {
      return (
        <TableRow>
          <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
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
      (() => {
        const youtubeStatus = getYoutubeStatusChipProps(song);
        const isPlaying = audioPreview?.songId === song.id;
        const catalogChip = getCatalogChipProps(song);
        const isSelected = selectedSongIds.includes(song.id);
        const isSelectable = isSuperAdmin && song.catalog_status !== "approved";

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
            <TableCell padding="checkbox" width={56}>
              {isSuperAdmin ? (
                <Checkbox
                  checked={isSelected}
                  disabled={!isSelectable}
                  onChange={() => toggleSongSelection(song.id)}
                  inputProps={{ "aria-label": `Seleccionar ${song.title}` }}
                />
              ) : null}
            </TableCell>
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
                Alta: {getSongOwnerLabel(song)}
              </Typography>
            </TableCell>
            <TableCell width={120}>{song.year ?? "-"}</TableCell>
            <TableCell width={140} align="center">
              <Chip
                label={catalogChip.label}
                color={catalogChip.color}
                variant={catalogChip.variant}
                size="small"
              />
            </TableCell>
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
                disabled={
                  !dataReady || languageToggleId === song.id || loading
                }
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
      })()
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
      const youtubeStatus = getYoutubeStatusChipProps(song);
      const catalogChip = getCatalogChipProps(song);
      const isPlaying = audioPreview?.songId === song.id;
      const isSelected = selectedSongIds.includes(song.id);
      const isSelectable = isSuperAdmin && song.catalog_status !== "approved";

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
                {isSuperAdmin ? (
                  <Checkbox
                    checked={isSelected}
                    disabled={!isSelectable}
                    onChange={() => toggleSongSelection(song.id)}
                    inputProps={{ "aria-label": `Seleccionar ${song.title}` }}
                  />
                ) : null}
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
                  label={catalogChip.label}
                  size="small"
                  color={catalogChip.color}
                  variant={catalogChip.variant}
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
                <Typography variant="body2" color="text.secondary">
                  Alta: {getSongOwnerLabel(song)}
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
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    isPlaying ? <StopIcon /> : <PlayArrowIcon />
                  }
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
                    alignItems="center"
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
                    {sessionUser ? (
                      <Stack
                        direction="row"
                        spacing={1.2}
                        alignItems="center"
                        sx={{
                          px: 1.25,
                          py: 0.8,
                          border: "1px solid",
                          borderColor: "divider",
                          backgroundColor: "#f8fafc",
                        }}
                      >
                        <Avatar
                          src={sessionUser.avatar_url ?? undefined}
                          sx={{ width: 34, height: 34, bgcolor: "#0f172a" }}
                        >
                          {(sessionUser.display_name || sessionUser.email || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                            {sessionUser.display_name || sessionUser.email}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {sessionUser.role === "superadmin" ? "Superadmin" : "Editor"}
                          </Typography>
                        </Box>
                      </Stack>
                    ) : null}
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

                    {isSuperAdmin ? (
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
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          alignItems={{ xs: "stretch", md: "center" }}
                          justifyContent="space-between"
                        >
                          <Typography variant="body2" color="text.secondary">
                            {selectedSongIds.length > 0
                              ? `${selectedSongIds.length} canción(es) seleccionadas para aprobar.`
                              : "Selecciona canciones pendientes para aprobarlas en bloque."}
                          </Typography>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={() => setSelectedSongIds([])}
                              disabled={selectedSongIds.length === 0 || bulkApproving}
                            >
                              Limpiar selección
                            </Button>
                            <Button
                              variant="contained"
                              startIcon={<VerifiedOutlinedIcon />}
                              onClick={handleBulkApproveSongs}
                              disabled={selectedSongIds.length === 0 || bulkApproving}
                            >
                              {bulkApproving ? "Aprobando..." : "Aprobar seleccionadas"}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ) : null}

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
                            {isSuperAdmin ? (
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
                            ) : null}
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
                              <TableCell padding="checkbox">
                                {isSuperAdmin ? (
                                  <Checkbox
                                    checked={allSelectableSelected}
                                    indeterminate={someSelectableSelected}
                                    onChange={handleToggleSelectAllSongs}
                                    inputProps={{
                                      "aria-label": "Seleccionar canciones pendientes",
                                    }}
                                  />
                                ) : null}
                              </TableCell>
                              <TableCell>ID</TableCell>
                              <TableCell>Artista</TableCell>
                              <TableCell>Canción</TableCell>
                              <TableCell>Año</TableCell>
                              <TableCell align="center">Catálogo</TableCell>
                              <TableCell align="center">YouTube</TableCell>
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
                            void handleApproveSong(songMenuSong);
                          }
                          handleSongMenuClose();
                        }}
                        disabled={
                          !songMenuSong ||
                          !isSuperAdmin ||
                          songMenuSong.catalog_status === "approved" ||
                          approvingSongId === songMenuSong?.id
                        }
                      >
                        <ListItemIcon>
                          <VerifiedOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Aprobar para catálogo</ListItemText>
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          if (songMenuSong) {
                            void copyPublicSongToMyCollection(songMenuSong.id)
                              .then(() => {
                                setFeedback({
                                  severity: "success",
                                  message: "La canción se copió a tu colección personal.",
                                });
                                setSnackbarOpen(true);
                              })
                              .catch((err) => {
                                setFeedback({
                                  severity: "error",
                                  message:
                                    err instanceof Error
                                      ? err.message
                                      : "No se pudo copiar la canción.",
                                });
                                setSnackbarOpen(true);
                              });
                          }
                          handleSongMenuClose();
                        }}
                        disabled={!songMenuSong}
                      >
                        <ListItemIcon>
                          <AddIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Copiar a mi colección</ListItemText>
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
                        disabled={
                          !songMenuSong ||
                          (!isSuperAdmin && songMenuSong.catalog_status === "approved")
                        }
                      >
                        <ListItemIcon>
                          <DeleteIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Eliminar</ListItemText>
                      </MenuItem>
                    </Menu>
                  </Paper>
                </>
                ) : activeTab === "playlists" ? (
                  <PlaylistManagementView
                    onFeedback={(payload) => {
                      setFeedback(payload);
                      setSnackbarOpen(true);
                    }}
                  />
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
                    {statsLoading ? (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{ py: 8 }}
                      >
                        <CircularProgress />
                      </Stack>
                    ) : statsError ? (
                      <Alert severity="error" sx={{ borderRadius: 0 }}>
                        {statsError}
                      </Alert>
                    ) : (
                      <Stack spacing={3}>
                        <GameSessionStatisticsView stats={gameStatistics} />
                        <SongStatisticsView
                          loading={false}
                          error={null}
                          stats={songStatistics}
                        />
                      </Stack>
                    )}
                  </>
                ) : activeTab === "profile" ? (
                  <ProfilePanel
                    currentUser={sessionUser}
                    onProfileUpdated={handleProfileUpdated}
                    onFeedback={(payload) => {
                      setFeedback(payload);
                      setSnackbarOpen(true);
                    }}
                  />
                ) : activeTab === "my-collection" ? (
                  <MyCollectionView
                    onFeedback={(payload) => {
                      setFeedback(payload);
                      setSnackbarOpen(true);
                    }}
                  />
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
              setFeedback({
                severity: "error",
                message:
                  typeof event.data === "number" &&
                  (event.data === 101 || event.data === 150)
                    ? "No es posible reproducir este enlace aquí por restricciones de YouTube."
                    : `No se pudo reproducir "${audioPreview.songLabel}".`,
              });
              setSnackbarOpen(true);
              stopAudioPreview();
            }}
          />
        </Box>
      ) : null}

      <SongFormDialog
        open={formOpen}
        mode={formMode}
        initialValue={editingSong}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        loading={formLoading}
      />

      <Dialog
        open={Boolean(duplicateReview)}
        onClose={formLoading ? undefined : handleDuplicateDialogClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Posibles canciones duplicadas
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              Se encontraron coincidencias parecidas en el catálogo. Revisa la
              lista antes de confirmar el guardado.
            </Alert>
            {duplicateReview?.matches.map((match) => (
              <Paper
                key={match.id}
                variant="outlined"
                sx={{ p: 2, borderRadius: 0 }}
              >
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={2}
                  >
                    <Typography variant="subtitle2">
                      {match.artist} · {match.title}
                    </Typography>
                    <Chip
                      size="small"
                      color={
                        match.matchLabel === "high" ? "warning" : "default"
                      }
                      label={`${Math.round(match.similarity * 100)}% similar`}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {match.reason}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID #{match.id}
                    {match.year ? ` · ${match.year}` : ""}
                    {match.isspanish ? " · Español" : ""}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDuplicateDialogClose}
            disabled={formLoading}
            variant="outlined"
          >
            Volver
          </Button>
          <Button
            onClick={handleDuplicateConfirm}
            variant="contained"
            disabled={formLoading}
          >
            Guardar de todas formas
          </Button>
        </DialogActions>
      </Dialog>

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
