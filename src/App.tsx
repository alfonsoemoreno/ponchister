import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Welcome from "./Welcome";
const AutoGame = lazy(() => import("./AutoGame"));
const AdminApp = lazy(() => import("./admin/AdminApp"));
import "./App.css";
import type { GameSource, PlaylistSummary, YearRange } from "./types";
import { fetchSongYearBounds } from "./services/songService";
import {
  fetchAvailablePlaylists,
  fetchPersonalPlaylists,
} from "./services/playlistService";
import { fetchAdminSession } from "./admin/services/adminAuth";
import type { AdminUser } from "./admin/types";

const YEAR_RANGE_STORAGE_KEY = "ponchister_year_range";
const LANGUAGE_FILTER_STORAGE_KEY = "ponchister_language_filter";
const TIMER_ENABLED_STORAGE_KEY = "ponchister_timer_enabled";
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

const readStoredLanguageMode = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const stored = window.localStorage.getItem(LANGUAGE_FILTER_STORAGE_KEY);
    if (stored === null) return false;
    return stored === "true";
  } catch {
    return false;
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
  const fallbackRange = useMemo(() => getDefaultYearRange(), []);
  const [availableRange, setAvailableRange] = useState<YearRange | null>(null);
  const [yearRange, setYearRange] = useState<YearRange>(() =>
    readStoredYearRange(),
  );
  const [onlySpanish, setOnlySpanish] = useState<boolean>(() =>
    readStoredLanguageMode(),
  );
  const [timerEnabled, setTimerEnabled] = useState<boolean>(() =>
    readStoredTimerEnabled(),
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
      LANGUAGE_FILTER_STORAGE_KEY,
      onlySpanish ? "true" : "false",
    );
  }, [onlySpanish]);

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

  const handleLanguageModeChange = (spanishOnly: boolean) => {
    setOnlySpanish(spanishOnly);
  };

  const handleTimerModeChange = (enabled: boolean) => {
    setTimerEnabled(enabled);
  };

  useEffect(() => {
    const syncView = () => {
      const isAdmin = window.location.pathname.startsWith("/admin");
      setView(isAdmin ? "admin" : "welcome");
    };

    syncView();
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

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
          onYearRangeChange={handleYearRangeChange}
          onlySpanish={onlySpanish}
          onLanguageModeChange={handleLanguageModeChange}
          timerEnabled={timerEnabled}
          onTimerModeChange={handleTimerModeChange}
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
