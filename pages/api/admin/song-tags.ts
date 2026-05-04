import type { NextApiRequest, NextApiResponse } from "next";
import { asc, eq, or } from "drizzle-orm";
import { songTags } from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";
import { slugifySongTag } from "../../../src/lib/songTags";

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

function serializeRow(row: {
  id: number;
  slug: string;
  label: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const rows = await db
      .select({
        id: songTags.id,
        slug: songTags.slug,
        label: songTags.label,
        active: songTags.active,
        created_at: songTags.createdAt,
        updated_at: songTags.updatedAt,
      })
      .from(songTags)
      .orderBy(asc(songTags.label), asc(songTags.id));

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(rows.map(serializeRow)));
    return;
  }

  if (req.method === "POST") {
    if (user.role !== "superadmin") {
      res.status(403).end("Solo un superadmin puede crear etiquetas.");
      return;
    }

    const body = parseBody(req);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const slugInput =
      typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : label;
    const slug = slugifySongTag(slugInput);

    if (!label || !slug) {
      res.status(400).end("Debes indicar un nombre válido para la etiqueta.");
      return;
    }

    const [existing] = await db
      .select({ id: songTags.id })
      .from(songTags)
      .where(or(eq(songTags.slug, slug), eq(songTags.label, label)))
      .limit(1);

    if (existing) {
      res.status(409).end("Ya existe una etiqueta con ese nombre o slug.");
      return;
    }

    const [created] = await db
      .insert(songTags)
      .values({
        slug,
        label,
        active: true,
        createdBy: user.id,
        updatedAt: new Date(),
      })
      .returning({
        id: songTags.id,
        slug: songTags.slug,
        label: songTags.label,
        active: songTags.active,
        created_at: songTags.createdAt,
        updated_at: songTags.updatedAt,
      });

    res.status(201).json(serializeRow(created));
    return;
  }

  res.status(405).end("Método no permitido.");
}
