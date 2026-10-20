/**
 * @glucoplate/domain — why a dish was chosen, and what to swap it for.
 *
 * These are the strings a user (and a judging panel) actually reads, so they
 * are generated in one place and used by every client.
 */

import type { Dish, MealSlot, SwapCandidate } from "@glucoplate/types";

export type { SwapCandidate };

export const GI_BANDS = [
  { max: 55, label: "low" },
  { max: 69, label: "medium" },
  { max: 100, label: "high" },
] as const;

export function giBandLabel(gi: number): "low" | "medium" | "high" {
  for (const band of GI_BANDS) {
    if (gi <= band.max) return band.label;
  }
  return "high";
}

export type ExplanationContext = {
  /** The daily budget in KES. */
  budget: number;
  /** The daily carbohydrate ceiling in grams. */
  carbTarget: number;
  /** The highest glycemic index allowed for a single dish. */
  giLimit?: number;
  /** "Morning", "Afternoon", "Evening". */
  slotLabel?: string;
  /** The dish this one replaced, when there was one. */
  replaced?: { name: string; cost: number; glycemicIndex: number } | null;
};

function kes(value: number): string {
  return `KSh ${Math.round(value).toLocaleString("en-KE")}`;
}

/**
 * Builds the short list of reasons that explain one dish in the plan.
 *
 * Every reason is a fact about this dish against this person's own limits —
 * never generic advice.
 */
export function explainDish(
  dish: Dish,
  context: ExplanationContext,
): string[] {
  const reasons: string[] = [];

  // --- Budget ------------------------------------------------------------
  if (dish.isPantryItem || dish.cost === 0) {
    reasons.push("Costs nothing — it is a pantry item, so it frees up your budget.");
  } else if (dish.cost > context.budget) {
    reasons.push(
      `${kes(dish.cost)} — that is ${kes(dish.cost - context.budget)} over your ${kes(context.budget)} daily budget.`,
    );
  } else {
    const share = Math.round((dish.cost / Math.max(context.budget, 1)) * 100);
    const left = context.budget - dish.cost;
    reasons.push(
      `${kes(dish.cost)} — ${share}% of your ${kes(context.budget)} daily budget, leaving ${kes(left)}.`,
    );
  }

  // --- Glycemic index ----------------------------------------------------
  const band = giBandLabel(dish.glycemicIndex);
  if (context.giLimit === undefined) {
    reasons.push(`Glycemic index ${dish.glycemicIndex} — a ${band} glycemic index dish.`);
  } else if (dish.glycemicIndex <= context.giLimit - 15) {
    reasons.push(
      `Glycemic index ${dish.glycemicIndex} is well under your limit of ${context.giLimit} — steady sugars.`,
    );
  } else if (dish.glycemicIndex <= context.giLimit) {
    reasons.push(
      `Glycemic index ${dish.glycemicIndex} sits right at your limit of ${context.giLimit}.`,
    );
  } else {
    reasons.push(
      `Glycemic index ${dish.glycemicIndex} is above your limit of ${context.giLimit} — worth swapping.`,
    );
  }

  // --- Carbohydrate ------------------------------------------------------
  if (dish.carbsG === 0) {
    reasons.push("No carbohydrate at all — it will not move your blood sugar.");
  } else {
    const share = Math.round((dish.carbsG / Math.max(context.carbTarget, 1)) * 100);
    reasons.push(
      `${dish.carbsG} g of carbohydrate — ${share}% of your ${context.carbTarget} g daily allowance.`,
    );
  }

  // --- Protein -----------------------------------------------------------
  if (dish.proteinG >= 15) {
    reasons.push(`${dish.proteinG} g of protein to keep you full.`);
  } else if (dish.proteinG >= 8) {
    reasons.push(`${dish.proteinG} g of protein.`);
  }

  // --- Meal slot ---------------------------------------------------------
  if (context.slotLabel) {
    reasons.push(`Chosen for your ${context.slotLabel.toLowerCase()} slot.`);
  }

  // --- Why not the other option -----------------------------------------
  if (context.replaced) {
    const saving = context.replaced.cost - dish.cost;
    const giDrop = context.replaced.glycemicIndex - dish.glycemicIndex;
    const parts: string[] = [];
    if (saving > 0) parts.push(`${kes(saving)} cheaper`);
    if (giDrop > 0) parts.push(`glycemic index ${giDrop} points lower`);
    if (parts.length > 0) {
      reasons.push(
        `Picked over ${context.replaced.name}: ${parts.join(" and ")}.`,
      );
    }
  }

  return reasons;
}

