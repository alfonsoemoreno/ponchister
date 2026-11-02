/** A single bounded snapshot per server instance; concurrent misses share a read. */
export function createRoscoCatalogCache<T>(
  load: () => Promise<T>,
  ttlMs = 5 * 60_000,
  now = Date.now,
) {
  let snapshot: { value: T; expiresAt: number } | null = null;
  let pending: Promise<T> | null = null;
  let generation = 0;

  return {
    get(): Promise<T> {
      if (snapshot && snapshot.expiresAt > now()) return Promise.resolve(snapshot.value);
      if (pending) return pending;
      const startedGeneration = generation;
      const request = Promise.resolve().then(load).then(value => {
        if (generation === startedGeneration) snapshot = { value, expiresAt: now() + ttlMs };
        return value;
      }).finally(() => {
        if (pending === request) pending = null;
      });
      pending = request;
      return request;
    },
    invalidate() {
      generation++;
      snapshot = null;
      pending = null;
    },
  };
}
