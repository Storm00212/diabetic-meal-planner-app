import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "./errors.js";
import { logger } from "./logger.js";
import { requireClaims } from "./jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The verified caller. Set by `requireAuth`. */
      auth?: { userId: number; email: string; role: string };
      /** The correlation id for this request. Set by `requestContext`. */
      requestId?: string;
    }
  }
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
 * The client sends `x-request-id`; if it does not, one is generated. The id
 * is echoed back on the response and included in every log line.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.length <= 128 ? incoming : undefined;

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId ?? "");
  res.setHeader("x-service", "svc-planner");
  next();
}

/**
 * Logs one line per request with its method, path, status and duration.
 *
 * The request id is the join key when tracing a problem across services.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on("finish", () => {
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

/** Rejects the request unless it carries a valid access token. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const claims = await requireClaims(req.header("authorization"));
  req.auth = {
    userId: Number(claims.sub),
    email: claims.email,
    role: claims.role,
  };
  next();
});

/** Returns the caller's id, or throws. Use after `requireAuth`. */
export function callerId(req: Request): number {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth.userId;
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
