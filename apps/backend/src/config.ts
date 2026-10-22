import { env, logLevel } from "@glucoplate/config";

/**
 * The backend configuration.
 *
 * One process serves every endpoint. The feature modules under
 * `src/modules/` keep their boundaries, but they talk to each other with
 * direct function calls — there is no HTTP between them, and no second
 * service to wake up.
 */
export const config = {
  /** The service name used in logs and in the `x-service` response header. */
  service: "glucoplate-api" as const,
  /**
   * The port to listen on.
   *
   * Render injects `PORT` for the public interface, which is what the
   * frontend and the mobile app call.
   */
  port: Number(env("PORT", "4000")),
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
  /** Groq LLM configuration (backend only). */
  groqApiKey: env("GROQ_API_KEY", ""),
  llmModel: env("LLM_MODEL", "llama-3.1-8b-instant"),
  /** Demo mode: shows one-click login buttons for personas. */
  demoMode: env("DEMO_MODE", "false") === "true",
} as const;

export type ServiceConfig = typeof config;
