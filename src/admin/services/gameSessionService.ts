import type { GameSessionStatistics } from "../types";

const API_BASE = "/api/admin";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "No se pudo completar la operación.");
  }

  return response.json() as Promise<T>;
}

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

function normalizeSeries(
  rows: unknown
): { label: string; count: number }[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((entry) => {
    const item =
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : {};

    return {
      label: String(item.label ?? ""),
      count: normalizeCount(item.count),
    };
  });
}

export async function fetchGameSessionStatistics(): Promise<GameSessionStatistics> {
  const data = await fetchJson<Record<string, unknown>>(
    `${API_BASE}/game-sessions/stats`
  );

  return {
    todayCount: normalizeCount(data.todayCount),
    currentMonthCount: normalizeCount(data.currentMonthCount),
    currentYearCount: normalizeCount(data.currentYearCount),
    daily: normalizeSeries(data.daily),
    monthly: normalizeSeries(data.monthly),
    countries: Array.isArray(data.countries)
      ? data.countries.map((entry) => {
          const item = entry && typeof entry === "object"
            ? (entry as Record<string, unknown>)
            : {};
          return {
            countryCode: String(item.countryCode ?? "").toUpperCase(),
            count: normalizeCount(item.count),
          };
        }).filter((entry) => /^[A-Z]{2}$/.test(entry.countryCode))
      : [],
    cities: Array.isArray(data.cities)
      ? data.cities.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const item = entry as Record<string, unknown>;
          const countryCode = String(item.countryCode ?? "").toUpperCase();
          const city = typeof item.city === "string" ? item.city.trim() : "";
          if (!/^[A-Z]{2}$/.test(countryCode) || !city) return [];
          const latitude = typeof item.latitude === "number" && Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90
            ? item.latitude : null;
          const longitude = typeof item.longitude === "number" && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180
            ? item.longitude : null;
          return [{
            countryCode, city, region: typeof item.region === "string" ? item.region : null,
            latitude: latitude !== null && longitude !== null ? latitude : null,
            longitude: latitude !== null && longitude !== null ? longitude : null,
            count: normalizeCount(item.count),
          }];
        })
      : [],
    locationPeriodMonths: normalizeCount(data.locationPeriodMonths) || 12,
    locationDetectionAvailable: data.locationDetectionAvailable === true,
  };
}
