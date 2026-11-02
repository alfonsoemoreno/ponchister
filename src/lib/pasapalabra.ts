import type { Song } from "../types";

export const ROSCO_LETTERS = [..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"];
export type RoscoLanguage = "all" | "espanol" | "ingles";
export const ROSCO_LANGUAGE_LABELS: Record<RoscoLanguage, string> = {
  all: "Todos", espanol: "Español", ingles: "Inglés",
};
const ENGLISH_LETTERS = ROSCO_LETTERS.filter(letter => letter !== "Ñ");
export function getRoscoLetters(language: RoscoLanguage): readonly string[] {
  return language === "ingles" ? ENGLISH_LETTERS : ROSCO_LETTERS;
}
export type RoscoSong = Pick<Song, "id" | "artist" | "title" | "youtube_url" | "play_start_seconds">;
export type RoscoQuestion = {
  letter: string;
  kind: "artist" | "title";
  rule: "starts" | "contains";
  song: RoscoSong;
};
export type RoscoStatus = "pending" | "correct" | "incorrect" | "unavailable";

export function normalizeRoscoAnswer(value: string): string {
  return value.trim().toLocaleUpperCase("es").normalize("NFD")
    .replace(/N\u0303/g, "Ñ").replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^A-ZÑ0-9]+/, "").replace(/\s+/g, " ");
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Resolve scarce letters first. Backtracking prevents a flexible letter from
// consuming the only available song or answer for a more constrained letter.
export function buildMixedRosco(
  songs: RoscoSong[], random = Math.random, letters: readonly string[] = ROSCO_LETTERS,
): RoscoQuestion[] {
  const videos = new Set<string>();
  const catalog = songs.filter(song => {
    const match = song.youtube_url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})(?:[?&#/]|$)/);
    if (!match || videos.has(match[1]) || !song.artist.trim() || !song.title.trim()) return false;
    videos.add(match[1]);
    return true;
  });
  // Normalize each answer once, rather than again for every letter and rule.
  const answers = new Map(catalog.map(song => [song.id, {
    artist: normalizeRoscoAnswer(song.artist), title: normalizeRoscoAnswer(song.title),
  }]));
  const offset = random() < 0.5 ? 0 : 1;
  const choices = letters.map((letter, index) => {
    const preferred = (index + offset) % 2 === 0 ? "artist" : "title";
    const candidates: RoscoQuestion[] = [];
    for (const kind of [preferred, preferred === "artist" ? "title" : "artist"] as const) {
      const starts = catalog.filter(song => answers.get(song.id)![kind].startsWith(letter));
      const manyStarts = new Set(starts.map(song => answers.get(song.id)![kind])).size >= 5;
      const contains = catalog.filter(song => answers.get(song.id)![kind].includes(letter));
      for (const rule of (manyStarts ? ["starts", "contains"] : ["contains", "starts"]) as ("starts" | "contains")[]) {
        candidates.push(...shuffled(rule === "starts" ? starts : contains, random).map(song => ({ letter, kind, rule, song })));
      }
    }
    return { letter, candidates };
  }).filter(choice => choice.candidates.length).sort((a, b) => a.candidates.length - b.candidates.length);

  const usedSongs = new Set<number>();
  const usedAnswers = new Set<string>();
  const selected: RoscoQuestion[] = [];
  let best: RoscoQuestion[] = [];
  let attempts = 0;
  function visit(index: number): boolean {
    if (selected.length > best.length) best = [...selected];
    if (index === choices.length) return true;
    if (++attempts > 20_000) return false;
    for (const question of choices[index].candidates) {
      const answer = normalizeRoscoAnswer(question.song[question.kind]);
      if (usedSongs.has(question.song.id) || usedAnswers.has(answer)) continue;
      usedSongs.add(question.song.id);
      usedAnswers.add(answer);
      selected.push(question);
      if (visit(index + 1)) return true;
      selected.pop();
      usedSongs.delete(question.song.id);
      usedAnswers.delete(answer);
    }
    return false;
  }
  visit(0);
  return best.sort((a, b) => letters.indexOf(a.letter) - letters.indexOf(b.letter));
}

export function nextPendingLetter(statuses: RoscoStatus[], current: number): number {
  for (let step = 1; step <= statuses.length; step++) {
    const index = (current + step) % statuses.length;
    if (statuses[index] === "pending") return index;
  }
  return -1;
}
