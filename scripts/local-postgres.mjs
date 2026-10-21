/**
 * Local Postgres for development.
 *
 * GlucoPlate runs one Postgres database shared by all four services, so this
 * starts a single embedded Postgres (PGlite behind a real Postgres
 * wire-protocol socket). Nothing has to be installed on the host.
 *
 *   npm run db:local          start it (Ctrl+C to stop)
 *   npm run db:local:reset    wipe the local data directory
 *
 *   host: 127.0.0.1
 *   port: 5432
 *   user: postgres
 *   pass: postgres
 *   db:   postgres
 *
 * The per-service `.env` files are written by `npm run env:sync`.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/** The one database every service uses. */
const SERVICE = { name: "glucoplate", port: 5432 };

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
  rmSync(join(root, ".pgdata"), { recursive: true, force: true });
  console.log("Local database wiped.");
  process.exit(0);
}

const children = [];

/** Starts the database and resolves once it is listening. */
function start(service) {
  return new Promise((resolve, reject) => {
    const dataDir = join(root, ".pgdata");
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
        "20",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const prefix = `[db:${service.port}]`;
    let settled = false;

    const onLine = (line) => {
      if (line.trim()) console.log(`${prefix} ${line}`);
      if (!settled && line.includes("listening on")) {
        settled = true;
        resolve(child);
      }
    };

    child.stdout.on("data", (chunk) => {
      for (const line of String(chunk).split("\n")) onLine(line);
    });
    child.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split("\n")) {
        if (line.trim()) console.error(`${prefix} ${line}`);
      }
    });

    child.on("exit", (code) => {
      console.log(`${prefix} exited with code ${code}`);
      if (!settled) {
        settled = true;
        reject(new Error(`the database exited with code ${code}`));
      }
    });

    children.push(child);
  });
}

try {
  await start(SERVICE);
} catch (error) {
  console.error("Could not start the local database:", error.message);
  console.error("Is the port already in use? Stop the other process and retry.");
  process.exit(1);
}

console.log("");
console.log("  Local Postgres is running — one database, shared by every service.");
console.log(
  `    postgresql://postgres:postgres@127.0.0.1:${SERVICE.port}/postgres`,
);
console.log("");
console.log("  Press Ctrl+C to stop it.");
console.log("");

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
