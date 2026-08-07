import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { useHintSchema } from "../schemas/hint.schema";
import { useHint } from "../services/starLedgerService";

export const hintsRouter = Router();

hintsRouter.post(
  "/hints/use",
  requireAuth,
  validateBody(useHintSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req as AuthedRequest;
    const { hintType, idempotencyKey } = req.body as { hintType: "next_step" | "solve"; idempotencyKey: string };

    const result = await useHint(userId, hintType, idempotencyKey);
    res.status(200).json(result);
  })
);
