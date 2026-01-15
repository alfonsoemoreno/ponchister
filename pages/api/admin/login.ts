import type { IncomingMessage, ServerResponse } from "node:http";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUsers } from "../../../src/db/schema.ts";
import { db } from "../_db.ts";
import { createSessionToken, getSessionCookie } from "../_auth.ts";

const parseBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  if (req.headers["content-type"]?.includes("application/json")) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    if (chunks.length === 0) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return {};
    }
  }
  return {};
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Método no permitido.");
    return;
  }

  const body = await parseBody(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    res.statusCode = 400;
    res.end("Credenciales inválidas.");
    return;
  }

  const [user] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      passwordHash: adminUsers.passwordHash,
      role: adminUsers.role,
      active: adminUsers.active,
    })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (!user || !user.active) {
    res.statusCode = 401;
    res.end("Credenciales inválidas.");
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.statusCode = 401;
    res.end("Credenciales inválidas.");
    return;
  }

  const token = createSessionToken({
    id: user.id,
    email: user.email,
    role: user.role as "superadmin" | "editor",
  });

  res.setHeader("Set-Cookie", getSessionCookie(token));
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      user: { id: user.id, email: user.email, role: user.role },
    })
  );
}
