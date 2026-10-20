import type { ServiceName } from "@glucoplate/types";
import { config } from "./config.js";

/**
 * The upstream services the gateway fronts.
 *
 * `gateway` itself is not an upstream: it is the thing the clients talk to.
 */
export type UpstreamName = Exclude<ServiceName, "gateway">;

/** Where each upstream lives. */
export const UPSTREAM_URLS: Record<UpstreamName, string> = {
  auth: config.svcAuthUrl,
  catalog: config.svcCatalogUrl,
  planner: config.svcPlannerUrl,
  health: config.svcHealthUrl,
};

export type RouteRule = {
  /** The path prefix this rule owns. */
  path: string;
  /** The upstream that serves it. */
  upstream: UpstreamName;
};

/**
 * The routing table, in the order it is documented.
 *
 * A rule owns the path itself and everything below it, so `/api/dishes`
 * covers `/api/dishes` and `/api/dishes/12`.
 */
export const ROUTE_TABLE: RouteRule[] = [
  { path: "/api/auth", upstream: "auth" },
  { path: "/api/user/profile", upstream: "auth" },
  { path: "/api/user/budget", upstream: "auth" },
  { path: "/api/user/portion-targets", upstream: "auth" },
  { path: "/api/settings", upstream: "auth" },
  { path: "/api/dishes", upstream: "catalog" },
  { path: "/api/plans", upstream: "planner" },
  { path: "/api/weight", upstream: "health" },
  { path: "/api/user/weight-targets", upstream: "health" },
  { path: "/api/analytics", upstream: "health" },
  { path: "/api/chat", upstream: "health" },
  { path: "/api/nutrients", upstream: "health" },
];

/**
 * The same table, longest prefix first.
 *
 * `/api/user/weight-targets` is longer than `/api/user/profile`, so it is
 * tried first and is never swallowed by a shorter, broader rule.
 */
export const ROUTES: RouteRule[] = [...ROUTE_TABLE].sort(
  (a, b) => b.path.length - a.path.length,
);

/**
 * Finds the upstream that owns a path.
 *
 * Returns undefined when nothing matches, which the caller turns into a 404.
 */
export function matchRoute(pathname: string): RouteRule | undefined {
  return ROUTES.find(
    (rule) => pathname === rule.path || pathname.startsWith(`${rule.path}/`),
  );
}
