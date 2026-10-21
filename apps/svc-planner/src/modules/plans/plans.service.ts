import {
  PLANNING_AID_NOTICE,
  SLOTS,
  applyOverrides,
  clinicianBannerFor,
  dailyAllowance,
  describePlan,
  exclusionsFor,
  explainPlan,
  generatePlan,
  summariseSlots,
} from "@glucoplate/domain";
import type {
  Dish,
  GeneratePlanRequest,
  GeneratePlanResponse,
  MealPlan,
  MealPlanItem,
  MealSlot,
  PlanItemStatus,
  PlanResult,
  PlanStatus,
  PublicUser,
} from "@glucoplate/types";
import { ApiError } from "../../lib/errors.js";
import { plansRepository, type MealPlanItemRow, type MealPlanRow } from "./plans.repository.js";
import { fetchCatalogue, fetchUser } from "./plans.upstream.js";

/** The title a generated plan carries. */
const PLAN_TITLE = "Daily plan";

/** A plan date is a calendar day, stored at UTC midnight. */
function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** `YYYY-MM-DD` for a plan date. */
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Reads the plan date from the request.
 *
 * A plan is for one calendar day, so the time of day is dropped and the date
 * is pinned to UTC midnight.
 */
export function parsePlanDate(value: unknown): Date {
  if (value === undefined || value === null || value === "") {
    return utcMidnight(new Date());
  }

  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw ApiError.badRequest("planDate must look like YYYY-MM-DD.");
  }

  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest("planDate must look like YYYY-MM-DD.");
  }

  return parsed;
}

/**
 * The numbers the planner works to.
 *
 * A request may override any of them; anything missing or not positive falls
 * back to the caller's own limits.
 */
export function resolveTargets(
  user: PublicUser,
  body: GeneratePlanRequest,
): { budget: number; carbTarget: number; giLimit: number } {
  const requestedBudget = Number(body?.budget);
  const requestedCarbs = Number(body?.carbTarget);
  const requestedGi = Number(body?.giLimit);

  return {
    budget: requestedBudget > 0 ? requestedBudget : dailyAllowance(user),
    carbTarget: requestedCarbs > 0 ? requestedCarbs : user.dailyCarbLimit,
    giLimit: requestedGi > 0 ? requestedGi : user.dailyGiLimit,
  };
}

/** The cost of a dish for the plan: pantry items are free. */
function effectiveCost(dish: Dish): number {
  return dish.isPantryItem ? 0 : dish.cost;
}

/**
 * The plan's average glycemic index, weighted by calories.
 *
 * The same formula the planner uses when it scores a day, so the number in
 * the database means what the message means.
 */
function averageGiOf(dishes: Dish[]): number {
  const calories = dishes.reduce((sum, dish) => sum + dish.calories, 0);
  if (calories <= 0) return 0;

  const weighted = dishes.reduce(
    (sum, dish) => sum + dish.glycemicIndex * dish.calories,
    0,
  );

  return Math.round((weighted / calories) * 10) / 10;
}

