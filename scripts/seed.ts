import { pool } from "../src/db/pool";

// Reference/fixture data so local dev and CI can stand up a working instance without
// production data. Star amounts/product ids here are placeholders — match them to whatever
// in-app products are actually configured in the Play Console before shipping.
const STAR_PACKS = [
  { id: "pack_small", productId: "stars_small", starAmount: 10, displayName: "10 Stars" },
  { id: "pack_medium", productId: "stars_medium", starAmount: 50, displayName: "50 Stars" },
  { id: "pack_large", productId: "stars_large", starAmount: 120, displayName: "120 Stars" },
];

async function main() {
  for (const pack of STAR_PACKS) {
    await pool.query(
      `INSERT INTO star_packs (id, product_id, star_amount, display_name, active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET
         product_id = EXCLUDED.product_id,
         star_amount = EXCLUDED.star_amount,
         display_name = EXCLUDED.display_name`,
      [pack.id, pack.productId, pack.starAmount, pack.displayName]
    );
  }

  console.log(`Seeded ${STAR_PACKS.length} star pack(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
