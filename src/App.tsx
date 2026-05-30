import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Welcome from "./Welcome";
const AutoGame = lazy(() => import("./AutoGame"));
const AdminApp = lazy(() => import("./admin/AdminApp"));
const MimicaRemoteView = lazy(() => import("./components/MimicaRemoteView"));
import "./App.css";
import type { GameSource, PlaylistSummary, YearRange } from "./types";
import { fetchSongYearBounds } from "./services/songService";
import {
  DEFAULT_SONG_TAG_DEFINITIONS,
  isSpanishTagSelected,
  normalizeSongTags,
  type SongTagMatchMode,
  type SongTagDefinition,
  type SongTag,
} from "./lib/songTags";
import { fetchAvailableSongTags } from "./services/songTagService";
import {
  fetchAvailablePlaylists,
  fetchPersonalPlaylists,
} from "./services/playlistService";
import { fetchAdminSession } from "./admin/services/adminAuth";
import type { AdminUser } from "./admin/types";

const YEAR_RANGE_STORAGE_KEY = "ponchister_year_range";
const SONG_TAG_FILTER_STORAGE_KEY = "ponchister_song_tag_filter";
const SONG_TAG_MATCH_MODE_STORAGE_KEY = "ponchister_song_tag_match_mode";
const LANGUAGE_FILTER_STORAGE_KEY = "ponchister_language_filter";
const TIMER_ENABLED_STORAGE_KEY = "ponchister_timer_enabled";
const MIMICA_ENABLED_STORAGE_KEY = "ponchister_mimica_enabled";
const TARAREAR_ENABLED_STORAGE_KEY = "ponchister_tararear_enabled";
const SELECTED_PLAYLIST_STORAGE_KEY = "ponchister_selected_playlist";

const getDefaultYearRange = (): YearRange => ({
  min: 1950,
  max: new Date().getFullYear(),
});

const coerceYear = (value: unknown, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.trunc(value);
};

const clampRange = (
  candidate: Partial<YearRange> | null | undefined,
  limits: YearRange,
): YearRange => {
  const rawMin = coerceYear(candidate?.min, limits.min);
  const rawMax = coerceYear(candidate?.max, limits.max);
  const min = Math.max(limits.min, Math.min(limits.max, rawMin));
  const max = Math.max(min, Math.min(limits.max, rawMax));
  return { min, max };
};

const readStoredYearRange = (): YearRange => {
  if (typeof window === "undefined") {
    return getDefaultYearRange();
  }
  try {
    const stored = window.localStorage.getItem(YEAR_RANGE_STORAGE_KEY);
    if (!stored) {
      return getDefaultYearRange();
    }
    const parsed = JSON.parse(stored) as Partial<YearRange> | null;
    if (!parsed || typeof parsed !== "object") {
      return getDefaultYearRange();
    }
    const fallback = getDefaultYearRange();
    const min = coerceYear(parsed.min, fallback.min);
    const max = coerceYear(parsed.max, fallback.max);
    return { min, max: max < min ? min : max };
  } catch {
    return getDefaultYearRange();
  }
};

const readStoredSongTags = (): SongTag[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(SONG_TAG_FILTER_STORAGE_KEY);
    if (stored) {
      return normalizeSongTags(JSON.parse(stored) as unknown);
    }
    const legacyStored = window.localStorage.getItem(LANGUAGE_FILTER_STORAGE_KEY);
    return legacyStored === "true" ? ["espanol"] : [];
  } catch {
    return [];
  }
};

const readStoredSongTagMatchMode = (): SongTagMatchMode => {
  if (typeof window === "undefined") {
    return "any";
  }
  try {
    const stored = window.localStorage.getItem(SONG_TAG_MATCH_MODE_STORAGE_KEY);
    return stored === "all" ? "all" : "any";
  } catch {
    return "any";
  }
};

const readStoredTimerEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const stored = window.localStorage.getItem(TIMER_ENABLED_STORAGE_KEY);
    if (stored === null) return false;
    return stored === "true";
  } catch {
    return false;
  }
};

