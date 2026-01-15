import type { IncomingMessage, ServerResponse } from "node:http";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUsers } from "../../../../src/db/schema";
import { db } from "../../_db";
import { requireAdmin } from "../../_admin";

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

  const id = Number((req as { query?: Record<string, string> }).query?.id);
  if (!Number.isFinite(id)) {
    res.statusCode = 400;
    res.end("ID inválido.");
    return;
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const body = await parseBody(req);
    const role =
      body.role === "superadmin" || body.role === "editor" ? body.role : null;
    const active =
      typeof body.active === "boolean" ? body.active : undefined;
    const password =
      typeof body.password === "string" ? body.password.trim() : "";

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (role) updates.role = role;
    if (typeof active === "boolean") updates.active = active;
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    const [updated] = await db
      .update(adminUsers)
      .set(updates)
      .where(eq(adminUsers.id, id))
      .returning({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        active: adminUsers.active,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      });

    if (!updated) {
      res.statusCode = 404;
      res.end("Usuario no encontrado.");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: updated.id,
        email: updated.email,
        role: updated.role,
        active: updated.active,
        created_at: updated.createdAt?.toISOString(),
        updated_at: updated.updatedAt?.toISOString(),
      })
    );
    return;
  }

  if (req.method === "DELETE") {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 405;
  res.end("Método no permitido.");
}
