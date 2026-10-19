import type { Prisma } from "../../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

/** The row type Prisma returns for a weight log. */
export type WeightLogRow = Prisma.WeightLogGetPayload<Record<string, never>>;

/** The row type Prisma returns for a weight target. */
export type WeightTargetRow = Prisma.WeightTargetGetPayload<Record<string, never>>;

/**
 * Database access for the weight tables.
 *
 * Every query is scoped by `userId`, so one caller can never read or write
 * another caller's rows.
 */
export const weightRepository = {
  async listByUser(userId: number): Promise<WeightLogRow[]> {
    return prisma.weightLog.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
  },

  async latestByUser(userId: number): Promise<WeightLogRow | null> {
    return prisma.weightLog.findFirst({
      where: { userId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
  },

  async create(data: {
    userId: number;
    weight: number;
    date: Date;
    note: string;
  }): Promise<WeightLogRow> {
    return prisma.weightLog.create({ data });
  },

  async findTarget(userId: number): Promise<WeightTargetRow | null> {
    return prisma.weightTarget.findUnique({ where: { userId } });
  },

  async upsertTarget(
    userId: number,
    data: { currentWeight: number | null; targetWeight: number | null },
  ): Promise<WeightTargetRow> {
    return prisma.weightTarget.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data, updatedAt: new Date() },
    });
  },
};
