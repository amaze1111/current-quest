import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { completeLevelSchema } from "../schemas/progress.schema";
import { HttpError } from "../errors/HttpError";
import { completeLevel } from "../services/progressService";

export const progressRouter = Router();

progressRouter.post(
  "/levels/:levelId/complete",
  requireAuth,
  validateBody(completeLevelSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req as AuthedRequest;
    const levelId = Number(req.params.levelId);
    if (!Number.isInteger(levelId)) {
      throw HttpError.badRequest("invalid_level", "levelId must be an integer");
    }
    const { timeMs } = req.body as { timeMs: number };

    const result = await completeLevel(userId, levelId, timeMs);
    res.status(200).json(result);
  })
);
