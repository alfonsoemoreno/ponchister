import type { IncomingMessage, ServerResponse } from "node:http";
import { sql } from "drizzle-orm";
import { songs } from "../../src/db/schema.ts";
import { db } from "../_db.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const [row] = await db.select({
    min: sql<number | null>`min(${songs.year})`,
    max: sql<number | null>`max(${songs.year})`,
  }).from(songs);

  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      min: row?.min ?? null,
      max: row?.max ?? null,
    })
  );
}
