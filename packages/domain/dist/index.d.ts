/**
 * @glucoplate/domain
 *
 * Pure business rules shared by the services and the clients: the meal
 * planner, budget arithmetic, safety copy and formatting.
 *
 * No database, no HTTP, no framework. Everything here is a function you can
 * unit test with plain values.
 */
import type { Dish, DiabetesLevel, MealSlot, UserSetting } from "@glucoplate/types";
export declare const SLOTS: MealSlot[];
export declare const SLOT_LABELS: Record<MealSlot, string>;
export type PlanOptions = {
    /** Highest glycemic index allowed for a single dish. */
    giLimit?: number;
    /** Free-text ingredients the user must avoid (allergies, dislikes). */
    exclude?: string[];
};
/**
 * Allocate an affordable, diabetes-friendly meal plan.
 *
 * The catalogue is the same for everybody, but the plan is not: the glycemic
 * index ceiling, the carbohydrate allowance, the budget and the user's
 * exclusions decide which three dishes end up on the plate.
 */
export declare function generatePlan(dishes: Dish[], budget: number, carbTarget: number, options?: PlanOptions): {
    slots: Record<MealSlot, Dish | null>;
    totalCost: number;
    totalCarbs: number;
    totalCalories: number;
    withinBudget: boolean;
    withinCarbs: boolean;
    withinGi: boolean;
    highestGi: number;
    message: string;
};
export declare function giBand(gi: number): {
    label: string;
    badge: string;
};
/**
 * The foods a user must not be served, taken from their allergies and
 * dislikes (both stored as comma-separated lists).
 */
export declare function exclusionsFor(user: {
    allergies?: string | null;
    dislikes?: string | null;
}): string[];
export type BudgetLike = {
    budgetAmount: number;
    budgetPeriod: string;
    dailyBudget: number;
    paydayDate?: Date | string | null;
};
/** How many days the current budget period covers. */
export declare function periodDays(user: BudgetLike, now?: Date): number;
/**
 * The daily allowance in KES.
 *
 * `budgetAmount` is the source of truth. `dailyBudget` is only used as a
 * fallback for accounts that have never set a period total.
 */
export declare function dailyAllowance(user: BudgetLike, now?: Date): number;
export declare const PLANNING_AID_NOTICE = "GlucoPlate is a planning aid, not medical advice. It does not diagnose or treat diabetes. Always follow the meal plan your doctor or dietitian gave you, and check with them before making dietary changes.";
export declare const SHORT_DISCLAIMER = "Planning aid, not medical advice. Consult your doctor or dietitian.";
export declare const CRITICAL_CLINICIAN_BANNER = "Your glucose readings have been in the high-risk range. Talk to your doctor or dietitian before changing your meals. GlucoPlate can help you plan cheaper and lower-GI options, but it cannot replace their advice.";
export declare const HIGH_RISK_CLINICIAN_BANNER = "You are in a high-risk category. Review this plan with your doctor or dietitian before you start.";
export type DiabetesLevelMeta = {
    label: string;
    blurb: string;
    giLimit: number;
    carbLimit: number;
    calorieLimit: number;
    badge: string;
    requiresClinician: boolean;
};
export declare const DIABETES_LEVEL_META: Record<DiabetesLevel, DiabetesLevelMeta>;
export type UserSettingMeta = {
    label: string;
    blurb: string;
    badge: string;
};
export declare const USER_SETTING_META: Record<UserSetting, UserSettingMeta>;
/**
 * Returns the banner a user should see, or `null` when they do not need one.
 */
export declare function clinicianBannerFor(user: {
    diabetesLevel?: string | null;
    needsClinicianReview?: boolean | null;
}): string | null;
/** Metadata for a diabetes level, with a safe fallback for unknown values. */
export declare function levelMeta(level: string | null | undefined): DiabetesLevelMeta;
/** Formats an amount of Kenyan shillings. */
export declare function money(n: number): string;
export declare function formatDate(d: string): string;
export declare const MEAL_TIME_LABELS: Record<string, string>;
//# sourceMappingURL=index.d.ts.map