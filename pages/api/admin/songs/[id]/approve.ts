import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, inArray } from "drizzle-orm";
import { adminUsers, songs } from "../../../../../src/db/schema";
import { db } from "../../../_db";
import { requireAdmin } from "../../../_admin";
import { serializeAdminIdentity } from "../../../../../src/admin/serializers";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (user.role !== "superadmin") {
    res.status(403).end("Solo un superadmin puede aprobar canciones.");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.status(400).end("ID inválido.");
    return;
  }

  const [updated] = await db
    .update(songs)
    .set({
      catalogStatus: "approved",
      approvedBy: user.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(songs.id, id), eq(songs.scope, "public")))
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
    res.status(404).end("Canción no encontrada.");
    return;
  }

  const userMap = await buildUserMap([updated.created_by, updated.approved_by]);

  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ...updated,
      youtube_validated_at: updated.youtube_validated_at?.toISOString() ?? null,
      approved_at: updated.approved_at?.toISOString() ?? null,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
      created_by_user:
        updated.created_by !== null
          ? (userMap.get(updated.created_by) ?? null)
          : null,
      approved_by_user:
        updated.approved_by !== null
          ? (userMap.get(updated.approved_by) ?? null)
          : null,
    })
  );
}
