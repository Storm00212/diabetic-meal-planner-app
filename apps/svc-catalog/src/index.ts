import "./env.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`listening on http://127.0.0.1:${config.port}`, {
    port: config.port,
    database: config.databaseUrl ? "configured" : "NOT CONFIGURED",
  });
});

async function shutdown(signal: string) {
  logger.info(`received ${signal}, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
