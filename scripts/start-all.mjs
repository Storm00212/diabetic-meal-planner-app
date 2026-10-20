/**
 * Runs the whole backend in one process group.
 *
 * The monorepo keeps five independent services, each with its own port and
 * its own database. In production on a free tier, running them as five
 * separate Render services would cost five times the 750 free
 * instance-hours, so instead they all run inside ONE container and the
 * gateway proxies to the others over localhost.
 *
 *   npm run start:all
 *
 * The gateway listens on $PORT (the port the host injects). The domain
 * services listen on 4001-4004 inside the container.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const SERVICES = [
  { name: "svc-auth", workspace: "@glucoplate/svc-auth", port: 4001 },
  { name: "svc-catalog", workspace: "@glucoplate/svc-catalog", port: 4002 },
  { name: "svc-planner", workspace: "@glucoplate/svc-planner", port: 4003 },
  { name: "svc-health", workspace: "@glucoplate/svc-health", port: 4004 },
];

const children = [];

function start(name, workspace, extraEnv = {}) {
  const child = spawn(
    process.execPath,
    [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"],
    {
      cwd: join(root, "apps", workspace.replace("@glucoplate/", "")),
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const prefix = `[${name}]`;
  const forward = (stream) => (chunk) => {
    for (const line of String(chunk).split("\n")) {
      if (line.trim()) stream.write(`${prefix} ${line}\n`);
    }
  };

  child.stdout.on("data", forward(process.stdout));
  child.stderr.on("data", forward(process.stderr));

  child.on("exit", (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });

  children.push(child);
  return child;
}

// The domain services first, so the gateway has something to talk to.
for (const service of SERVICES) {
  start(service.name, service.workspace);
}

// The gateway last: it binds the public $PORT.
const gateway = spawn(
  process.execPath,
  [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"],
  {
    cwd: join(root, "apps", "gateway"),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const forward = (stream) => (chunk) => {
  for (const line of String(chunk).split("\n")) {
    if (line.trim()) stream.write(`[gateway] ${line}\n`);
  }
};
gateway.stdout.on("data", forward(process.stdout));
gateway.stderr.on("data", forward(process.stderr));
gateway.on("exit", (code) => console.log(`[gateway] exited with code ${code}`));
children.push(gateway);

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
