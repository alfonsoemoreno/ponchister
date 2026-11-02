import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error Node 24 runs these TypeScript tests directly.
import { createRoscoCatalogCache } from "../src/server/pasapalabraCatalogCache.ts";

test("shares simultaneous cold reads and avoids new reads until expiry", async () => {
  let reads = 0;
  let now = 0;
  const cache = createRoscoCatalogCache(async () => { reads++; return [reads]; }, 300_000, () => now);
  const values = await Promise.all(Array.from({ length: 30 }, () => cache.get()));
  assert.equal(reads, 1);
  assert.ok(values.every(value => value === values[0]));
  now = 299_999;
  await cache.get();
  assert.equal(reads, 1);
  now = 300_000;
  await Promise.all([cache.get(), cache.get()]);
  assert.equal(reads, 2);
});

test("retries failed reads instead of retaining a rejected request", async () => {
  let reads = 0;
  const cache = createRoscoCatalogCache(async () => {
    if (++reads === 1) throw new Error("Database unavailable");
    return "fresh";
  });
  await assert.rejects(cache.get(), /Database unavailable/);
  assert.equal(await cache.get(), "fresh");
  assert.equal(await cache.get(), "fresh");
  assert.equal(reads, 2);
});

test("invalidation prevents an older in-flight read from overwriting a fresh snapshot", async () => {
  let finishOld!: (value: string) => void;
  let reads = 0;
  const cache = createRoscoCatalogCache(() => ++reads === 1
    ? new Promise<string>(resolve => { finishOld = resolve; })
    : Promise.resolve("new catalog"));
  const old = cache.get();
  await Promise.resolve();
  cache.invalidate();
  assert.equal(await cache.get(), "new catalog");
  finishOld("old catalog");
  assert.equal(await old, "old catalog");
  assert.equal(await cache.get(), "new catalog");
  assert.equal(reads, 2);
});
