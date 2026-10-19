/**
 * @glucoplate/data
 *
 * The seed fixtures for GlucoPlate: the shared Kenyan dish catalogue and the
 * demo personas. Both are the single source of truth for the seed scripts and
 * the tests.
 *
 * The JSON is read from disk at runtime rather than imported, so the same
 * package works in every Node version without JSON import attributes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SeedDish = {
  name: string;
  description: string;
  mealTime: "morning" | "afternoon" | "evening" | "any";
  /** Cost of one serving in KES. */
  cost: number;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  glycemicIndex: number;
  region: string;
  isPantryItem: boolean;
};

export type SeedPersona = {
  email: string;
  name: string;
  password: string;
  role: string;
  setting: string;
  diabetesLevel: string;
  region: string;
  description: string;
  dailyBudget: number;
  budgetAmount: number;
  budgetPeriod: string;
  budgetCurrency: string;
  dailyCarbTarget: number;
  dailyGiLimit: number;
  dailyCalorieLimit: number;
  age: number;
  heightCm: number;
  currentWeight: number;
  targetWeight: number;
  isPremium: boolean;
  needsClinicianReview: boolean;
  allergies: string;
  dislikes: string;
};

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "src");

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(dataDir, fileName), "utf8")) as T;
}

/** The 42 shared Kenyan dishes every account can plan with. */
export const KENYAN_DISHES = readJson<SeedDish[]>("kenyan-dishes.json");

/** The five demo personas plus the generic demo account. */
export const PERSONAS = readJson<SeedPersona[]>("personas.json");

export const DEMO_CREDENTIALS = {
  email: "demo@glucoplate.app",
  password: "demo123",
} as const;

export const PERSONA_PASSWORD = "Gluco@2026" as const;
