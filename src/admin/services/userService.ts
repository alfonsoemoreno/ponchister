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

export async function listAdminUsers(): Promise<AdminUser[]> {
  return fetchJson<AdminUser[]>(`${API_BASE}/users`);
}

export async function createAdminUser(payload: {
  email: string;
  password: string;
  role: AdminRole;
}): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${API_BASE}/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminUser(
  id: number,
  payload: {
    role?: AdminRole;
    active?: boolean;
    password?: string;
  }
): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${API_BASE}/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUser(id: number): Promise<void> {
  await fetchJson(`${API_BASE}/users/${id}`, { method: "DELETE" });
}
