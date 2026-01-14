import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
}

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const pool = new Pool({ connectionString: databaseUrl });
const PAGE_SIZE = 1000;

async function fetchSongsBatch(from) {
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await supabase
    .from("songs")
    .select("id, artist, title, year, youtube_url, isspanish")
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(error.message || "Failed to fetch songs from Supabase.");
  }
  return data ?? [];
}

async function insertBatch(client, rows) {
  if (!rows.length) return;
  const values = [];
  const placeholders = rows.map((row, index) => {
    const base = index * 6;
    values.push(
      row.id,
      row.artist ?? "",
      row.title ?? "",
      row.year ?? null,
      row.youtube_url ?? "",
      row.isspanish === true
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
      base + 5
    }, $${base + 6})`;
  });

  const query = `
    insert into songs (id, artist, title, year, youtube_url, isspanish)
    values ${placeholders.join(",")}
    on conflict (id) do update set
      artist = excluded.artist,
      title = excluded.title,
      year = excluded.year,
      youtube_url = excluded.youtube_url,
      isspanish = excluded.isspanish;
  `;

  await client.query(query, values);
}

async function main() {
  const client = await pool.connect();
  try {
    let from = 0;
    while (true) {
      const rows = await fetchSongsBatch(from);
      if (!rows.length) break;
      await insertBatch(client, rows);
      console.log(`Migrated ${from + rows.length} songs...`);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    await client.query(`
      select setval(
        pg_get_serial_sequence('songs', 'id'),
        (select coalesce(max(id), 1) from songs)
      );
    `);

    console.log("Migration completed.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
