export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number | null;
  youtube_url: string;
  isspanish: boolean;
}

export interface SongInput {
  artist: string;
  title: string;
  year: number | null;
  youtube_url: string;
  isspanish: boolean;
}

export interface StatEntry {
  label: string;
  count: number;
}

export interface SongStatistics {
  totalSongs: number;
  missingYearCount: number;
  yearsMostCommon: StatEntry[];
  yearsLeastCommon: StatEntry[];
  decadesLeastCommon: StatEntry[];
  artistsMostCommon: StatEntry[];
}

export interface SongStatisticsGroup {
  overall: SongStatistics;
  spanish: SongStatistics;
}

export interface GameSessionSeriesEntry {
  label: string;
  count: number;
}

export interface GameSessionStatistics {
  todayCount: number;
  currentMonthCount: number;
  currentYearCount: number;
  daily: GameSessionSeriesEntry[];
  monthly: GameSessionSeriesEntry[];
  yearly: GameSessionSeriesEntry[];
}

export type AdminRole = "superadmin" | "editor";

export interface AdminUser {
  id: number;
  email: string;
  role: AdminRole;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}
