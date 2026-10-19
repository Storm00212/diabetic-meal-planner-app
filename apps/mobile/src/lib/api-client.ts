/**
 * The mobile app's API client.
 *
 * It wraps the shared `@glucoplate/api-client` so the mobile app and the web
 * app speak exactly the same contract, and stores the access token in the
 * device's secure storage.
 */

import * as SecureStore from "expo-secure-store";
import {
  createGlucoPlateApi,
  resolveServiceUrls,
  type GlucoPlateApi,
} from "@glucoplate/api-client";

const TOKEN_STORAGE_KEY = "auth_token";

export const serviceUrls = resolveServiceUrls({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SVC_AUTH_URL: process.env.EXPO_PUBLIC_SVC_AUTH_URL,
  EXPO_PUBLIC_SVC_CATALOG_URL: process.env.EXPO_PUBLIC_SVC_CATALOG_URL,
  EXPO_PUBLIC_SVC_PLANNER_URL: process.env.EXPO_PUBLIC_SVC_PLANNER_URL,
  EXPO_PUBLIC_SVC_HEALTH_URL: process.env.EXPO_PUBLIC_SVC_HEALTH_URL,
});

export const debugEnabled = process.env.EXPO_PUBLIC_DEBUG === "true";

export async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

export const api: GlucoPlateApi = createGlucoPlateApi({
  service: "gateway",
  baseUrl: serviceUrls.gateway,
  getToken: readToken,
  debug: debugEnabled,
  clientName: "mobile",
});

/**
 * A raw `fetch` against the gateway, with the access token attached.
 *
 * Use this when you need the status code. `apiJson` is the shortcut for the
 * common case where you only want the body.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await readToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${serviceUrls.gateway}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // The token is missing, expired or invalid. Clear it so the app can send
    // the user back to the login screen instead of retrying forever.
    await removeToken();
  }

  return response;
}

/** The parsed body of a request to the gateway. */
export async function apiJson<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(endpoint, options);
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}
