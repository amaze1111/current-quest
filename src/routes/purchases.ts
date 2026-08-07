import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { verifyPurchaseSchema } from "../schemas/purchase.schema";
import { verifyAndCreditPurchase } from "../services/purchaseService";

export const purchasesRouter = Router();

purchasesRouter.post(
  "/purchases/verify",
  requireAuth,
  validateBody(verifyPurchaseSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req as AuthedRequest;
    const { productId, purchaseToken } = req.body as { productId: string; purchaseToken: string };

    const result = await verifyAndCreditPurchase(userId, productId, purchaseToken);
    res.status(200).json(result);
  })
);
