import { Pool } from "pg";
import { randomBytes, scryptSync } from "crypto";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
});

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

const DEMO_DISHES = [
  ["Steel-Cut Oatmeal with Berries", "Slow-release oats topped with blueberries and cinnamon.", "morning", 2.2, 290, 42, 9, 42],
  ["Veggie Egg-White Omelette", "Egg whites with spinach, tomato and bell peppers.", "morning", 2.8, 220, 8, 22, 20],
  ["Greek Yogurt & Walnut Bowl", "Unsweetened Greek yogurt with walnuts and chia seeds.", "morning", 2.5, 240, 14, 18, 30],
  ["Grilled Chicken & Quinoa Salad", "Lean grilled chicken over quinoa with mixed greens.", "afternoon", 4.5, 430, 38, 35, 45],
  ["Lentil & Vegetable Soup", "Hearty lentil soup with carrots, celery and kale.", "afternoon", 2.9, 310, 40, 18, 32],
  ["Tuna Salad Lettuce Wraps", "Tuna with olive oil and herbs in crisp lettuce cups.", "afternoon", 3.6, 280, 6, 30, 15],
  ["Baked Salmon with Asparagus", "Omega-3 rich salmon fillet with roasted asparagus.", "evening", 5.5, 400, 10, 34, 18],
  ["Turkey & Bean Chili", "Lean ground turkey with kidney beans and tomato.", "evening", 3.8, 360, 34, 28, 40],
  ["Tofu Stir-Fry with Broccoli", "Firm tofu and broccoli in a light ginger-soy glaze.", "evening", 3.4, 320, 22, 20, 35],
  ["Almonds & Apple Slices", "A handful of raw almonds with fresh apple.", "any", 1.5, 180, 20, 6, 38],
  ["Chickpea Hummus with Cucumber", "Homemade hummus with crunchy cucumber sticks.", "any", 1.8, 200, 18, 8, 28],
  ["Cottage Cheese with Flaxseed", "Low-fat cottage cheese sprinkled with ground flax.", "any", 2.0, 190, 9, 24, 25],
];

async function main() {
  const email = "demo@glucoplate.app";
  const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rows.length > 0) {
    console.log("Demo user already exists, skipping.");
    await pool.end();
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, daily_budget, daily_carb_target)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    ["Demo Patient", email, hashPassword("demo123"), 12, 160],
  );
  const userId = rows[0].id;

  const dishIds = {};
  for (const d of DEMO_DISHES) {
    const r = await pool.query(
      `INSERT INTO dishes (user_id, name, description, meal_time, cost, calories, carbs_g, protein_g, glycemic_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [userId, ...d],
    );
    dishIds[d[0]] = r.rows[0].id;
  }

  // Create a couple of sample saved plans
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const fmt = (dt) => dt.toISOString().slice(0, 10);

  async function makePlan(dateStr, budget, picks) {
    let cost = 0, carbs = 0, cals = 0;
    for (const p of picks) {
      cost += p.cost; carbs += p.carbs; cals += p.cals;
    }
    const pr = await pool.query(
      `INSERT INTO meal_plans (user_id, plan_date, budget, total_cost, total_carbs, total_calories)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [userId, dateStr, budget, cost, carbs, cals],
    );
    const planId = pr.rows[0].id;
    for (const p of picks) {
      await pool.query(
        `INSERT INTO meal_plan_items (plan_id, dish_id, slot) VALUES ($1,$2,$3)`,
        [planId, dishIds[p.name], p.slot],
      );
    }
  }

  await makePlan(fmt(yesterday), 12, [
    { name: "Veggie Egg-White Omelette", slot: "morning", cost: 2.8, carbs: 8, cals: 220 },
    { name: "Tuna Salad Lettuce Wraps", slot: "afternoon", cost: 3.6, carbs: 6, cals: 280 },
    { name: "Baked Salmon with Asparagus", slot: "evening", cost: 5.5, carbs: 10, cals: 400 },
  ]);

  await makePlan(fmt(today), 12, [
    { name: "Greek Yogurt & Walnut Bowl", slot: "morning", cost: 2.5, carbs: 14, cals: 240 },
    { name: "Lentil & Vegetable Soup", slot: "afternoon", cost: 2.9, carbs: 40, cals: 310 },
    { name: "Tofu Stir-Fry with Broccoli", slot: "evening", cost: 3.4, carbs: 22, cals: 320 },
  ]);

  console.log("Demo data seeded for user", userId);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
