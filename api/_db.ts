import dotenv from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema.ts";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

type GlobalWithPool = typeof globalThis & {
  __ponchisterPool?: Pool;
};

const globalWithPool = globalThis as GlobalWithPool;

const pool =
  globalWithPool.__ponchisterPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (!globalWithPool.__ponchisterPool) {
  globalWithPool.__ponchisterPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
