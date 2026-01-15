import type { IncomingMessage, ServerResponse } from "node:http";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { songs } from "../../../src/db/schema.ts";
import { db } from "../_db.ts";
import { requireAdmin } from "../_admin";

const parseBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const url = new URL(req.url ?? "", "http://localhost");
    const page = Number(url.searchParams.get("page") ?? "0");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "25");
    const search = url.searchParams.get("search")?.trim() ?? "";
    const yearParam = url.searchParams.get("year");
    const year =
      typeof yearParam === "string" && yearParam !== ""
        ? Number(yearParam)
        : null;
    const sortBy =
      (url.searchParams.get("sortBy") as "id" | "artist" | "title" | "year") ??
      "id";
    const sortDirection =
      (url.searchParams.get("sortDirection") as "asc" | "desc") ?? "asc";

    const filters = [];
    if (typeof year === "number" && Number.isFinite(year)) {
      filters.push(eq(songs.year, year));
    }
    if (search) {
      const likeTerm = `%${search}%`;
      filters.push(
        or(
          ilike(songs.artist, likeTerm),
          ilike(songs.title, likeTerm),
          ilike(songs.youtubeUrl, likeTerm)
        )
      );
    }

    const whereClause = filters.length ? and(...filters) : undefined;
    const orderDirection = sortDirection === "asc" ? asc : desc;
    const orderBy = [
      orderDirection(
        sortBy === "artist"
          ? songs.artist
          : sortBy === "title"
          ? songs.title
          : sortBy === "year"
          ? songs.year
          : songs.id
      ),
    ];
    if (sortBy !== "id") {
      orderBy.push(asc(songs.id));
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(songs)
      .where(whereClause);

    const rows = await db
      .select({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        year: songs.year,
        youtube_url: songs.youtubeUrl,
        isspanish: songs.isSpanish,
      })
      .from(songs)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(page * pageSize);

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ songs: rows, total: Number(countRow?.count ?? 0) }));
    return;
  }

  if (req.method === "POST") {
    const body = await parseBody(req);
    const artist = typeof body.artist === "string" ? body.artist.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const youtubeUrl =
      typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
    const year =
      typeof body.year === "number" && Number.isFinite(body.year)
        ? body.year
        : null;
    const isSpanish = Boolean(body.isspanish);

    if (!artist || !title || !youtubeUrl) {
      res.statusCode = 400;
      res.end("Datos inválidos.");
      return;
    }

    const [created] = await db
      .insert(songs)
      .values({
        artist,
        title,
        youtubeUrl,
        year,
        isSpanish,
      })
      .returning({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        year: songs.year,
        youtube_url: songs.youtubeUrl,
        isspanish: songs.isSpanish,
      });

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(created));
    return;
  }

  res.statusCode = 405;
  res.end("Método no permitido.");
}
