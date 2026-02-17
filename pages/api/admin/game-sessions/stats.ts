import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";

type SeriesRow = {
  label: string;
  count: number;
};

function normalizeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    res.status(405).end("Método no permitido.");
    return;
  }

  try {
    const [totalsResult, dailyResult, monthlyResult, yearlyResult] =
      await Promise.all([
        db.execute(sql`
          select
            count(*) filter (where created_at >= date_trunc('day', now())) as today_count,
            count(*) filter (where created_at >= date_trunc('month', now())) as month_count,
            count(*) filter (where created_at >= date_trunc('year', now())) as year_count
          from game_sessions
        `),
        db.execute(sql`
          with days as (
            select generate_series(
              date_trunc('day', now()) - interval '29 day',
              date_trunc('day', now()),
              interval '1 day'
            ) as bucket
          )
          select
            to_char(days.bucket, 'YYYY-MM-DD') as label,
            coalesce(count(gs.id), 0)::int as count
          from days
          left join game_sessions gs
            on gs.created_at >= days.bucket
           and gs.created_at < days.bucket + interval '1 day'
          group by days.bucket
          order by days.bucket asc
        `),
        db.execute(sql`
          with months as (
            select generate_series(
              date_trunc('month', now()) - interval '11 month',
              date_trunc('month', now()),
              interval '1 month'
            ) as bucket
          )
          select
            to_char(months.bucket, 'YYYY-MM') as label,
            coalesce(count(gs.id), 0)::int as count
          from months
          left join game_sessions gs
            on gs.created_at >= months.bucket
           and gs.created_at < months.bucket + interval '1 month'
          group by months.bucket
          order by months.bucket asc
        `),
        db.execute(sql`
          with bounds as (
            select
              date_trunc('year', min(created_at)) as min_year,
              date_trunc('year', max(created_at)) as max_year
            from game_sessions
          ),
          years as (
            select generate_series(min_year, max_year, interval '1 year') as bucket
            from bounds
            where min_year is not null
          )
          select
            to_char(years.bucket, 'YYYY') as label,
            coalesce(count(gs.id), 0)::int as count
          from years
          left join game_sessions gs
            on gs.created_at >= years.bucket
           and gs.created_at < years.bucket + interval '1 year'
          group by years.bucket
          order by years.bucket asc
        `),
      ]);

    const totalsRow = (totalsResult.rows[0] ?? {}) as Record<string, unknown>;

    const toSeries = (rows: unknown[]): SeriesRow[] =>
      rows.map((row) => {
        const safeRow = row as Record<string, unknown>;
        return {
          label: String(safeRow.label ?? ""),
          count: normalizeCount(safeRow.count),
        };
      });

    res.status(200).json({
      todayCount: normalizeCount(totalsRow.today_count),
      currentMonthCount: normalizeCount(totalsRow.month_count),
      currentYearCount: normalizeCount(totalsRow.year_count),
      daily: toSeries(dailyResult.rows),
      monthly: toSeries(monthlyResult.rows),
      yearly: toSeries(yearlyResult.rows),
    });
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;

    if (code === "42P01") {
      res.status(200).json({
        todayCount: 0,
        currentMonthCount: 0,
        currentYearCount: 0,
        daily: [],
        monthly: [],
        yearly: [],
      });
      return;
    }

    console.error("Failed to load game session stats:", error);
    res.status(500).end("No se pudieron obtener las estadísticas de partidas.");
  }
}
