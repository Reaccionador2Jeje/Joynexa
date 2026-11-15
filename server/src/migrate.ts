import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString, max: 2 });
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationName = "0001_accounts.sql";
  const existing = await client.query(
    "SELECT name FROM schema_migrations WHERE name = $1",
    [migrationName]
  );

  if (existing.rowCount === 0) {
    const sql = await readFile(resolve(process.cwd(), "migrations", migrationName), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migrationName]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${migrationName}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } else {
    console.log("Database schema is up to date.");
  }
} finally {
  client.release();
  await pool.end();
}
