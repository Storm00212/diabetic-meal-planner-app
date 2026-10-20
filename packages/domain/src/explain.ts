/**
 * @glucoplate/domain — why a dish was chosen, and what to swap it for.
 *
 * These are the strings a user (and a judging panel) actually reads, so they
 * are generated in one place and used by every client.
 */

import type { Dish, MealSlot } from "@glucoplate/types";

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

/** The reasons for every slot of a plan. */
export function explainPlan(
  slots: Record<MealSlot, Dish | null>,
  context: Omit<ExplanationContext, "slotLabel">,
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
      ? explainDish(dish, { ...context, slotLabel: labels[slot] })
      : [];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Swapping
// ---------------------------------------------------------------------------

export type SwapCandidate = Dish & {
  /** How much cheaper the alternative is, in KSh. */
  saving: number;
  /** How much lower the glycemic index is. */
  giDrop: number;
  /** One line explaining the swap. */
  reason: string;
};

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

  const candidates = catalogue
    .filter((candidate) => {
      if (candidate.id === dish.id) return false;
      if (excluded.has(candidate.name.trim().toLowerCase())) return false;
      // No more expensive than what it replaces...
      if (candidate.cost > dish.cost) return false;
      // ...and a genuinely lower glycemic index.
      if (candidate.glycemicIndex >= dish.glycemicIndex) return false;
      return true;
    })
    .map((candidate) => {
      const saving = dish.cost - candidate.cost;
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
      if (a.cost !== b.cost) return a.cost - b.cost;
      return a.name.localeCompare(b.name);
    });

  return candidates.slice(0, limit);
}
