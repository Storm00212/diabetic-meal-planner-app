import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  date,
  index,
  boolean,
} from "drizzle-orm/pg-core";

// Diabetic patients using the meal planner
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Budget and Period configuration
  dailyBudget: real("daily_budget").notNull().default(15),
  budgetAmount: real("budget_amount").notNull().default(100),
  budgetPeriod: text("budget_period").notNull().default("daily"), // daily | weekly | until_payday
  budgetCurrency: text("budget_currency").notNull().default("USD"),
  paydayDate: timestamp("payday_date"),
  // Target maximum carbs (g) per day to keep sugars stable
  dailyCarbTarget: integer("daily_carb_target").notNull().default(180),
  // Biometrics
  currentWeight: real("current_weight"),
  targetWeight: real("target_weight"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Weight logs for tracking trends
export const weightLogs = pgTable("weight_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weight: real("weight").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Session management for authentication
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User health profiles and preferences
export const userPreferences = pgTable("user_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  diabetesType: text("diabetes_type").notNull().default("type2"), // type1 | type2 | gestational
  allergies: text("allergies").notNull().default(""), // Comma-separated list
  dislikes: text("dislikes").notNull().default(""),
});

// The "bucket" of dishes a patient can prepare within budget
export const dishes = pgTable(
  "dishes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // Which meal this dish is suitable for: morning | afternoon | evening | any
    mealTime: text("meal_time").notNull().default("any"),
    // Cost to prepare one serving
    cost: real("cost").notNull().default(0),
    // If true, cost effectively becomes 0 during planning
    isPantryItem: boolean("is_pantry_item").notNull().default(false),
    calories: integer("calories").notNull().default(0),
    carbsG: integer("carbs_g").notNull().default(0),
    proteinG: integer("protein_g").notNull().default(0),
    // Glycemic index 0-100 (lower is safer for diabetics)
    glycemicIndex: integer("glycemic_index").notNull().default(50),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("dishes_user_idx").on(table.userId)],
);

// A generated daily meal plan
export const mealPlans = pgTable(
  "meal_plans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planDate: date("plan_date").notNull(),
    budget: real("budget").notNull(),
    totalCost: real("total_cost").notNull().default(0),
    totalCarbs: integer("total_carbs").notNull().default(0),
    totalCalories: integer("total_calories").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("meal_plans_user_idx").on(table.userId)],
);

// Individual slots within a meal plan (morning / afternoon / evening)
export const mealPlanItems = pgTable(
  "meal_plan_items",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(), // morning | afternoon | evening
    status: text("status").notNull().default("planned"), // planned | eaten | swapped | skipped
    actualCost: real("actual_cost").notNull().default(0),
  },
  (table) => [index("meal_plan_items_plan_idx").on(table.planId)],
);

export type User = typeof users.$inferSelect;
export type Dish = typeof dishes.$inferSelect;
export type NewDish = typeof dishes.$inferInsert;
export type MealPlan = typeof mealPlans.$inferSelect;
export type MealPlanItem = typeof mealPlanItems.$inferSelect;