/** The reason text stored on a saved item. */
export type PlanTotals = {
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  highestGi: number;
};

/** The dish a slot's dish replaced, when the person swapped it. */
export type ReplacedDish = {
  name: string;
  cost: number;
  glycemicIndex: number;
};

/**
 * Sums a set of slots.
 *
 * A pantry item is free, so it costs nothing.
 */
export function summariseSlots(
  slots: Partial<Record<MealSlot, Dish | null>>,
): PlanTotals {
  const dishes = (Object.values(slots) ?? []).filter(
    (dish): dish is Dish => Boolean(dish),
  );

  const totalCalories = dishes.reduce((sum, dish) => sum + dish.calories, 0);
  const weightedGi = dishes.reduce(
    (sum, dish) => sum + dish.glycemicIndex * dish.calories,
    0,
  );

  return {
    totalCost: dishes.reduce(
      (sum, dish) => sum + (dish.isPantryItem ? 0 : dish.cost),
      0,
    ),
    totalCarbs: dishes.reduce((sum, dish) => sum + dish.carbsG, 0),
    totalCalories,
    highestGi: dishes.reduce(
      (max, dish) => Math.max(max, dish.glycemicIndex),
      0,
    ),
  };
}

/**
 * The one-line verdict on a plan.
 *
 * Used by the planner when it generates a plan and again when a person has
 * swapped a dish, so the two never disagree.
 */
export function describePlan(
  totals: PlanTotals,
  limits: { budget: number; carbTarget: number; giLimit?: number },
): string {
  const { totalCost, totalCarbs, highestGi } = totals;
  const { budget, carbTarget, giLimit } = limits;

  const withinBudget = totalCost <= budget + 0.0001;
  const withinCarbs = totalCarbs <= carbTarget;
  const withinGi = giLimit === undefined ? true : highestGi <= giLimit;

  if (withinBudget && withinCarbs && withinGi) {
    return "Plan is affordable and keeps your carbs and glycemic index within your targets. 🎉";
  }
  if (!withinBudget && withinCarbs && withinGi) {
    return "Carbs are within target, but this plan exceeds your budget. Add cheaper dishes or mark items as Pantry.";
  }
  if (withinBudget && !withinCarbs && withinGi) {
    return "Plan is affordable, but carbs exceed your target. Add lower-carb / low-GI dishes.";
  }
  if (withinBudget && withinCarbs && !withinGi) {
    return `Plan is affordable and within your carb target, but one dish has a glycemic index above your limit of ${giLimit}. Swap it for a lower-GI option.`;
  }
  return "This plan exceeds your budget and carb target. Add more affordable, low-GI dishes to your bucket.";
}

/**
 * Applies the dishes a person swapped in.
 *
 * The planner generated a plan; the person then picked a different dish for
 * one or more slots. The swap is only honoured when it is safe:
 *
 *   - the dish has to exist in the catalogue,
 *   - it has to be within the person's glycemic index limit,
 *   - it must not already be in another slot.
 *
 * Anything else is ignored, so a stale or hand-edited request can never
 * produce a plan that breaks the person's safety limits.
 */
