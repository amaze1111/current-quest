import fs from "fs";
import path from "path";
import { pool } from "../src/db/pool";

// Runnable both locally (npm run migrate:dev) and as a one-off deploy step (npm run migrate)
// against whatever DATABASE_URL is set, not something that only works on one machine.
//
// Resolved from process.cwd() (npm always runs scripts from the project root), not __dirname:
// migrations/*.sql are plain files tsc never copies into dist/, so an __dirname-relative path
// works under ts-node (where __dirname is the source scripts/ dir) but breaks once compiled
// (where __dirname is dist/scripts, and "../migrations" resolves to a dist/migrations that
// never gets created).
async function main() {
  const migrationsDir = path.join(process.cwd(), "migrations");
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
