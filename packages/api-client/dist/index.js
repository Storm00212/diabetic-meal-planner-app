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
/** A failed API call, with enough detail to debug it. */
export class ApiClientError extends Error {
    status;
    code;
    requestId;
    service;
    constructor(message, options) {
        super(message);
        this.name = "ApiClientError";
        this.status = options.status;
        this.code = options.code;
        this.requestId = options.requestId;
        this.service = options.service;
    }
}
export const DEFAULT_SERVICE_URLS = {
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
export function resolveServiceUrls(source = {}) {
    const gateway = source.VITE_API_URL ??
        source.EXPO_PUBLIC_API_URL ??
        source.GATEWAY_URL ??
        DEFAULT_SERVICE_URLS.gateway;
    return {
        gateway,
        auth: source.VITE_SVC_AUTH_URL ??
            source.EXPO_PUBLIC_SVC_AUTH_URL ??
            source.SVC_AUTH_URL ??
            DEFAULT_SERVICE_URLS.auth,
        catalog: source.VITE_SVC_CATALOG_URL ??
            source.EXPO_PUBLIC_SVC_CATALOG_URL ??
            source.SVC_CATALOG_URL ??
            DEFAULT_SERVICE_URLS.catalog,
        planner: source.VITE_SVC_PLANNER_URL ??
            source.EXPO_PUBLIC_SVC_PLANNER_URL ??
            source.SVC_PLANNER_URL ??
            DEFAULT_SERVICE_URLS.planner,
        health: source.VITE_SVC_HEALTH_URL ??
            source.EXPO_PUBLIC_SVC_HEALTH_URL ??
            source.SVC_HEALTH_URL ??
            DEFAULT_SERVICE_URLS.health,
    };
}
/** A short, unique-enough identifier for tracing one request. */
export function newRequestId() {
    const random = Math.random().toString(36).slice(2, 10);
    return `req_${Date.now().toString(36)}_${random}`;
}
/**
 * A thin, typed wrapper around `fetch` that gives every service the same
 * error shape, the same tracing header and the same debug output.
 */
export function createClient(options) {
    const { service, baseUrl, getToken, debug = false, clientName = service, } = options;
    async function request(path, requestOptions = {}) {
        const { method = "GET", body, headers = {}, timeoutMs = 20000 } = requestOptions;
        const requestId = newRequestId();
        const controller = new AbortController();
        const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
        const token = getToken ? await getToken() : null;
        const requestHeaders = {
            "Content-Type": "application/json",
            "x-request-id": requestId,
            "x-client": clientName,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        };
        const url = `${baseUrl.replace(/\/$/, "")}${path}`;
        const startedAt = Date.now();
        if (debug) {
            console.debug(`[api:${clientName}] → ${method} ${url}`, { requestId, service, body: body ?? undefined });
        }
        let response;
        try {
            response = await fetch(url, {
                method,
                headers: requestHeaders,
                signal: controller.signal,
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
        }
        catch (error) {
            const message = error instanceof Error && error.name === "AbortError"
                ? `Request to ${service} timed out after ${timeoutMs}ms.`
                : `Could not reach ${service} at ${baseUrl}. Is it running?`;
            if (debug) {
                console.debug(`[api:${clientName}] ✗ ${method} ${url}`, {
                    requestId,
                    error: message,
                });
            }
            throw new ApiClientError(message, { status: 0, requestId, service });
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
        const durationMs = Date.now() - startedAt;
        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            }
            catch {
                payload = { raw: text };
            }
        }
        if (debug) {
            console.debug(`[api:${clientName}] ${response.status} ${method} ${url} (${durationMs}ms)`, { requestId, service, durationMs });
        }
        if (!response.ok) {
            const error = payload;
            throw new ApiClientError(error?.error ?? `Request failed with status ${response.status}.`, {
                status: response.status,
                code: error?.code,
                requestId: response.headers.get("x-request-id") ?? requestId,
                service,
            });
        }
        return payload;
    }
    return { request, service, baseUrl, debug };
}
// ---------------------------------------------------------------------------
// Typed service facades
// ---------------------------------------------------------------------------
export function createAuthApi(client) {
    return {
        register: (body) => client.request("/api/auth/register", { method: "POST", body }),
        login: (body) => client.request("/api/auth/login", { method: "POST", body }),
        me: () => client.request("/api/auth/me"),
        logout: () => client.request("/api/auth/logout", { method: "POST" }),
    };
}
export function createCatalogApi(client) {
    return {
        list: () => client.request("/api/dishes"),
        create: (body) => client.request("/api/dishes", { method: "POST", body }),
        update: (id, body) => client.request(`/api/dishes/${id}`, { method: "PATCH", body }),
        remove: (id) => client.request(`/api/dishes/${id}`, { method: "DELETE" }),
        stats: () => client.request("/api/dishes/stats"),
    };
}
export function createPlannerApi(client) {
    return {
        list: () => client.request("/api/plans"),
        generate: (body = {}) => client.request("/api/plans/generate", {
            method: "POST",
            body,
        }),
        save: (body) => client.request("/api/plans", { method: "POST", body }),
        remove: (id) => client.request(`/api/plans/${id}`, { method: "DELETE" }),
        updateItem: (body) => client.request("/api/plans/update-item", { method: "PATCH", body }),
    };
}
export function createHealthApi(client) {
    return {
        analytics: () => client.request("/api/analytics"),
        weightLogs: () => client.request("/api/weight"),
        logWeight: (body) => client.request("/api/weight", { method: "POST", body }),
        weightTargets: () => client.request("/api/user/weight-targets"),
        updateWeightTargets: (body) => client.request("/api/user/weight-targets", {
            method: "PATCH",
            body,
        }),
        chat: (body) => client.request("/api/chat", { method: "POST", body }),
        nutrients: (query) => client.request(`/api/nutrients?query=${encodeURIComponent(query)}`),
        payments: () => client.request("/api/payments"),
    };
}
export function createUserApi(client) {
    return {
        profile: () => client.request("/api/user/profile"),
        updateProfile: (body) => client.request("/api/user/profile", {
            method: "PATCH",
            body,
        }),
        budget: () => client.request("/api/user/budget"),
        updateBudget: (body) => client.request("/api/user/budget", {
            method: "PATCH",
            body,
        }),
        settings: () => client.request("/api/settings"),
        updateSettings: (body) => client.request("/api/settings", {
            method: "PATCH",
            body,
        }),
    };
}
export function createHealthCheckApi(client) {
    return {
        check: () => client.request("/api/health"),
    };
}
/** Everything a client needs, in one object. */
export function createGlucoPlateApi(options) {
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
//# sourceMappingURL=index.js.map