export function applyOverrides(
  slots: Record<MealSlot, Dish | null>,
  overrides: Partial<Record<MealSlot, number>> | undefined,
  catalogue: Dish[],
  limits: { giLimit?: number },
): {
  slots: Record<MealSlot, Dish | null>;
  replacedBy: Partial<Record<MealSlot, ReplacedDish | null>>;
} {
  const result: Record<MealSlot, Dish | null> = { ...slots };
  const replacedBy: Partial<Record<MealSlot, ReplacedDish | null>> = {};

  if (!overrides) return { slots: result, replacedBy };

  const byId = new Map(catalogue.map((dish) => [dish.id, dish]));
  const used = new Set(
    (Object.values(slots) ?? []).filter(Boolean).map((dish) => dish!.id),
  );

  for (const slot of ["morning", "afternoon", "evening"] as MealSlot[]) {
    const requested = Number(overrides[slot]);
    if (!Number.isFinite(requested) || requested <= 0) continue;

    const dish = byId.get(requested);
    if (!dish) continue;
    if (limits.giLimit !== undefined && dish.glycemicIndex > limits.giLimit) {
      continue;
    }
    if (used.has(dish.id)) continue;

    const previous = result[slot];
    if (previous) used.delete(previous.id);
    used.add(dish.id);

    result[slot] = dish;
    replacedBy[slot] = previous
      ? {
          name: previous.name,
          cost: previous.isPantryItem ? 0 : previous.cost,
          glycemicIndex: previous.glycemicIndex,
        }
      : null;
  }

  return { slots: result, replacedBy };
}

/** The reasons for every slot of a plan. */
export function explainPlan(
  slots: Record<MealSlot, Dish | null>,
  context: Omit<ExplanationContext, "slotLabel"> & {
    /** The dish each slot replaced, when the person swapped it. */
    replacedBy?: Partial<Record<MealSlot, ReplacedDish | null>>;
  },
): Record<MealSlot, string[]> {
  const labels: Record<MealSlot, string> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
  };

  const result = {} as Record<MealSlot, string[]>;

  for (const slot of ["morning", "afternoon", "evening"] as MealSlot[]) {
    const dish = slots[slot];
    result[slot] = dish
      ? explainDish(dish, {
          ...context,
          slotLabel: labels[slot],
          replaced: context.replacedBy?.[slot] ?? null,
        })
      : [];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Swapping
// ---------------------------------------------------------------------------

export type SwapOptions = {
  /** How many alternatives to return. */
  limit?: number;
  /** Dish names the person must not be served. */
  excludeNames?: string[];
};

/**
 * Finds cheaper, lower-glycemic-index alternatives for a dish.
 *
 * This is the "give me an equally cheap but lower-GI version of this meal"
 * action. It only needs the dish and the catalogue, so it can run entirely
 * inside the catalogue service.
 */
export function swapCandidates(
  dish: Dish,
  catalogue: Dish[],
  options: SwapOptions = {},
): SwapCandidate[] {
  const limit = options.limit ?? 3;
  const excluded = new Set(
    (options.excludeNames ?? []).map((name) => name.trim().toLowerCase()),
  );
  excluded.add(dish.name.trim().toLowerCase());

  // A pantry item is free, so the saving is measured against what the person
  // would actually pay.
  const price = (candidate: Dish) =>
    candidate.isPantryItem ? 0 : candidate.cost;

  const candidates = catalogue
    .filter((candidate) => {
      if (candidate.id === dish.id) return false;
      if (excluded.has(candidate.name.trim().toLowerCase())) return false;
      // No more expensive than what it replaces...
      if (price(candidate) > price(dish)) return false;
      // ...and a genuinely lower glycemic index.
      if (candidate.glycemicIndex >= dish.glycemicIndex) return false;
      return true;
    })
    .map((candidate) => {
      const saving = price(dish) - price(candidate);
      const giDrop = dish.glycemicIndex - candidate.glycemicIndex;
      return {
        ...candidate,
        saving,
        giDrop,
        reason: `${kes(saving)} cheaper and glycemic index ${giDrop} points lower.`,
      };
    })
    .sort((a, b) => {
      // Prefer the same meal slot, then the bigger glycemic drop, then the
      // cheaper option.
      const slotRank = (candidate: SwapCandidate) =>
        candidate.mealTime === dish.mealTime ? 0 : 1;
      if (slotRank(a) !== slotRank(b)) return slotRank(a) - slotRank(b);
      if (a.giDrop !== b.giDrop) return b.giDrop - a.giDrop;
      if (price(a) !== price(b)) return price(a) - price(b);
      return a.name.localeCompare(b.name);
    });

  return candidates.slice(0, limit);
}
