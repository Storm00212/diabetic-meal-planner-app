import type { Prisma } from "../../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

/** The row type Prisma returns for a meal plan. */
export type MealPlanRow = Prisma.MealPlanGetPayload<Record<string, never>>;

/** The row type Prisma returns for a meal plan item. */
export type MealPlanItemRow = Prisma.MealPlanItemGetPayload<Record<string, never>>;

/** A plan with its items attached. */
export type MealPlanWithItemsRow = Prisma.MealPlanGetPayload<{
  include: { items: true };
}>;

export const plansRepository = {
  async createPlan(data: {
    userId: number;
    planDate: Date;
    title: string;
    budget: number;
    totalCost: number;
    totalCarbs: number;
    totalCalories: number;
    averageGi: number;
    status?: string;
    notes?: string;
  }): Promise<MealPlanRow> {
    return prisma.mealPlan.create({
      data: {
        userId: data.userId,
        planDate: data.planDate,
        title: data.title,
        budget: data.budget,
        totalCost: data.totalCost,
        totalCarbs: data.totalCarbs,
        totalCalories: data.totalCalories,
        averageGi: data.averageGi,
        status: data.status ?? "planned",
        notes: data.notes ?? "",
      },
    });
  },

  async createItems(
    items: {
      planId: number;
      dishId: number;
      slot: string;
      dishName: string;
      plannedCost: number;
      carbsG: number;
      proteinG: number;
      calories: number;
      glycemicIndex: number;
      servings?: number;
      /** Why the dish was chosen, saved with the item. */
      reason?: string;
    }[],
  ): Promise<void> {
    if (items.length === 0) return;

    await prisma.mealPlanItem.createMany({ data: items });
  },

  /** The caller's plans, newest first. */
  async listForUser(userId: number): Promise<MealPlanRow[]> {
    return prisma.mealPlan.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { planDate: "desc" }],
    });
  },

  async listItems(planIds: number[]): Promise<MealPlanItemRow[]> {
    if (planIds.length === 0) return [];

    return prisma.mealPlanItem.findMany({
      where: { planId: { in: planIds } },
      orderBy: { id: "asc" },
    });
  },

  /** A plan, but only when the caller owns it. */
  async findOwned(planId: number, userId: number): Promise<MealPlanRow | null> {
    return prisma.mealPlan.findFirst({ where: { id: planId, userId } });
  },

  /** Deletes a plan the caller owns. Returns how many rows went. */
  async deleteOwned(planId: number, userId: number): Promise<number> {
    const result = await prisma.mealPlan.deleteMany({
      where: { id: planId, userId },
    });

    return result.count;
  },

  /** An item together with the plan it belongs to, for the ownership check. */
  async findItemWithPlan(itemId: number): Promise<
    (MealPlanItemRow & { plan: MealPlanRow }) | null
  > {
    return prisma.mealPlanItem.findUnique({
      where: { id: itemId },
      include: { plan: true },
    });
  },

  async updateItemStatus(itemId: number, status: string): Promise<MealPlanItemRow> {
    return prisma.mealPlanItem.update({
      where: { id: itemId },
      data: { status },
    });
  },

  /**
   * The plan's running cost: every item that has not been skipped.
   *
   * The costs are snapshotted onto the items, so this stays correct even when
   * the price of a dish changes later.
   */
  async sumPlannedCost(planId: number): Promise<number> {
    const items = await prisma.mealPlanItem.findMany({
      where: { planId, status: { not: "skipped" } },
      select: { plannedCost: true },
    });

    return items.reduce((sum, item) => sum + item.plannedCost, 0);
  },

  async updatePlanTotalCost(planId: number, totalCost: number): Promise<MealPlanRow> {
    return prisma.mealPlan.update({
      where: { id: planId },
      data: { totalCost },
    });
  },
};
