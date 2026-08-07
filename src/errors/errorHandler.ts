import { NextFunction, Request, Response } from "express";
import { HttpError } from "./HttpError";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: `No route for ${req.method} ${req.path}` } });
}

// Registered last in app.ts. Express identifies error middleware by arity, so all four
// params must stay even though `next` is unused.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Anything else is unexpected — log full detail server-side, never leak it to the client.
  console.error(`Unhandled error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}
