import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
import { songs } from "../../../../../src/db/schema";
import { db } from "../../../_db";
import { requireAdmin } from "../../../_admin";
import { serializeAdminIdentity } from "../../../../../src/admin/serializers";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.statusCode = 400;
    res.end("ID inválido.");
    return;
  }

  if (req.method !== "PUT") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const status =
    body.status === "operational" ||
    body.status === "restricted" ||
    body.status === "unavailable" ||
    body.status === "invalid"
      ? body.status
      : null;

  if (!status) {
    res.statusCode = 400;
    res.end("Estado de validación inválido.");
    return;
  }

  const validatedAtValue =
    typeof body.validatedAt === "string" ? new Date(body.validatedAt) : null;

  const [updated] = await db
    .update(songs)
    .set({
      youtubeStatus: status,
      youtubeValidationMessage:
        typeof body.message === "string" ? body.message : null,
      youtubeValidationCode:
        typeof body.code === "number" && Number.isFinite(body.code)
          ? body.code
          : null,
      youtubeValidatedAt:
        validatedAtValue && !Number.isNaN(validatedAtValue.getTime())
          ? validatedAtValue
          : new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(songs.id, id),
        eq(songs.scope, "personal"),
        eq(songs.ownerUserId, user.id)
      )
    )
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
      approved_at: songs.approvedAt,
      created_at: songs.createdAt,
      updated_at: songs.updatedAt,
    });

  if (!updated) {
    res.statusCode = 404;
    res.end("Canción no encontrada.");
    return;
  }

  const owner = serializeAdminIdentity({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  });

  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ...updated,
      scope: "personal",
      youtube_validated_at: updated.youtube_validated_at?.toISOString() ?? null,
      approved_at: updated.approved_at?.toISOString() ?? null,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
      created_by_user: owner,
      approved_by_user: null,
    })
  );
}
