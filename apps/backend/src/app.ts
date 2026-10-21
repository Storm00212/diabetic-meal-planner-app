import cors from "cors";
import express from "express";
import { config } from "./config.js";
import {
  errorHandler,
  notFoundHandler,
  requestContext,
  requestLogger,
} from "./lib/http.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { authRouter, userRouter } from "./modules/auth/auth.routes.js";
import { dishRouter } from "./modules/dish/dish.routes.js";
import { plansRouter } from "./modules/plans/plans.routes.js";
import { weightRouter } from "./modules/weight/weight.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { chatRouter } from "./modules/chat/chat.routes.js";
import { nutrientsRouter } from "./modules/nutrients/nutrients.routes.js";

/**
 * Builds the Express application.
 *
 * Keeping this separate from `index.ts` means the app can be imported by a
 * test without opening a socket.
 */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(
    cors({
      origin: config.corsOrigins === "*" ? true : config.corsOrigins.split(","),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-client"],
      exposedHeaders: ["x-request-id", "x-service"],
    }),
  );

  app.use(express.json({ limit: "256kb" }));
  app.use(requestContext);
  app.use(requestLogger);

  // --- Operational endpoints ---------------------------------------------
  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: config.service, database: "connected" });
    } catch (error) {
      logger.error("Health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        ok: false,
        service: config.service,
        database: "unreachable",
      });
    }
  });

  app.get("/", (_req, res) => {
    res.json({
      service: config.service,
      modules: [
        "/api/health",
        "/api/auth/*",
        "/api/user/*",
        "/api/settings",
        "/api/dishes/*",
        "/api/plans/*",
        "/api/weight",
        "/api/user/weight-targets",
        "/api/analytics",
        "/api/chat",
        "/api/nutrients",
      ],
    });
  });

  // --- Feature modules ----------------------------------------------------
  app.use(authRouter);
  app.use(userRouter);
  app.use(dishRouter);
  app.use(plansRouter);
  app.use(weightRouter);
  app.use(analyticsRouter);
  app.use(chatRouter);
  app.use(nutrientsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
