import type { IncomingMessage, ServerResponse } from "node:http";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { adminUsers } from "../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";

const parseBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
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
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (user.role !== "superadmin") {
    res.statusCode = 403;
    res.end("Acceso restringido.");
    return;
  }

  if (req.method === "GET") {
    const users = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        active: adminUsers.active,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      })
      .from(adminUsers)
      .orderBy(desc(adminUsers.id));

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        users.map((entry) => ({
          id: entry.id,
          email: entry.email,
          role: entry.role,
          active: entry.active,
          created_at: entry.createdAt?.toISOString(),
          updated_at: entry.updatedAt?.toISOString(),
        }))
      )
    );
    return;
  }

  if (req.method === "POST") {
    const body = await parseBody(req);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const role =
      body.role === "superadmin" || body.role === "editor" ? body.role : null;

    if (!email || !password || !role) {
      res.statusCode = 400;
      res.end("Datos inválidos.");
      return;
    }

    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    if (existing) {
      res.statusCode = 409;
      res.end("Ya existe un usuario con ese email.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [created] = await db
      .insert(adminUsers)
      .values({
        email,
        passwordHash,
        role,
        active: true,
        updatedAt: new Date(),
      })
      .returning({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        active: adminUsers.active,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      });

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: created.id,
        email: created.email,
        role: created.role,
        active: created.active,
        created_at: created.createdAt?.toISOString(),
        updated_at: created.updatedAt?.toISOString(),
      })
    );
    return;
  }

  res.statusCode = 405;
  res.end("Método no permitido.");
}
