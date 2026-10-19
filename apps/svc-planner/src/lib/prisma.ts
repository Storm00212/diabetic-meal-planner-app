import { PrismaClient } from "../../generated/prisma/index.js";

/**
 * One Prisma client per process.
 *
 * In development `tsx watch` restarts the process on every change, so the
 * client is cached on `globalThis` to avoid exhausting the database's
 * connection limit.
 *
 * The client comes from this service's own generated folder rather than from
 * `@prisma/client`: every service in the monorepo has its own schema, and
 * the shared default folder only ever holds the client of the service that
 * generated last.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  __glucoplatePrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.__glucoplatePrisma ??
  new PrismaClient({
    log:
      process.env.PRISMA_LOG === "query"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__glucoplatePrisma = prisma;
}
