import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, inArray } from "drizzle-orm";
import { songs } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";

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

  if (user.role !== "superadmin") {
    res.status(403).end("Solo un superadmin puede aprobar canciones.");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const songIds = Array.isArray(body.songIds)
    ? Array.from(
        new Set(
          body.songIds
            .map((entry) =>
              typeof entry === "number" && Number.isFinite(entry)
                ? Math.trunc(entry)
                : null
            )
            .filter((entry): entry is number => entry !== null && entry > 0)
        )
      )
    : [];

  if (!songIds.length) {
    res.status(400).end("Debes seleccionar al menos una canción.");
    return;
  }

  const updated = await db
    .update(songs)
    .set({
      catalogStatus: "approved",
      approvedBy: user.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(inArray(songs.id, songIds), eq(songs.scope, "public")))
    .returning({ id: songs.id });

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, count: updated.length }));
}
