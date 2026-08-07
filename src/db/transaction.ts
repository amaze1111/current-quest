import { PoolClient } from "pg";
import { pool } from "./pool";

// Multi-statement writes (e.g. "insert a ledger row and update the cached balance")
// must commit or roll back together — every mutation crossing more than one statement
// should go through this rather than issuing pool.query() calls directly.
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
