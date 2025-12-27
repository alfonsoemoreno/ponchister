export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number | null;
  youtube_url: string;
  isSpanish: boolean;
}

export interface YearRange {
  min: number;
  max: number;
}
