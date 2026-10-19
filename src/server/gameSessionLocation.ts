type HeaderValue = string | string[] | undefined;

function firstHeader(value: HeaderValue): string | null {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text || null;
}

function decodeLocationText(value: HeaderValue): string | null {
  const text = firstHeader(value);
  if (!text) return null;
  try {
    const decoded = decodeURIComponent(text).trim();
    // Reject malformed or unbounded metadata; never persist raw headers/IPs.
    return decoded && decoded.length <= 120 && !Array.from(decoded).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      ? decoded : null;
  } catch {
    return null;
  }
}

function coordinate(value: HeaderValue, limit: number): number | null {
  const text = firstHeader(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && Math.abs(number) <= limit
    ? Math.round(number * 100) / 100 : null;
}

export function getGameSessionLocation(headers: Record<string, HeaderValue>) {
  const rawCountry = firstHeader(headers["x-vercel-ip-country"])?.toUpperCase();
  const countryCode = rawCountry && /^[A-Z]{2}$/.test(rawCountry) && !["XX", "ZZ"].includes(rawCountry)
    ? rawCountry : null;
  const city = countryCode ? decodeLocationText(headers["x-vercel-ip-city"]) : null;
  const region = city ? decodeLocationText(headers["x-vercel-ip-country-region"]) : null;
  const latitude = city ? coordinate(headers["x-vercel-ip-latitude"], 90) : null;
  const longitude = city ? coordinate(headers["x-vercel-ip-longitude"], 180) : null;
  return {
    countryCode, city, region,
    latitude: latitude !== null && longitude !== null ? latitude : null,
    longitude: latitude !== null && longitude !== null ? longitude : null,
  };
}

export function getMissingSessionColumn(error: unknown): string | null {
  let candidate = error;
  while (candidate && typeof candidate === "object") {
    const current = candidate as { code?: unknown; message?: unknown; cause?: unknown };
    if (current.code === "42703" && typeof current.message === "string") {
      return /column "([a-z_]+)"/.exec(current.message)?.[1] ?? null;
    }
    candidate = current.cause;
  }
  return null;
}
