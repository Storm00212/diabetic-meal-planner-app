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
import type { AnalyticsResponse, AuthResponse, ChatRequest, ChatResponse, Dish, DishInput, GeneratePlanRequest, GeneratePlanResponse, HealthResponse, LoginRequest, MealPlan, MealPlanItem, MealPlanWithItems, Payment, PublicUser, RegisterRequest, ServiceName, UpdateBudgetRequest, UpdatePlanItemRequest, UpdateProfileRequest, UpdateSettingsRequest, WeightLog, WeightRequest, WeightTargets } from "@glucoplate/types";
export type { ServiceName };
/** A failed API call, with enough detail to debug it. */
export declare class ApiClientError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly requestId?: string;
    readonly service: ServiceName | "gateway";
    constructor(message: string, options: {
        status: number;
        code?: string;
        requestId?: string;
        service: ServiceName | "gateway";
    });
}
/** The base URL of each service, resolved from the environment. */
export type ServiceUrls = Record<ServiceName, string>;
export declare const DEFAULT_SERVICE_URLS: ServiceUrls;
/**
 * Builds the service URL map from environment variables.
 *
 * The web app reads `VITE_*`, the mobile app reads `EXPO_PUBLIC_*`, and the
 * gateway reads plain names. Pass the resolved values in.
 */
