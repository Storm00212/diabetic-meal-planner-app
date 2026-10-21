import { config } from "../config.js";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level | "silent", number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/**
 * Structured console logging.
 *
 * Every line carries the service name and, when the request context is
 * available, the request id. That is what makes it possible to follow one
 * request from the browser through the gateway into this service.
 */
function write(
  level: Level,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[config.logLevel]) return;

  const parts = [
    new Date().toISOString(),
    level.toUpperCase().padEnd(5),
    config.service.padEnd(10),
    message,
  ];

  if (meta && Object.keys(meta).length > 0) {
    parts.push(JSON.stringify(meta));
  }

  const line = parts.join(" ");
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    write("error", message, meta),
};
