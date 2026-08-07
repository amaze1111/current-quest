import { Pool } from "pg";
import { config } from "../config";

// Managed Postgres providers (Render, Railway, etc.) commonly terminate TLS with a
// self-signed/short chain — reject unauthorized only when the operator explicitly opts in.
//
// This database instance is shared with other apps, so every connection is pinned to ONLY
// the current_quest schema via search_path — no "public" fallback. If a table is ever
// missing from current_quest (e.g. a failed migration), queries error out instead of
// silently resolving to another app's same-named table in public.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  options: "-c search_path=current_quest",
  max: 10,
});

pool.on("error", (err) => {
  console.error("Unexpected idle Postgres client error:", err);
});
