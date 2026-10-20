/**
 * @glucoplate/types
 *
 * The shared API contract. Every service, the web app and the mobile app
 * import from here, so a change to a request or response shape is a
 * compile-time error everywhere it matters.
 *
 * Nothing in this package may import from an app or a service.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Clinical severity ladder, from lowest to highest risk. */
export const DIABETES_LEVELS = [
  "healthy",
  "prediabetes",
  "type2_controlled",
  "type2_high_risk",
  "critical",
] as const;
export type DiabetesLevel = (typeof DIABETES_LEVELS)[number];

/** Kenyan socio-economic settings that shape budget and portion expectations. */
export const USER_SETTINGS = [
  "student",
  "child",
  "working_class",
  "elderly",
  "rural_farmer",
] as const;
export type UserSetting = (typeof USER_SETTINGS)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MEAL_SLOTS = ["morning", "afternoon", "evening"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_TIMES = ["morning", "afternoon", "evening", "any"] as const;
export type MealTime = (typeof MEAL_TIMES)[number];

export const PLAN_ITEM_STATUSES = ["planned", "eaten", "skipped"] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

export const PLAN_STATUSES = ["planned", "active", "completed"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const BUDGET_PERIODS = ["daily", "weekly", "until_payday"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const PAYMENT_STATUSES = [
  "initiated",
  "pending",
  "completed",
  "failed",
  "cancelled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/** The user as every client sees it. Never includes the password hash. */
export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  setting: UserSetting;
  diabetesLevel: DiabetesLevel;
  diabetesType: string;
  region: string;
  /** Maximum carbohydrates (g) per day. */
  dailyCarbLimit: number;
  /** Maximum glycemic index allowed for any single planned dish. */
  dailyGiLimit: number;
  /** Maximum energy (kcal) per day. */
  dailyCalorieLimit: number;
  /** Daily budget in KES. */
  dailyBudget: number;
  /** Total budget for `budgetPeriod`, in KES. */
  budgetAmount: number;
  budgetPeriod: BudgetPeriod;
  budgetCurrency: string;
  paydayDate: string | null;
  isPremium: boolean;
  premiumPlan: string;
  premiumSince: string | null;
  needsClinicianReview: boolean;
  allergies: string;
  dislikes: string;
  age: number | null;
  heightCm: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  createdAt: string;
};

export type Dish = {
  id: number;
  /** `null` means the dish belongs to the shared Kenyan catalogue. */
  userId: number | null;
  name: string;
  description: string;
  mealTime: MealTime;
  /** Cost of one serving in KES. */
  cost: number;
  isPantryItem: boolean;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  glycemicIndex: number;
  /** What one serving actually is, e.g. "1 chapati (60 g)". */
  servingLabel: string;
  region: string;
  isKenyan: boolean;
  source: string;
  createdAt: string;
};

export type DishInput = {
  name: string;
  description?: string;
  mealTime?: MealTime;
  cost?: number;
  isPantryItem?: boolean;
  calories?: number;
  carbsG?: number;
  proteinG?: number;
  fatG?: number;
  fiberG?: number;
  glycemicIndex?: number;
  region?: string;
};

/** The fields the dish form edits. Every field is required on the form. */
export type DishFormValues = {
  name: string;
  description: string;
  mealTime: MealTime;
  cost: number;
  isPantryItem: boolean;
  calories: number;
  carbsG: number;
  proteinG: number;
  glycemicIndex: number;
};

/** A meal slot inside a generated plan. */
export type PlanSlot = {
  dish: Dish | null;
};

/** The result of a plan generation — a preview that has not been saved. */
export type PlanResult = {
  slots: Record<MealSlot, Dish | null>;
  /**
   * Why each dish was chosen, in the user's own numbers — cost against the
   * budget, glycemic index against the limit, carbohydrate against the cap.
   */
  reasons: Record<MealSlot, string[]>;
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  withinBudget: boolean;
  withinCarbs: boolean;
  /** True when every dish is within the caller's glycemic index limit. */
  withinGi: boolean;
  highestGi: number;
  message: string;
};

/** A cheaper, lower-glycemic-index alternative for a dish. */
export type SwapCandidate = Dish & {
  /** How much cheaper the alternative is, in KSh. */
  saving: number;
  /** How much lower the glycemic index is. */
  giDrop: number;
  reason: string;
};

/** How much the person moves in a day. */
export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const SEXES = ["male", "female", "unspecified"] as const;
export type Sex = (typeof SEXES)[number];

/** The physical details a portion calculator needs. */
export type PortionProfile = {
  age: number | null;
  sex: Sex;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel;
};

/** The daily nutrition targets derived from a portion profile. */
export type PortionTargets = {
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  bmr: number;
  tdee: number;
  basis: string;
  /** True when the profile was complete enough to personalise the targets. */
  personalised: boolean;
};

export type MealPlan = {
  id: number;
  userId: number;
  planDate: string;
  budget: number;
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  averageGi: number;
  status: PlanStatus;
  notes: string;
  createdAt: string;
};

export type MealPlanItem = {
  id: number;
  planId: number;
  slot: MealSlot;
  dishId: number;
  dishName: string;
  /** Cost in KES, snapshotted at plan time. */
  cost: number;
  carbsG: number;
  calories: number;
  glycemicIndex: number;
  status: PlanItemStatus;
  actualCost: number;
};

export type MealPlanWithItems = MealPlan & { items: MealPlanItem[] };

export type WeightLog = {
  id: number;
  userId: number;
  weight: number;
  date: string;
  note: string;
  createdAt: string;
};

export type Payment = {
  id: number;
  userId: number;
  provider: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  planTier: string;
  status: PaymentStatus;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  mpesaReceiptCode: string | null;
  resultCode: number | null;
  resultDescription: string | null;
  initiatedAt: string;
  completedAt: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Requests and responses
// ---------------------------------------------------------------------------

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  setting?: UserSetting;
  diabetesLevel?: DiabetesLevel;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthResponse = {
  ok: true;
  token: string;
  user: PublicUser;
  /** Standing safety notice. Always present. */
  notice: string;
  /** Set for the critical / high-risk personas. */
  banner: string | null;
};

export type GeneratePlanRequest = {
  budget?: number;
  carbTarget?: number;
  giLimit?: number;
};

export type GeneratePlanResponse = {
  plan: PlanResult;
  budget: number;
  carbTarget: number;
  giLimit: number;
  notice: string;
  banner: string | null;
};

export type UpdateBudgetRequest = {
  budgetAmount?: number;
  budgetPeriod?: BudgetPeriod;
  budgetCurrency?: string;
  paydayDate?: string | null;
};

export type UpdateProfileRequest = {
  diabetesType?: string;
  allergies?: string;
  dislikes?: string;
  name?: string;
};

export type UpdateSettingsRequest = {
  name?: string;
  dailyBudget?: number;
  dailyCarbTarget?: number;
  dailyGiLimit?: number;
  dailyCalorieLimit?: number;
  age?: number;
  heightCm?: number;
  currentWeight?: number;
  targetWeight?: number;
  sex?: Sex;
  activityLevel?: ActivityLevel;
};

/** The body of a swap request. */
export type SwapRequest = {
  dishId: number;
  /** How many alternatives to return. */
  limit?: number;
};

export type UpdatePlanItemRequest = {
  itemId: number;
  status: PlanItemStatus;
};

export type WeightRequest = {
  weight: number;
  date?: string;
  note?: string;
};

export type WeightTargets = {
  currentWeight: number | null;
  targetWeight: number | null;
};

export type AnalyticsSummary = {
  totalPlans: number;
  totalSpent: number;
  totalBudget: number;
  savings: number;
};

export type AnalyticsResponse = {
  summary: AnalyticsSummary;
  carbTrends: { date: string; carbs: number }[];
  nutritionDist: { gi: number; count: number }[];
};

export type ChatRequest = { query: string };
export type ChatResponse = {
  answer: string;
  disclaimer: string;
  notice: string;
};

export type HealthResponse = {
  ok: boolean;
  service: string;
  database?: "connected" | "not configured" | "unreachable";
  error?: string;
};

/** The shape every failing endpoint returns. */
export type ApiError = {
  error: string;
  code?: string;
  requestId?: string;
};

// ---------------------------------------------------------------------------
// Service registry
// ---------------------------------------------------------------------------

export type ServiceName =
  | "gateway"
  | "auth"
  | "catalog"
  | "planner"
  | "health";

/**
 * The explicit local port for every service.
 *
 * Keeping them in one place means the web app, the mobile app, the gateway
 * and the smoke test all agree on where a service lives.
 */
export const SERVICE_PORTS = {
  gateway: 4000,
  auth: 4001,
  catalog: 4002,
  planner: 4003,
  health: 4004,
} as const satisfies Record<ServiceName, number>;

export const SERVICE_NAMES: ServiceName[] = [
  "gateway",
  "auth",
  "catalog",
  "planner",
  "health",
];

export function serviceUrl(service: ServiceName, host = "127.0.0.1"): string {
  return `http://${host}:${SERVICE_PORTS[service]}`;
}
