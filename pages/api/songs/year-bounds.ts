import type { IncomingMessage, ServerResponse } from "node:http";
import { eq, sql } from "drizzle-orm";
import { songs } from "../../../src/db/schema";
import { db } from "../_db";
import { setPublicCatalogCache } from "../../../src/server/publicCatalogCache";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const [row] = await db
    .select({
      min: sql<number | null>`min(${songs.year})`,
      max: sql<number | null>`max(${songs.year})`,
    })
    .from(songs)
    .where(eq(songs.catalogStatus, "approved"));

  res.setHeader("Content-Type", "application/json");
  setPublicCatalogCache(res);
  res.end(
    JSON.stringify({
      min: row?.min ?? null,
      max: row?.max ?? null,
    })
  );
}
