import type { IncomingMessage, ServerResponse } from "node:http";
import { eq } from "drizzle-orm";
import { adminUsers } from "../../../src/db/schema";
import { db } from "../_db";
import { getAdminSession, getClearSessionCookie } from "../_auth";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const session = getAdminSession(req);
  if (!session) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ user: null }));
    return;
  }

  const [user] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      displayName: adminUsers.displayName,
      avatarUrl: adminUsers.avatarUrl,
      active: adminUsers.active,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, session.id))
    .limit(1);

  if (!user || !user.active) {
    res.setHeader("Set-Cookie", getClearSessionCookie());
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ user: null }));
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
