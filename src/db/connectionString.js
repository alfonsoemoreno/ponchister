const LEGACY_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

export function normalizeDatabaseUrl(rawValue) {
  const trimmed = (rawValue ?? "").trim();
  if (!trimmed) {
    return trimmed;
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const currentSslMode = url.searchParams.get("sslmode");
  const useLibpqCompat = url.searchParams.get("uselibpqcompat");

  if (
    currentSslMode &&
    LEGACY_SSL_MODES.has(currentSslMode) &&
    useLibpqCompat !== "true"
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}
