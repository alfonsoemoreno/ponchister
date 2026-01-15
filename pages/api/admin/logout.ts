import type { IncomingMessage, ServerResponse } from "node:http";
import { getClearSessionCookie } from "../_auth.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  res.setHeader("Set-Cookie", getClearSessionCookie());
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
}
