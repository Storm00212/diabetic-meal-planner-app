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
/** The 42 shared Kenyan dishes every account can plan with. */
export declare const KENYAN_DISHES: SeedDish[];
/** The five demo personas plus the generic demo account. */
export declare const PERSONAS: SeedPersona[];
export declare const DEMO_CREDENTIALS: {
    readonly email: "demo@glucoplate.app";
    readonly password: "demo123";
};
export declare const PERSONA_PASSWORD: "Gluco@2026";
//# sourceMappingURL=index.d.ts.map