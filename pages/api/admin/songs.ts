import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { songs } from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";

const parseBody = (req: NextApiRequest): Record<string, unknown> => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") return req.body as Record<string, unknown>;
  return {};
};

const parseYoutubeValidation = (body: Record<string, unknown>) => {
  const raw = body.youtubeValidation;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const status =
    value.status === "operational" ||
    value.status === "restricted" ||
    value.status === "unavailable" ||
    value.status === "invalid"
      ? value.status
      : null;

  if (!status) {
    return null;
  }

  const validatedAtValue =
    typeof value.validatedAt === "string" ? new Date(value.validatedAt) : null;

  return {
    youtubeStatus: status,
    youtubeValidationMessage:
      typeof value.message === "string" ? value.message : null,
    youtubeValidationCode:
      typeof value.code === "number" && Number.isFinite(value.code)
        ? value.code
        : null,
    youtubeValidatedAt:
      validatedAtValue && !Number.isNaN(validatedAtValue.getTime())
        ? validatedAtValue
        : new Date(),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
        youtube_status: songs.youtubeStatus,
        youtube_validation_message: songs.youtubeValidationMessage,
        youtube_validation_code: songs.youtubeValidationCode,
        youtube_validated_at: songs.youtubeValidatedAt,
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
    const body = parseBody(req);
    const artist = typeof body.artist === "string" ? body.artist.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const youtubeUrl =
      typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
    const year =
      typeof body.year === "number" && Number.isFinite(body.year)
        ? body.year
        : null;
    const isSpanish = Boolean(body.isspanish);
    const youtubeValidation = parseYoutubeValidation(body);

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
        youtubeStatus: youtubeValidation?.youtubeStatus ?? null,
        youtubeValidationMessage:
          youtubeValidation?.youtubeValidationMessage ?? null,
        youtubeValidationCode: youtubeValidation?.youtubeValidationCode ?? null,
        youtubeValidatedAt: youtubeValidation?.youtubeValidatedAt ?? null,
      })
      .returning({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        year: songs.year,
        youtube_url: songs.youtubeUrl,
        isspanish: songs.isSpanish,
        youtube_status: songs.youtubeStatus,
        youtube_validation_message: songs.youtubeValidationMessage,
        youtube_validation_code: songs.youtubeValidationCode,
        youtube_validated_at: songs.youtubeValidatedAt,
      });

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(created));
    return;
  }

  res.statusCode = 405;
  res.end("Método no permitido.");
}
