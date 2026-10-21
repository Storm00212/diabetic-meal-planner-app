/**
 * Database tasks for one deployable unit.
 *
 *   node scripts/db-units.mjs generate   the Backend API's Prisma client
 *   node scripts/db-units.mjs push       apply the schema
 *   node scripts/db-units.mjs seed       load the demo data
 *
 * Every task reads DATABASE_URL and DIRECT_DATABASE_URL from the
 * environment, so it works the same on a laptop and on a build host.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The Backend API — the only unit that touches the database. */
const BACKEND = "backend";

/**
 * The unit's own `.env` first, then the repository's.
 *
 * dotenv never overrides a variable that is already set, so the unit's file
 * wins. `npm run env:sync` decides what goes in it — the local database by
 * default, the hosted one with `--neon`.
 */
loadEnv({ path: join(root, "apps", BACKEND, ".env") });
loadEnv({ path: join(root, ".env.local") });
loadEnv({ path: join(root, ".env") });

function run(command, args, cwd) {
  console.log(`\n  $ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\n  FAILED: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

switch (process.argv[2]) {
  case "generate":
    run("npx", ["prisma", "generate"], join(root, "apps", BACKEND));
    break;

  case "push":
    run(
      "npx",
      ["prisma", "db", "push", "--skip-generate"],
      join(root, "apps", BACKEND),
    );
    break;

  case "seed":
    run("npx", ["tsx", "prisma/seed.ts"], join(root, "apps", BACKEND));
    break;

  default:
    console.error('Unknown task. Use one of: generate, push, seed.');
    process.exit(1);
}
