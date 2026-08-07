import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { getProgress } from "../services/progressService";

export const meRouter = Router();

meRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req as AuthedRequest;
    const progress = await getProgress(userId);
    res.status(200).json(progress);
  })
);
