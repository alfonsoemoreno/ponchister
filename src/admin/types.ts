export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number | null;
  youtube_url: string;
  isspanish: boolean;
  youtube_status: YoutubeValidationStatus | null;
  youtube_validation_message: string | null;
  youtube_validation_code: number | null;
  youtube_validated_at: string | null;
}

export interface SongInput {
  artist: string;
  title: string;
  year: number | null;
  youtube_url: string;
  isspanish: boolean;
}

export interface SongDuplicateMatch extends Song {
  similarity: number;
  matchLabel: "high" | "medium";
  reason: string;
}

export type YoutubeValidationStatus =
  | "unchecked"
  | "checking"
  | "operational"
  | "restricted"
  | "unavailable"
  | "invalid";

export interface YoutubeValidationResult {
  status: YoutubeValidationStatus;
  message: string;
  code: number | null;
  videoId: string | null;
}

export interface SongYoutubeValidationPayload {
  status: Exclude<YoutubeValidationStatus, "checking" | "unchecked">;
  message: string;
  code: number | null;
  validatedAt: string;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  songCount: number;
  songs?: Song[];
}

export interface PlaylistInput {
  name: string;
  description: string | null;
  active: boolean;
  songIds: number[];
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
