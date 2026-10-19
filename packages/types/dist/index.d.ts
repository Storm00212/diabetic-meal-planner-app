/**
 * @glucoplate/types
 *
 * The shared API contract. Every service, the web app and the mobile app
 * import from here, so a change to a request or response shape is a
 * compile-time error everywhere it matters.
 *
 * Nothing in this package may import from an app or a service.
 */
/** Clinical severity ladder, from lowest to highest risk. */
export declare const DIABETES_LEVELS: readonly ["healthy", "prediabetes", "type2_controlled", "type2_high_risk", "critical"];
export type DiabetesLevel = (typeof DIABETES_LEVELS)[number];
/** Kenyan socio-economic settings that shape budget and portion expectations. */
export declare const USER_SETTINGS: readonly ["student", "child", "working_class", "elderly", "rural_farmer"];
export type UserSetting = (typeof USER_SETTINGS)[number];
export declare const USER_ROLES: readonly ["user", "admin"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const MEAL_SLOTS: readonly ["morning", "afternoon", "evening"];
export type MealSlot = (typeof MEAL_SLOTS)[number];
export declare const MEAL_TIMES: readonly ["morning", "afternoon", "evening", "any"];
export type MealTime = (typeof MEAL_TIMES)[number];
export declare const PLAN_ITEM_STATUSES: readonly ["planned", "eaten", "skipped"];
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];
export declare const PLAN_STATUSES: readonly ["planned", "active", "completed"];
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export declare const BUDGET_PERIODS: readonly ["daily", "weekly", "until_payday"];
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];
export declare const PAYMENT_STATUSES: readonly ["initiated", "pending", "completed", "failed", "cancelled"];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
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
    slots: Record<MealSlot, PlanSlot["dish"]>;
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
export type MealPlanWithItems = MealPlan & {
    items: MealPlanItem[];
};
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
    carbTrends: {
        date: string;
        carbs: number;
    }[];
    nutritionDist: {
        gi: number;
        count: number;
    }[];
};
export type ChatRequest = {
    query: string;
};
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
export type ServiceName = "gateway" | "auth" | "catalog" | "planner" | "health";
/**
 * The explicit local port for every service.
 *
 * Keeping them in one place means the web app, the mobile app, the gateway
 * and the smoke test all agree on where a service lives.
 */
export declare const SERVICE_PORTS: {
    readonly gateway: 4000;
    readonly auth: 4001;
    readonly catalog: 4002;
    readonly planner: 4003;
    readonly health: 4004;
};
export declare const SERVICE_NAMES: ServiceName[];
export declare function serviceUrl(service: ServiceName, host?: string): string;
//# sourceMappingURL=index.d.ts.map