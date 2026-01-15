import type { AdminUser } from "../types";

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

export async function loginAdmin(payload: {
  email: string;
  password: string;
}): Promise<AdminUser> {
  const data = await fetchJson<{ user: AdminUser }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function logoutAdmin(): Promise<void> {
  await fetchJson("/api/admin/logout", { method: "POST" });
}

export async function fetchAdminSession(): Promise<AdminUser | null> {
  const response = await fetch("/api/admin/session", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "No se pudo obtener la sesión.");
  }

  const data = (await response.json()) as { user: AdminUser | null };
  return data.user ?? null;
}
