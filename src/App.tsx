import { useEffect, useMemo, useState } from "react";
import Welcome from "./Welcome";
import QrScanner from "./QrScanner";
import AudioPlayer from "./AudioPlayer";
import AutoGame from "./AutoGame";
import BingoGame from "./BingoGame";
import "./App.css";
import type { YearRange } from "./types";
import { fetchSongYearBounds } from "./services/songService";

const YEAR_RANGE_STORAGE_KEY = "ponchister_year_range";

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
  limits: YearRange
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

function App() {
  const [view, setView] = useState<
    "welcome" | "scan" | "audio" | "auto" | "bingo"
  >("welcome");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const fallbackRange = useMemo(() => getDefaultYearRange(), []);
  const [availableRange, setAvailableRange] = useState<YearRange | null>(null);
  const [yearRange, setYearRange] = useState<YearRange>(() =>
    readStoredYearRange()
  );

  const effectiveLimits = availableRange ?? fallbackRange;

  const normalizedYearRange = useMemo(
    () => clampRange(yearRange, effectiveLimits),
    [yearRange, effectiveLimits]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !availableRange) {
      return;
    }
    window.localStorage.setItem(
      YEAR_RANGE_STORAGE_KEY,
      JSON.stringify(normalizedYearRange)
    );
  }, [normalizedYearRange, availableRange]);

  useEffect(() => {
    let cancelled = false;

    const loadBounds = async () => {
      try {
        const bounds = await fetchSongYearBounds();
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
          error
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

  const handleYearRangeChange = (range: YearRange) => {
    setYearRange((prev) => {
      const next = clampRange(range, effectiveLimits);
      if (next.min === prev.min && next.max === prev.max) {
        return prev;
      }
      return next;
    });
  };

  const handleAccept = () => setView("scan");
  const handleScan = (url: string) => {
    setVideoUrl(url);
    setView("audio");
  };
  const handleBack = () => {
    setVideoUrl("");
    setView("scan");
  };

  const handleStartAuto = () => setView("auto");
  const handleExitAuto = () => {
    setVideoUrl("");
    setView("welcome");
  };

  const handleStartBingo = () => setView("bingo");
  const handleExitBingo = () => {
    setVideoUrl("");
    setView("welcome");
  };

  if (view === "welcome")
    return (
      <Welcome
        onAccept={handleAccept}
        onStartAuto={handleStartAuto}
        onStartBingo={handleStartBingo}
        yearRange={normalizedYearRange}
        availableRange={effectiveLimits}
        onYearRangeChange={handleYearRangeChange}
      />
    );
  if (view === "scan") return <QrScanner onScan={handleScan} />;
  if (view === "audio")
    return <AudioPlayer videoUrl={videoUrl} onBack={handleBack} />;
  if (view === "auto")
    return <AutoGame onExit={handleExitAuto} yearRange={normalizedYearRange} />;
  if (view === "bingo")
    return (
      <BingoGame onExit={handleExitBingo} yearRange={normalizedYearRange} />
    );
  return null;
}

export default App;
