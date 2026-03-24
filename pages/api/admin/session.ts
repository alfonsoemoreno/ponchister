import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAdmin } from "../_admin";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const user = await requireAdmin(req, res);
  if (!user) {
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
      },
    })
  );
}
