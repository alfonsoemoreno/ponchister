import type { ServerResponse } from "node:http";

// Public catalog data changes through the admin UI, but it is read much more
// often than it changes. Let Vercel's CDN serve repeated requests and refresh
// the value in the background after five minutes.
export function setPublicCatalogCache(res: ServerResponse): void {
  res.setHeader(
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=86400"
  );
}
