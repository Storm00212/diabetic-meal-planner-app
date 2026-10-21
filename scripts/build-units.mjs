/**
 * Builds one deployable unit.
 *
 * The monorepo is deployed as three units:
 *
 *   backend   the Backend API — one Express app, one database
 *   web       the Vite single page app
 *   mobile    the Expo app
 *
 * Each unit can be built on its own, from its own directory, without
 * Turborepo. The shared packages are built first, in dependency order, so a
 * fresh checkout — where the packages' `dist/` folders do not exist — still
 * builds.
 *
 *   node scripts/build-units.mjs backend
 *   node scripts/build-units.mjs web
 *   node scripts/build-units.mjs mobile
 *
 * It is deliberately plain `tsc` and `vite` rather than Turborepo, so that
 * pointing a host's build command at one unit cannot recurse into the task
 * that called it.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The shared packages, in dependency order. */
const PACKAGES = ["config", "types", "data", "ui", "domain", "api-client"];

/** The Backend API — the only unit that touches the database. */
const BACKEND = "backend";

function run(command, args, cwd) {
  const label = `${command} ${args.join(" ")}`.slice(0, 90);
  console.log(`\n  $ ${label}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`\n  FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

/** Builds the shared packages, in the order they depend on each other. */
function buildPackages() {
  console.log("\nBuilding the shared packages");
  for (const name of PACKAGES) {
    run("npx", ["tsc", "-p", join("packages", name, "tsconfig.json")], root);
  }
}

/** Generates the Backend API's Prisma client. */
function generateClients() {
  console.log("\nGenerating the Prisma client");
  run("npx", ["prisma", "generate"], join(root, "apps", BACKEND));
}

/** Type-checks a unit. */
function typecheck(name) {
  run("npx", ["tsc", "-p", "tsconfig.json", "--noEmit"], join(root, "apps", name));
}

const unit = process.argv[2];

switch (unit) {
  case "backend": {
    buildPackages();
    generateClients();
    console.log("\nType-checking the backend");
    typecheck(BACKEND);
    console.log("\nBackend built.");
    break;
  }

  case "web": {
    buildPackages();
    console.log("\nBuilding the web app");
    run("npx", ["vite", "build"], join(root, "apps", "web"));
    console.log("\nWeb app built -> apps/web/dist");
    break;
  }

  case "mobile": {
    buildPackages();
    console.log("\nBundling the mobile app");
    run("npx", ["expo", "export", "--platform", "android"], join(root, "apps", "mobile"));
    console.log("\nMobile app bundled -> apps/mobile/dist");
    break;
  }

  default:
    console.error(
      `Unknown unit "${unit}". Use one of: backend, web, mobile.`,
    );
    process.exit(1);
}
