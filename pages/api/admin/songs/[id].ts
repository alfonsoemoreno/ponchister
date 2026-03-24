import type { NextApiRequest, NextApiResponse } from "next";
import { eq, inArray } from "drizzle-orm";
import { adminUsers, songs } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";
import { serializeAdminIdentity } from "../../../../src/admin/serializers";

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
    youtube_url: string;
    isspanish: boolean;
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

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.statusCode = 400;
    res.end("ID inválido.");
    return;
  }

  if (req.method === "PUT") {
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

    const [currentSong] = await db
      .select({
        youtubeUrl: songs.youtubeUrl,
        catalogStatus: songs.catalogStatus,
        scope: songs.scope,
      })
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    if (!artist || !title || !youtubeUrl) {
      res.statusCode = 400;
      res.end("Datos inválidos.");
      return;
    }

    if (!currentSong) {
      res.statusCode = 404;
      res.end("Canción no encontrada.");
      return;
    }
    if (currentSong.scope !== "public") {
      res.statusCode = 404;
      res.end("Canción no encontrada.");
      return;
    }

    const youtubeChanged = currentSong.youtubeUrl !== youtubeUrl;

    const [updated] = await db
      .update(songs)
      .set({
        artist,
        title,
        youtubeUrl,
        year,
        isSpanish,
        youtubeStatus: youtubeChanged
          ? youtubeValidation?.youtubeStatus ?? null
          : youtubeValidation?.youtubeStatus ?? undefined,
        youtubeValidationMessage: youtubeChanged
          ? youtubeValidation?.youtubeValidationMessage ?? null
          : youtubeValidation?.youtubeValidationMessage ?? undefined,
        youtubeValidationCode: youtubeChanged
          ? youtubeValidation?.youtubeValidationCode ?? null
          : youtubeValidation?.youtubeValidationCode ?? undefined,
        youtubeValidatedAt: youtubeChanged
          ? youtubeValidation?.youtubeValidatedAt ?? null
          : youtubeValidation?.youtubeValidatedAt ?? undefined,
        catalogStatus:
          user.role === "superadmin" ? currentSong.catalogStatus : "pending",
        approvedBy: user.role === "superadmin" ? undefined : null,
        approvedAt: user.role === "superadmin" ? undefined : null,
        updatedAt: new Date(),
      })
      .where(eq(songs.id, id))
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
        catalog_status: songs.catalogStatus,
        created_by: songs.createdBy,
        approved_by: songs.approvedBy,
        approved_at: songs.approvedAt,
        created_at: songs.createdAt,
        updated_at: songs.updatedAt,
      });

    if (!updated) {
      res.statusCode = 404;
      res.end("Canción no encontrada.");
      return;
    }

    const userMap = await buildUserMap([updated.created_by, updated.approved_by]);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(serializeSong(updated, userMap)));
    return;
  }

  if (req.method === "DELETE") {
    const [existing] = await db
      .select({ catalogStatus: songs.catalogStatus, scope: songs.scope })
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    if (!existing) {
      res.statusCode = 404;
      res.end("Canción no encontrada.");
      return;
    }

    if (existing.scope !== "public") {
      res.statusCode = 404;
      res.end("Canción no encontrada.");
      return;
    }

    if (user.role !== "superadmin" && existing.catalogStatus === "approved") {
      res.statusCode = 403;
      res.end("Los editores no pueden eliminar canciones del catálogo oficial.");
      return;
    }

    await db.delete(songs).where(eq(songs.id, id));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 405;
  res.end("Método no permitido.");
}
