/**
 * Writes one `.env` file per service and per client.
 *
 * The repository root holds the shared values (`.env.local`). Every service
 * needs its own database URL and port, so this script fans the shared values
 * out into the individual workspaces.
 *
 *   npm run env:sync
 *
 * The generated files are git-ignored. Run it again after changing the
 * database URLs.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const SERVICE_PORTS = {
  auth: 4001,
  catalog: 4002,
  planner: 4003,
  health: 4004,
};

/**
 * One database, shared by every service.
 *
 * The services still own their tables — each generates a client for only its
 * own models — but they all point at the same Postgres.
 *
 * The pool parameters matter. Neon Free allows 10 concurrent connections per
 * branch, and Prisma's default pool is `num_cpus * 2 + 1` per client. Four
 * services on one database would open far more than 10, and Neon answers the
 * overflow by force-closing live connections ("An existing connection was
 * forcibly closed by the remote host"). So:
 *
 *   pgbouncer=true     the pooler is in transaction mode, so Prisma must not
 *                      use prepared statements
 *   connection_limit=2 two connections per service, four services, plus room
 *   connect_timeout=15 Neon scales to zero, and waking the compute takes a
 *                      few seconds
 *   pool_timeout=15    do not fail fast while the pool is busy
 */
const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&connection_limit=1&connect_timeout=15&pool_timeout=15";
const LOCAL_DIRECT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const SERVICE_DIRS = {
  auth: "svc-auth",
  catalog: "svc-catalog",
  planner: "svc-planner",
  health: "svc-health",
};

/** Reads a KEY=value map out of a dotenv file. */
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    values[trimmed.slice(0, index).trim()] = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return values;
}

const rootEnv = {
  ...readEnvFile(join(root, ".env")),
  ...readEnvFile(join(root, ".env.local")),
  // Environment variables win, so this script also works on a build host
  // (Render) where the values are injected rather than written to a file.
  ...process.env,
};

const jwtSecret =
  rootEnv.JWT_SECRET ??
  "glucoplate-development-only-secret-change-me-please";

const CORS_ORIGINS =
  rootEnv.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:8081,*";

/**
 * Adds the pool parameters Prisma and the host pooler need.
 *
 * `pgbouncer=true`     only for a POOLED endpoint (the hostname contains
 *                       "-pooler"): the pooler is in transaction mode, so
 *                       Prisma must not use prepared statements
 * `connection_limit=N` Prisma's own pool size, kept small so four services
 *                       sharing one database stay under the host's limit
 * `connect_timeout=15` the host scales to zero, and waking the compute takes
 *                       seconds
 * `pool_timeout=15`    do not fail fast while the pool is busy
 */
function withPoolParams(url) {
  if (!url) return url;

  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);

  if (base.includes("-pooler") && !params.has("pgbouncer")) {
    params.set("pgbouncer", "true");
  }
  if (!params.has("connection_limit")) params.set("connection_limit", "1");
  if (!params.has("connect_timeout")) params.set("connect_timeout", "15");
  if (!params.has("pool_timeout")) params.set("pool_timeout", "15");

  return `${base}?${params.toString()}`;
}

/** Removes `pgbouncer=true` from a connection string. */
function stripPgBouncer(url) {
  if (!url) return url;
  return url.replace(/[?&]pgbouncer=true/, "").replace(/[?&]$/, "");
}

let written = 0;

