import crypto from "node:crypto";

const COOKIE_NAME = "ponchister_admin";

export interface AdminSession {
  id: number;
  email: string;
  role: "superadmin" | "editor";
}

const base64UrlEncode = (input: Buffer | string) => {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const base64UrlDecode = (input: string) => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const pad = padLength === 0 ? "" : "=".repeat(padLength);
  return Buffer.from(padded + pad, "base64");
};

const getJwtSecret = () => {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET is not configured.");
  }
  return secret;
};

export const createSessionToken = (payload: AdminSession) => {
  const header = base64UrlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: nowSeconds,
      exp: nowSeconds + 60 * 60 * 12,
    })
  );
  const unsigned = `${header}.${body}`;
  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(unsigned)
    .digest();
  const signed = `${unsigned}.${base64UrlEncode(signature)}`;
  return signed;
};

const verifyToken = (token: string): AdminSession | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const unsigned = `${header}.${payload}`;
  const expected = crypto
    .createHmac("sha256", getJwtSecret())
    .update(unsigned)
    .digest();
  const provided = base64UrlDecode(signature);
  if (expected.length !== provided.length) return null;
  if (!crypto.timingSafeEqual(expected, provided)) return null;
  const decoded = JSON.parse(base64UrlDecode(payload).toString("utf8")) as {
    id: number;
    email: string;
    role: "superadmin" | "editor";
    exp?: number;
  };
  if (!decoded || typeof decoded.id !== "number") return null;
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return { id: decoded.id, email: decoded.email, role: decoded.role };
};

const parseCookies = (cookieHeader: string | undefined) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, item) => {
    const [key, ...rest] = item.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

type RequestLike = {
  headers: Record<string, string | undefined>;
};

export const getAdminSession = (req: RequestLike): AdminSession | null => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
};

export const getSessionCookie = (token: string) => {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "Secure; " : "";
  return `${COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; ${secure}Max-Age=${60 * 60 * 12}`;
};

export const getClearSessionCookie = () => {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "Secure; " : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; ${secure}Max-Age=0`;
};
