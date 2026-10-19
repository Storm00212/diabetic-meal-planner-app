import { Router } from "express";
import { ApiError } from "../../lib/errors.js";
import { asyncHandler, callerId, requireAuth } from "../../lib/http.js";
import { dishService } from "./dish.service.js";

/**
 * The dish catalogue.
 *
 * - GET    /api/dishes        the shared catalogue plus the caller's dishes
 * - POST   /api/dishes        add a dish of the caller's own
 * - GET    /api/dishes/stats  totals and averages over the visible dishes
 * - PATCH  /api/dishes/:id    update a dish the caller owns
 * - DELETE /api/dishes/:id    delete a dish the caller owns
 */
export const dishRouter = Router();

/** Reads the `:id` path parameter. A bad id is simply not found. */
function dishId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.notFound("Dish not found.");
  }
  return id;
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
