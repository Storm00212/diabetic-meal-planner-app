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
];
/** Kenyan socio-economic settings that shape budget and portion expectations. */
export const USER_SETTINGS = [
    "student",
    "child",
    "working_class",
    "elderly",
    "rural_farmer",
];
export const USER_ROLES = ["user", "admin"];
export const MEAL_SLOTS = ["morning", "afternoon", "evening"];
export const MEAL_TIMES = ["morning", "afternoon", "evening", "any"];
export const PLAN_ITEM_STATUSES = ["planned", "eaten", "skipped"];
export const PLAN_STATUSES = ["planned", "active", "completed"];
export const BUDGET_PERIODS = ["daily", "weekly", "until_payday"];
export const PAYMENT_STATUSES = [
    "initiated",
    "pending",
    "completed",
    "failed",
    "cancelled",
];
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
};
export const SERVICE_NAMES = [
    "gateway",
    "auth",
    "catalog",
    "planner",
    "health",
];
export function serviceUrl(service, host = "127.0.0.1") {
    return `http://${host}:${SERVICE_PORTS[service]}`;
}
//# sourceMappingURL=index.js.map