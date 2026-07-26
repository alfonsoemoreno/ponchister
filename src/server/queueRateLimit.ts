const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

type Entry = { count: number; resetAt: number };

// This is intentionally only a lightweight, per-function-instance guard. It
// blocks accidental loops and basic abuse without adding a paid shared store.
const entries = new Map<string, Entry>();

export function checkQueueRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const current = entries.get(clientKey);

  if (!current || current.resetAt <= now) {
    entries.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
