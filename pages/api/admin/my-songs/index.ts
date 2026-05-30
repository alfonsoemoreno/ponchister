import type { NextApiRequest, NextApiResponse } from "next";
import { and, asc, eq } from "drizzle-orm";
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
      .where(and(eq(songs.scope, "personal"), eq(songs.ownerUserId, user.id)))
      .orderBy(asc(songs.artist), asc(songs.title), asc(songs.id));

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(rows.map((row) => serializeSong(row, owner))));
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
