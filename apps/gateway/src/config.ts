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
  /** How long the gateway waits for an upstream before giving up. */
  upstreamTimeoutMs: Number(env("GATEWAY_UPSTREAM_TIMEOUT_MS", "15000")),
  /** How long a single upstream health probe may take. */
  healthTimeoutMs: Number(env("GATEWAY_HEALTH_TIMEOUT_MS", "2500")),
} as const;

export type ServiceConfig = typeof config;
