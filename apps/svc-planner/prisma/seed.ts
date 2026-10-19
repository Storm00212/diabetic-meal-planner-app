import { PrismaClient } from "../generated/prisma/index.js";
import { KENYAN_DISHES, PERSONAS } from "@glucoplate/data";
import { SLOTS, dailyAllowance, exclusionsFor, generatePlan } from "@glucoplate/domain";
import type { Dish } from "@glucoplate/types";

const prisma = new PrismaClient();

/**
 * The title the sample plans carry.
 *
 * It doubles as the idempotency marker: a re-run replaces the sample plans
 * of a persona and leaves the plans a user created for themselves alone.
 */
const SEED_TITLE = "Sample daily plan";

/**
 * The Kenyan catalogue as the shared `Dish` contract.
 *
 * The dishes live in svc-catalog's database, so their ids here are only
 * there to satisfy the planner — the plan items store `dishId: 0` and the
 * dish name, which is the snapshot the dashboard shows.
 */
const CATALOGUE: Dish[] = KENYAN_DISHES.map((dish, index) => ({
  id: index + 1,
  userId: null,
  name: dish.name,
  description: dish.description,
  mealTime: dish.mealTime,
  cost: dish.cost,
  isPantryItem: dish.isPantryItem,
  calories: dish.calories,
  carbsG: dish.carbsG,
  proteinG: dish.proteinG,
  fatG: dish.fatG,
  fiberG: dish.fiberG,
  glycemicIndex: dish.glycemicIndex,
  region: dish.region,
  isKenyan: true,
  source: "catalogue",
  createdAt: new Date(0).toISOString(),
}));

/** A plan is for one calendar day, stored at UTC midnight. */
function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** The calorie-weighted average glycemic index of the plan's dishes. */
function averageGiOf(dishes: Dish[]): number {
  const calories = dishes.reduce((sum, dish) => sum + dish.calories, 0);
  if (calories <= 0) return 0;

  const weighted = dishes.reduce(
    (sum, dish) => sum + dish.glycemicIndex * dish.calories,
    0,
  );

  return Math.round((weighted / calories) * 10) / 10;
}

/**
 * The user id of every persona.
 *
 * The users live in svc-auth's database, so this service cannot look them up.
 * svc-auth seeds the personas in the order they appear in `PERSONAS` and
 * their ids are auto-incremented, so the first persona is user 1, the second
 * user 2, and so on — `index + 1` is the right answer for a fresh auth
 * database.
 *
 * `SEED_USER_IDS` overrides that when the auth database has a different
 * history: a JSON map of email to id, e.g. `{"njeri@glucoplate.app": 42}`.
 */
function resolveUserIds(): Map<string, number> {
  const ids = new Map<string, number>();
  const raw = process.env.SEED_USER_IDS;

  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Record<string, number | string>;
      for (const [email, id] of Object.entries(parsed)) {
        const value = Number(id);
        if (Number.isFinite(value)) {
          ids.set(email.trim().toLowerCase(), value);
        }
      }
      console.log(`SEED_USER_IDS: using ${ids.size} explicit user id(s).`);
    } catch (error) {
      console.warn(
        "SEED_USER_IDS is not valid JSON, falling back to the persona order:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if (ids.size === 0) {
    console.warn(
      "SEED_USER_IDS is not set — assuming svc-auth seeded the personas in PERSONAS order, so userId = index + 1. Set SEED_USER_IDS to a JSON map of email -> id if the auth database has a different history.",
    );
  }

  return ids;
}

/**
 * Seeds the sample meal plans.
 *
 * Two plans per persona — today and yesterday — so the dashboard is not
 * empty. Idempotent: the sample plans of a persona are replaced on every run.
 */
async function main() {
  console.log("Seeding svc-planner …");

  const explicitIds = resolveUserIds();
  const today = new Date();
  const yesterday = new Date(
    today.getTime() - 1000 * 60 * 60 * 24,
  );

  let planCount = 0;
  let itemCount = 0;

  for (const [index, persona] of PERSONAS.entries()) {
    const userId = explicitIds.get(persona.email.toLowerCase()) ?? index + 1;

    const budget = dailyAllowance({
      budgetAmount: persona.budgetAmount,
      budgetPeriod: persona.budgetPeriod,
      dailyBudget: persona.dailyBudget,
      paydayDate: null,
    });

    const result = generatePlan(
      CATALOGUE,
      budget,
      persona.dailyCarbTarget,
      {
        giLimit: persona.dailyGiLimit,
        exclude: exclusionsFor({
          allergies: persona.allergies,
          dislikes: persona.dislikes,
        }),
      },
    );

    const dishes = SLOTS.map((slot) => result.slots[slot]).filter(
      (dish): dish is Dish => dish !== null,
    );
    const averageGi = averageGiOf(dishes);

    // Replace this persona's sample plans, leave everything else alone.
    await prisma.mealPlan.deleteMany({
      where: { userId, title: SEED_TITLE },
    });

    for (const day of [today, yesterday]) {
      const planDate = utcMidnight(day);

      const plan = await prisma.mealPlan.create({
        data: {
          userId,
          planDate,
          title: SEED_TITLE,
          budget,
          totalCost: result.totalCost,
          totalCarbs: result.totalCarbs,
          totalCalories: result.totalCalories,
          averageGi,
          status: "planned",
          notes: "Sample plan generated for the demo dashboard.",
        },
      });

      const items = SLOTS.flatMap((slot) => {
        const dish = result.slots[slot];
        if (!dish) return [];

        return [
          {
            planId: plan.id,
            // The dish lives in svc-catalog's database, so only the name and
            // the nutrition snapshot are stored here.
            dishId: 0,
            slot,
            dishName: dish.name,
            plannedCost: dish.isPantryItem ? 0 : dish.cost,
            carbsG: dish.carbsG,
            calories: dish.calories,
            glycemicIndex: dish.glycemicIndex,
            servings: 1,
          },
        ];
      });

      if (items.length > 0) {
        await prisma.mealPlanItem.createMany({ data: items });
        itemCount += items.length;
      }

      planCount += 1;
    }

    console.log(
      `  ✓ ${persona.email.padEnd(28)} user ${String(userId).padEnd(4)} ${dishes.length} dishes · KSh ${result.totalCost.toFixed(2)}`,
    );
  }

  console.log(
    `Seeded svc-planner: ${planCount} plans with ${itemCount} items.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
