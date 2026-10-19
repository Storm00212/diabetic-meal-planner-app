import {
  createGlucoPlateApi,
  resolveServiceUrls,
  type GlucoPlateApi,
} from "@glucoplate/api-client";

/**
 * The single API client for the whole web app.
 *
 * Every feature imports this instance rather than constructing its own, so
 * the base URL, the auth token and the debug switch live in one place.
 */

const TOKEN_STORAGE_KEY = "glucoplate.token";

export const serviceUrls = resolveServiceUrls({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_SVC_AUTH_URL: import.meta.env.VITE_SVC_AUTH_URL,
  VITE_SVC_CATALOG_URL: import.meta.env.VITE_SVC_CATALOG_URL,
  VITE_SVC_PLANNER_URL: import.meta.env.VITE_SVC_PLANNER_URL,
  VITE_SVC_HEALTH_URL: import.meta.env.VITE_SVC_HEALTH_URL,
});

export const debugEnabled = import.meta.env.VITE_DEBUG_API === "true";

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* storage unavailable (private mode) — the session simply will not persist */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const api: GlucoPlateApi = createGlucoPlateApi({
  service: "gateway",
  baseUrl: serviceUrls.gateway,
  getToken: readToken,
  debug: debugEnabled,
  clientName: "web",
});
