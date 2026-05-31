import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { adminUsers, songs } from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";
import { serializeAdminIdentity } from "../../../src/admin/serializers";
import {
  isSpanishTagSelected,
  normalizeSongTags,
  syncSongModeTags,
} from "../../../src/lib/songTags";

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

async function buildUserMap(userIds: Array<number | null | undefined>) {
  const ids = Array.from(
    new Set(
      userIds.filter(
        (entry): entry is number => typeof entry === "number" && Number.isFinite(entry)
      )
    )
  );

  if (!ids.length) {
    return new Map<number, ReturnType<typeof serializeAdminIdentity>>();
  }

  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      avatarUrl: adminUsers.avatarUrl,
    })
    .from(adminUsers)
    .where(inArray(adminUsers.id, ids));

  return new Map(
    rows.map((entry) => [
      entry.id,
      serializeAdminIdentity({
        id: entry.id,
        email: entry.email,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
      }),
    ])
  );
}

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
    created_by: number | null;
    approved_by: number | null;
    approved_at: Date | null;
    created_at: Date;
    updated_at: Date;
  },
  userMap: Map<number, ReturnType<typeof serializeAdminIdentity>>
) {
  return {
    ...row,
    youtube_validated_at: row.youtube_validated_at?.toISOString() ?? null,
    approved_at: row.approved_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    created_by_user:
      row.created_by !== null ? (userMap.get(row.created_by) ?? null) : null,
    approved_by_user:
      row.approved_by !== null ? (userMap.get(row.approved_by) ?? null) : null,
  };
}

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
    const tags = normalizeSongTags(url.searchParams.get("tags"));
    const catalogStatus =
      url.searchParams.get("catalogStatus") === "approved"
        ? "approved"
        : url.searchParams.get("catalogStatus") === "pending"
        ? "pending"
        : null;
    const specialMode =
      url.searchParams.get("specialMode") === "mimica" ||
      url.searchParams.get("specialMode") === "tararear" ||
      url.searchParams.get("specialMode") === "karaoke" ||
      url.searchParams.get("specialMode") === "trivia"
        ? url.searchParams.get("specialMode")
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
    filters.push(eq(songs.scope, "public"));
    if (catalogStatus) {
      filters.push(eq(songs.catalogStatus, catalogStatus));
    }
    if (specialMode === "mimica") {
      filters.push(eq(songs.mimica, true));
    } else if (specialMode === "tararear") {
      filters.push(eq(songs.tararear, true));
    } else if (specialMode === "karaoke") {
      filters.push(eq(songs.karaoke, true));
    } else if (specialMode === "trivia") {
      filters.push(eq(songs.trivia, true));
    }
    if (tags.length) {
      filters.push(
        sql`${songs.songAttributes} @> ARRAY[${sql.join(
          tags.map((tag) => sql`${tag}`),
          sql.raw(", ")
        )}]::text[]`
      );
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
        created_by: songs.createdBy,
        approved_by: songs.approvedBy,
        approved_at: songs.approvedAt,
        created_at: songs.createdAt,
        updated_at: songs.updatedAt,
      })
      .from(songs)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(page * pageSize);

    const userMap = await buildUserMap(
      rows.flatMap((entry) => [entry.created_by, entry.approved_by])
    );

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        songs: rows.map((entry) => serializeSong(entry, userMap)),
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
        youtubeStatus: youtubeValidation?.youtubeStatus ?? null,
        youtubeValidationMessage:
          youtubeValidation?.youtubeValidationMessage ?? null,
        youtubeValidationCode: youtubeValidation?.youtubeValidationCode ?? null,
        youtubeValidatedAt: youtubeValidation?.youtubeValidatedAt ?? null,
        scope: "public",
        catalogStatus: user.role === "superadmin" ? "approved" : "pending",
        createdBy: user.id,
        approvedBy: user.role === "superadmin" ? user.id : null,
        approvedAt: user.role === "superadmin" ? new Date() : null,
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
        created_by: songs.createdBy,
        approved_by: songs.approvedBy,
        approved_at: songs.approvedAt,
        created_at: songs.createdAt,
        updated_at: songs.updatedAt,
      });

    const userMap = await buildUserMap([created.created_by, created.approved_by]);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(serializeSong(created, userMap)));
    return;
  }

  res.statusCode = 405;
  res.end("Método no permitido.");
}
