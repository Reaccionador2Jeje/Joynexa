import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npm run import:legacy -- ./legacy-users.json");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

type LegacyUser = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  role?: string;
  status?: string;
};

function extractRows(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && Array.isArray((item as { results?: unknown }).results)) {
        return (item as { results: unknown[] }).results;
      }
    }
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as { results?: unknown[]; result?: unknown[] };
    if (Array.isArray(record.results)) return record.results;
    if (Array.isArray(record.result)) return extractRows(record.result);
  }
  throw new Error("Unrecognized export format. Expected an array of D1 user rows.");
}

const raw = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
const rows = extractRows(raw) as LegacyUser[];
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
let imported = 0;
let skipped = 0;

try {
  for (const row of rows) {
    if (!row || !/^[a-f0-9]{32}$/i.test(row.id) ||
        !/^[a-zA-Z0-9_]{3,20}$/.test(row.username) ||
        !/^[a-f0-9]{64}$/i.test(row.password_hash) ||
        !/^[a-f0-9]{32}$/i.test(row.password_salt)) {
      console.warn("Skipped a row with invalid legacy account fields.");
      skipped++;
      continue;
    }

    const role = ["player", "admin", "developer", "moderator"].includes(row.role ?? "")
      ? row.role! : "player";
    const status = row.status === "suspended" ? "suspended" : "active";

    try {
      const result = await pool.query(
        `INSERT INTO users (id, username, password_hash, password_salt, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.username, row.password_hash, row.password_salt, role, status]
      );
      if (result.rowCount === 1) imported++;
      else skipped++;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        console.warn(`Skipped username collision: ${row.username}`);
        skipped++;
        continue;
      }
      throw error;
    }
  }
  console.log(`Legacy import finished. Imported: ${imported}; skipped: ${skipped}.`);
  console.log("No session tokens were imported. Users will sign in again to create new secure sessions.");
} finally {
  await pool.end();
}
