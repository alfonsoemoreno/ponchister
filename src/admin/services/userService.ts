import type { AdminRole, AdminUser } from "../types";

const API_BASE = "/api/admin";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "No se pudo completar la operación.");
  }

  return response.json() as Promise<T>;
}

function normalizeAdminUser(raw: Record<string, unknown>): AdminUser {
  return {
    id: Number(raw.id),
    email: String(raw.email ?? ""),
    role: raw.role === "superadmin" ? "superadmin" : "editor",
    display_name:
      typeof raw.display_name === "string" ? raw.display_name : null,
    avatar_url: typeof raw.avatar_url === "string" ? raw.avatar_url : null,
    active: raw.active === true,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const data = await fetchJson<Record<string, unknown>[]>(`${API_BASE}/users`);
  return data.map(normalizeAdminUser);
}

export async function createAdminUser(payload: {
  email: string;
  password: string;
  role: AdminRole;
}): Promise<AdminUser> {
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeAdminUser(data);
}

export async function updateAdminUser(
  id: number,
  payload: {
    role?: AdminRole;
    active?: boolean;
    password?: string;
  }
): Promise<AdminUser> {
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeAdminUser(data);
}

export async function deleteAdminUser(id: number): Promise<void> {
  await fetchJson(`${API_BASE}/users/${id}`, { method: "DELETE" });
}

export async function fetchMyProfile(): Promise<AdminUser> {
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/profile`);
  return normalizeAdminUser(data);
}

export async function updateMyProfile(payload: {
  display_name: string | null;
  avatar_url: string | null;
}): Promise<AdminUser> {
  const data = await fetchJson<Record<string, unknown>>(`${API_BASE}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeAdminUser(data);
}
