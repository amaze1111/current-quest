import { config } from "../config";
import { HttpError } from "../errors/HttpError";
import { withTransaction } from "../db/transaction";
import { getAndroidPublisherClient } from "./googlePlayClient";

const GOOGLE_PLAY_PURCHASED = 0;

export interface VerifyPurchaseResult {
  productId: string;
  starsCredited: number;
  alreadyProcessed: boolean;
  starBalance: number;
}

// A client-supplied "I paid" claim is never sufficient on its own — every purchase is
// re-verified against Google Play server-side before any stars are credited.
export async function verifyAndCreditPurchase(
  userId: string,
  productId: string,
  purchaseToken: string
): Promise<VerifyPurchaseResult> {
  const packResult = await withTransaction((client) =>
    client.query<{ id: string; star_amount: number }>(
      `SELECT id, star_amount FROM star_packs WHERE product_id = $1 AND active = true`,
      [productId]
    )
  );
  const pack = packResult.rows[0];
  if (!pack) {
    throw HttpError.badRequest("unknown_product", `No active star pack for product ${productId}`);
  }

  const androidPublisher = getAndroidPublisherClient();
  const purchase = await androidPublisher.purchases.products.get({
    packageName: config.androidPackageName,
    productId,
    token: purchaseToken,
  });

  if (purchase.data.purchaseState !== GOOGLE_PLAY_PURCHASED) {
    throw HttpError.badRequest("purchase_not_valid", "Purchase is not in a completed state");
  }

  const result = await withTransaction(async (client) => {
    await client.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [userId]);

    const insertedPurchase = await client.query(
      `INSERT INTO purchases (user_id, platform, product_id, purchase_token, star_pack_id, status)
       VALUES ($1, 'google_play', $2, $3, $4, 'verified')
       ON CONFLICT (purchase_token) DO NOTHING
       RETURNING id`,
      [userId, productId, purchaseToken, pack.id]
    );

    if ((insertedPurchase.rowCount ?? 0) === 0) {
      const balanceRow = await client.query<{ star_balance: number }>(
        `SELECT star_balance FROM users WHERE id = $1`,
        [userId]
      );
      return { starsCredited: 0, alreadyProcessed: true, starBalance: balanceRow.rows[0].star_balance };
    }

    const dedupeKey = `purchase:google_play:${purchaseToken}`;
    await client.query(
      `INSERT INTO star_ledger (user_id, delta, reason, dedupe_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [userId, pack.star_amount, `purchase:${productId}`, dedupeKey]
    );

    const updated = await client.query<{ star_balance: number }>(
      `UPDATE users SET star_balance = star_balance + $1 WHERE id = $2 RETURNING star_balance`,
      [pack.star_amount, userId]
    );

    return { starsCredited: pack.star_amount, alreadyProcessed: false, starBalance: updated.rows[0].star_balance };
  });

  if (!result.alreadyProcessed) {
    // Star packs are consumable — consume() both acknowledges the purchase (preventing
    // Google's 3-day auto-refund) and clears it so the same product can be bought again.
    await androidPublisher.purchases.products.consume({
      packageName: config.androidPackageName,
      productId,
      token: purchaseToken,
    });
  }

  console.log(
    `[purchase] user=${userId} product=${productId} starsCredited=${result.starsCredited} ` +
      `alreadyProcessed=${result.alreadyProcessed} starBalance=${result.starBalance}`
  );

  return { productId, ...result };
}
