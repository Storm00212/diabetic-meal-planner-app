import { env, logLevel } from "@glucoplate/config";

/**
 * Every service reads its own `.env` file. The root `npm run env:sync` script
 * copies the shared values out of the root `.env.local` and gives each
 * service its own database URL.
 */
export const config = {
  /** The service name used in logs and in the `x-service` response header. */
  service: "svc-planner" as const,
  port: Number(env("PORT", "4003")),
  databaseUrl: env("DATABASE_URL"),
  directDatabaseUrl: env("DIRECT_DATABASE_URL"),
  jwtSecret: env(
    "JWT_SECRET",
    "glucoplate-development-only-secret-change-me-please",
  ),
  corsOrigins: env("CORS_ORIGINS", "*"),
  logLevel: logLevel(),
  /** How long an access token stays valid, in seconds. */
  tokenTtlSeconds: Number(env("JWT_TTL_SECONDS", String(60 * 60 * 24 * 7))),
  /** Where svc-auth lives — the planner reads the caller's clinical limits from it. */
  svcAuthUrl: env("SVC_AUTH_URL", "http://127.0.0.1:4001"),
  /** Where svc-catalog lives — the planner reads the dish catalogue from it. */
  svcCatalogUrl: env("SVC_CATALOG_URL", "http://127.0.0.1:4002"),
} as const;

export type ServiceConfig = typeof config;
