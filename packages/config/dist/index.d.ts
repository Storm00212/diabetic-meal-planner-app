/**
 * Shared environment helpers for every workspace.
 *
 * Each service reads its own variables but they all follow the same naming
 * rules, so the helpers live in one place.
 */
/** Reads an environment variable, falling back to a default. */
export declare function env(name: string, fallback?: string): string;
/** Reads a required environment variable, throwing a clear error if missing. */
export declare function requiredEnv(name: string): string;
/** Parses a boolean-ish environment variable. */
export declare function boolEnv(name: string, fallback?: boolean): boolean;
/** The log level for a service: debug | info | warn | error | silent. */
export declare function logLevel(): "debug" | "info" | "warn" | "error" | "silent";
/**
 * The origin list a service accepts browser requests from.
 *
 * `*` is allowed for the sandbox so the Expo web target and the Vite dev
 * server work without extra configuration.
 */
export declare function corsOrigins(): string[];
//# sourceMappingURL=index.d.ts.map