/** Maps a stored plan onto the shared `MealPlan` contract. */
export function toMealPlan(row: MealPlanRow): MealPlan {
  return {
    id: row.id,
    userId: row.userId,
    planDate: toDateOnly(row.planDate),
    budget: row.budget,
    totalCost: row.totalCost,
    totalCarbs: row.totalCarbs,
    totalCalories: row.totalCalories,
    averageGi: row.averageGi,
    status: row.status as PlanStatus,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * A saved item, plus the reason the dish was chosen.
 *
 * The shared `MealPlanItem` contract has no `reason` field, so the extra
 * property is added here, in the service, rather than in the shared types.
 */
export type MealPlanItemWithReason = MealPlanItem & { reason: string };

/** A plan whose items carry their reasons. */
export type MealPlanWithReasons = MealPlan & {
  items: MealPlanItemWithReason[];
};

/** Maps a stored item onto the shared `MealPlanItem` contract. */
export function toMealPlanItem(row: MealPlanItemRow): MealPlanItemWithReason {
  return {
    id: row.id,
    planId: row.planId,
    slot: row.slot as MealSlot,
    dishId: row.dishId,
    dishName: row.dishName,
    /** The cost snapshotted at plan time. */
    cost: row.plannedCost,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    calories: row.calories,
    glycemicIndex: row.glycemicIndex,
    status: row.status as PlanItemStatus,
    actualCost: row.actualCost,
    /** Why this dish was chosen, snapshotted with the plan. */
    reason: row.reason,
  };
}

/**
 * The reason text stored on a saved item.
 *
 * The explanations are short sentences, so one line of plain text holds the
 * whole story and reads well next to a saved plan.
 */
export function reasonText(reasons: string[] | undefined): string {
  return (reasons ?? []).filter(Boolean).join(" ");
}

/** Everything the planner worked out for one request. */
type ResolvedPlan = {
  result: PlanResult;
  budget: number;
  carbTarget: number;
  giLimit: number;
  user: PublicUser;
};

export const plansService = {
  /**
   * Runs the planner.
   *
   * The catalogue comes from svc-catalog and the limits from svc-auth; both
   * are cached, so this costs one request each per minute.
   */
  async resolve(
    userId: number,
    authorization: string | undefined,
    body: GeneratePlanRequest,
  ): Promise<ResolvedPlan> {
    const [dishes, user] = await Promise.all([
      fetchCatalogue(authorization),
      fetchUser(userId, authorization),
    ]);

    const { budget, carbTarget, giLimit } = resolveTargets(user, body);

    const generated = generatePlan(dishes, budget, carbTarget, {
      giLimit,
      exclude: exclusionsFor(user),
    });

    // A person can swap a dish in the preview. The swap is applied here so
    // that what they saved is what they saw.
    const { slots, replacedBy } = applyOverrides(
      generated.slots,
      body?.overrides,
      dishes,
      { giLimit },
    );

    const totals = summariseSlots(slots);

    // The reasons are explained against the very numbers the plan was built
    // with, so the sentences quote the caller's own budget, carbohydrate
    // allowance and glycemic index limit.
    const reasons = explainPlan(slots, {
      budget,
      carbTarget,
      giLimit,
      replacedBy,
    });

    const result: PlanResult = {
      ...generated,
      slots,
      reasons,
      totalCost: totals.totalCost,
      totalCarbs: totals.totalCarbs,
      totalCalories: totals.totalCalories,
      highestGi: totals.highestGi,
      withinBudget: totals.totalCost <= budget + 0.0001,
      withinCarbs: totals.totalCarbs <= carbTarget,
      withinGi: giLimit === undefined ? true : totals.highestGi <= giLimit,
      message: describePlan(totals, { budget, carbTarget, giLimit }),
    };

    return { result, budget, carbTarget, giLimit, user };
  },

  /**
   * Builds a plan without saving it.
   *
   * The preview is what the planner screen shows: the plan itself plus the
   * numbers it was built against and the standing safety copy.
   */
  async preview(
    userId: number,
    authorization: string | undefined,
    body: GeneratePlanRequest,
  ): Promise<GeneratePlanResponse> {
    const { result, budget, carbTarget, giLimit, user } = await this.resolve(
      userId,
      authorization,
      body,
    );

    return {
      plan: result,
      budget,
      carbTarget,
      giLimit,
      notice: PLANNING_AID_NOTICE,
      banner: clinicianBannerFor(user),
    };
  },

  /** Builds a plan and stores it. */
  async save(
    userId: number,
    authorization: string | undefined,
    body: GeneratePlanRequest & { planDate?: string },
  ): Promise<{ plan: MealPlan; result: PlanResult; notice: string; banner: string | null }> {
    const { result, budget, user } = await this.resolve(
      userId,
      authorization,
      body,
    );

    const planDate = parsePlanDate(body?.planDate);
    const dishes = SLOTS.map((slot) => result.slots[slot]).filter(
      (dish): dish is Dish => dish !== null,
    );

    const row = await plansRepository.createPlan({
      userId,
      planDate,
      title: PLAN_TITLE,
      budget,
      totalCost: result.totalCost,
      totalCarbs: result.totalCarbs,
      totalCalories: result.totalCalories,
      averageGi: averageGiOf(dishes),
    });

    await plansRepository.createItems(
      SLOTS.flatMap((slot) => {
        const dish = result.slots[slot];
        if (!dish) return [];

        return [
          {
            planId: row.id,
            dishId: dish.id,
            slot,
            dishName: dish.name,
            plannedCost: effectiveCost(dish),
            carbsG: dish.carbsG,
            proteinG: dish.proteinG,
            calories: dish.calories,
            glycemicIndex: dish.glycemicIndex,
            servings: 1,
            /** Why this dish was chosen, saved with the plan. */
            reason: reasonText(result.reasons[slot]),
          },
        ];
      }),
    );

    return {
      plan: toMealPlan(row),
      result,
      notice: PLANNING_AID_NOTICE,
      banner: clinicianBannerFor(user),
    };
  },

  /** The caller's plans, newest first, each with its items. */
  async list(userId: number): Promise<MealPlanWithReasons[]> {
    const plans = await plansRepository.listForUser(userId);
    if (plans.length === 0) return [];

    const items = await plansRepository.listItems(plans.map((plan) => plan.id));

    return plans.map((plan) => ({
      ...toMealPlan(plan),
      items: items
        .filter((item) => item.planId === plan.id)
        .map(toMealPlanItem),
    }));
  },

  /** Deletes one of the caller's plans. */
  async remove(userId: number, planId: number): Promise<void> {
    const deleted = await plansRepository.deleteOwned(planId, userId);
    if (deleted === 0) {
      throw ApiError.notFound("Plan not found.");
    }
  },

  /**
   * Marks an item as eaten or skipped.
   *
   * The item is only reachable through its plan, so the ownership check runs
   * against the plan the item belongs to.
   */
  async updateItem(
    userId: number,
    body: { itemId: number; status: PlanItemStatus },
  ): Promise<{ success: true; item: MealPlanItemWithReason }> {
    const itemId = Number(body?.itemId);
    const status = String(body?.status ?? "") as PlanItemStatus;

    if (!Number.isFinite(itemId) || itemId <= 0) {
      throw ApiError.badRequest("itemId is required.");
    }

    if (!["planned", "eaten", "skipped"].includes(status)) {
      throw ApiError.badRequest("status must be planned, eaten or skipped.");
    }

    const existing = await plansRepository.findItemWithPlan(itemId);
    if (!existing) {
      throw ApiError.notFound("Plan item not found.");
    }

    if (existing.plan.userId !== userId) {
      throw ApiError.notFound("Plan item not found.");
    }

    const item = await plansRepository.updateItemStatus(itemId, status);

    // The plan's cost follows the items: anything skipped is not paid for.
    const totalCost = await plansRepository.sumPlannedCost(existing.planId);
    await plansRepository.updatePlanTotalCost(existing.planId, totalCost);

    return { success: true, item: toMealPlanItem(item) };
  },
};
