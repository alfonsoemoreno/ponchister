import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { db } from "../_db";
import { requireAdmin } from "../_admin";
import type { SongStatistics, SongStatisticsGroup, StatEntry } from "../../../src/admin/types";

type StatisticRow = {
  scope: "overall" | "spanish";
  kind: "metric" | "decade" | "artist" | "tag";
  label: string;
  count: number | string;
};

function normalizeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function makeStatistics(rows: StatisticRow[], scope: StatisticRow["scope"]): SongStatistics {
  const scopedRows = rows.filter((row) => row.scope === scope);
  const metric = (label: string) =>
    normalizeCount(scopedRows.find((row) => row.kind === "metric" && row.label === label)?.count);
  const entries = (kind: StatisticRow["kind"]): StatEntry[] =>
    scopedRows
      .filter((row) => row.kind === kind)
      .map((row) => ({ label: row.label, count: normalizeCount(row.count) }));

  return {
    totalSongs: metric("total"),
    missingYearCount: metric("missingYear"),
    mimicaCount: metric("mimica"),
    tararearCount: metric("tararear"),
    karaokeCount: metric("karaoke"),
    triviaCount: metric("trivia"),
    songsByDecade: entries("decade"),
    artistsMostCommon: entries("artist"),
    tagsMostCommon: entries("tag"),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Método no permitido.");
  }

  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    // Aggregate inside PostgreSQL and return only the rows needed by the charts.
    const result = await db.execute<StatisticRow>(sql`
      with base as materialized (
        select artist, year, song_attributes as tags, isspanish, mimica, tararear, karaoke, trivia
        from songs
        where scope = 'public'
      ),
      scoped as materialized (
        select 'overall'::text as scope, * from base
        union all
        select 'spanish'::text as scope, * from base where isspanish
      ),
      metrics as (
        select scope, 'total'::text as label, count(*)::int as count from scoped group by scope
        union all
        select scope, 'missingYear', count(*)::int from scoped where year is null group by scope
        union all
        select scope, 'mimica', count(*)::int from scoped where mimica group by scope
        union all
        select scope, 'tararear', count(*)::int from scoped where tararear group by scope
        union all
        select scope, 'karaoke', count(*)::int from scoped where karaoke group by scope
        union all
        select scope, 'trivia', count(*)::int from scoped where trivia group by scope
      ),
      decades as (
        select scope, (floor(year / 10.0) * 10)::int::text || 's' as label, count(*)::int as count
        from scoped where year is not null group by scope, floor(year / 10.0)
      ),
      artist_ranked as (
        select scope, coalesce(nullif(btrim(artist), ''), 'Sin artista') as label,
          count(*)::int as count,
          row_number() over (partition by scope order by count(*) desc, coalesce(nullif(btrim(artist), ''), 'Sin artista')) as rank
        from scoped group by scope, coalesce(nullif(btrim(artist), ''), 'Sin artista')
      ),
      tag_ranked as (
        select scoped.scope, tag.label, count(*)::int as count,
          row_number() over (partition by scoped.scope order by count(*) desc, tag.label) as rank
        from scoped cross join lateral unnest(scoped.tags) as tag(label)
        group by scoped.scope, tag.label
      )
      select scope, 'metric'::text as kind, label, count from metrics
      union all
      select scope, 'decade', label, count from decades
      union all
      select scope, 'artist', label, count from artist_ranked where rank <= 10
      union all
      select scope, 'tag', label, count from tag_ranked where rank <= 10
    `);

    const rows = result.rows as StatisticRow[];
    const response: SongStatisticsGroup = {
      overall: makeStatistics(rows, "overall"),
      spanish: makeStatistics(rows, "spanish"),
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("Failed to calculate song statistics", error);
    return res.status(500).json({ error: "No se pudieron cargar las estadísticas del catálogo." });
  }
}
