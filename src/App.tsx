import { useEffect, useMemo, useState } from "react";
import Welcome from "./Welcome";
import QrScanner from "./QrScanner";
import AudioPlayer from "./AudioPlayer";
import AutoGame from "./AutoGame";
import BingoGame from "./BingoGame";
import "./App.css";
import type { YearRange } from "./types";

const MIN_AVAILABLE_YEAR = 1950;
const YEAR_RANGE_STORAGE_KEY = "ponchister_year_range";

const getDefaultYearRange = (): YearRange => ({
  min: MIN_AVAILABLE_YEAR,
  max: new Date().getFullYear(),
});

const sanitizeYear = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.trunc(value);
};

const sanitizeRange = (range: YearRange): YearRange => {
  const defaultRange = getDefaultYearRange();
  const min = Math.max(
    MIN_AVAILABLE_YEAR,
    Math.min(defaultRange.max, sanitizeYear(range.min, defaultRange.min))
  );
  const max = Math.max(
    min,
    Math.min(defaultRange.max, sanitizeYear(range.max, defaultRange.max))
  );
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
    const candidate: YearRange = {
      min:
        typeof parsed.min === "number" ? parsed.min : getDefaultYearRange().min,
      max:
        typeof parsed.max === "number" ? parsed.max : getDefaultYearRange().max,
    };
    return sanitizeRange(candidate);
  } catch {
    return getDefaultYearRange();
  }
};

function App() {
  const [view, setView] = useState<
    "welcome" | "scan" | "audio" | "auto" | "bingo"
  >("welcome");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [yearRange, setYearRange] = useState<YearRange>(() =>
    readStoredYearRange()
  );

  const normalizedYearRange = useMemo(
    () => sanitizeRange(yearRange),
    [yearRange]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      YEAR_RANGE_STORAGE_KEY,
      JSON.stringify(normalizedYearRange)
    );
  }, [normalizedYearRange]);

  const handleYearRangeChange = (range: YearRange) => {
    setYearRange(sanitizeRange(range));
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
