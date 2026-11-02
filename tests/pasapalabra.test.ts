import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error Node 24 runs these TypeScript tests directly.
import { buildMixedRosco, nextPendingLetter, normalizeRoscoAnswer, ROSCO_LETTERS } from "../src/lib/pasapalabra.ts";

function song(id: number, artist: string, title: string) {
  return { id, artist, title, youtube_url: `https://www.youtube.com/watch?v=${String(id).padStart(11, "0")}`, play_start_seconds: 30 };
}
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

test("normalizes accents and punctuation while preserving Ñ and literal articles", () => {
  assert.equal(normalizeRoscoAnswer('  ¿Cómo te extraño? '), 'COMO TE EXTRAÑO?');
  assert.equal(normalizeRoscoAnswer('iñigo quintero'), 'IÑIGO QUINTERO');
  assert.equal(normalizeRoscoAnswer('The Beatles'), 'THE BEATLES');
  assert.equal(normalizeRoscoAnswer('31 minutos'), '31 MINUTOS');
});

test("builds a mixed full rosco with valid clues and no repeated songs or answers", () => {
  const catalog = ROSCO_LETTERS.filter(l => l !== "Ñ").flatMap((letter, i) =>
    Array.from({ length: 6 }, (_, j) => song(i * 6 + j + 1, `${letter} artista ${j}`, `${letter} canción ${j} niño x`)));
  for (let seed = 1; seed <= 20; seed++) {
    const rosco = buildMixedRosco(catalog, seeded(seed));
    assert.deepEqual(rosco.map(q => q.letter), ROSCO_LETTERS);
    assert.equal(new Set(rosco.map(q => q.song.id)).size, 27);
    assert.equal(new Set(rosco.map(q => normalizeRoscoAnswer(q.song[q.kind]))).size, 27);
    assert.ok(rosco.some(q => q.kind === "artist"));
    assert.ok(rosco.some(q => q.kind === "title"));
    for (const q of rosco) {
      const answer = normalizeRoscoAnswer(q.song[q.kind]);
      assert.ok(q.rule === "starts" ? answer.startsWith(q.letter) : answer.includes(q.letter));
    }
    assert.equal(rosco.find(q => q.letter === "Ñ")?.rule, "contains");
  }
});

test("rejects invalid and duplicated video sources and never reuses equivalent answers", () => {
  const a = song(1, "ÁBBA", "ABC");
  const b = song(2, "abba", "DEF");
  const rosco = buildMixedRosco([a, b, { ...song(3, "X", "Y"), youtube_url: a.youtube_url },
    { ...song(4, "Ñ", "Z"), youtube_url: "invalid" }], seeded(1));
  assert.ok(rosco.length <= 2);
  assert.equal(new Set(rosco.map(q => normalizeRoscoAnswer(q.song[q.kind]))).size, rosco.length);
  assert.ok(rosco.every(q => q.song.id === 1 || q.song.id === 2));
  assert.deepEqual(buildMixedRosco([]), []);
});

test("passes over closed letters, wraps around and ends only without pending letters", () => {
  assert.equal(nextPendingLetter(["pending", "correct", "pending"], 0), 2);
  assert.equal(nextPendingLetter(["pending", "incorrect", "unavailable"], 0), 0);
  assert.equal(nextPendingLetter(["pending", "pending", "correct"], 1), 0);
  assert.equal(nextPendingLetter(["correct", "incorrect", "unavailable"], 0), -1);
  assert.equal(nextPendingLetter([], 0), -1);
});

test("English uses 26 letters without relying on a Spanish Ñ answer", async () => {
  // @ts-expect-error Node 24 runs these TypeScript tests directly.
  const { getRoscoLetters } = await import("../src/lib/pasapalabra.ts");
  assert.equal(getRoscoLetters("ingles").length, 26);
  assert.equal(getRoscoLetters("espanol").length, 27);
  assert.equal(getRoscoLetters("all").length, 27);
  const catalog = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].flatMap((letter, i) =>
    Array.from({ length: 3 }, (_, j) => song(i * 3 + j + 1, `${letter} artist ${j}`, `${letter} song ${j}`)));
  const rosco = buildMixedRosco(catalog, seeded(1), getRoscoLetters("ingles"));
  assert.equal(rosco.length, 26);
  assert.ok(rosco.every(question => question.letter !== "Ñ"));
  assert.equal(new Set(rosco.map(question => question.song.id)).size, 26);
});
