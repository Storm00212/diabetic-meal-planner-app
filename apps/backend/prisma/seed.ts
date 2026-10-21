import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "../generated/prisma/index.js";
import { PERSONAS } from "@glucoplate/data";
import {
  SLOTS,
  dailyAllowance,
  exclusionsFor,
  explainPlan,
  generatePlan,
} from "@glucoplate/domain";
import type { Dish } from "@glucoplate/types";
import {
  CATALOGUE_ROWS,
  CATALOGUE_SOURCE,
  seedCatalogue,
} from "../src/modules/dish/dish.catalogue.js";

const prisma = new PrismaClient();

/**
 * A persona as it sits in `personas.json`.
 *
 * The activity fields the portion calculator reads are optional, so a fixture
 * that does not name them still seeds.
 */
type PersonaFixture = (typeof PERSONAS)[number] & {
  sex?: string;
  activityLevel?: string;
};

/**
 * The title the sample plans carry.
 *
 * It doubles as the idempotency marker: a re-run replaces the sample plans
 * of a persona and leaves the plans a user created for themselves alone.
 */
const SEED_TITLE = "Sample daily plan";

/** Same format as `hashPassword` in src/modules/auth/auth.service.ts. */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

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
 * Seeds the demo accounts.
 *
 * Idempotent: an account that already exists is updated, not duplicated.
 */
async function seedUsers(): Promise<Map<string, number>> {
  const ids = new Map<string, number>();

  for (const persona of PERSONAS as PersonaFixture[]) {
    const data = {
      name: persona.name,
      passwordHash: hashPassword(persona.password),
      role: persona.role,
      setting: persona.setting,
      diabetesLevel: persona.diabetesLevel,
      region: persona.region,
      dailyCarbTarget: persona.dailyCarbTarget,
      dailyGiLimit: persona.dailyGiLimit,
      dailyCalorieLimit: persona.dailyCalorieLimit,
      dailyBudget: persona.dailyBudget,
      budgetAmount: persona.budgetAmount,
      budgetPeriod: persona.budgetPeriod,
      budgetCurrency: persona.budgetCurrency,
      isPremium: persona.isPremium,
      needsClinicianReview: persona.needsClinicianReview,
      allergies: persona.allergies,
      dislikes: persona.dislikes,
      age: persona.age,
      heightCm: persona.heightCm,
      currentWeight: persona.currentWeight,
      targetWeight: persona.targetWeight,
      sex: persona.sex ?? "unspecified",
      activityLevel: persona.activityLevel ?? "light",
      updatedAt: new Date(),
    };

    const user = await prisma.user.upsert({
      where: { email: persona.email.toLowerCase() },
      update: data,
      create: {
        ...data,
        email: persona.email.toLowerCase(),
        premiumSince: persona.isPremium ? new Date() : null,
      },
      select: { id: true },
    });

    ids.set(persona.email.toLowerCase(), user.id);

    console.log(
      `  ✓ ${persona.email.padEnd(28)} ${persona.password.padEnd(12)} (${persona.setting} / ${persona.diabetesLevel} / ${data.sex} / ${data.activityLevel})`,
    );
  }

  return ids;
}

/**
 * Seeds the shared Kenyan catalogue.
 *
 * Idempotent: a catalogue dish that already exists is refreshed, never
 * duplicated. Dishes a user added themselves are never touched.
 */
async function seedDishes(): Promise<void> {
  const { inserted, updated, skipped } = await seedCatalogue(prisma);

  console.log(
    `  ✓ inserted ${inserted} catalogue dish(es), refreshed ${updated}, skipped ${skipped} already present`,
  );

  const catalogue = await prisma.dish.count({
    where: { source: CATALOGUE_SOURCE, userId: null },
  });

  if (catalogue !== CATALOGUE_ROWS.length) {
    console.warn(
      `  ! expected ${CATALOGUE_ROWS.length} catalogue dishes, found ${catalogue}`,
    );
  }
}