export declare function resolveServiceUrls(source?: {
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
}): ServiceUrls;
/** A short, unique-enough identifier for tracing one request. */
export declare function newRequestId(): string;
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
export declare function createClient(options: ClientOptions): {
    request: <T>(path: string, requestOptions?: RequestOptions) => Promise<T>;
    service: ServiceName;
    baseUrl: string;
    debug: boolean;
};
export type GlucoPlateClient = ReturnType<typeof createClient>;
export declare function createAuthApi(client: GlucoPlateClient): {
    register: (body: RegisterRequest) => Promise<AuthResponse>;
    login: (body: LoginRequest) => Promise<AuthResponse>;
    me: () => Promise<{
        user: PublicUser;
        notice: string;
        banner: string | null;
    }>;
    logout: () => Promise<{
        ok: boolean;
    }>;
};
export declare function createCatalogApi(client: GlucoPlateClient): {
    list: () => Promise<{
        dishes: Dish[];
    }>;
    create: (body: DishInput) => Promise<{
        dish: Dish;
    }>;
    update: (id: number, body: Partial<DishInput>) => Promise<{
        dish: Dish;
    }>;
    remove: (id: number) => Promise<{
        ok: boolean;
    }>;
    stats: () => Promise<{
        total: number;
        avgCost: number;
        avgGi: number;
    }>;
};
export declare function createPlannerApi(client: GlucoPlateClient): {
    list: () => Promise<{
        plans: MealPlanWithItems[];
    }>;
    generate: (body?: GeneratePlanRequest) => Promise<GeneratePlanResponse>;
    save: (body: GeneratePlanRequest & {
        planDate?: string;
    }) => Promise<{
        plan: MealPlan;
        result: GeneratePlanResponse["plan"];
    }>;
    remove: (id: number) => Promise<{
        ok: boolean;
    }>;
    updateItem: (body: UpdatePlanItemRequest) => Promise<{
        success: boolean;
        item: MealPlanItem;
    }>;
};
export declare function createHealthApi(client: GlucoPlateClient): {
    analytics: () => Promise<AnalyticsResponse>;
    weightLogs: () => Promise<{
        logs: WeightLog[];
    }>;
    logWeight: (body: WeightRequest) => Promise<{
        log: WeightLog;
    }>;
    weightTargets: () => Promise<WeightTargets>;
    updateWeightTargets: (body: {
        currentWeight?: number;
        targetWeight?: number;
    }) => Promise<WeightTargets>;
    chat: (body: ChatRequest) => Promise<ChatResponse>;
    nutrients: (query: string) => Promise<Record<string, number>>;
    payments: () => Promise<{
        payments: Payment[];
    }>;
};
export declare function createUserApi(client: GlucoPlateClient): {
    profile: () => Promise<PublicUser & {
        notice?: string;
    }>;
    updateProfile: (body: UpdateProfileRequest) => Promise<{
        success: boolean;
    }>;
    budget: () => Promise<{
        dailyBudget: number;
        budgetAmount: number;
        budgetPeriod: string;
        budgetCurrency: string;
        paydayDate: string | null;
    }>;
    updateBudget: (body: UpdateBudgetRequest) => Promise<{
        success: boolean;
    }>;
    settings: () => Promise<PublicUser>;
    updateSettings: (body: UpdateSettingsRequest) => Promise<{
        success: boolean;
    }>;
};
export declare function createHealthCheckApi(client: GlucoPlateClient): {
    check: () => Promise<HealthResponse>;
};
/** Everything a client needs, in one object. */
export declare function createGlucoPlateApi(options: ClientOptions): {
    client: {
        request: <T>(path: string, requestOptions?: RequestOptions) => Promise<T>;
        service: ServiceName;
        baseUrl: string;
        debug: boolean;
    };
    auth: {
        register: (body: RegisterRequest) => Promise<AuthResponse>;
        login: (body: LoginRequest) => Promise<AuthResponse>;
        me: () => Promise<{
            user: PublicUser;
            notice: string;
            banner: string | null;
        }>;
        logout: () => Promise<{
            ok: boolean;
        }>;
    };
    catalog: {
        list: () => Promise<{
            dishes: Dish[];
        }>;
        create: (body: DishInput) => Promise<{
            dish: Dish;
        }>;
        update: (id: number, body: Partial<DishInput>) => Promise<{
            dish: Dish;
        }>;
        remove: (id: number) => Promise<{
            ok: boolean;
        }>;
        stats: () => Promise<{
            total: number;
            avgCost: number;
            avgGi: number;
        }>;
    };
    planner: {
        list: () => Promise<{
            plans: MealPlanWithItems[];
        }>;
        generate: (body?: GeneratePlanRequest) => Promise<GeneratePlanResponse>;
        save: (body: GeneratePlanRequest & {
            planDate?: string;
        }) => Promise<{
            plan: MealPlan;
            result: GeneratePlanResponse["plan"];
        }>;
        remove: (id: number) => Promise<{
            ok: boolean;
        }>;
        updateItem: (body: UpdatePlanItemRequest) => Promise<{
            success: boolean;
            item: MealPlanItem;
        }>;
    };
    health: {
        analytics: () => Promise<AnalyticsResponse>;
        weightLogs: () => Promise<{
            logs: WeightLog[];
        }>;
        logWeight: (body: WeightRequest) => Promise<{
            log: WeightLog;
        }>;
        weightTargets: () => Promise<WeightTargets>;
        updateWeightTargets: (body: {
            currentWeight?: number;
            targetWeight?: number;
        }) => Promise<WeightTargets>;
        chat: (body: ChatRequest) => Promise<ChatResponse>;
        nutrients: (query: string) => Promise<Record<string, number>>;
        payments: () => Promise<{
            payments: Payment[];
        }>;
    };
    user: {
        profile: () => Promise<PublicUser & {
            notice?: string;
        }>;
        updateProfile: (body: UpdateProfileRequest) => Promise<{
            success: boolean;
        }>;
        budget: () => Promise<{
            dailyBudget: number;
            budgetAmount: number;
            budgetPeriod: string;
            budgetCurrency: string;
            paydayDate: string | null;
        }>;
        updateBudget: (body: UpdateBudgetRequest) => Promise<{
            success: boolean;
        }>;
        settings: () => Promise<PublicUser>;
        updateSettings: (body: UpdateSettingsRequest) => Promise<{
            success: boolean;
        }>;
    };
};
export type GlucoPlateApi = ReturnType<typeof createGlucoPlateApi>;
//# sourceMappingURL=index.d.ts.map