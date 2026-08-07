import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { HttpError } from "../errors/HttpError";

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(HttpError.badRequest("invalid_body", "Request body failed validation", result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
