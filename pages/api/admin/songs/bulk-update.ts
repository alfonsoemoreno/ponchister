import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";
import { normalizeSongTags } from "../../../../src/lib/songTags";

const parseBody = (req: NextApiRequest): Record<string, unknown> => {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;
  if (user.role !== "superadmin") {
    return res.status(403).end("Solo un superadmin puede actualizar canciones por lote.");
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Método no permitido.");
  }

  const body = parseBody(req);
  const ids = Array.isArray(body.songIds)
    ? Array.from(new Set(body.songIds
        .map((id) => typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null)
        .filter((id): id is number => id !== null)))
    : [];
  if (!ids.length || ids.length > 200) {
    return res.status(400).end("Selecciona entre 1 y 200 canciones.");
  }

  let updated;
  if (body.operation === "add-tags") {
    const tags = normalizeSongTags(body.tags);
    if (!tags.length) return res.status(400).end("Selecciona al menos una etiqueta.");
    updated = await db.execute(sql`
      update songs
      set song_attributes = array(
            select distinct tag
            from (
              select tag from unnest(song_attributes || ${tags}::text[]) as existing(tag)
              where tag not in ('mimica', 'tarareo')
              union all
              select 'espanol' where songs.isspanish
              union all
              select 'mimica' where songs.mimica
              union all
              select 'tarareo' where songs.tararear
            ) merged
            order by tag
          ),
          isspanish = (isspanish or 'espanol' = any(song_attributes || ${tags}::text[])),
          updated_at = now()
      where id = any(${ids}::int[]) and scope = 'public'
      returning id
    `);
  } else if (body.operation === "set-mode" && (body.mode === "mimica" || body.mode === "tararear")) {
    const mimica = body.mode === "mimica";
    const tararear = body.mode === "tararear";
    updated = await db.execute(sql`
      update songs
      set mimica = ${mimica},
          tararear = ${tararear},
          song_attributes = array(
            select distinct tag from (
              select tag from unnest(song_attributes) as existing(tag)
              where tag not in ('mimica', 'tarareo')
              union all
              select 'espanol' where songs.isspanish
              union all
              select 'mimica' where ${mimica}
              union all
              select 'tarareo' where ${tararear}
            ) merged
            order by tag
          ),
          updated_at = now()
      where id = any(${ids}::int[]) and scope = 'public'
      returning id
    `);
  } else {
    return res.status(400).end("Operación de actualización inválida.");
  }

  return res.status(200).json({ ok: true, count: updated.rows.length });
}
