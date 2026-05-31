import type { SongTag } from "./lib/songTags";

export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number | null;
  play_start_seconds: number;
  youtube_url: string;
  tags: SongTag[];
  isSpanish: boolean;
  mimica: boolean;
  tararear: boolean;
  karaoke: boolean;
  karaoke_pause_seconds: number;
  karaoke_lyric: string | null;
  trivia: boolean;
  trivia_question: string | null;
  trivia_answer: string | null;
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
