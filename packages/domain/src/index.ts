/**
 * @glucoplate/domain
 *
 * Pure business rules shared by the services and the clients: the meal
 * planner, budget arithmetic, safety copy and formatting.
 *
 * No database, no HTTP, no framework. Everything here is a function you can
 * unit test with plain values.
 */

import type { Dish, DiabetesLevel, MealSlot, UserSetting } from "@glucoplate/types";

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

export const SLOTS: MealSlot[] = ["morning", "afternoon", "evening"];

export const SLOT_LABELS: Record<MealSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export type PlanOptions = {
  /** Highest glycemic index allowed for a single dish. */
  giLimit?: number;
  /** Free-text ingredients the user must avoid (allergies, dislikes). */
  exclude?: string[];
};

/** How many candidate dishes are considered per meal slot. */
const SHORTLIST_SIZE = 14;

type Combo = {
  dishes: Dish[];
  cost: number;
  carbs: number;
  protein: number;
  calories: number;
  averageGi: number;
  highestGi: number;
  /** Higher is a better plan. */
  utility: number;
};

function effectiveCost(dish: Dish): number {
  return dish.isPantryItem ? 0 : dish.cost;
}

/**
 * Builds a small, diverse shortlist of candidates for a slot.
 *
 * A dish designed for the slot scores a small bonus so that, all else being
 * equal, breakfast stays breakfast. The rest of the ordering keeps the safest
 * and the most filling options in the running.
 */
function buildShortlist(candidates: Dish[], slot: MealSlot): Dish[] {
  const slotRank = (d: Dish) => (d.mealTime === slot ? 0 : 1);
  const picked = new Map<number, Dish>();

  const add = (list: Dish[], limit: number) => {
    let added = 0;
    for (const dish of list) {
      if (added >= limit || picked.size >= SHORTLIST_SIZE) break;
      if (picked.has(dish.id)) continue;
      picked.set(dish.id, dish);
      added += 1;
    }
  };

  // Safest first (lowest glycemic index, then lowest carbs, then cheapest).
  add(
    [...candidates].sort((a, b) => {
      if (slotRank(a) !== slotRank(b)) return slotRank(a) - slotRank(b);
      if (a.glycemicIndex !== b.glycemicIndex)
        return a.glycemicIndex - b.glycemicIndex;
      if (a.carbsG !== b.carbsG) return a.carbsG - b.carbsG;
      return effectiveCost(a) - effectiveCost(b);
    }),
    6,
  );

  // Most filling first (highest carbs that still leave room for protein).
  add(
    [...candidates].sort((a, b) => {
      if (slotRank(a) !== slotRank(b)) return slotRank(a) - slotRank(b);
      if (a.carbsG !== b.carbsG) return b.carbsG - a.carbsG;
      return effectiveCost(a) - effectiveCost(b);
    }),
    5,
  );

  // Cheapest first, so tight budgets still get a full plan.
  add(
    [...candidates].sort((a, b) => {
      if (slotRank(a) !== slotRank(b)) return slotRank(a) - slotRank(b);
      return effectiveCost(a) - effectiveCost(b);
    }),
    SHORTLIST_SIZE,
  );

  return [...picked.values()].slice(0, SHORTLIST_SIZE);
}

function scoreCombo(combo: Dish[], slots: MealSlot[], carbTarget: number): Combo {
  const cost = combo.reduce((sum, d) => sum + effectiveCost(d), 0);
  const carbs = combo.reduce((sum, d) => sum + d.carbsG, 0);
  const protein = combo.reduce((sum, d) => sum + d.proteinG, 0);
  const calories = combo.reduce((sum, d) => sum + d.calories, 0);
  const highestGi = combo.reduce((max, d) => Math.max(max, d.glycemicIndex), 0);
  const averageGi =
    calories > 0
      ? combo.reduce((sum, d) => sum + d.glycemicIndex * d.calories, 0) /
        calories
      : 0;

  const slotBonus = combo.reduce(
    (sum, dish, index) => sum + (dish.mealTime === slots[index] ? 3 : 0),
    0,
  );

  /**
   * Utility of a plan:
   *   - filling the day's carbohydrate allowance is the main goal,
   *   - protein keeps the person full,
   *   - a lower average glycemic index keeps the sugars steadier.
   */
  const utility =
    Math.min(carbs, carbTarget) + protein * 1.5 - averageGi * 0.5 + slotBonus;

  return {
    dishes: combo,
    cost,
    carbs,
    protein,
    calories,
    averageGi: Math.round(averageGi * 10) / 10,
    highestGi,
    utility,
  };
}

