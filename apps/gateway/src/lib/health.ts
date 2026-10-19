import { config } from "../config.js";
import { logger } from "./logger.js";
import { UPSTREAM_URLS, type UpstreamName } from "../routes.js";

/** Which upstream services answered the health probe. */
export type UpstreamHealth = Record<UpstreamName, boolean>;

/**
 * Asks one upstream whether it is healthy.
 *
 * The probe is deliberately short-lived: a service that hangs must not be
 * able to hang the gateway's health check.
 */
async function probe(
  name: UpstreamName,
  requestId: string,
): Promise<[UpstreamName, boolean]> {
  const baseUrl = UPSTREAM_URLS[name].replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: {
        "x-request-id": requestId,
        "x-client": "gateway",
      },
      signal: AbortSignal.timeout(config.healthTimeoutMs),
    });

    if (!response.ok) return [name, false];

    const body = (await response.json()) as { ok?: unknown };
    return [name, body?.ok === true];
  } catch (error) {
    logger.debug(`upstream ${name} did not answer`, {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [name, false];
  }
}

/**
 * Probes every upstream in parallel and reports who is up.
 *
 * The probes share the caller's request id, so the health check can be
 * followed through every service it touched.
 */
export async function aggregateHealth(
  requestId: string,
): Promise<UpstreamHealth> {
  const names = Object.keys(UPSTREAM_URLS) as UpstreamName[];
  const results = await Promise.all(
    names.map((name) => probe(name, requestId)),
  );

  return Object.fromEntries(results) as UpstreamHealth;
}
