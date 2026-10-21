import { createGlucoPlateApi, resolveApiUrl } from "@glucoplate/api-client";

/**
 * The one API client for the whole web app.
 *
 * There is a single Backend API, so the app needs a single base URL. It comes
 * from `VITE_API_URL` and is baked into the bundle at build time.
 */

const TOKEN_STORAGE_KEY = "glucoplate.token";

export const apiUrl = resolveApiUrl({
  VITE_API_URL: import.meta.env.VITE_API_URL,
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

export const api = createGlucoPlateApi({
  service: "api",
  baseUrl: apiUrl,
  getToken: readToken,
  debug: debugEnabled,
  clientName: "web",
});
