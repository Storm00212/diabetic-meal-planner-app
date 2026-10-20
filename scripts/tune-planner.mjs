/**
 * Tuning harness for the planner's scoring function.
 *
 * The utility function decides which combination of dishes wins. It has to
 * reward three things at once:
 *
 *   - filling the person's carbohydrate allowance (they should not starve)
 *   - spending the budget they actually have (a bigger budget should buy a
 *     more substantial meal, not the same plate)
 *   - keeping the glycemic index low
 *
 * This script sweeps the weights and reports how many distinct plans the five
 * personas get, and whether every plan stays inside all three limits.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const dishes = JSON.parse(
  readFileSync(join(root, "packages", "data", "src", "kenyan-dishes.json"), "utf8"),
).map((dish, index) => ({
  id: index + 1,
  userId: null,
  fatG: dish.fatG ?? 0,
  fiberG: dish.fiberG ?? 0,
  region: dish.region,
  isKenyan: true,
  source: "catalogue",
  createdAt: new Date().toISOString(),
  ...dish,
}));

const personas = [
  { name: "Njeri", budget: 200, carbs: 210, gi: 55, excludes: ["liver"] },
  { name: "Brian", budget: 150, carbs: 150, gi: 50, excludes: ["coconut"] },
  { name: "Peter", budget: 350, carbs: 180, gi: 55, excludes: [] },
  { name: "Grace", budget: 250, carbs: 120, gi: 50, excludes: ["spicy"] },
  { name: "Josephine", budget: 120, carbs: 100, gi: 45, excludes: [] },
];

const SLOTS = ["morning", "afternoon", "evening"];
const SHORTLIST_SIZE = 14;

const effectiveCost = (dish) => (dish.isPantryItem ? 0 : dish.cost);

function buildShortlist(candidates, slot) {
  const slotRank = (d) => (d.mealTime === slot ? 0 : 1);
  const picked = new Map();

  const add = (list, limit) => {
    let added = 0;
    for (const dish of list) {
      if (added >= limit || picked.size >= SHORTLIST_SIZE) break;
      if (picked.has(dish.id)) continue;
      picked.set(dish.id, dish);
      added += 1;
    }
  };

  add(
    [...candidates].sort((a, b) => {
      if (slotRank(a) !== slotRank(b)) return slotRank(a) - slotRank(b);
      if (a.glycemicIndex !== b.glycemicIndex) return a.glycemicIndex - b.glycemicIndex;
      if (a.carbsG !== b.carbsG) return a.carbsG - b.carbsG;
      return effectiveCost(a) - effectiveCost(b);
    }),
    6,
  );
  add(
    [...candidates].sort((a, b) => {
      if (slotRank(a) !== slotRank(b)) return slotRank(a) - slotRank(b);
      if (a.carbsG !== b.carbsG) return b.carbsG - a.carbsG;
      return effectiveCost(a) - effectiveCost(b);
    }),
    5,
  );
  add(
    [...candidates].sort((a, b) => {
      if (slotRank(a) !== slotRank(b)) return slotRank(a) - slotRank(b);
      return effectiveCost(a) - effectiveCost(b);
    }),
    SHORTLIST_SIZE,
  );

  return [...picked.values()].slice(0, SHORTLIST_SIZE);
}

function planFor(persona, weights) {
  const eligible = dishes.filter(
    (dish) =>
      dish.glycemicIndex <= persona.gi &&
      !persona.excludes.some((word) =>
        dish.name.toLowerCase().includes(word.toLowerCase()),
      ),
  );

  const shortlists = {};
  for (const slot of SLOTS) {
    shortlists[slot] = buildShortlist(
      eligible.filter((d) => d.mealTime === slot || d.mealTime === "any"),
      slot,
    );
  }

  let best = null;
  let bestCombo = null;
  let bestBudget = null;

  for (const morning of shortlists.morning) {
    for (const afternoon of shortlists.afternoon) {
      if (afternoon.id === morning.id) continue;
      for (const evening of shortlists.evening) {
        if (evening.id === morning.id || evening.id === afternoon.id) continue;

        const combo = [morning, afternoon, evening];
        const cost = combo.reduce((s, d) => s + effectiveCost(d), 0);
        if (cost > persona.budget) continue;

        const carbs = combo.reduce((s, d) => s + d.carbsG, 0);
        if (carbs > persona.carbs) continue;

        const protein = combo.reduce((s, d) => s + d.proteinG, 0);
        const calories = combo.reduce((s, d) => s + d.calories, 0);
        const avgGi =
          calories > 0
            ? combo.reduce((s, d) => s + d.glycemicIndex * d.calories, 0) / calories
            : 0;
        const slotBonus = combo.reduce(
          (s, d, i) => s + (d.mealTime === SLOTS[i] ? 3 : 0),
          0,
        );

        const utility =
          Math.min(carbs, persona.carbs) * weights.carb +
          protein * weights.protein +
          calories * weights.calories +
          cost * weights.cost -
          avgGi * weights.gi +
          slotBonus * weights.slot;

        if (!best || utility > best.utility) {
          best = { utility, cost, carbs, protein, calories, avgGi };
          bestCombo = combo;
          bestBudget = cost;
        }
      }
    }
  }

  if (!bestCombo) return null;

  return {
    names: bestCombo.map((d) => d.name),
    cost: best.cost,
    carbs: best.carbs,
    protein: best.protein,
    calories: best.calories,
    avgGi: best.avgGi,
    withinBudget: best.cost <= persona.budget,
    withinCarbs: best.carbs <= persona.carbs,
  };
}

const BASELINE = {
  carb: 1,
  protein: 1.5,
  calories: 0,
  cost: 0,
  gi: 0.5,
  slot: 1,
};

const CANDIDATES = [
  { label: "baseline (current)", weights: BASELINE },
  { label: "+calories 0.01", weights: { ...BASELINE, calories: 0.01 } },
  { label: "+cost 0.05", weights: { ...BASELINE, cost: 0.05 } },
  { label: "+cost 0.10", weights: { ...BASELINE, cost: 0.10 } },
  { label: "+cal 0.01 +cost 0.05", weights: { ...BASELINE, calories: 0.01, cost: 0.05 } },
  { label: "+cal 0.02 +cost 0.08", weights: { ...BASELINE, calories: 0.02, cost: 0.08 } },
  { label: "+cal 0.02 +cost 0.15", weights: { ...BASELINE, calories: 0.02, cost: 0.15 } },
  { label: "+cal 0.03 +cost 0.20", weights: { ...BASELINE, calories: 0.03, cost: 0.2 } },
  { label: "+cal 0.03 +cost 0.30", weights: { ...BASELINE, calories: 0.03, cost: 0.3 } },
  { label: "+cal 0.05 +cost 0.30", weights: { ...BASELINE, calories: 0.05, cost: 0.3 } },
  { label: "+cal 0.05 +cost 0.50", weights: { ...BASELINE, calories: 0.05, cost: 0.5 } },
];

console.log("\nweight sweep\n");

for (const candidate of CANDIDATES) {
  const results = personas.map((persona) => ({
    persona: persona.name,
    ...planFor(persona, candidate.weights),
  }));

  const distinct = new Set(results.map((r) => r.names.join("|"))).size;
  const allWithin = results.every(
    (r) => r && r.withinBudget && r.withinCarbs,
  );
  const spends = results
    .map((r) => (r ? `${r.persona}:${Math.round((r.cost / personas.find((p) => p.name === r.persona).budget) * 100)}%` : "?"))
    .join(" ");

  console.log(
    `${candidate.label.padEnd(24)} distinct=${distinct}/5 within=${allWithin ? "ok" : "OUT"}  ${spends}`,
  );

  if (distinct === 5 && allWithin) {
    console.log(`    ${results.map((r) => `${r.persona}[${r.names.join(" | ")}]`).join("\n    ")}`);
  }
}
