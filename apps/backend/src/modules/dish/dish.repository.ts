import type { Prisma } from "../../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

/** The row type Prisma returns for a dish. */
export type DishRow = Prisma.DishGetPayload<Record<string, never>>;

/**
 * The rows a caller may see: the shared catalogue plus their own dishes.
 *
 * The catalogue is every row with no owner (`userId` is null).
 */
function visibleTo(userId: number): Prisma.DishWhereInput {
  return { OR: [{ userId: null }, { userId }] };
}

export const dishRepository = {
  async findVisibleTo(userId: number): Promise<DishRow[]> {
    return prisma.dish.findMany({
      where: visibleTo(userId),
      orderBy: [{ source: "asc" }, { name: "asc" }],
    });
  },

  async findById(id: number): Promise<DishRow | null> {
    return prisma.dish.findUnique({ where: { id } });
  },

  /** Counts the shared catalogue, ignoring every user's own dishes. */
  async countCatalogue(): Promise<number> {
    return prisma.dish.count({ where: { userId: null } });
  },

  async create(data: Prisma.DishUncheckedCreateInput): Promise<DishRow> {
    return prisma.dish.create({ data });
  },

  /**
   * Updates a dish the caller owns.
   *
   * The owner is part of the query, so a catalogue dish (or somebody else's
   * dish) is never touched. The count tells the caller whether anything was
   * actually updated.
   */
  async updateOwned(
    id: number,
    userId: number,
    data: Prisma.DishUpdateManyMutationInput,
  ): Promise<number> {
    const { count } = await prisma.dish.updateMany({
      where: { id, userId },
      data,
    });
    return count;
  },

  /** Deletes a dish the caller owns. Same ownership rule as `updateOwned`. */
  async deleteOwned(id: number, userId: number): Promise<number> {
    const { count } = await prisma.dish.deleteMany({
      where: { id, userId },
    });
    return count;
  },

  /** Totals and averages over the shared catalogue plus the caller's dishes. */
  async stats(userId: number): Promise<{
    total: number;
    avgCost: number;
    avgGi: number;
  }> {
    const aggregate = await prisma.dish.aggregate({
      where: visibleTo(userId),
      _count: { _all: true },
      _avg: { cost: true, glycemicIndex: true },
    });

    return {
      total: aggregate._count._all,
      avgCost: aggregate._avg.cost ?? 0,
      avgGi: aggregate._avg.glycemicIndex ?? 0,
    };
  },
};
