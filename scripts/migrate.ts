import fs from "fs";
import path from "path";
import { pool } from "../src/db/pool";

// Runnable both locally (npm run migrate:dev) and as a one-off deploy step (npm run migrate)
// against whatever DATABASE_URL is set, not something that only works on one machine.
async function main() {
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }

  console.log(`Applied ${files.length} migration file(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
