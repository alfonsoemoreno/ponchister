import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const role = process.env.ADMIN_ROLE ?? "superadmin";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing.");
}
if (!email || !password) {
  throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD is missing.");
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await client.query(
      `
      insert into admin_users (email, password_hash, role, active)
      values ($1, $2, $3, true)
      on conflict (email) do update set
        password_hash = excluded.password_hash,
        role = excluded.role,
        active = true,
        updated_at = now()
      returning id, email, role;
    `,
      [email.toLowerCase(), hash, role]
    );

    console.log("Admin user ready:", result.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Failed to create admin user:", err);
  process.exit(1);
});
