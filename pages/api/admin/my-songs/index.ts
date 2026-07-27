import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { songs } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";
import { serializeAdminIdentity } from "../../../../src/admin/serializers";
import {
  isSpanishTagSelected,
  normalizeSongTags,
  syncSongModeTags,
} from "../../../../src/lib/songTags";

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
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const status =
    value.status === "operational" ||
    value.status === "restricted" ||
    value.status === "unavailable" ||
    value.status === "invalid"
      ? value.status
      : null;
  if (!status) return null;
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

function serializeSong(
  row: {
    id: number;
    artist: string;
    title: string;
    year: number | null;
    play_start_seconds: number;
    youtube_url: string;
    tags: string[];
    isspanish: boolean;
    mimica: boolean;
    tararear: boolean;
    karaoke: boolean;
    karaoke_pause_seconds: number;
    karaoke_lyric: string | null;
    trivia: boolean;
    trivia_question: string | null;
    trivia_answer: string | null;
    youtube_status: string | null;
    youtube_validation_message: string | null;
    youtube_validation_code: number | null;
    youtube_validated_at: Date | null;
    catalog_status: string;
    created_at: Date;
    updated_at: Date;
    approved_at: Date | null;
  },
  owner: ReturnType<typeof serializeAdminIdentity>
) {
  return {
    ...row,
    scope: "personal",
    youtube_validated_at: row.youtube_validated_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    approved_at: row.approved_at?.toISOString() ?? null,
    created_by_user: owner,
    approved_by_user: null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const owner = serializeAdminIdentity({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  });

  if (req.method === "GET") {
    const url = new URL(req.url ?? "", "http://localhost");
    const requestedPage = Number(url.searchParams.get("page") ?? "0");
    const requestedPageSize = Number(url.searchParams.get("pageSize") ?? "50");
    const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
    const pageSize =
      Number.isInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 2_000)
        : 50;
    const search = url.searchParams.get("search")?.trim() ?? "";
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : null;
    const tags = normalizeSongTags(url.searchParams.get("tags"));
    const specialMode =
      url.searchParams.get("specialMode") === "mimica" ||
      url.searchParams.get("specialMode") === "tararear" ||
      url.searchParams.get("specialMode") === "karaoke" ||
      url.searchParams.get("specialMode") === "trivia"
        ? url.searchParams.get("specialMode")
        : null;
    const sortBy =
      (url.searchParams.get("sortBy") as "id" | "artist" | "title" | "year") ??
      "artist";
    const sortDirection =
      (url.searchParams.get("sortDirection") as "asc" | "desc") ?? "asc";
    const filters = [
      eq(songs.scope, "personal"),
      eq(songs.ownerUserId, user.id),
    ];

    if (typeof year === "number" && Number.isFinite(year)) {
      filters.push(eq(songs.year, year));
    }
    if (tags.length) {
      filters.push(
        sql`${songs.songAttributes} @> ARRAY[${sql.join(
          tags.map((tag) => sql`${tag}`),
          sql.raw(", ")
        )}]::text[]`
      );
    }
    if (specialMode === "mimica") filters.push(eq(songs.mimica, true));
    if (specialMode === "tararear") filters.push(eq(songs.tararear, true));
    if (specialMode === "karaoke") filters.push(eq(songs.karaoke, true));
    if (specialMode === "trivia") filters.push(eq(songs.trivia, true));

    if (search) {
      const likeTerm = `%${search}%`;
      const searchFilter = or(
        ilike(songs.artist, likeTerm),
        ilike(songs.title, likeTerm),
        ilike(songs.youtubeUrl, likeTerm)
      );
      if (searchFilter) filters.push(searchFilter);
    }

    const whereClause = and(...filters);
    const orderDirection = sortDirection === "desc" ? desc : asc;
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
    if (sortBy !== "id") orderBy.push(asc(songs.id));
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
        play_start_seconds: songs.playStartSeconds,
        youtube_url: songs.youtubeUrl,
        tags: songs.songAttributes,
        isspanish: songs.isSpanish,
        mimica: songs.mimica,
        tararear: songs.tararear,
        karaoke: songs.karaoke,
        karaoke_pause_seconds: songs.karaokePauseSeconds,
        // The lyric and trivia text can be very large. They are only needed
        // when a song is opened for editing, so do not transfer them with a list.
        karaoke_lyric: sql<string | null>`null`,
        trivia: songs.trivia,
        trivia_question: sql<string | null>`null`,
        trivia_answer: sql<string | null>`null`,
        youtube_status: songs.youtubeStatus,
        youtube_validation_message: songs.youtubeValidationMessage,
        youtube_validation_code: songs.youtubeValidationCode,
        youtube_validated_at: songs.youtubeValidatedAt,
        catalog_status: songs.catalogStatus,
        created_at: songs.createdAt,
        updated_at: songs.updatedAt,
        approved_at: songs.approvedAt,
      })
      .from(songs)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(page * pageSize);

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        songs: rows.map((row) => serializeSong(row, owner)),
        total: Number(countRow?.count ?? 0),
      })
    );
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
    const playStartSeconds =
      typeof body.play_start_seconds === "number" &&
      Number.isFinite(body.play_start_seconds)
        ? Math.max(0, Math.trunc(body.play_start_seconds))
        : 0;
    const mimica = body.mimica === true;
    const tararear = body.tararear === true;
    const karaoke = body.karaoke === true;
    const karaokePauseSeconds =
      karaoke &&
      typeof body.karaoke_pause_seconds === "number" &&
      Number.isFinite(body.karaoke_pause_seconds)
        ? Math.max(0, Math.trunc(body.karaoke_pause_seconds))
        : 0;
    const karaokeLyric =
      karaoke && typeof body.karaoke_lyric === "string"
        ? body.karaoke_lyric.trim() || null
        : null;
    const trivia = body.trivia === true;
    const triviaQuestion =
      trivia && typeof body.trivia_question === "string"
        ? body.trivia_question.trim() || null
        : null;
    const triviaAnswer =
      trivia && typeof body.trivia_answer === "string"
        ? body.trivia_answer.trim() || null
        : null;
    const tags = syncSongModeTags(normalizeSongTags(body.tags, body.isspanish), {
      mimica,
      tararear,
    });
    const isSpanish = isSpanishTagSelected(tags);
    const youtubeValidation = parseYoutubeValidation(body);

    if (!artist || !title || !youtubeUrl) {
      res.status(400).end("Datos inválidos.");
      return;
    }

    const [created] = await db
      .insert(songs)
      .values({
        artist,
        title,
        youtubeUrl,
        year,
        playStartSeconds,
        songAttributes: tags,
        isSpanish,
        mimica,
        tararear,
        karaoke,
        karaokePauseSeconds,
        karaokeLyric,
        trivia,
        triviaQuestion,
        triviaAnswer,
        scope: "personal",
        ownerUserId: user.id,
        catalogStatus: "approved",
        createdBy: user.id,
        youtubeStatus: youtubeValidation?.youtubeStatus ?? null,
        youtubeValidationMessage:
          youtubeValidation?.youtubeValidationMessage ?? null,
        youtubeValidationCode: youtubeValidation?.youtubeValidationCode ?? null,
        youtubeValidatedAt: youtubeValidation?.youtubeValidatedAt ?? null,
        updatedAt: new Date(),
      })
      .returning({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        year: songs.year,
        play_start_seconds: songs.playStartSeconds,
        youtube_url: songs.youtubeUrl,
        tags: songs.songAttributes,
        isspanish: songs.isSpanish,
        mimica: songs.mimica,
        tararear: songs.tararear,
        karaoke: songs.karaoke,
        karaoke_pause_seconds: songs.karaokePauseSeconds,
        karaoke_lyric: songs.karaokeLyric,
        trivia: songs.trivia,
        trivia_question: songs.triviaQuestion,
        trivia_answer: songs.triviaAnswer,
        youtube_status: songs.youtubeStatus,
        youtube_validation_message: songs.youtubeValidationMessage,
        youtube_validation_code: songs.youtubeValidationCode,
        youtube_validated_at: songs.youtubeValidatedAt,
        catalog_status: songs.catalogStatus,
        created_at: songs.createdAt,
        updated_at: songs.updatedAt,
        approved_at: songs.approvedAt,
      });

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(serializeSong(created, owner)));
    return;
  }

  res.status(405).end("Método no permitido.");
}
