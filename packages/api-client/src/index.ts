/**
 * @glucoplate/api-client
 *
 * One typed HTTP client, used by the web app, the mobile app and the
 * gateway. It knows which service owns which endpoint, so a client never
 * hard-codes a port.
 *
 * ## Tracing
 *
 * Every request carries an `x-request-id`. The client generates it, the
 * service logs it, and the gateway forwards it. Turn on `debug` and you can
 * follow one request from the UI through the gateway into every service it
 * touched.
 */

import type {
  AnalyticsResponse,
  ApiError,
  AuthResponse,
  ChatRequest,
  ChatResponse,
  Dish,
  DishInput,
  GeneratePlanRequest,
  GeneratePlanResponse,
  HealthResponse,
  LoginRequest,
  MealPlan,
  MealPlanItem,
  MealPlanWithItems,
  Payment,
  PortionTargets,
  PublicUser,
  RegisterRequest,
  ServiceName,
  SwapCandidate,
  UpdateBudgetRequest,
  UpdatePlanItemRequest,
  UpdateProfileRequest,
  UpdateSettingsRequest,
  WeightLog,
  WeightRequest,
  WeightTargets,
} from "@glucoplate/types";

export type { ServiceName };

/** A failed API call, with enough detail to debug it. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly service: ServiceName | "gateway";

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      requestId?: string;
      service: ServiceName | "gateway";
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.service = options.service;
  }
}

/** The base URL of each service, resolved from the environment. */
export type ServiceUrls = Record<ServiceName, string>;

export const DEFAULT_SERVICE_URLS: ServiceUrls = {
  gateway: "http://127.0.0.1:4000",
  auth: "http://127.0.0.1:4001",
  catalog: "http://127.0.0.1:4002",
  planner: "http://127.0.0.1:4003",
  health: "http://127.0.0.1:4004",
};

/**
 * Builds the service URL map from environment variables.
 *
 * The web app reads `VITE_*`, the mobile app reads `EXPO_PUBLIC_*`, and the
 * gateway reads plain names. Pass the resolved values in.
 */
export function resolveServiceUrls(source: {
  VITE_API_URL?: string;
  VITE_SVC_AUTH_URL?: string;
  VITE_SVC_CATALOG_URL?: string;
  VITE_SVC_PLANNER_URL?: string;
  VITE_SVC_HEALTH_URL?: string;
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_SVC_AUTH_URL?: string;
  EXPO_PUBLIC_SVC_CATALOG_URL?: string;
  EXPO_PUBLIC_SVC_PLANNER_URL?: string;
  EXPO_PUBLIC_SVC_HEALTH_URL?: string;
  SVC_AUTH_URL?: string;
  SVC_CATALOG_URL?: string;
  SVC_PLANNER_URL?: string;
  SVC_HEALTH_URL?: string;
  GATEWAY_URL?: string;
} = {}): ServiceUrls {
  const gateway =
    source.VITE_API_URL ??
    source.EXPO_PUBLIC_API_URL ??
    source.GATEWAY_URL ??
    DEFAULT_SERVICE_URLS.gateway;

  return {
    gateway,
    auth:
      source.VITE_SVC_AUTH_URL ??
      source.EXPO_PUBLIC_SVC_AUTH_URL ??
      source.SVC_AUTH_URL ??
      DEFAULT_SERVICE_URLS.auth,
    catalog:
      source.VITE_SVC_CATALOG_URL ??
      source.EXPO_PUBLIC_SVC_CATALOG_URL ??
      source.SVC_CATALOG_URL ??
      DEFAULT_SERVICE_URLS.catalog,
    planner:
      source.VITE_SVC_PLANNER_URL ??
      source.EXPO_PUBLIC_SVC_PLANNER_URL ??
      source.SVC_PLANNER_URL ??
      DEFAULT_SERVICE_URLS.planner,
    health:
      source.VITE_SVC_HEALTH_URL ??
      source.EXPO_PUBLIC_SVC_HEALTH_URL ??
      source.SVC_HEALTH_URL ??
      DEFAULT_SERVICE_URLS.health,
  };
}

