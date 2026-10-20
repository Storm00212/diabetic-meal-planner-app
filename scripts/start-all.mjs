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
const restarts = new Map();

/**
 * Starts one service and supervises it.
 *
 * If a service dies it is restarted, because a crashed child should not
 * permanently break the whole stack. The restart is logged so a crash loop
 * is visible rather than silent.
 */
function start(name, cwd, extraEnv = {}) {
  const child = spawn(
    process.execPath,
    [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"],
    {
      cwd,
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
    if (shuttingDown) return;

    const count = (restarts.get(name) ?? 0) + 1;
    restarts.set(name, count);

    if (count > 5) {
      console.error(
        `${prefix} exited with code ${code} and has been restarted ${count - 1} times. Giving up.`,
      );
      return;
    }

    console.error(
      `${prefix} exited with code ${code}. Restarting in 2s (attempt ${count}).`,
    );
    setTimeout(() => start(name, cwd, extraEnv), 2000);
  });

  children.push(child);
  return child;
}

// The domain services first, so the gateway has something to talk to.
for (const service of SERVICES) {
  start(
    service.name,
    join(root, "apps", service.workspace.replace("@glucoplate/", "")),
  );
}

// The gateway last: it binds the public $PORT.
start("gateway", join(root, "apps", "gateway"));

let shuttingDown = false;

function shutdown() {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
