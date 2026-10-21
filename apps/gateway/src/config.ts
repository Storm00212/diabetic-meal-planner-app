import { env, logLevel } from "@glucoplate/config";

/**
 * The gateway reads its own `.env` file.
 *
 * It has no database, so there is no `DATABASE_URL` here — only the
 * addresses of the services it fronts.
 */
export const config = {
  /** The service name used in logs and in the `x-service` response header. */
  service: "gateway" as const,
  port: Number(env("PORT", "4000")),
  /**
   * The gateway never verifies a token: it forwards the `Authorization`
   * header untouched and each service checks the JWT itself. The value is
   * kept here only so the shared secret stays in one place.
   */
  jwtSecret: env(
    "JWT_SECRET",
    "glucoplate-development-only-secret-change-me-please",
  ),
  corsOrigins: env("CORS_ORIGINS", "*"),
  logLevel: logLevel(),
  /** Where each upstream service lives. */
  svcAuthUrl: env("SVC_AUTH_URL", "http://127.0.0.1:4001"),
  svcCatalogUrl: env("SVC_CATALOG_URL", "http://127.0.0.1:4002"),
  svcPlannerUrl: env("SVC_PLANNER_URL", "http://127.0.0.1:4003"),
  svcHealthUrl: env("SVC_HEALTH_URL", "http://127.0.0.1:4004"),
  /**
   * How long the gateway waits for an upstream before giving up.
   *
   * The hosted database scales to zero, so the first request after a pause
   * has to wake the compute, which takes several seconds. A short timeout
   * turns that into a 502 in front of a perfectly healthy service.
   */
  upstreamTimeoutMs: Number(env("GATEWAY_UPSTREAM_TIMEOUT_MS", "30000")),
  /**
   * How long a single upstream health probe may take.
   *
   * The hosted database scales to zero, so the first query after a pause has
   * to wake the compute, which takes a few seconds. A short timeout makes the
   * health check report a healthy service as down.
   */
  healthTimeoutMs: Number(env("GATEWAY_HEALTH_TIMEOUT_MS", "20000")),
} as const;

export type ServiceConfig = typeof config;
