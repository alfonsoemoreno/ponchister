import type { NextApiRequest, NextApiResponse } from "next";
import { gameSessions } from "../../../src/db/schema";
import { db } from "../_db";

const parseBody = (req: NextApiRequest): Record<string, unknown> => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }
  return {};
};

function toFiniteInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).end("Método no permitido.");
    return;
  }

  const body = parseBody(req);
  const mode = typeof body.mode === "string" ? body.mode.trim() : "auto";
  const yearMin = toFiniteInteger(body.yearMin);
  const yearMax = toFiniteInteger(body.yearMax);
  const onlySpanish = body.onlySpanish === true;
  const timerEnabled = body.timerEnabled === true;

  if (!mode) {
    res.status(400).end("Datos inválidos.");
    return;
  }

  await db.insert(gameSessions).values({
    mode,
    yearMin,
    yearMax,
    onlySpanish,
    timerEnabled,
  });

  res.status(201).json({ ok: true });
}
