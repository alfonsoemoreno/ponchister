import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { songs } from "../../../src/db/schema";
import { buildMixedRosco, getRoscoLetters, type RoscoLanguage } from "../../../src/lib/pasapalabra";
import { normalizeSongTags } from "../../../src/lib/songTags";
import { createRoscoCatalogCache } from "../../../src/server/pasapalabraCatalogCache";
import { checkQueueRateLimit } from "../../../src/server/queueRateLimit";
import { db } from "../_db";

const playable = () => and(
  eq(songs.scope, "public"), eq(songs.catalogStatus, "approved"),
  or(isNull(songs.youtubeStatus), eq(songs.youtubeStatus, "operational")),
);
const songFields = {
  id: songs.id, artist: songs.artist, title: songs.title,
  youtube_url: songs.youtubeUrl, play_start_seconds: songs.playStartSeconds,
};

// Only this small public metadata snapshot is cached. It is bounded to one
// entry, expires after five minutes, and shares concurrent reads. A cold
// serverless instance has its own cache; this is not a cross-instance store.
const catalogCache = createRoscoCatalogCache(async () => {
  const catalog = await db.select({
    ...songFields, tags: songs.songAttributes, isSpanish: songs.isSpanish,
  }).from(songs).where(playable());
  return catalog.map(song => ({ ...song, tags: normalizeSongTags(song.tags, song.isSpanish) }));
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end("Método no permitido.");
    return;
  }
  const language: unknown = req.body?.language ?? "all";
  if (language !== "all" && language !== "espanol" && language !== "ingles") {
    res.status(400).end("Idioma no válido.");
    return;
  }
  const selectedLanguage: RoscoLanguage = language;
  const forwarded = req.headers["x-forwarded-for"];
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkQueueRateLimit(key);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.status(429).end("Demasiadas solicitudes. Intenta nuevamente en un momento.");
    return;
  }
  try {
    // A catalog edit can invalidate a chosen answer. Refresh at most once;
    // never send a revoked/private song or loop over the database per letter.
    for (let attempt = 0; attempt < 2; attempt++) {
      const catalog = await catalogCache.get();
      const pool = selectedLanguage === "all" ? catalog : catalog.filter(song => song.tags.includes(selectedLanguage));
      const questions = buildMixedRosco(pool, Math.random, getRoscoLetters(selectedLanguage));
      if (questions.length < 10) {
        res.status(422).end("No hay suficientes canciones para este idioma. Prueba con todos los idiomas.");
        return;
      }
      // One indexed, bounded lookup for only the 26/27 selected songs. Also
      // check current language tags, so moderation/edits take effect immediately.
      const details = await db.select({
        ...songFields, tags: songs.songAttributes, isSpanish: songs.isSpanish,
      }).from(songs).where(and(playable(), inArray(songs.id, questions.map(q => q.song.id))));
      const byId = new Map(details.map(song => [song.id, song]));
      const unchanged = questions.every(({ song }) => {
        const fresh = byId.get(song.id);
        return fresh && fresh.artist === song.artist && fresh.title === song.title &&
          fresh.youtube_url === song.youtube_url &&
          (selectedLanguage === "all" || normalizeSongTags(fresh.tags, fresh.isSpanish).includes(selectedLanguage));
      });
      if (unchanged) {
        res.status(200).json({ language: selectedLanguage, questions: questions.map(question => {
          const fresh = byId.get(question.song.id)!;
          return { ...question, song: {
            id: fresh.id, artist: fresh.artist, title: fresh.title,
            youtube_url: fresh.youtube_url, play_start_seconds: fresh.play_start_seconds,
          } };
        }) });
        return;
      }
      catalogCache.invalidate();
    }
    res.status(503).end("El catálogo está cambiando. Intenta nuevamente.");
  } catch (error) {
    console.error("[pasapalabra] No se pudo crear el rosco", error);
    res.status(500).end("No se pudo preparar el rosco. Intenta nuevamente.");
  }
}
