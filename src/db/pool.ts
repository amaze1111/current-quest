import { Pool } from "pg";
import { config } from "../config";

// Managed Postgres providers (Render, Railway, etc.) commonly terminate TLS with a
// self-signed/short chain — reject unauthorized only when the operator explicitly opts in.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on("error", (err) => {
  console.error("Unexpected idle Postgres client error:", err);
});
