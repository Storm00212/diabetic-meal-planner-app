import type { AnalyticsResponse } from "@glucoplate/types";
import { plansRepository } from "../plans/plans.repository.js";

/**
 * Analytics reads the caller's saved plans straight from the database.
 *
 * The plans used to live in another service and had to be fetched over HTTP,
 * with a cache and a fallback so the dashboard never broke. Now it is one
 * query for the plans and one for their items.
 */

/** Rounds a money value to two decimals. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Formats a stored day as an ISO date. */
function isoDay(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * Turns the plans into the dashboard's numbers.
 *
 * - the summary adds up the budget and the spend of every plan,
 * - the carb trend is the last seven plans, oldest first,
 * - the nutrition distribution counts the items that were actually eaten,
 *   grouped by the glycemic index snapshotted on the item.
 */
function computeAnalytics(
  plans: {
    planDate: Date | string;
    budget: number;
    totalCost: number;
    totalCarbs: number;
  }[],
  items: { status: string; glycemicIndex: number }[],
): AnalyticsResponse {
  const totalBudget = plans.reduce((sum, plan) => sum + plan.budget, 0);
  const totalSpent = plans.reduce((sum, plan) => sum + plan.totalCost, 0);

  const recent = [...plans]
    .sort((a, b) => isoDay(b.planDate).localeCompare(isoDay(a.planDate)))
    .slice(0, 7);

  const carbTrends = recent
    .reverse()
    .map((plan) => ({
      date: isoDay(plan.planDate),
      carbs: plan.totalCarbs,
    }));

  const giCounts = new Map<number, number>();
  for (const item of items) {
    if (String(item.status ?? "") !== "eaten") continue;
    giCounts.set(item.glycemicIndex, (giCounts.get(item.glycemicIndex) ?? 0) + 1);
  }

  const nutritionDist = [...giCounts.entries()]
    .map(([gi, count]) => ({ gi, count }))
    .sort((a, b) => a.gi - b.gi);

  return {
    summary: {
      totalPlans: plans.length,
      totalSpent: money(totalSpent),
      totalBudget: money(totalBudget),
      savings: money(totalBudget - totalSpent),
    },
    carbTrends,
    nutritionDist,
  };
}

export const analyticsService = {
  /** The caller's analytics. */
  async getAnalytics(userId: number): Promise<AnalyticsResponse> {
    const plans = await plansRepository.listForUser(userId);
    const items =
      plans.length > 0
        ? await plansRepository.listItems(plans.map((plan) => plan.id))
        : [];

    return computeAnalytics(
      plans.map((plan) => ({
        planDate: plan.planDate,
        budget: plan.budget,
        totalCost: plan.totalCost,
        totalCarbs: plan.totalCarbs,
      })),
      items.map((item) => ({
        status: item.status,
        glycemicIndex: item.glycemicIndex,
      })),
    );
  },
};
