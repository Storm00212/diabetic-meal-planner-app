import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "./errors.js";
import { logger } from "./logger.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The correlation id for this request. Set by `requestContext`. */
      requestId?: string;
      /**
       * True once the request has been handed to an upstream service.
       * The proxy writes its own log line, so `requestLogger` stays quiet.
       */
      proxied?: boolean;
    }
  }
}

/**
 * A short, unique-enough identifier for tracing one request.
 *
 * The same shape as `newRequestId()` in `@glucoplate/api-client`, so an id
 * minted by the gateway is indistinguishable from one minted by a client.
 */
export function newRequestId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now().toString(36)}_${random}`;
}

/** Wraps an async handler so a rejected promise reaches the error handler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/**
 * Establishes the correlation id for the request.
 *
 * The client may send `x-request-id`. If it does not, the gateway mints one
 * and forwards it upstream, so the browser, the gateway and every service
 * the request touches all log the same id.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const requestId =
    incoming && incoming.length <= 128 ? incoming : newRequestId();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-service", "gateway");
  next();
}

/**
 * Logs one line per request with its method, path, status and duration.
 *
 * Proxied requests are logged by the proxy instead, because only the proxy
 * knows which upstream answered. The request id is the join key when
 * tracing a problem across services.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (req.proxied) return;

    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      requestId: req.requestId,
      durationMs,
      client: req.header("x-client"),
    });
  });

  next();
}

/**
 * Reads the HTTP status off an error thrown by the body parser.
 *
 * Malformed JSON and oversized payloads arrive as plain `Error`s carrying a
 * `status`; they are the caller's mistake, not a server fault.
 */
function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const value =
    typeof candidate.status === "number" ? candidate.status : candidate.statusCode;
  if (typeof value !== "number") return undefined;
  return value >= 400 && value < 600 ? value : undefined;
}

/** The final error handler. Every failure leaves through here. */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.requestId;

  if (error instanceof ApiError) {
    logger.warn(error.message, {
      requestId,
      status: error.status,
      code: error.code,
    });

    res.status(error.status).json({
      error: error.message,
      code: error.code,
      requestId,
    });
    return;
  }

  const clientStatus = clientErrorStatus(error);
  if (clientStatus) {
    const message = error instanceof Error ? error.message : "Bad request.";

    logger.warn(message, {
      requestId,
      status: clientStatus,
      code: "bad_request",
    });

    res.status(clientStatus).json({
      error: message,
      code: "bad_request",
      requestId,
    });
    return;
  }

  logger.error(
    error instanceof Error ? error.message : "Unknown error",
    {
      requestId,
      stack: error instanceof Error ? error.stack : undefined,
    },
  );

  res.status(500).json({
    error: "Something went wrong.",
    code: "internal_error",
    requestId,
  });
}

/** Anything that reached here did not match a route. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: `No route for ${req.method} ${req.originalUrl}`,
    code: "not_found",
    requestId: req.requestId,
  });
}
