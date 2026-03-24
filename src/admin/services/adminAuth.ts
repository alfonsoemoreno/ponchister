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
  const data = await fetchJson<{ user: Record<string, unknown> }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    id: Number(data.user.id),
    email: String(data.user.email ?? ""),
    role: data.user.role === "superadmin" ? "superadmin" : "editor",
    display_name:
      typeof data.user.display_name === "string" ? data.user.display_name : null,
    avatar_url:
      typeof data.user.avatar_url === "string" ? data.user.avatar_url : null,
    active: true,
  };
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

  const data = (await response.json()) as { user: Record<string, unknown> | null };
  if (!data.user) return null;
  return {
    id: Number(data.user.id),
    email: String(data.user.email ?? ""),
    role: data.user.role === "superadmin" ? "superadmin" : "editor",
    display_name:
      typeof data.user.display_name === "string" ? data.user.display_name : null,
    avatar_url:
      typeof data.user.avatar_url === "string" ? data.user.avatar_url : null,
    active: true,
  };
}
