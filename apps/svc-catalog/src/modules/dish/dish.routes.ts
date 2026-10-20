import { Router } from "express";
import { ApiError } from "../../lib/errors.js";
import { asyncHandler, callerId, requireAuth } from "../../lib/http.js";
import { dishService } from "./dish.service.js";

/**
 * The dish catalogue.
 *
 * - GET    /api/dishes           the shared catalogue plus the caller's dishes
 * - POST   /api/dishes           add a dish of the caller's own
 * - GET    /api/dishes/stats     totals and averages over the visible dishes
 * - GET    /api/dishes/:id/swap  cheaper, lower-GI alternatives for a dish
 * - PATCH  /api/dishes/:id       update a dish the caller owns
 * - DELETE /api/dishes/:id       delete a dish the caller owns
 */
export const dishRouter = Router();

/** How many alternatives a swap returns when the caller says nothing. */
const DEFAULT_SWAP_LIMIT = 3;

/** The smallest number of alternatives a swap may return. */
const MIN_SWAP_LIMIT = 1;

/** The largest number of alternatives a swap may return. */
const MAX_SWAP_LIMIT = 5;

/** Reads the `:id` path parameter. A bad id is simply not found. */
function dishId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.notFound("Dish not found.");
  }
  return id;
}

/** Reads the `limit` query parameter, clamped to 1–5. */
function swapLimit(raw: unknown): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(value)) return DEFAULT_SWAP_LIMIT;
  return Math.min(MAX_SWAP_LIMIT, Math.max(MIN_SWAP_LIMIT, Math.round(value)));
}

/**
 * Reads the `exclude` query parameter: a comma-separated list of dish names
 * the caller must not be served (their allergies and dislikes).
 */
function excludeNames(raw: unknown): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

dishRouter.get(
  "/api/dishes",
  requireAuth,
  asyncHandler(async (req, res) => {
    const dishes = await dishService.listFor(callerId(req));
    res.json({ dishes });
  }),
);

dishRouter.post(
  "/api/dishes",
  requireAuth,
  asyncHandler(async (req, res) => {
    const dish = await dishService.createFor(callerId(req), req.body ?? {});
    res.status(201).json({ dish });
  }),
);

// Registered before the `/:id` routes so the literal path always wins.
dishRouter.get(
  "/api/dishes/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const stats = await dishService.statsFor(callerId(req));
    res.json(stats);
  }),
);

dishRouter.get(
  "/api/dishes/:id/swap",
  requireAuth,
  asyncHandler(async (req, res) => {
    const swap = await dishService.swapFor(callerId(req), dishId(req.params.id), {
      limit: swapLimit(req.query.limit),
      excludeNames: excludeNames(req.query.exclude),
    });
    res.json(swap);
  }),
);

dishRouter.patch(
  "/api/dishes/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const dish = await dishService.updateFor(
      callerId(req),
      dishId(req.params.id),
      req.body ?? {},
    );
    res.json({ dish });
  }),
);

dishRouter.delete(
  "/api/dishes/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await dishService.deleteFor(callerId(req), dishId(req.params.id));
    res.json({ ok: true });
  }),
);
