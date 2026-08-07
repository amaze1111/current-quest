import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { meRouter } from "./routes/me";
import { progressRouter } from "./routes/progress";
import { hintsRouter } from "./routes/hints";
import { starPacksRouter } from "./routes/starPacks";
import { purchasesRouter } from "./routes/purchases";
import { notFoundHandler, errorHandler } from "./errors/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
    })
  );
  app.use(express.json());

  app.use(healthRouter);
  app.use(meRouter);
  app.use(progressRouter);
  app.use(hintsRouter);
  app.use(starPacksRouter);
  app.use(purchasesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