/** A short, unique-enough identifier for tracing one request. */
export function newRequestId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now().toString(36)}_${random}`;
}

export type ClientOptions = {
  /** The service this client talks to. Used in logs and error messages. */
  service: ServiceName | "gateway";
  /** Base URL of the service. */
  baseUrl: string;
  /** Called before each request so the client can attach an auth token. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Print requests and responses to the console. */
  debug?: boolean;
  /** Prefix for the debug output, e.g. "web" or "mobile". */
  clientName?: string;
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Extra headers, merged over the defaults. */
  headers?: Record<string, string>;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
};

/**
 * A thin, typed wrapper around `fetch` that gives every service the same
 * error shape, the same tracing header and the same debug output.
 */
export function createClient(options: ClientOptions) {
  const {
    service,
    baseUrl,
    getToken,
    debug = false,
    clientName = service,
  } = options;

  async function request<T>(
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const { method = "GET", body, headers = {}, timeoutMs = 20000 } = requestOptions;

    const requestId = newRequestId();
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const token = getToken ? await getToken() : null;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-client": clientName,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };

    const url = `${baseUrl.replace(/\/$/, "")}${path}`;
    const startedAt = Date.now();

    if (debug) {
      console.debug(
        `[api:${clientName}] → ${method} ${url}`,
        { requestId, service, body: body ?? undefined },
      );
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        signal: controller.signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `Request to ${service} timed out after ${timeoutMs}ms.`
          : `Could not reach ${service} at ${baseUrl}. Is it running?`;

      if (debug) {
        console.debug(`[api:${clientName}] ✗ ${method} ${url}`, {
          requestId,
          error: message,
        });
      }

      throw new ApiClientError(message, { status: 0, requestId, service });
    } finally {
      if (timer) clearTimeout(timer);
    }

    const durationMs = Date.now() - startedAt;
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    if (debug) {
      console.debug(
        `[api:${clientName}] ${response.status} ${method} ${url} (${durationMs}ms)`,
        { requestId, service, durationMs },
      );
    }

    if (!response.ok) {
      const error = payload as ApiError | null;
      throw new ApiClientError(
        error?.error ?? `Request failed with status ${response.status}.`,
        {
          status: response.status,
          code: error?.code,
          requestId: response.headers.get("x-request-id") ?? requestId,
          service,
        },
      );
    }

    return payload as T;
  }

  return { request, service, baseUrl, debug };
}

export type GlucoPlateClient = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// Typed service facades
// ---------------------------------------------------------------------------

export function createAuthApi(client: GlucoPlateClient) {
  return {
    register: (body: RegisterRequest) =>
      client.request<AuthResponse>("/api/auth/register", { method: "POST", body }),
    login: (body: LoginRequest) =>
      client.request<AuthResponse>("/api/auth/login", { method: "POST", body }),
    me: () => client.request<{ user: PublicUser; notice: string; banner: string | null }>(
      "/api/auth/me",
    ),
    logout: () =>
      client.request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  };
}

export function createCatalogApi(client: GlucoPlateClient) {
  return {
    list: () => client.request<{ dishes: Dish[] }>("/api/dishes"),
    create: (body: DishInput) =>
      client.request<{ dish: Dish }>("/api/dishes", { method: "POST", body }),
    update: (id: number, body: Partial<DishInput>) =>
      client.request<{ dish: Dish }>(`/api/dishes/${id}`, { method: "PATCH", body }),
    remove: (id: number) =>
      client.request<{ ok: boolean }>(`/api/dishes/${id}`, { method: "DELETE" }),
    stats: () =>
      client.request<{
        total: number;
        avgCost: number;
        avgGi: number;
      }>("/api/dishes/stats"),
    /** Cheaper, lower-glycemic-index alternatives for a dish. */
    swap: (dishId: number, limit = 3) =>
      client.request<{
        dish: { id: number; name: string };
        alternatives: SwapCandidate[];
      }>(`/api/dishes/${dishId}/swap?limit=${limit}`),
  };
}

export function createPlannerApi(client: GlucoPlateClient) {
  return {
    list: () => client.request<{ plans: MealPlanWithItems[] }>("/api/plans"),
    generate: (body: GeneratePlanRequest = {}) =>
      client.request<GeneratePlanResponse>("/api/plans/generate", {
        method: "POST",
        body,
      }),
    save: (body: GeneratePlanRequest & { planDate?: string }) =>
      client.request<{ plan: MealPlan; result: GeneratePlanResponse["plan"] }>(
        "/api/plans",
        { method: "POST", body },
      ),
    remove: (id: number) =>
      client.request<{ ok: boolean }>(`/api/plans/${id}`, { method: "DELETE" }),
    updateItem: (body: UpdatePlanItemRequest) =>
      client.request<{ success: boolean; item: MealPlanItem }>(
        "/api/plans/update-item",
        { method: "PATCH", body },
      ),
  };
}

export function createHealthApi(client: GlucoPlateClient) {
  return {
    analytics: () => client.request<AnalyticsResponse>("/api/analytics"),
    weightLogs: () => client.request<{ logs: WeightLog[] }>("/api/weight"),
    logWeight: (body: WeightRequest) =>
      client.request<{ log: WeightLog }>("/api/weight", { method: "POST", body }),
    weightTargets: () => client.request<WeightTargets>("/api/user/weight-targets"),
    updateWeightTargets: (body: { currentWeight?: number; targetWeight?: number }) =>
      client.request<WeightTargets>("/api/user/weight-targets", {
        method: "PATCH",
        body,
      }),
    chat: (body: ChatRequest) =>
      client.request<ChatResponse>("/api/chat", { method: "POST", body }),
    nutrients: (query: string) =>
      client.request<Record<string, number>>(
        `/api/nutrients?query=${encodeURIComponent(query)}`,
      ),
    payments: () => client.request<{ payments: Payment[] }>("/api/payments"),
  };
}

export function createUserApi(client: GlucoPlateClient) {
  return {
    profile: () => client.request<PublicUser & { notice?: string }>("/api/user/profile"),
    updateProfile: (body: UpdateProfileRequest) =>
      client.request<{ success: boolean }>("/api/user/profile", {
        method: "PATCH",
        body,
      }),
    budget: () =>
      client.request<{
        dailyBudget: number;
        budgetAmount: number;
        budgetPeriod: string;
        budgetCurrency: string;
        paydayDate: string | null;
      }>("/api/user/budget"),
    updateBudget: (body: UpdateBudgetRequest) =>
      client.request<{ success: boolean }>("/api/user/budget", {
        method: "PATCH",
        body,
      }),
    settings: () => client.request<PublicUser>("/api/settings"),
    updateSettings: (body: UpdateSettingsRequest) =>
      client.request<{ success: boolean }>("/api/settings", {
        method: "PATCH",
        body,
      }),
    /** The daily nutrition targets derived from the caller's physical profile. */
    portionTargets: () =>
      client.request<
        PortionTargets & {
          profile: {
            age: number | null;
            sex: string;
            heightCm: number | null;
            weightKg: number | null;
            activityLevel: string;
          };
        }
      >("/api/user/portion-targets"),
  };
}

export function createHealthCheckApi(client: GlucoPlateClient) {
  return {
    check: () => client.request<HealthResponse>("/api/health"),
  };
}

/** Everything a client needs, in one object. */
export function createGlucoPlateApi(options: ClientOptions) {
  const client = createClient(options);
  return {
    client,
    auth: createAuthApi(client),
    catalog: createCatalogApi(client),
    planner: createPlannerApi(client),
    health: createHealthApi(client),
    user: createUserApi(client),
  };
}

export type GlucoPlateApi = ReturnType<typeof createGlucoPlateApi>;
