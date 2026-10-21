import type { AnalyticsResponse } from "@glucoplate/types";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

/**
 * Analytics needs the caller's saved plans, and plans live in svc-planner.
 * This service reads them over HTTP — one database per service — and caches
 * the answer briefly so the dashboard does not hammer the planner.
 */

/** The fields of a plan this service needs. */
type UpstreamPlan = {
  planDate?: string;
  budget?: number;
  totalCost?: number;
  totalCarbs?: number;
  items?: { glycemicIndex?: number; status?: string }[];
};

const CACHE_TTL_MS = 60_000;

/** The answer for a user, with the moment it stops being fresh. */
type CacheEntry = { expiresAt: number; payload: AnalyticsResponse };

const cache = new Map<number, CacheEntry>();

/** The answer when there is nothing to show. */
const EMPTY_ANALYTICS: AnalyticsResponse = {
  summary: { totalPlans: 0, totalSpent: 0, totalBudget: 0, savings: 0 },
  carbTrends: [],
  nutritionDist: [],
};

/** Rounds a money value to two decimals. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Reads a number from an unknown value, defaulting to zero. */
function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Pulls the plan list out of the planner's response. */
function parsePlans(payload: unknown): UpstreamPlan[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { plans?: unknown }).plans)
      ? ((payload as { plans: unknown[] }).plans)
      : [];

  return list.filter(
    (plan): plan is UpstreamPlan => Boolean(plan) && typeof plan === "object",
  );
}

/** Fetches the caller's plans from the planner service. */
async function fetchPlans(
  authorization: string | undefined,
): Promise<UpstreamPlan[]> {
  const response = await fetch(`${config.svcPlannerUrl}/api/plans`, {
    headers: { Authorization: authorization ?? "" },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`svc-planner /api/plans returned ${response.status}`);
  }

  return parsePlans(await response.json());
}

/**
 * Turns the plans into the dashboard's numbers.
 *
 * - the summary adds up the budget and the spend of every plan,
 * - the carb trend is the last seven plans, oldest first,
 * - the nutrition distribution counts the items that were actually eaten,
 *   grouped by the glycemic index snapshotted on the item.
 */
function computeAnalytics(plans: UpstreamPlan[]): AnalyticsResponse {
  const totalBudget = plans.reduce((sum, plan) => sum + num(plan.budget), 0);
  const totalSpent = plans.reduce((sum, plan) => sum + num(plan.totalCost), 0);

  const recent = [...plans]
    .sort((a, b) => String(b.planDate ?? "").localeCompare(String(a.planDate ?? "")))
    .slice(0, 7);

  const carbTrends = recent
    .reverse()
    .map((plan) => ({
      date: String(plan.planDate ?? ""),
      carbs: num(plan.totalCarbs),
    }));

  const giCounts = new Map<number, number>();
  for (const plan of plans) {
    for (const item of plan.items ?? []) {
      if (String(item.status ?? "") !== "eaten") continue;
      const gi = num(item.glycemicIndex);
      giCounts.set(gi, (giCounts.get(gi) ?? 0) + 1);
    }
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
  /**
   * The caller's analytics.
   *
   * The upstream fetch is cached for a minute per user. When the planner
   * cannot be reached the last good answer is used, and when there is none
   * the empty answer is returned: analytics must never break the dashboard.
   */
  async getAnalytics(
    userId: number,
    authorization: string | undefined,
  ): Promise<AnalyticsResponse> {
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.payload;

    try {
      const plans = await fetchPlans(authorization);
      const payload = computeAnalytics(plans);
      cache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
      return payload;
    } catch (error) {
      logger.warn("svc-planner /api/plans is unavailable", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (cached) return cached.payload;
      return EMPTY_ANALYTICS;
    }
  },
};
