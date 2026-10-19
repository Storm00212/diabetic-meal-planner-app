import type {
  NextFunction,
  Request,
  Response as ExpressResponse,
} from "express";
import { config } from "../config.js";
import { matchRoute, UPSTREAM_URLS } from "../routes.js";
import { logger } from "./logger.js";

/**
 * The headers the gateway copies to the upstream, untouched.
 *
 * `authorization` is forwarded verbatim: the gateway does not authenticate,
 * it only carries the token to the service that owns the resource.
 */
const FORWARDED_HEADERS = [
  "authorization",
  "content-type",
  "x-request-id",
  "x-client",
] as const;

/** The upstream answer, decoded into either JSON or plain text. */
type UpstreamBody =
  | { kind: "json"; value: unknown }
  | { kind: "text"; value: string };

/**
 * True when the request carries something worth forwarding.
 *
 * `express.json()` leaves an empty object behind when there was no body, so
 * an object with no keys means "no payload".
 */
function hasPayload(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  if (typeof body === "object") return Object.keys(body).length > 0;
  return true;
}

/** Copies the headers the upstream cares about, and stamps the request id. */
function buildUpstreamHeaders(
  req: Request,
  requestId: string,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const name of FORWARDED_HEADERS) {
    const value = req.header(name);
    if (value) headers[name] = value;
  }

  // One id for the whole chain: the gateway mints it when the client did
  // not send one, so the upstream logs exactly what the gateway logs.
  headers["x-request-id"] = requestId;

  if (hasBody && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  return headers;
}

/** Re-serialises the parsed body as JSON for the upstream. */
function buildUpstreamBody(req: Request): string | undefined {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (!hasPayload(req.body)) return undefined;
  return JSON.stringify(req.body);
}

/**
 * Decides how to send the upstream body back.
 *
 * JSON stays JSON; anything else is passed through as text with the
 * upstream's own content type.
 */
function decodeBody(text: string, contentType: string): UpstreamBody {
  const looksJson = contentType.includes("json");

  if (looksJson || !contentType) {
    if (!text) return { kind: "text", value: text };
    try {
      return { kind: "json", value: JSON.parse(text) };
    } catch {
      return { kind: "text", value: text };
    }
  }

  return { kind: "text", value: text };
}

/** The log level that matches an HTTP status. */
function levelFor(status: number): "info" | "warn" | "error" {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/**
 * Forwards one request to the upstream that owns its path.
 *
 * The status and the body come straight from the upstream. When the
 * upstream cannot be reached the caller gets a 502 in the standard error
 * shape instead of a hung connection.
 */
export async function proxyRequest(
  req: Request,
  res: ExpressResponse,
  next: NextFunction,
): Promise<void> {
  const rule = matchRoute(req.path);
  if (!rule) {
    next();
    return;
  }

  // From here on the proxy owns the log line: only it knows the upstream.
  req.proxied = true;

  const startedAt = Date.now();
  const requestId = req.requestId ?? "";
  const baseUrl = UPSTREAM_URLS[rule.upstream].replace(/\/+$/, "");
  const target = `${baseUrl}${req.originalUrl}`;

  const body = buildUpstreamBody(req);
  const headers = buildUpstreamHeaders(req, requestId, body !== undefined);

  // Tell the client which upstream answered.
  res.setHeader("x-upstream", rule.upstream);

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(config.upstreamTimeoutMs),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logger.error(`${req.method} ${req.originalUrl} 502`, {
      requestId,
      upstream: rule.upstream,
      status: 502,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(502).json({
      error: `The ${rule.upstream} service is unavailable.`,
      code: "bad_gateway",
      requestId,
    });
    return;
  }

  const status = upstream.status;
  const contentType = upstream.headers.get("content-type") ?? "";
  const text = await upstream.text();
  const durationMs = Date.now() - startedAt;

  const decoded = decodeBody(text, contentType);
  if (decoded.kind === "json") {
    res.status(status).json(decoded.value);
  } else {
    res.setHeader(
      "Content-Type",
      contentType || "text/plain; charset=utf-8",
    );
    res.status(status).send(decoded.value);
  }

  logger[levelFor(status)](`${req.method} ${req.originalUrl} ${status}`, {
    requestId,
    upstream: rule.upstream,
    status,
    durationMs,
  });
}
