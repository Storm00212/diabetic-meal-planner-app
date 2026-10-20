import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generatePlan, exclusionsFor } from "../packages/domain/dist/index.js";

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
  { name: "Njeri (student/healthy)", budget: 200, carbs: 210, gi: 55, allergies: "", dislikes: "liver" },
  { name: "Brian (child/prediabetes)", budget: 150, carbs: 150, gi: 50, allergies: "", dislikes: "coconut" },
  { name: "Peter (working/controlled)", budget: 350, carbs: 180, gi: 55, allergies: "", dislikes: "" },
  { name: "Grace (elderly/high risk)", budget: 250, carbs: 120, gi: 50, allergies: "", dislikes: "spicy" },
  { name: "Josephine (farmer/critical)", budget: 120, carbs: 100, gi: 45, allergies: "", dislikes: "" },
];

const results = [];

for (const persona of personas) {
  const result = generatePlan(dishes, persona.budget, persona.carbs, {
    giLimit: persona.gi,
    exclude: exclusionsFor(persona),
  });

  const names = ["morning", "afternoon", "evening"]
    .map((slot) => result.slots[slot]?.name)
    .filter(Boolean);

  results.push({
    name: persona.name,
    gi: persona.gi,
    cost: result.totalCost,
    carbs: result.totalCarbs,
    withinBudget: result.withinBudget,
    withinCarbs: result.withinCarbs,
    withinGi: result.withinGi,
    names,
  });

  console.log(
    `${persona.name.padEnd(28)} GI<=${String(persona.gi).padStart(3)}  KSh ${String(result.totalCost).padStart(4)}/${String(persona.budget).padEnd(4)} ${String(result.totalCarbs).padStart(3)}g/${String(persona.carbs).padEnd(4)}  ${result.withinBudget && result.withinCarbs && result.withinGi ? "ok " : "OUT"}  ${names.join(", ")}`,
  );
}

const distinct = new Set(results.map((r) => r.names.join("|"))).size;
const allWithin = results.every((r) => r.withinBudget && r.withinCarbs && r.withinGi);

console.log(`\n${distinct} distinct plans out of ${results.length} personas.`);
console.log(allWithin ? "every plan is inside all three limits." : "SOME PLAN IS OUT OF LIMITS.");