for (const [name, port] of Object.entries(SERVICE_PORTS)) {
  const dir = join(root, "apps", SERVICE_DIRS[name]);
  if (!existsSync(dir)) continue;

  mkdirSync(dir, { recursive: true });

  const localUrl = `postgresql://postgres:postgres@127.0.0.1:5432/postgres`;
  // The runtime URL goes through a transaction-mode pooler (PgBouncer), so
  // Prisma must be told not to use prepared statements.
  //
  // By default the services point at the LOCAL database, which is fast and
  // works offline. `npm run env:sync -- --neon` points them at the shared
  // hosted database instead.
  const useNeon = process.argv.includes("--neon");
  const remoteUrl =
    rootEnv.DATABASE_URL ?? rootEnv[`${name.toUpperCase()}_DATABASE_URL`];

  const databaseUrl = useNeon && remoteUrl
    ? withPoolParams(remoteUrl)
    : withPoolParams(LOCAL_DATABASE_URL);

  // The direct URL bypasses the pooler and is used for schema operations.
  // When the host only offers a pooled endpoint (Neon does), the same URL is
  // used for both, with `pgbouncer=true` so Prisma does not try prepared
  // statements through the pooler.
  const directDatabaseUrl =
    rootEnv.DIRECT_DATABASE_URL ??
    (useNeon && rootEnv.DIRECT_DATABASE_URL
      ? rootEnv.DIRECT_DATABASE_URL
      : useNeon
        ? databaseUrl
        : LOCAL_DIRECT_DATABASE_URL);

  const lines = [
    "# Generated by `npm run env:sync`. Git-ignored.",
    `PORT=${port}`,
    `SERVICE_NAME=svc-${name}`,
    `DATABASE_URL=${databaseUrl}`,
    `DIRECT_DATABASE_URL=${directDatabaseUrl}`,
    `JWT_SECRET=${jwtSecret}`,
    `CORS_ORIGINS=${CORS_ORIGINS}`,
    "LOG_LEVEL=info",
    "",
    "# Where the other services live (used for service-to-service calls).",
    `SVC_AUTH_URL=http://127.0.0.1:${SERVICE_PORTS.auth}`,
    `SVC_CATALOG_URL=http://127.0.0.1:${SERVICE_PORTS.catalog}`,
    `SVC_PLANNER_URL=http://127.0.0.1:${SERVICE_PORTS.planner}`,
    `SVC_HEALTH_URL=http://127.0.0.1:${SERVICE_PORTS.health}`,
    "",
  ];

  writeFileSync(join(dir, ".env"), lines.join("\n"), "utf8");
  written += 1;
  console.log(`  wrote apps/${SERVICE_DIRS[name]}/.env`);
}

// The gateway and the two clients.
const gatewayDir = join(root, "apps", "gateway");
if (existsSync(gatewayDir)) {
  mkdirSync(gatewayDir, { recursive: true });
  writeFileSync(
    join(gatewayDir, ".env"),
    [
      "# Generated by `npm run env:sync`. Git-ignored.",
      "PORT=4000",
      "SERVICE_NAME=gateway",
      `JWT_SECRET=${jwtSecret}`,
      `CORS_ORIGINS=${CORS_ORIGINS}`,
      "LOG_LEVEL=info",
      `SVC_AUTH_URL=http://127.0.0.1:${SERVICE_PORTS.auth}`,
      `SVC_CATALOG_URL=http://127.0.0.1:${SERVICE_PORTS.catalog}`,
      `SVC_PLANNER_URL=http://127.0.0.1:${SERVICE_PORTS.planner}`,
      `SVC_HEALTH_URL=http://127.0.0.1:${SERVICE_PORTS.health}`,
      "",
    ].join("\n"),
    "utf8",
  );
  written += 1;
  console.log("  wrote apps/gateway/.env");
}

const webDir = join(root, "apps", "web");
if (existsSync(webDir)) {
  mkdirSync(webDir, { recursive: true });
  writeFileSync(
    join(webDir, ".env.local"),
    [
      "# Generated by `npm run env:sync`. Git-ignored.",
      "VITE_API_URL=http://127.0.0.1:4000",
      "VITE_SVC_AUTH_URL=http://127.0.0.1:4001",
      "VITE_SVC_CATALOG_URL=http://127.0.0.1:4002",
      "VITE_SVC_PLANNER_URL=http://127.0.0.1:4003",
      "VITE_SVC_HEALTH_URL=http://127.0.0.1:4004",
      "VITE_DEBUG_API=false",
      "",
    ].join("\n"),
    "utf8",
  );
  written += 1;
  console.log("  wrote apps/web/.env.local");
}

const mobileDir = join(root, "apps", "mobile");
if (existsSync(mobileDir)) {
  mkdirSync(mobileDir, { recursive: true });
  writeFileSync(
    join(mobileDir, ".env"),
    [
      "# Generated by `npm run env:sync`. Git-ignored.",
      "EXPO_PUBLIC_API_URL=http://127.0.0.1:4000",
      "EXPO_PUBLIC_SVC_AUTH_URL=http://127.0.0.1:4001",
      "EXPO_PUBLIC_SVC_CATALOG_URL=http://127.0.0.1:4002",
      "EXPO_PUBLIC_SVC_PLANNER_URL=http://127.0.0.1:4003",
      "EXPO_PUBLIC_SVC_HEALTH_URL=http://127.0.0.1:4004",
      "EXPO_PUBLIC_DEBUG=false",
      "",
    ].join("\n"),
    "utf8",
  );
  written += 1;
  console.log("  wrote apps/mobile/.env");
}

console.log(`env:sync — wrote ${written} file(s).`);
