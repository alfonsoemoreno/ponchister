import type { IncomingMessage, ServerResponse } from "node:http";
import { asc, eq } from "drizzle-orm";
import { songTags } from "../../src/db/schema";
import { db } from "./_db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

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
    .where(eq(songTags.active, true))
    .orderBy(asc(songTags.label), asc(songTags.id));

  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify(
      rows.map((row) => ({
        ...row,
        created_at: row.created_at?.toISOString() ?? null,
        updated_at: row.updated_at?.toISOString() ?? null,
      }))
    )
  );
}
