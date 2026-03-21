export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number | null;
  youtube_url: string;
  isSpanish: boolean;
}

export interface PlaylistSummary {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  songCount: number;
}

export interface YearRange {
  min: number;
  max: number;
}
