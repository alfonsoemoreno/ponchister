export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number | null;
  youtube_url: string;
  isSpanish: boolean;
}

export type PlaylistScope = "public" | "personal";
export type GameSource =
  | "classic"
  | "public_playlist"
  | "personal_catalog"
  | "personal_playlist";

export interface PlaylistSummary {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  songCount: number;
  scope: PlaylistScope;
}

export interface YearRange {
  min: number;
  max: number;
}
