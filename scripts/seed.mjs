/**
 * GlucoPlate demo seeder.
 *
 * Creates the shared Kenyan dish catalogue, the five persona users (plus the
 * generic demo account) and a couple of sample plans per persona so the
 * dashboard is never empty during a demo.
 *
 * Idempotent: safe to run as many times as you like. Users are matched on
 * email, catalogue dishes on name.
 *
 *   node scripts/seed.mjs
 */

import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const DISHES = JSON.parse(
  readFileSync(join(root, "src", "lib", "data", "kenyan-dishes.json"), "utf8"),
);
const PERSONAS = JSON.parse(
  readFileSync(join(root, "src", "lib", "data", "personas.json"), "utf8"),
);

/** Same format as `hashPassword` in src/lib/auth.ts: `salt:derivedKey`. */
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Greedy meal allocation, mirroring src/lib/planner.ts: score every possible
 * combination of one dish per slot and keep the best one.
 */
function buildPlan(catalogue, { budget, carbTarget, giLimit }) {
  const SLOTS = ["morning", "afternoon", "evening"];
  const eligible = catalogue.filter((d) => d.glycemicIndex <= giLimit);

  const shortlist = (slot) => {
    const candidates = eligible.filter(
      (d) => d.mealTime === slot || d.mealTime === "any",
    );
    const rank = (d) => (d.mealTime === slot ? 0 : 1);

    const safest = [...candidates].sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.glycemicIndex !== b.glycemicIndex)
        return a.glycemicIndex - b.glycemicIndex;
      if (a.carbsG !== b.carbsG) return a.carbsG - b.carbsG;
      return a.cost - b.cost;
    });
    const filling = [...candidates].sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.carbsG !== b.carbsG) return b.carbsG - a.carbsG;
      return a.cost - b.cost;
    });

    const picked = [];
    const seen = new Set();
    for (const list of [safest, filling]) {
      for (const dish of list) {
        if (picked.length >= 14) break;
        if (seen.has(dish.name)) continue;
        seen.add(dish.name);
        picked.push(dish);
      }
    }
    return picked;
  };

  const score = (combo) => {
    const cost = combo.reduce((sum, d) => sum + d.cost, 0);
    const carbs = combo.reduce((sum, d) => sum + d.carbsG, 0);
    const protein = combo.reduce((sum, d) => sum + d.proteinG, 0);
    const calories = combo.reduce((sum, d) => sum + d.calories, 0);
    const highestGi = combo.reduce((m, d) => Math.max(m, d.glycemicIndex), 0);
    const averageGi = calories
      ? combo.reduce((s, d) => s + d.glycemicIndex * d.calories, 0) / calories
      : 0;
    const slotBonus = combo.reduce(
      (sum, d, i) => sum + (d.mealTime === SLOTS[i] ? 3 : 0),
      0,
    );
    const utility =
      Math.min(carbs, carbTarget) + protein * 1.5 - averageGi * 0.5 + slotBonus;
    return { cost, carbs, protein, calories, highestGi, averageGi, utility };
  };

  const lists = SLOTS.map(shortlist);
  let best = null;
  let bestCombo = null;

  for (const morning of lists[0]) {
    for (const afternoon of lists[1]) {
      if (afternoon.name === morning.name) continue;
      for (const evening of lists[2]) {
        if (evening.name === morning.name || evening.name === afternoon.name)
          continue;
        const combo = [morning, afternoon, evening];
        const s = score(combo);
        if (s.cost > budget) continue;
        if (s.carbs > carbTarget) continue;
        if (!best || s.utility > best.utility) {
          best = s;
          bestCombo = combo;
        }
      }
    }
  }

  if (!bestCombo) {
    // Nothing fits both limits: fall back to the cheapest three that fit the
    // budget so the demo still has a plan to show.
    const sorted = [...eligible].sort((a, b) => a.cost - b.cost);
    bestCombo = sorted.slice(0, 3);
    best = score(bestCombo);
  }

  const slots = { morning: bestCombo[0], afternoon: bestCombo[1], evening: bestCombo[2] };

  return {
    slots,
    totalCost: best.cost,
    totalCarbs: best.carbs,
    totalCalories: best.calories,
    averageGi: Math.round(best.averageGi * 10) / 10,
  };
}

