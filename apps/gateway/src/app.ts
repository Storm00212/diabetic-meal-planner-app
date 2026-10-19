import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { aggregateHealth } from "./lib/health.js";
import {
  asyncHandler,
  errorHandler,
  notFoundHandler,
  requestContext,
  requestLogger,
} from "./lib/http.js";
import { proxyRouter } from "./modules/proxy/proxy.routes.js";
import { ROUTE_TABLE } from "./routes.js";

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
      exposedHeaders: ["x-request-id", "x-service", "x-upstream"],
    }),
  );

  app.use(express.json({ limit: "256kb" }));
  app.use(requestContext);
  app.use(requestLogger);

  // --- Operational endpoints ---------------------------------------------
  app.get(
    "/api/health",
    asyncHandler(async (req, res) => {
      const upstream = await aggregateHealth(req.requestId ?? "");
      const ok = Object.values(upstream).every(Boolean);

      res.json({ ok, service: config.service, upstream });
    }),
  );

  app.get("/", (_req, res) => {
    res.json({
      service: config.service,
      routes: ROUTE_TABLE.map((rule) => rule.path),
      proxies: ROUTE_TABLE.map((rule) => ({
        path: rule.path,
        upstream: rule.upstream,
      })),
    });
  });

  // --- Everything else is proxied ----------------------------------------
  app.use(proxyRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
