import { config } from "../config";
import { HttpError } from "../errors/HttpError";
import { withTransaction } from "../db/transaction";

export type HintType = "next_step" | "solve";

function costFor(hintType: HintType): number {
  return hintType === "next_step" ? config.hintNextStepCost : config.hintSolveCost;
}

export interface UseHintResult {
  hintType: HintType;
  cost: number;
  charged: boolean;
  starBalance: number;
}

// idempotencyKey is client-generated per attempt (e.g. a UUID) so a retried request after
// a dropped response is absorbed instead of charging stars twice.
export async function useHint(userId: string, hintType: HintType, idempotencyKey: string): Promise<UseHintResult> {
  const cost = costFor(hintType);

  return withTransaction(async (client) => {
    await client.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [userId]);

    // Lock the balance row before check-and-update so concurrent hint requests serialize
    // instead of both reading a stale balance and racing past zero.
    const balanceRow = await client.query<{ star_balance: number }>(
      `SELECT star_balance FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    const currentBalance = balanceRow.rows[0].star_balance;

    const dedupeKey = `hint_use:${userId}:${idempotencyKey}`;
    const alreadyCharged = await client.query(`SELECT id FROM star_ledger WHERE dedupe_key = $1`, [dedupeKey]);
    if (alreadyCharged.rowCount && alreadyCharged.rowCount > 0) {
      console.log(`[hint_use] user=${userId} type=${hintType} charged=false (dedupe) starBalance=${currentBalance}`);
      return { hintType, cost, charged: false, starBalance: currentBalance };
    }

    if (currentBalance < cost) {
      console.log(`[hint_use] user=${userId} type=${hintType} rejected: insufficient_stars (have ${currentBalance}, need ${cost})`);
      throw HttpError.badRequest("insufficient_stars", `Need ${cost} stars, have ${currentBalance}`);
    }

    const inserted = await client.query(
      `INSERT INTO star_ledger (user_id, delta, reason, dedupe_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [userId, -cost, `hint_use:${hintType}`, dedupeKey]
    );

    if ((inserted.rowCount ?? 0) === 0) {
      // Lost a race to a concurrent identical request between the check above and this insert.
      const balanceAfter = await client.query<{ star_balance: number }>(
        `SELECT star_balance FROM users WHERE id = $1`,
        [userId]
      );
      console.log(`[hint_use] user=${userId} type=${hintType} charged=false (race) starBalance=${balanceAfter.rows[0].star_balance}`);
      return { hintType, cost, charged: false, starBalance: balanceAfter.rows[0].star_balance };
    }

    const updated = await client.query<{ star_balance: number }>(
      `UPDATE users SET star_balance = star_balance - $1 WHERE id = $2 RETURNING star_balance`,
      [cost, userId]
    );

    console.log(`[hint_use] user=${userId} type=${hintType} charged=true cost=${cost} starBalance=${updated.rows[0].star_balance}`);
    return { hintType, cost, charged: true, starBalance: updated.rows[0].star_balance };
  });
}
