import type { IncomingMessage, ServerResponse } from "node:http";

const ITUNES_BASE_URL = "https://itunes.apple.com/search";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const term = url.searchParams.get("term");
  const entity = url.searchParams.get("entity");

  if (!term || !entity) {
    res.statusCode = 400;
    res.end("Parámetros inválidos.");
    return;
  }

  const endpoint = `${ITUNES_BASE_URL}?term=${encodeURIComponent(
    term
  )}&entity=${encodeURIComponent(entity)}&limit=5`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      res.statusCode = response.status;
      res.end(await response.text());
      return;
    }

    const body = await response.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.end(body);
  } catch (error) {
    res.statusCode = 502;
    res.end("No se pudo consultar iTunes.");
  }
}
