import type { Dish } from "@/db/schema";
import type { PlanResult } from "@/lib/types";

export type Slot = "morning" | "afternoon" | "evening";
export const SLOTS: Slot[] = ["morning", "afternoon", "evening"];

export const SLOT_LABELS: Record<Slot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/**
 * Allocate an affordable, diabetes-friendly meal plan.
 * Strategy: for each meal slot, pick the safest (lowest glycemic index, then
 * lowest carbs) dish that keeps the running cost under budget.
 * Pantry items are treated as 0 cost.
 */
export function generatePlan(
  dishes: Dish[],
  budget: number,
  carbTarget: number,
): PlanResult {
  const slots: Record<Slot, Dish | null> = {
    morning: null,
    afternoon: null,
    evening: null,
  };

  let totalCost = 0;
  let totalCarbs = 0;
  let totalCalories = 0;

  // Track which dishes were used so we don't repeat the same dish across slots
  const usedIds = new Set<number>();

  for (const slot of SLOTS) {
    // Candidate dishes suitable for this slot or "any"
    const candidates = dishes
      .filter((d) => (d.mealTime === slot || d.mealTime === "any") && !usedIds.has(d.id))
      .sort((a, b) => {
        // Prefer safest (lowest GI), then lowest carbs, then cheapest
        if (a.glycemicIndex !== b.glycemicIndex)
          return a.glycemicIndex - b.glycemicIndex;
        if (a.carbsG !== b.carbsG) return a.carbsG - b.carbsG;

        const costA = a.isPantryItem ? 0 : a.cost;
        const costB = b.isPantryItem ? 0 : b.cost;
        return costA - costB;
      });

    const remainingBudget = budget - totalCost;

    // Pick the first candidate whose effective cost fits the remaining budget
    const chosen = candidates.find((d) => {
      const effectiveCost = d.isPantryItem ? 0 : d.cost;
      return effectiveCost <= remainingBudget;
    }) ?? candidates[0] ?? null;

    if (chosen) {
      slots[slot] = chosen;
      usedIds.add(chosen.id);
      totalCost += chosen.isPantryItem ? 0 : chosen.cost;
      totalCarbs += chosen.carbsG;
      totalCalories += chosen.calories;
    }
  }

  const withinBudget = totalCost <= budget + 0.0001;
  const withinCarbs = totalCarbs <= carbTarget;

  let message: string;
  if (withinBudget && withinCarbs) {
    message =
      "Plan is affordable and keeps your carbs within your stable target. 🎉";
  } else if (!withinBudget && withinCarbs) {
    message =
      "Carbs are within target, but this plan exceeds your budget. Add cheaper dishes or mark items as Pantry.";
  } else if (withinBudget && !withinCarbs) {
    message =
      "Plan is affordable, but carbs exceed your target. Add lower-carb / low-GI dishes.";
  } else {
    message =
      "This plan exceeds both your budget and carb target. Add more affordable, low-GI dishes to your bucket.";
  }

  return {
    slots,
    totalCost,
    totalCarbs,
    totalCalories,
    withinBudget,
    withinCarbs,
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
