import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { adminUsers } from "../../../src/db/schema";
import { db } from "../_db";
import { requireAdmin } from "../_admin";

const MAX_AVATAR_LENGTH = 1_500_000;

function parseBody(req: NextApiRequest): Record<string, unknown> {
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
}

function normalizeProfile(row: {
  id: number;
  email: string;
  role: string;
  displayName: string | null;
  avatarUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    display_name: row.displayName,
    avatar_url: row.avatarUrl,
    active: row.active,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const [profile] = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        displayName: adminUsers.displayName,
        avatarUrl: adminUsers.avatarUrl,
        active: adminUsers.active,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, user.id))
      .limit(1);

    if (!profile) {
      res.status(404).end("Perfil no encontrado.");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(normalizeProfile(profile)));
    return;
  }

  if (req.method === "PUT") {
    const body = parseBody(req);
    const displayName =
      typeof body.display_name === "string" && body.display_name.trim()
        ? body.display_name.trim().slice(0, 120)
        : null;
    const avatarUrl =
      typeof body.avatar_url === "string" && body.avatar_url.trim()
        ? body.avatar_url.trim()
        : null;

    if (avatarUrl && avatarUrl.length > MAX_AVATAR_LENGTH) {
      res.status(400).end("El avatar es demasiado grande.");
      return;
    }

    const [updated] = await db
      .update(adminUsers)
      .set({
        displayName,
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, user.id))
      .returning({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        displayName: adminUsers.displayName,
        avatarUrl: adminUsers.avatarUrl,
        active: adminUsers.active,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      });

    if (!updated) {
      res.status(404).end("Perfil no encontrado.");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(normalizeProfile(updated)));
    return;
  }

  res.status(405).end("Método no permitido.");
}