/**
 * Allocate an affordable, diabetes-friendly meal plan.
 *
 * The catalogue is the same for everybody, but the plan is not: the glycemic
 * index ceiling, the carbohydrate allowance, the budget and the user's
 * exclusions decide which three dishes end up on the plate.
 */
export function generatePlan(
  dishes: Dish[],
  budget: number,
  carbTarget: number,
  options: PlanOptions = {},
): {
  slots: Record<MealSlot, Dish | null>;
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  withinBudget: boolean;
  withinCarbs: boolean;
  withinGi: boolean;
  highestGi: number;
  message: string;
} {
  const giLimit =
    typeof options.giLimit === "number" ? options.giLimit : undefined;

  const excludes = (options.exclude ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const isExcluded = (dish: Dish) =>
    excludes.some((word) => dish.name.toLowerCase().includes(word));

  const eligible = dishes.filter(
    (dish) =>
      (giLimit === undefined || dish.glycemicIndex <= giLimit) && !isExcluded(dish),
  );

  const shortlists: Record<MealSlot, Dish[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of SLOTS) {
    const candidates = eligible.filter(
      (dish) => dish.mealTime === slot || dish.mealTime === "any",
    );
    shortlists[slot] = buildShortlist(candidates, slot);
  }

  let bestWithinLimits: Combo | null = null;
  let bestWithinBudget: Combo | null = null;
  let cheapestOverall: Combo | null = null;

  for (const morning of shortlists.morning) {
    for (const afternoon of shortlists.afternoon) {
      if (afternoon.id === morning.id) continue;

      for (const evening of shortlists.evening) {
        if (evening.id === morning.id || evening.id === afternoon.id) continue;

        const combo = scoreCombo(
          [morning, afternoon, evening],
          ["morning", "afternoon", "evening"],
          carbTarget,
        );

        if (
          !cheapestOverall ||
          combo.cost < cheapestOverall.cost ||
          (combo.cost === cheapestOverall.cost &&
            combo.utility > cheapestOverall.utility)
        ) {
          cheapestOverall = combo;
        }

        if (combo.cost > budget + 0.0001) continue;

        if (
          !bestWithinBudget ||
          combo.utility > bestWithinBudget.utility ||
          (combo.utility === bestWithinBudget.utility &&
            combo.cost < bestWithinBudget.cost)
        ) {
          bestWithinBudget = combo;
        }

        if (combo.carbs > carbTarget) continue;

        if (
          !bestWithinLimits ||
          combo.utility > bestWithinLimits.utility ||
          (combo.utility === bestWithinLimits.utility &&
            combo.cost < bestWithinLimits.cost)
        ) {
          bestWithinLimits = combo;
        }
      }
    }
  }

  const chosen = bestWithinLimits ?? bestWithinBudget ?? cheapestOverall;

  const slots: Record<MealSlot, Dish | null> = {
    morning: chosen?.dishes[0] ?? null,
    afternoon: chosen?.dishes[1] ?? null,
    evening: chosen?.dishes[2] ?? null,
  };

  const totalCost = chosen?.cost ?? 0;
  const totalCarbs = chosen?.carbs ?? 0;
  const totalCalories = chosen?.calories ?? 0;
  const highestGi = chosen?.highestGi ?? 0;

  const withinBudget = totalCost <= budget + 0.0001;
  const withinCarbs = totalCarbs <= carbTarget;
  const withinGi = giLimit === undefined ? true : highestGi <= giLimit;

  let message: string;
  if (!chosen) {
    message =
      "No Kenyan dish in your catalogue matches these limits. Add a dish or relax your glycemic index limit.";
  } else if (withinBudget && withinCarbs && withinGi) {
    message =
      "Plan is affordable and keeps your carbs and glycemic index within your targets. 🎉";
  } else if (!withinBudget && withinCarbs && withinGi) {
    message =
      "Carbs are within target, but this plan exceeds your budget. Add cheaper dishes or mark items as Pantry.";
  } else if (withinBudget && !withinCarbs && withinGi) {
    message =
      "Plan is affordable, but carbs exceed your target. Add lower-carb / low-GI dishes.";
  } else if (withinBudget && withinCarbs && !withinGi) {
    message =
      `Plan is affordable and within your carb target, but one dish has a glycemic index above your limit of ${giLimit}. Swap it for a lower-GI option.`;
  } else {
    message =
      "This plan exceeds your budget and carb target. Add more affordable, low-GI dishes to your bucket.";
  }

  return {
    slots,
    totalCost,
    totalCarbs,
    totalCalories,
    withinBudget,
    withinCarbs,
    withinGi,
    highestGi,
    message,
  };
}

export function giBand(gi: number): { label: string; badge: string } {
  if (gi <= 55)
    return { label: "Low GI", badge: "bg-emerald-100 text-emerald-700" };
  if (gi <= 69)
    return { label: "Medium GI", badge: "bg-amber-100 text-amber-700" };
  return { label: "High GI", badge: "bg-rose-100 text-rose-700" };
}

/**
 * The foods a user must not be served, taken from their allergies and
 * dislikes (both stored as comma-separated lists).
 */
export function exclusionsFor(user: {
  allergies?: string | null;
  dislikes?: string | null;
}): string[] {
  return [user.allergies, user.dislikes]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export type BudgetLike = {
  budgetAmount: number;
  budgetPeriod: string;
  dailyBudget: number;
  paydayDate?: Date | string | null;
};

const DAY_MS = 1000 * 60 * 60 * 24;

/** How many days the current budget period covers. */
export function periodDays(
  user: BudgetLike,
  now: Date = new Date(),
): number {
  if (user.budgetPeriod === "weekly") return 7;

  if (user.budgetPeriod === "until_payday" && user.paydayDate) {
    const payday = new Date(user.paydayDate);
    const diff = payday.getTime() - now.getTime();
    return Math.max(1, Math.ceil(diff / DAY_MS));
  }

  return 1;
}

/**
 * The daily allowance in KES.
 *
 * `budgetAmount` is the source of truth. `dailyBudget` is only used as a
 * fallback for accounts that have never set a period total.
 */
export function dailyAllowance(
  user: BudgetLike,
  now: Date = new Date(),
): number {
  const days = periodDays(user, now);

  if (user.budgetPeriod === "daily") {
    return user.budgetAmount > 0 ? user.budgetAmount : user.dailyBudget;
  }

  const periodTotal =
    user.budgetAmount > 0 ? user.budgetAmount : user.dailyBudget * days;

  return periodTotal / days;
}

// ---------------------------------------------------------------------------
// Safety copy
// ---------------------------------------------------------------------------

export const PLANNING_AID_NOTICE =
  "GlucoPlate is a planning aid, not medical advice. It does not diagnose or treat diabetes. Always follow the meal plan your doctor or dietitian gave you, and check with them before making dietary changes.";

export const SHORT_DISCLAIMER =
  "Planning aid, not medical advice. Consult your doctor or dietitian.";

export const CRITICAL_CLINICIAN_BANNER =
  "Your glucose readings have been in the high-risk range. Talk to your doctor or dietitian before changing your meals. GlucoPlate can help you plan cheaper and lower-GI options, but it cannot replace their advice.";

export const HIGH_RISK_CLINICIAN_BANNER =
  "You are in a high-risk category. Review this plan with your doctor or dietitian before you start.";

export type DiabetesLevelMeta = {
  label: string;
  blurb: string;
  giLimit: number;
  carbLimit: number;
  calorieLimit: number;
  badge: string;
  requiresClinician: boolean;
};

export const DIABETES_LEVEL_META: Record<DiabetesLevel, DiabetesLevelMeta> = {
  healthy: {
    label: "Healthy",
    blurb: "No diagnosis. Planning for sugar control and good value.",
    giLimit: 55,
    carbLimit: 210,
    calorieLimit: 2200,
    badge: "bg-emerald-100 text-emerald-700",
    requiresClinician: false,
  },
  prediabetes: {
    label: "Prediabetes",
    blurb: "Blood sugar is above normal but not diabetic yet.",
    giLimit: 50,
    carbLimit: 150,
    calorieLimit: 1900,
    badge: "bg-lime-100 text-lime-700",
    requiresClinician: false,
  },
  type2_controlled: {
    label: "Type 2 — controlled",
    blurb: "Managed with lifestyle and medication. Keep portions steady.",
    giLimit: 55,
    carbLimit: 180,
    calorieLimit: 2200,
    badge: "bg-sky-100 text-sky-700",
    requiresClinician: false,
  },
  type2_high_risk: {
    label: "Type 2 — high risk",
    blurb: "Readings are drifting up. Small changes matter a lot.",
    giLimit: 50,
    carbLimit: 120,
    calorieLimit: 1800,
    badge: "bg-amber-100 text-amber-700",
    requiresClinician: true,
  },
  critical: {
    label: "Critical",
    blurb: "Needs close clinical supervision. Plan carefully and ask questions.",
    giLimit: 45,
    carbLimit: 100,
    calorieLimit: 1800,
    badge: "bg-rose-100 text-rose-700",
    requiresClinician: true,
  },
};

export type UserSettingMeta = {
  label: string;
  blurb: string;
  badge: string;
};

export const USER_SETTING_META: Record<UserSetting, UserSettingMeta> = {
  student: {
    label: "Student",
    blurb: "Cheap meals around campus, tight budget, irregular hours.",
    badge: "bg-indigo-100 text-indigo-700",
  },
  child: {
    label: "Child",
    blurb: "Growing bodies need steady energy and smaller portions.",
    badge: "bg-sky-100 text-sky-700",
  },
  working_class: {
    label: "Working class",
    blurb: "Long shifts, eating out, and a daily budget that must last.",
    badge: "bg-teal-100 text-teal-700",
  },
  elderly: {
    label: "Elderly",
    blurb: "Lower targets, more protein, and very gentle on the stomach.",
    badge: "bg-purple-100 text-purple-700",
  },
  rural_farmer: {
    label: "Rural farmer",
    blurb: "Homegrown produce and the tightest budget of all.",
    badge: "bg-orange-100 text-orange-700",
  },
};

/**
 * Returns the banner a user should see, or `null` when they do not need one.
 */
export function clinicianBannerFor(user: {
  diabetesLevel?: string | null;
  needsClinicianReview?: boolean | null;
}): string | null {
  if (user.needsClinicianReview) return CRITICAL_CLINICIAN_BANNER;

  const level = user.diabetesLevel as DiabetesLevel | undefined;
  if (!level) return null;

  const meta = DIABETES_LEVEL_META[level];
  if (!meta) return null;

  if (level === "critical") return CRITICAL_CLINICIAN_BANNER;
  if (level === "type2_high_risk") return HIGH_RISK_CLINICIAN_BANNER;

  return null;
}

/** Metadata for a diabetes level, with a safe fallback for unknown values. */
export function levelMeta(
  level: string | null | undefined,
): DiabetesLevelMeta {
  const key = (level ?? "healthy") as DiabetesLevel;
  return DIABETES_LEVEL_META[key] ?? DIABETES_LEVEL_META.healthy;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Formats an amount of Kenyan shillings. */
export function money(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  return `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(d: string): string {
  const date = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const MEAL_TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Any time",
};