async function main() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: /neon\.tech|neon\.build/.test(DATABASE_URL)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --- Kenyan dish catalogue (shared by every user) --------------------
    let dishCount = 0;
    for (const dish of DISHES) {
      const existing = await client.query(
        "SELECT id FROM dishes WHERE name = $1 AND source = 'catalogue' LIMIT 1",
        [dish.name],
      );

      if (existing.rowCount > 0) continue;

      await client.query(
        `INSERT INTO dishes
           (user_id, name, description, meal_time, cost, is_pantry_item,
            calories, carbs_g, protein_g, fat_g, fiber_g, glycemic_index,
            region, is_kenyan, source)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, 'catalogue')`,
        [
          dish.name,
          dish.description ?? "",
          dish.mealTime ?? "any",
          dish.cost ?? 0,
          dish.isPantryItem ?? false,
          dish.calories ?? 0,
          dish.carbsG ?? 0,
          dish.proteinG ?? 0,
          dish.fatG ?? 0,
          dish.fiberG ?? 0,
          dish.glycemicIndex ?? 50,
          dish.region ?? "Kenya",
        ],
      );
      dishCount += 1;
    }

    // --- Persona users ----------------------------------------------------
    const seededUsers = [];

    for (const persona of PERSONAS) {
      const result = await client.query(
        `INSERT INTO users
           (name, email, password_hash, role, setting, diabetes_level, region,
            daily_carb_target, daily_gi_limit, daily_calorie_limit,
            daily_budget, budget_amount, budget_period, budget_currency,
            is_premium, premium_plan, premium_since,
            needs_clinician_review, allergies, dislikes,
            age, height_cm, current_weight, target_weight, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24, NOW())
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           setting = EXCLUDED.setting,
           diabetes_level = EXCLUDED.diabetes_level,
           region = EXCLUDED.region,
           daily_carb_target = EXCLUDED.daily_carb_target,
           daily_gi_limit = EXCLUDED.daily_gi_limit,
           daily_calorie_limit = EXCLUDED.daily_calorie_limit,
           daily_budget = EXCLUDED.daily_budget,
           budget_amount = EXCLUDED.budget_amount,
           budget_period = EXCLUDED.budget_period,
           budget_currency = EXCLUDED.budget_currency,
           is_premium = EXCLUDED.is_premium,
           needs_clinician_review = EXCLUDED.needs_clinician_review,
           allergies = EXCLUDED.allergies,
           dislikes = EXCLUDED.dislikes,
           age = EXCLUDED.age,
           height_cm = EXCLUDED.height_cm,
           current_weight = EXCLUDED.current_weight,
           target_weight = EXCLUDED.target_weight,
           updated_at = NOW()
         RETURNING id`,
        [
          persona.name,
          persona.email.toLowerCase(),
          hashPassword(persona.password),
          persona.role ?? "user",
          persona.setting,
          persona.diabetesLevel,
          persona.region ?? "",
          persona.dailyCarbTarget ?? 200,
          persona.dailyGiLimit ?? 55,
          persona.dailyCalorieLimit ?? 2200,
          persona.dailyBudget ?? 300,
          persona.budgetAmount ?? 2100,
          persona.budgetPeriod ?? "weekly",
          persona.budgetCurrency ?? "KES",
          persona.isPremium ?? false,
          "premium",
          persona.isPremium ? new Date() : null,
          persona.needsClinicianReview ?? false,
          persona.allergies ?? "",
          persona.dislikes ?? "",
          persona.age ?? null,
          persona.heightCm ?? null,
          persona.currentWeight ?? null,
          persona.targetWeight ?? null,
        ],
      );

      const userId = result.rows[0].id;
      seededUsers.push({ ...persona, id: userId });

      // --- Sample plans ----------------------------------------------------
      const existingPlans = await client.query(
        "SELECT count(*)::int AS count FROM meal_plans WHERE user_id = $1",
        [userId],
      );

      const resetPlans = process.argv.includes("--reset-plans");

      if (resetPlans) {
        await client.query("DELETE FROM meal_plans WHERE user_id = $1", [userId]);
      } else if (existingPlans.rows[0].count > 0) {
        continue;
      }

      for (const offset of [-1, 0]) {
        const plan = buildPlan(DISHES, {
          budget: persona.dailyBudget ?? 300,
          carbTarget: persona.dailyCarbTarget ?? 200,
          giLimit: persona.dailyGiLimit ?? 55,
        });

        const planResult = await client.query(
          `INSERT INTO meal_plans
             (user_id, plan_date, title, budget, total_cost, total_carbs,
              total_calories, average_gi, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'planned', $9)
           RETURNING id`,
          [
            userId,
            isoDay(offset),
            offset === 0 ? "Today's plan" : "Yesterday's plan",
            persona.dailyBudget ?? 300,
            plan.totalCost,
            plan.totalCarbs,
            plan.totalCalories,
            plan.averageGi,
            "Seeded sample plan",
          ],
        );

        const planId = planResult.rows[0].id;

        for (const slot of ["morning", "afternoon", "evening"]) {
          const dish = plan.slots[slot];
          if (!dish) continue;

          const dishResult = await client.query(
            "SELECT id FROM dishes WHERE name = $1 AND source = 'catalogue' LIMIT 1",
            [dish.name],
          );
          const dishId = dishResult.rows[0]?.id;
          if (!dishId) continue;

          await client.query(
            `INSERT INTO meal_plan_items
               (plan_id, dish_id, slot, status, servings, dish_name, planned_cost,
                carbs_g, calories, glycemic_index, actual_cost)
             VALUES ($1, $2, $3, 'planned', 1, $4, $5, $6, $7, $8, 0)`,
            [
              planId,
              dishId,
              slot,
              dish.name,
              dish.cost,
              dish.carbsG,
              dish.calories,
              dish.glycemicIndex,
            ],
          );
        }
      }
    }

    await client.query("COMMIT");

    console.log("GlucoPlate seed complete.");
    console.log(`  Kenyan dishes added this run : ${dishCount}`);
    console.log(`  Users seeded                : ${seededUsers.length}`);
    console.log("");
    console.log("  Sign in with any of these:");
    for (const persona of seededUsers) {
      console.log(
        `   - ${persona.email.padEnd(28)} ${persona.password.padEnd(12)} (${persona.setting} / ${persona.diabetesLevel})`,
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
