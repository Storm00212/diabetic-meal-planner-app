/**
 * Applies the schema to the database.
 *
 * GlucoPlate runs one Postgres database shared by all four services, so the
 * schema that is pushed is the combined one in `prisma/schema.prisma` — the
 * union of the four service schemas. It is regenerated first, so it can never
 * drift from the models the services actually use.
 *
 *   npm run db:push
 *
 * The environment is loaded from `.env.local` / `.env` because the Prisma CLI
 * only reads `.env` on its own.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

loadEnv({ path: join(root, ".env.local") });
loadEnv({ path: join(root, ".env") });

/**
 * By default the schema is applied to the LOCAL database, which is fast and
 * works offline. `npm run db:push -- --neon` applies it to the shared hosted
 * database instead — the same flag `npm run env:sync -- --neon` uses, so the
 * services and the schema always point at the same place.
 */
const useNeon = process.argv.includes("--neon");

const LOCAL_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&connection_limit=2&connect_timeout=15&pool_timeout=15";
const LOCAL_DIRECT_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const databaseUrl = useNeon
  ? (process.env.DATABASE_URL ?? LOCAL_URL)
  : LOCAL_URL;
const directUrl = useNeon
  ? (process.env.DIRECT_DATABASE_URL ?? databaseUrl)
  : LOCAL_DIRECT_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_DATABASE_URL = directUrl;

const cli = join(root, "node_modules", "prisma", "build", "index.js");
if (!existsSync(cli)) {
  console.error("Prisma is not installed. Run `npm install` at the repository root.");
  process.exit(1);
}

const args = [
  cli,
  "db",
  "push",
  "--schema",
  join(root, "prisma", "schema.prisma"),
  "--skip-generate",
];

if (process.argv.includes("--accept-data-loss")) {
  args.push("--accept-data-loss");
}

const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
