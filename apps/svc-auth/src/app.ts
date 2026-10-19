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
      endpoints: ["/api/health", "/api/auth/*", "/api/user/*", "/api/settings"],
    });
  });

  // --- Feature modules ----------------------------------------------------
  app.use(authRouter);
  app.use(userRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
