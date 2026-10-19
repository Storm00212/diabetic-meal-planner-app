/**
 * Local Postgres for development.
 *
 * The monorepo uses the database-per-service pattern, so local development
 * needs one database per service. This script starts four embedded Postgres
 * instances (PGlite behind a real Postgres wire-protocol socket) — one per
 * service — so nothing has to be installed on the host.
 *
 *   npm run db:local          start all four (Ctrl+C to stop)
 *   npm run db:local:reset    wipe the local data directories
 *
 * Ports:
 *   auth    5432
 *   catalog 5433
 *   planner 5434
 *   health  5435
 *
 * The matching per-service `.env` files are written by `npm run env:sync`.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

export const SERVICES = [
  { name: "auth", port: 5432 },
  { name: "catalog", port: 5433 },
  { name: "planner", port: 5434 },
  { name: "health", port: 5435 },
];

const serverEntry = join(
  root,
  "node_modules",
  "@electric-sql",
  "pglite-socket",
  "dist",
  "scripts",
  "server.js",
);

if (!existsSync(serverEntry)) {
  console.error(
    "pglite-socket is not installed. Run `npm install` at the repository root.",
  );
  process.exit(1);
}

if (process.argv.includes("--reset")) {
  for (const service of SERVICES) {
    rmSync(join(root, ".pgdata", service.name), {
      recursive: true,
      force: true,
    });
  }
  console.log("Local databases wiped.");
  process.exit(0);
}

const children = [];

for (const service of SERVICES) {
  const dataDir = join(root, ".pgdata", service.name);
  mkdirSync(dataDir, { recursive: true });

  const child = spawn(
    process.execPath,
    [
      serverEntry,
      "-d",
      dataDir,
      "-p",
      String(service.port),
      "-h",
      "127.0.0.1",
      "-m",
      "10",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const prefix = `[db:${service.name}:${service.port}]`;
  child.stdout.on("data", (chunk) => {
    for (const line of String(chunk).split("\n")) {
      if (line.trim()) console.log(`${prefix} ${line}`);
    }
  });
  child.stderr.on("data", (chunk) => {
    for (const line of String(chunk).split("\n")) {
      if (line.trim()) console.error(`${prefix} ${line}`);
    }
  });

  child.on("exit", (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });

  children.push(child);
}

console.log("");
console.log("  Local Postgres is running — one database per service.");
for (const service of SERVICES) {
  console.log(
    `    ${service.name.padEnd(8)} postgresql://postgres:postgres@127.0.0.1:${service.port}/postgres`,
  );
}
console.log("");
console.log("  Press Ctrl+C to stop all of them.");
console.log("");

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
