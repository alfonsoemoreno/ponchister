import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";

type StatisticsRow = {
  kind: string;
  label: string | null;
  country_code?: string | null;
  count: number | string;
  today_count?: number | string;
  month_count?: number | string;
  year_count?: number | string;
};

function normalizeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function hasCountryDetection(req: NextApiRequest): boolean {
  const value = req.headers["x-vercel-ip-country"];
  const countryCode = (Array.isArray(value) ? value[0] : value)?.trim().toUpperCase();
  return Boolean(countryCode && /^[A-Z]{2}$/.test(countryCode));
}

function hasMissingColumnError(error: unknown, columnName: string): boolean {
  let candidate: unknown = error;
  while (candidate && typeof candidate === "object") {
    const current = candidate as { code?: unknown; message?: unknown; cause?: unknown };
    if (
      current.code === "42703" &&
      typeof current.message === "string" &&
      current.message.toLowerCase().includes(`column "${columnName.toLowerCase()}"`)
    ) {
      return true;
    }
    candidate = current.cause;
  }
  return false;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end("Método no permitido.");
    return;
  }

  try {
    // Materialize the bounded date range once, then derive all metrics from it.
    // The admin UI only displays the last 30 days and 12 months.
    const result = await db.execute<StatisticsRow>(sql`
      with recent_sessions as materialized (
        select created_at, country_code,
          to_jsonb(session)->>'city' as city,
          to_jsonb(session)->>'region' as region,
          (to_jsonb(session)->>'latitude')::double precision as latitude,
          (to_jsonb(session)->>'longitude')::double precision as longitude
        from game_sessions session
        where created_at >= date_trunc('month', now()) - interval '11 months'
      ),
      totals as (
        select
          count(*) filter (where created_at >= date_trunc('day', now()))::int as today_count,
          count(*) filter (where created_at >= date_trunc('month', now()))::int as month_count,
          count(*) filter (where created_at >= date_trunc('year', now()))::int as year_count
        from recent_sessions
      ),
      daily as (
        select date_trunc('day', created_at) as bucket, count(*)::int as count
        from recent_sessions
        where created_at >= date_trunc('day', now()) - interval '29 days'
        group by 1
      ),
      daily_series as (
        select generate_series(
          date_trunc('day', now()) - interval '29 days',
          date_trunc('day', now()), interval '1 day'
        ) as bucket
      ),
      monthly as (
        select date_trunc('month', created_at) as bucket, count(*)::int as count
        from recent_sessions
        group by 1
      ),
      monthly_series as (
        select generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()), interval '1 month'
        ) as bucket
      ),
      countries as (
        select country_code, count(*)::int as count
        from recent_sessions
        where country_code is not null
        group by country_code
      ),
      cities as (
        select country_code, city, region, count(*)::int as count,
          avg(latitude) filter (where latitude between -90 and 90 and longitude between -180 and 180) as latitude,
          avg(longitude) filter (where latitude between -90 and 90 and longitude between -180 and 180) as longitude
        from recent_sessions
        where country_code is not null and nullif(trim(city), '') is not null
        group by country_code, city, region
      ),
      output as (
        select 'totals'::text as kind, null::text as label,
          0::int as count, today_count, month_count, year_count from totals
        union all
        select 'daily', to_char(series.bucket, 'YYYY-MM-DD'), coalesce(daily.count, 0), null::int, null::int, null::int
        from daily_series series left join daily using (bucket)
        union all
        select 'monthly', to_char(series.bucket, 'YYYY-MM'), coalesce(monthly.count, 0), null::int, null::int, null::int
        from monthly_series series left join monthly using (bucket)
        union all
        select 'country', country_code, count, null::int, null::int, null::int
        from countries
        union all
        select 'city', json_build_object(
          'countryCode', country_code, 'city', city, 'region', region,
          'latitude', latitude, 'longitude', longitude
        )::text, count, null::int, null::int, null::int
        from cities
      )
      select * from output order by kind, label nulls first
    `);

    const rows = result.rows as StatisticsRow[];
    const totals = rows.find((row) => row.kind === "totals");
    const toSeries = (kind: "daily" | "monthly") =>
      rows
        .filter((row) => row.kind === kind)
        .map((row) => ({ label: row.label ?? "", count: normalizeCount(row.count) }));
    const countries = rows
      .filter((row) => row.kind === "country" && row.label)
      .map((row) => ({ countryCode: row.label as string, count: normalizeCount(row.count) }))
      .sort((a, b) => b.count - a.count);

    res.status(200).json({
      todayCount: normalizeCount(totals?.today_count),
      currentMonthCount: normalizeCount(totals?.month_count),
      currentYearCount: normalizeCount(totals?.year_count),
      daily: toSeries("daily"),
      monthly: toSeries("monthly"),
      countries,
      cities: rows.filter((row) => row.kind === "city" && row.label).map((row) => ({
        ...JSON.parse(row.label as string), count: normalizeCount(row.count),
      })),
      locationPeriodMonths: 12,
      locationDetectionAvailable: hasCountryDetection(req),
    });
  } catch (error) {
    if (hasMissingColumnError(error, "country_code")) {
      // Keep existing installations usable until migration 0008 is applied.
      const legacyResult = await db.execute<StatisticsRow>(sql`
        with recent_sessions as materialized (
          select created_at
          from game_sessions
          where created_at >= date_trunc('month', now()) - interval '11 months'
        ),
        totals as (
          select
            count(*) filter (where created_at >= date_trunc('day', now()))::int as today_count,
            count(*) filter (where created_at >= date_trunc('month', now()))::int as month_count,
            count(*) filter (where created_at >= date_trunc('year', now()))::int as year_count
          from recent_sessions
        ),
        daily as (
          select date_trunc('day', created_at) as bucket, count(*)::int as count
          from recent_sessions
          where created_at >= date_trunc('day', now()) - interval '29 days'
          group by 1
        ),
        daily_series as (
          select generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') as bucket
        ),
        monthly as (
          select date_trunc('month', created_at) as bucket, count(*)::int as count
          from recent_sessions group by 1
        ),
        monthly_series as (
          select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as bucket
        ),
        output as (
          select 'totals'::text as kind, null::text as label, 0::int as count, today_count, month_count, year_count from totals
          union all
          select 'daily', to_char(series.bucket, 'YYYY-MM-DD'), coalesce(daily.count, 0), null::int, null::int, null::int from daily_series series left join daily using (bucket)
          union all
          select 'monthly', to_char(series.bucket, 'YYYY-MM'), coalesce(monthly.count, 0), null::int, null::int, null::int from monthly_series series left join monthly using (bucket)
        )
        select * from output order by kind, label nulls first
      `);
      const legacyRows = legacyResult.rows as StatisticsRow[];
      const legacyTotals = legacyRows.find((row) => row.kind === "totals");
      const legacySeries = (kind: "daily" | "monthly") => legacyRows
        .filter((row) => row.kind === kind)
        .map((row) => ({ label: row.label ?? "", count: normalizeCount(row.count) }));
      res.status(200).json({
        todayCount: normalizeCount(legacyTotals?.today_count),
        currentMonthCount: normalizeCount(legacyTotals?.month_count),
        currentYearCount: normalizeCount(legacyTotals?.year_count),
        daily: legacySeries("daily"),
        monthly: legacySeries("monthly"),
        countries: [],
        cities: [],
        locationPeriodMonths: 12,
        locationDetectionAvailable: hasCountryDetection(req),
      });
      return;
    }
    console.error("Failed to load game session statistics", error);
    res.status(500).json({ error: "No se pudieron cargar las estadísticas de partidas." });
  }
}
