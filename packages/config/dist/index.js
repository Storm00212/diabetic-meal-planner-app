/**
 * Shared environment helpers for every workspace.
 *
 * Each service reads its own variables but they all follow the same naming
 * rules, so the helpers live in one place.
 */
/** Reads an environment variable, falling back to a default. */
export function env(name, fallback = "") {
    const value = process.env[name];
    return value === undefined || value === "" ? fallback : value;
}
/** Reads a required environment variable, throwing a clear error if missing. */
export function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
    }
    return value;
}
/** Parses a boolean-ish environment variable. */
export function boolEnv(name, fallback = false) {
    const value = process.env[name];
    if (value === undefined)
        return fallback;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
/** The log level for a service: debug | info | warn | error | silent. */
export function logLevel() {
    const value = (process.env.LOG_LEVEL ?? "info").toLowerCase();
    if (value === "debug" ||
        value === "info" ||
        value === "warn" ||
        value === "error" ||
        value === "silent") {
        return value;
    }
    return "info";
}
/**
 * The origin list a service accepts browser requests from.
 *
 * `*` is allowed for the sandbox so the Expo web target and the Vite dev
 * server work without extra configuration.
 */
export function corsOrigins() {
    const raw = process.env.CORS_ORIGINS ?? "";
    if (raw.trim() === "*")
        return ["*"];
    return raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}
//# sourceMappingURL=index.js.map