import type { NextApiRequest, NextApiResponse } from "next";
import {
  clearMimicaReveal,
  getMimicaSession,
  upsertMimicaSession,
} from "../../../src/server/mimicaSessionStore";

const parseBody = (req: NextApiRequest): Record<string, unknown> => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object") return req.body as Record<string, unknown>;
  return {};
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = String(req.query.sessionId ?? "").trim();

  if (!sessionId) {
    res.status(400).end("Sesión inválida.");
    return;
  }

  if (req.method === "GET") {
    const session = getMimicaSession(sessionId);
    if (!session) {
      res.status(404).end("Sesión no encontrada.");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(session));
    return;
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const active = typeof body.active === "boolean" ? body.active : undefined;
    const mode =
      body.mode === "mimica" || body.mode === "tararear" ? body.mode : undefined;
    const songId =
      typeof body.songId === "number" && Number.isFinite(body.songId)
        ? Math.trunc(body.songId)
        : body.songId === null
          ? null
          : undefined;
    const songTitle =
      typeof body.songTitle === "string"
        ? body.songTitle
        : body.songTitle === null
          ? null
          : undefined;
    const artist =
      typeof body.artist === "string"
        ? body.artist
        : body.artist === null
          ? null
          : undefined;
    const videoId =
      typeof body.videoId === "string"
        ? body.videoId
        : body.videoId === null
          ? null
          : undefined;
    const revealPressed =
      typeof body.revealPressed === "boolean" ? body.revealPressed : undefined;
    const resetReveal = body.resetReveal === true;

    const session = resetReveal
      ? clearMimicaReveal(sessionId) ??
        upsertMimicaSession(sessionId, {
          active: active ?? false,
          mode: mode ?? null,
          songId: songId ?? null,
          songTitle: songTitle ?? null,
          artist: artist ?? null,
          videoId: videoId ?? null,
          revealPressed: false,
        })
      : upsertMimicaSession(sessionId, {
          active,
          mode,
          songId,
          songTitle,
          artist,
          videoId,
          revealPressed,
        });

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(session));
    return;
  }

  res.status(405).end("Método no permitido.");
}