const readStoredBoolean = (key: string, fallback: boolean): boolean => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === "true";
  } catch {
    return fallback;
  }
};

const readStoredPlaylist = (): PlaylistSummary | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(SELECTED_PLAYLIST_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PlaylistSummary | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      id: coerceYear((parsed as { id?: unknown }).id, 0),
      name: typeof parsed.name === "string" ? parsed.name : "",
      description:
        typeof parsed.description === "string" ? parsed.description : null,
      active: parsed.active === true,
      songCount: coerceYear((parsed as { songCount?: unknown }).songCount, 0),
      scope: parsed.scope === "personal" ? "personal" : "public",
    };
  } catch {
    return null;
  }
};

function App() {
  const [view, setView] = useState<"welcome" | "auto" | "admin">("welcome");
  const [remoteMode, setRemoteMode] = useState<"mimica" | "tararear" | null>(
    null,
  );
  const [remoteSongTitle, setRemoteSongTitle] = useState<string>("");
  const [remoteArtist, setRemoteArtist] = useState<string>("");
  const [remoteVideoId, setRemoteVideoId] = useState<string>("");
  const [remotePlayStartSeconds, setRemotePlayStartSeconds] = useState<number>(0);
  const fallbackRange = useMemo(() => getDefaultYearRange(), []);
  const [availableRange, setAvailableRange] = useState<YearRange | null>(null);
  const [yearRange, setYearRange] = useState<YearRange>(() =>
    readStoredYearRange(),
  );
  const [selectedSongTags, setSelectedSongTags] = useState<SongTag[]>(() =>
    readStoredSongTags(),
  );
  const [songTagMatchMode, setSongTagMatchMode] = useState<SongTagMatchMode>(() =>
    readStoredSongTagMatchMode()
  );
  const [timerEnabled, setTimerEnabled] = useState<boolean>(() =>
    readStoredTimerEnabled(),
  );
  const [mimicaEnabled, setMimicaEnabled] = useState<boolean>(() =>
    readStoredBoolean(MIMICA_ENABLED_STORAGE_KEY, true),
  );
  const [tararearEnabled, setTararearEnabled] = useState<boolean>(() =>
    readStoredBoolean(TARAREAR_ENABLED_STORAGE_KEY, true),
  );
  const [availablePlaylists, setAvailablePlaylists] = useState<PlaylistSummary[]>(
    [],
  );
  const [personalPlaylists, setPersonalPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistSummary | null>(
    () => readStoredPlaylist(),
  );
  const [gameSource, setGameSource] = useState<GameSource>("classic");
  const [currentAdminUser, setCurrentAdminUser] = useState<AdminUser | null>(null);
  const [availableSongTags, setAvailableSongTags] = useState<SongTagDefinition[]>(
    DEFAULT_SONG_TAG_DEFINITIONS
  );

  const effectiveLimits = availableRange ?? fallbackRange;

  const normalizedYearRange = useMemo(
    () => clampRange(yearRange, effectiveLimits),
    [yearRange, effectiveLimits],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !availableRange) {
      return;
    }
    window.localStorage.setItem(
      YEAR_RANGE_STORAGE_KEY,
      JSON.stringify(normalizedYearRange),
    );
  }, [normalizedYearRange, availableRange]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SONG_TAG_FILTER_STORAGE_KEY,
      JSON.stringify(selectedSongTags),
    );
    window.localStorage.setItem(
      LANGUAGE_FILTER_STORAGE_KEY,
      isSpanishTagSelected(selectedSongTags) ? "true" : "false",
    );
  }, [selectedSongTags]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SONG_TAG_MATCH_MODE_STORAGE_KEY,
      songTagMatchMode
    );
  }, [songTagMatchMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      TIMER_ENABLED_STORAGE_KEY,
      timerEnabled ? "true" : "false",
    );
  }, [timerEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      MIMICA_ENABLED_STORAGE_KEY,
      mimicaEnabled ? "true" : "false",
    );
  }, [mimicaEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      TARAREAR_ENABLED_STORAGE_KEY,
      tararearEnabled ? "true" : "false",
    );
  }, [tararearEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!selectedPlaylist) {
      window.localStorage.removeItem(SELECTED_PLAYLIST_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SELECTED_PLAYLIST_STORAGE_KEY,
      JSON.stringify(selectedPlaylist),
    );
  }, [selectedPlaylist]);

  useEffect(() => {
    let cancelled = false;

    const loadBounds = async () => {
      try {
        const bounds = await fetchSongYearBounds({ forceRefresh: true });
        if (cancelled) return;
        setAvailableRange(bounds);
        setYearRange((prev) => {
          const next = clampRange(prev, bounds);
          if (next.min === prev.min && next.max === prev.max) {
            return prev;
          }
          return next;
        });
      } catch (error) {
        console.error(
          "[ponchister] No se pudieron cargar los límites de años.",
          error,
        );
        if (!cancelled) {
          setAvailableRange((prev) => prev ?? fallbackRange);
        }
      }
    };

    void loadBounds();

    return () => {
      cancelled = true;
    };
  }, [fallbackRange]);

  useEffect(() => {
    let cancelled = false;

    const loadSongTags = async () => {
      try {
        const tags = await fetchAvailableSongTags();
        if (!cancelled && tags.length) {
          setAvailableSongTags(tags);
        }
      } catch (error) {
        console.error("[ponchister] No se pudieron cargar las etiquetas.", error);
        if (!cancelled) {
          setAvailableSongTags(DEFAULT_SONG_TAG_DEFINITIONS);
        }
      }
    };

    void loadSongTags();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view !== "welcome") {
      return;
    }

    void fetchAvailableSongTags()
      .then((tags) => {
        if (tags.length) {
          setAvailableSongTags(tags);
        }
      })
      .catch(() => {
        /* noop */
      });
  }, [view]);

  const loadPlaylists = useCallback(async () => {
    try {
      const [playlists, adminUser] = await Promise.all([
        fetchAvailablePlaylists(),
        fetchAdminSession().catch(() => null),
      ]);
      const personal = adminUser
        ? await fetchPersonalPlaylists().catch(() => [])
        : [];
      setAvailablePlaylists(playlists);
      setCurrentAdminUser(adminUser);
      setPersonalPlaylists(personal);
      setSelectedPlaylist((prev) => {
        if (!prev) return null;
        const match = [...playlists, ...personal].find(
          (playlist) => playlist.id === prev.id && playlist.scope === prev.scope
        );
        return match ?? null;
      });
    } catch (error) {
      console.error("[ponchister] No se pudieron cargar las playlists.", error);
      setAvailablePlaylists([]);
      setPersonalPlaylists([]);
      setSelectedPlaylist(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [playlists, adminUser] = await Promise.all([
          fetchAvailablePlaylists(),
          fetchAdminSession().catch(() => null),
        ]);
        if (cancelled) return;
        setAvailablePlaylists(playlists);
        setCurrentAdminUser(adminUser);
        const personal = adminUser
          ? await fetchPersonalPlaylists().catch(() => [])
          : [];
        if (cancelled) return;
        setPersonalPlaylists(personal);
        setSelectedPlaylist((prev) => {
          if (!prev) return null;
          const match = [...playlists, ...personal].find(
            (playlist) => playlist.id === prev.id && playlist.scope === prev.scope
          );
          return match ?? null;
        });
      } catch (error) {
        console.error("[ponchister] No se pudieron cargar las playlists.", error);
        if (!cancelled) {
          setAvailablePlaylists([]);
          setPersonalPlaylists([]);
          setSelectedPlaylist(null);
          setCurrentAdminUser(null);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view !== "welcome") {
      return;
    }

    void loadPlaylists();
  }, [loadPlaylists, view]);

  const handleYearRangeChange = (range: YearRange) => {
    setYearRange((prev) => {
      const next = clampRange(range, effectiveLimits);
      if (next.min === prev.min && next.max === prev.max) {
        return prev;
      }
      return next;
    });
  };

  const handleStartAuto = ({
    source,
    playlist,
  }: {
    source: GameSource;
    playlist: PlaylistSummary | null;
  }) => {
    setGameSource(source);
    setSelectedPlaylist(playlist);
    setView("auto");
  };
  const handleOpenAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setView("admin");
  };
  const handleExitAuto = () => {
    setView("welcome");
  };
  const handleExitAdmin = () => {
    window.history.pushState({}, "", "/");
    setView("welcome");
  };

  const handleSongTagsChange = (tags: SongTag[]) => {
    setSelectedSongTags(normalizeSongTags(tags));
  };

  const handleSongTagMatchModeChange = (mode: SongTagMatchMode) => {
    setSongTagMatchMode(mode);
  };

  const handleTimerModeChange = (enabled: boolean) => {
    setTimerEnabled(enabled);
  };

  const handleMimicaModeChange = (enabled: boolean) => {
    setMimicaEnabled(enabled);
  };

  const handleTararearModeChange = (enabled: boolean) => {
    setTararearEnabled(enabled);
  };

  useEffect(() => {
    const syncView = () => {
      const params = new URLSearchParams(window.location.search);
      const mode =
        params.get("remoteMode") === "mimica" || params.get("remoteMode") === "tararear"
          ? (params.get("remoteMode") as "mimica" | "tararear")
          : null;
      const songTitle = params.get("songTitle") ?? "";
      const artist = params.get("artist") ?? "";
      const videoId = params.get("videoId") ?? "";
      const playStartSecondsParam = Number(params.get("playStartSeconds") ?? "0");

      setRemoteMode(mode);
      setRemoteSongTitle(songTitle);
      setRemoteArtist(artist);
      setRemoteVideoId(videoId);
      setRemotePlayStartSeconds(
        Number.isFinite(playStartSecondsParam)
          ? Math.max(0, Math.trunc(playStartSecondsParam))
          : 0
      );

      if (mode) {
        setView("welcome");
        return;
      }

      const isAdmin = window.location.pathname.startsWith("/admin");
      setView(isAdmin ? "admin" : "welcome");
    };

    syncView();
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  if (remoteMode) {
    return (
      <Suspense fallback={<div>Cargando control de mímica...</div>}>
        <MimicaRemoteView
          mode={remoteMode}
          songTitle={remoteSongTitle}
          artist={remoteArtist}
          videoId={remoteVideoId}
          playStartSeconds={remotePlayStartSeconds}
        />
      </Suspense>
    );
  }

  if (view === "welcome")
    return (
      <Welcome
        onStartAuto={handleStartAuto}
        onOpenAdmin={handleOpenAdmin}
        onAdminSessionRefresh={loadPlaylists}
        yearRange={normalizedYearRange}
        playlists={availablePlaylists}
        personalPlaylists={personalPlaylists}
        selectedPlaylist={selectedPlaylist}
        currentAdminUser={currentAdminUser}
      />
    );
  if (view === "auto")
    return (
      <Suspense fallback={<div>Cargando juego...</div>}>
        <AutoGame
          onExit={handleExitAuto}
          yearRange={normalizedYearRange}
          availableRange={effectiveLimits}
          availableSongTags={availableSongTags}
          onYearRangeChange={handleYearRangeChange}
          selectedSongTags={selectedSongTags}
          onSongTagsChange={handleSongTagsChange}
          songTagMatchMode={songTagMatchMode}
          onSongTagMatchModeChange={handleSongTagMatchModeChange}
          timerEnabled={timerEnabled}
          onTimerModeChange={handleTimerModeChange}
          mimicaEnabled={mimicaEnabled}
          onMimicaModeChange={handleMimicaModeChange}
          tararearEnabled={tararearEnabled}
          onTararearModeChange={handleTararearModeChange}
          gameSource={gameSource}
          playlist={selectedPlaylist}
        />
      </Suspense>
    );
  if (view === "admin")
    return (
      <Suspense fallback={<div>Cargando administración...</div>}>
        <AdminApp onExit={handleExitAdmin} />
      </Suspense>
    );
  return null;
}

export default App;
