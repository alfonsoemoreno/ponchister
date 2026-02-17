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
    yearly: normalizeSeries(data.yearly),
  };
}
