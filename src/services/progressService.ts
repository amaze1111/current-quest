import { PoolClient } from "pg";
import { config } from "../config";
import { HttpError } from "../errors/HttpError";
import { withTransaction } from "../db/transaction";

function starsForTime(timeMs: number): number {
  if (timeMs <= config.star3ThresholdMs) return 3;
  if (timeMs <= config.star2ThresholdMs) return 2;
  if (timeMs <= config.star1ThresholdMs) return 1;
  return 0;
}

async function ensureUser(client: PoolClient, userId: string) {
  await client.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [userId]);
}

export interface CompleteLevelResult {
  levelId: number;
  bestTimeMs: number;
  starsEarned: number;
  starsAwardedThisCall: number;
  starBalance: number;
}

// Stars are computed here from the elapsed time using the same thresholds the client
// displays, never from a client-supplied star count — that value is what a modified
// client would tamper with first.
export async function completeLevel(userId: string, levelId: number, timeMs: number): Promise<CompleteLevelResult> {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > config.maxLevel) {
    throw HttpError.badRequest("invalid_level", `levelId must be between 1 and ${config.maxLevel}`);
  }
  if (!Number.isFinite(timeMs) || timeMs < 0 || timeMs > config.timerLimitMs) {
    throw HttpError.badRequest("invalid_time", `timeMs must be between 0 and ${config.timerLimitMs}`);
  }

  const newStars = starsForTime(timeMs);

  return withTransaction(async (client) => {
    await ensureUser(client, userId);

    const existing = await client.query<{ best_time_ms: number; stars_earned: number }>(
      `SELECT best_time_ms, stars_earned FROM level_progress WHERE user_id = $1 AND level_id = $2 FOR UPDATE`,
      [userId, levelId]
    );

    const previousStars = existing.rows[0]?.stars_earned ?? 0;
    const previousBestTime = existing.rows[0]?.best_time_ms;
    const bestTimeMs = previousBestTime !== undefined ? Math.min(previousBestTime, timeMs) : timeMs;
    const starsEarned = Math.max(previousStars, newStars);
    const starsAwardedThisCall = starsEarned - previousStars;

    await client.query(
      `INSERT INTO level_progress (user_id, level_id, best_time_ms, stars_earned, completed_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id, level_id)
       DO UPDATE SET best_time_ms = $3, stars_earned = $4, completed_at = now()`,
      [userId, levelId, bestTimeMs, starsEarned]
    );

    if (starsAwardedThisCall > 0) {
      // Dedupe key encodes the resulting star count, so retried requests that land on the
      // same outcome (e.g. a client retry after a dropped response) don't double-credit,
      // while a genuine improvement (1 star -> 3 stars) is a distinct, creditable event.
      const dedupeKey = `level_clear:${userId}:${levelId}:to${starsEarned}`;
      const inserted = await client.query(
        `INSERT INTO star_ledger (user_id, delta, reason, dedupe_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (dedupe_key) DO NOTHING
         RETURNING id`,
        [userId, starsAwardedThisCall, `level_clear:${levelId}`, dedupeKey]
      );
      if ((inserted.rowCount ?? 0) > 0) {
        await client.query(`UPDATE users SET star_balance = star_balance + $1 WHERE id = $2`, [
          starsAwardedThisCall,
          userId,
        ]);
      }
    }

    const balanceRow = await client.query<{ star_balance: number }>(
      `SELECT star_balance FROM users WHERE id = $1`,
      [userId]
    );

    return {
      levelId,
      bestTimeMs,
      starsEarned,
      starsAwardedThisCall: Math.max(starsAwardedThisCall, 0),
      starBalance: balanceRow.rows[0].star_balance,
    };
  });
}

export async function getProgress(userId: string) {
  const result = await withTransaction(async (client) => {
    await ensureUser(client, userId);
    const progress = await client.query(
      `SELECT level_id, best_time_ms, stars_earned, completed_at FROM level_progress WHERE user_id = $1 ORDER BY level_id`,
      [userId]
    );
    const balance = await client.query<{ star_balance: number }>(
      `SELECT star_balance FROM users WHERE id = $1`,
      [userId]
    );
    return { levels: progress.rows, starBalance: balance.rows[0].star_balance };
  });
  return result;
}
