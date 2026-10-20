/**
 * @glucoplate/domain — portions, explanations and swaps.
 *
 * Pure business rules shared by the services and the clients.
 */

/** How much the person moves in a day. */
export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/**
 * Physical Activity Scale multipliers applied to the basal metabolic rate.
 * Values follow the standard PAL classification.
 */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary — desk work, little exercise",
  light: "Lightly active — a walk or light exercise a few times a week",
  moderate: "Moderately active — exercise three to five times a week",
  active: "Very active — hard exercise six to seven times a week",
};

export type Sex = "male" | "female" | "unspecified";

export type PortionProfile = {
  age: number | null | undefined;
  sex: Sex | string | null | undefined;
  heightCm: number | null | undefined;
  weightKg: number | null | undefined;
  activityLevel: ActivityLevel | string | null | undefined;
};

export type PortionTargets = {
  /** Daily energy, in kcal. */
  calories: number;
  /** Daily carbohydrate, in grams. */
  carbsG: number;
  /** Daily protein, in grams. */
  proteinG: number;
  /** Daily fat, in grams. */
  fatG: number;
  /** Basal metabolic rate, in kcal. */
  bmr: number;
  /** Total daily energy expenditure, in kcal. */
  tdee: number;
  /** How the numbers were arrived at, shown to the user. */
  basis: string;
  /** True when the profile had enough information to personalise it. */
  personalised: boolean;
};

/** The values used when the profile is too incomplete to personalise. */
export const DEFAULT_PORTION_TARGETS: PortionTargets = {
  calories: 2000,
  carbsG: 225,
  proteinG: 100,
  fatG: 67,
  bmr: 1500,
  tdee: 2000,
  basis:
    "A general adult profile. Add your age, height, weight and activity level for a plan shaped around you.",
  personalised: false,
};

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normaliseActivity(value: unknown): ActivityLevel {
  const candidate = String(value ?? "").toLowerCase();
  return (ACTIVITY_LEVELS as readonly string[]).includes(candidate)
    ? (candidate as ActivityLevel)
    : "light";
}

function normaliseSex(value: unknown): Sex {
  const candidate = String(value ?? "").toLowerCase();
  if (candidate === "male" || candidate === "female") return candidate;
  return "unspecified";
}

/**
 * Basal metabolic rate, using the Mifflin-St Jeor equation.
 *
 *   male:   10 x weight(kg) + 6.25 x height(cm) - 5 x age + 5
 *   female: 10 x weight(kg) + 6.25 x height(cm) - 5 x age - 161
 */
export function bmrCalories(profile: PortionProfile): number | null {
  const weight = numberOrNull(profile.weightKg);
  const height = numberOrNull(profile.heightCm);
  const age = numberOrNull(profile.age);

  if (weight === null || height === null || age === null) return null;

  const base = 10 * weight + 6.25 * height - 5 * age;
  const sex = normaliseSex(profile.sex);
  const offset = sex === "male" ? 5 : sex === "female" ? -161 : -78;

  return Math.round(base + offset);
}

/** Total daily energy expenditure, in kcal. */
export function dailyEnergy(profile: PortionProfile): number | null {
  const bmr = bmrCalories(profile);
  if (bmr === null) return null;

  return Math.round(bmr * ACTIVITY_FACTORS[normaliseActivity(profile.activityLevel)]);
}

/**
 * The daily nutrition targets for one person.
 *
 * The split is diabetes-aware: carbohydrate is held at 45% of energy (rather
 * than the usual 50-55%) because the plan has to fit a carbohydrate ceiling,
 * and protein is given a slightly larger share so the meals stay filling.
 */
export function portionTargets(profile: PortionProfile): PortionTargets {
  const tdee = dailyEnergy(profile);
  const bmr = bmrCalories(profile);

  if (tdee === null || bmr === null) {
    return { ...DEFAULT_PORTION_TARGETS };
  }

  const carbShare = 0.45;
  const proteinShare = 0.25;
  const fatShare = 0.3;

  return {
    calories: tdee,
    carbsG: Math.round((tdee * carbShare) / 4),
    proteinG: Math.round((tdee * proteinShare) / 4),
    fatG: Math.round((tdee * fatShare) / 9),
    bmr,
    tdee,
    basis: `Mifflin-St Jeor from your height, weight and age, times a ${normaliseActivity(profile.activityLevel)} activity factor. Carbohydrate is held at 45% of your energy.`,
    personalised: true,
  };
}

/**
 * How many portions of a dish fit a person's remaining carbohydrate budget.
 *
 * A portion is one serving of the dish as described by its serving label.
 */
export function portionsForDish(
  dish: { carbsG: number; cost: number },
  targets: PortionTargets,
  remainingCarbsG: number,
  remainingBudget: number,
): number {
  if (dish.carbsG <= 0) return remainingBudget >= dish.cost ? 1 : 0;

  const byCarbs = Math.floor(remainingCarbsG / dish.carbsG);
  const byBudget = dish.cost > 0 ? Math.floor(remainingBudget / dish.cost) : 99;

  return Math.max(0, Math.min(byCarbs, byBudget, 3));
}