/**
 * Seeds a sample meal plan for every persona — today and yesterday — so the
 * dashboard is not empty.
 *
 * Idempotent: the sample plans of a persona are replaced on every run, and
 * the plans a user created for themselves are left alone.
 */
async function seedPlans(userIds: Map<string, number>): Promise<void> {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 1000 * 60 * 60 * 24);

  // The catalogue is in the same database now, so the plan can reference the
  // real dishes rather than a copy of them.
  const catalogueRows = await prisma.dish.findMany({
    where: { source: CATALOGUE_SOURCE, userId: null },
    orderBy: { id: "asc" },
  });

  const catalogue: Dish[] = catalogueRows.map((row) => ({
    id: row.id,
    userId: null,
    name: row.name,
    description: row.description,
    mealTime: row.mealTime as Dish["mealTime"],
    cost: row.cost,
    isPantryItem: row.isPantryItem,
    calories: row.calories,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    glycemicIndex: row.glycemicIndex,
    servingLabel: row.servingLabel,
    region: row.region,
    isKenyan: row.isKenyan,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  }));

  const dishIdByName = new Map(catalogueRows.map((row) => [row.name, row.id]));

  let planCount = 0;
  let itemCount = 0;

  for (const persona of PERSONAS) {
    const userId = userIds.get(persona.email.toLowerCase());
    if (userId === undefined) {
      console.warn(`  ! no user id for ${persona.email}, skipping its plans`);
      continue;
    }

    const budget = dailyAllowance({
      budgetAmount: persona.budgetAmount,
      budgetPeriod: persona.budgetPeriod,
      dailyBudget: persona.dailyBudget,
      paydayDate: null,
    });

    const result = generatePlan(catalogue, budget, persona.dailyCarbTarget, {
      giLimit: persona.dailyGiLimit,
      exclude: exclusionsFor({
        allergies: persona.allergies,
        dislikes: persona.dislikes,
      }),
    });

    const dishes = SLOTS.map((slot) => result.slots[slot]).filter(
      (dish): dish is Dish => dish !== null,
    );
    const averageGi = averageGiOf(dishes);

    // The reasons are explained against the persona's own numbers, exactly as
    // the planner does for a real request.
    const reasons = explainPlan(result.slots, {
      budget,
      carbTarget: persona.dailyCarbTarget,
      giLimit: persona.dailyGiLimit,
    });

    // Replace this persona's sample plans, leave everything else alone.
    await prisma.mealPlan.deleteMany({ where: { userId, title: SEED_TITLE } });

    for (const day of [today, yesterday]) {
      const plan = await prisma.mealPlan.create({
        data: {
          userId,
          planDate: utcMidnight(day),
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
            dishId: dishIdByName.get(dish.name) ?? 0,
            slot,
            dishName: dish.name,
            plannedCost: dish.isPantryItem ? 0 : dish.cost,
            carbsG: dish.carbsG,
            proteinG: dish.proteinG,
            calories: dish.calories,
            glycemicIndex: dish.glycemicIndex,
            servings: 1,
            /** Why this dish was chosen, in the persona's own numbers. */
            reason: (reasons[slot] ?? []).join(" "),
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

  console.log(`  ✓ ${planCount} sample plan(s) with ${itemCount} items.`);
}

async function main() {
  console.log("Seeding the GlucoPlate backend …\n");

  console.log("Accounts");
  const userIds = await seedUsers();

  console.log("\nDish catalogue");
  await seedDishes();

  console.log("\nSample meal plans");
  await seedPlans(userIds);

  const [users, dishes, plans, items] = await Promise.all([
    prisma.user.count(),
    prisma.dish.count(),
    prisma.mealPlan.count(),
    prisma.mealPlanItem.count(),
  ]);

  console.log(
    `\nSeeded: ${users} accounts, ${dishes} dishes, ${plans} plans, ${items} plan items.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
