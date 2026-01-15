import type { IncomingMessage, ServerResponse } from "node:http";
import { eq } from "drizzle-orm";
import { adminUsers } from "../../src/db/schema.ts";
import { db } from "./_db.ts";
import { getAdminSession, getClearSessionCookie } from "./_auth";

type ResponseLike = Pick<ServerResponse, "statusCode" | "setHeader" | "end">;
type RequestLike = Pick<IncomingMessage, "headers">;

export async function requireAdmin(
  req: RequestLike,
  res: ResponseLike
): Promise<{ id: number; email: string; role: "superadmin" | "editor" } | null> {
  const session = getAdminSession(req);
  if (!session) {
    res.statusCode = 401;
    res.end("Sesión requerida.");
    return null;
  }

  const [user] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      active: adminUsers.active,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, session.id))
    .limit(1);

  if (!user || !user.active) {
    res.statusCode = 401;
    res.setHeader("Set-Cookie", getClearSessionCookie());
    res.end("Sesión inválida.");
    return null;
  }

  return { id: user.id, email: user.email, role: user.role as "superadmin" | "editor" };
}
