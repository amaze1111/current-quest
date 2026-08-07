import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { pool } from "../db/pool";

export const starPacksRouter = Router();

// Public, read-only catalogue — no auth required so the store screen can render before login.
starPacksRouter.get(
  "/star-packs",
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT id, product_id, star_amount, display_name FROM star_packs WHERE active = true ORDER BY star_amount`
    );
    res.status(200).json({ starPacks: result.rows });
  })
);
