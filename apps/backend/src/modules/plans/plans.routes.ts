import { Router } from "express";
import type {
  GeneratePlanRequest,
  PlanItemStatus,
} from "@glucoplate/types";
import { asyncHandler, callerId, requireAuth } from "../../lib/http.js";
import { ApiError } from "../../lib/errors.js";
import {
  plansService,
  type MealPlanWithReasons,
} from "./plans.service.js";

/**
 * Meal plan endpoints.
 *
 * - POST   /api/plans/generate     preview a plan, without saving it
 * - POST   /api/plans              generate a plan and save it
 * - GET    /api/plans              the caller's saved plans, newest first
 * - PATCH  /api/plans/update-item  mark an item eaten or skipped
 * - DELETE /api/plans/:id          delete one of the caller's plans
 */
export const plansRouter = Router();

plansRouter.post(
  "/api/plans/generate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as GeneratePlanRequest;

    const preview = await plansService.preview(
      callerId(req),
      req.header("authorization"),
      body,
    );

    res.json(preview);
  }),
);

plansRouter.post(
  "/api/plans",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as GeneratePlanRequest & { planDate?: string };

    const { plan, result, notice, banner } = await plansService.save(
      callerId(req),
      req.header("authorization"),
      body,
    );

    res.status(201).json({ plan, result, notice, banner });
  }),
);

plansRouter.get(
  "/api/plans",
  requireAuth,
  asyncHandler(async (req, res) => {
    const plans: MealPlanWithReasons[] = await plansService.list(callerId(req));

    res.json({ plans });
  }),
);

plansRouter.delete(
  "/api/plans/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const planId = Number(req.params.id);
    if (!Number.isFinite(planId) || planId <= 0) {
      throw ApiError.badRequest("A plan id is required.");
    }

    await plansService.remove(callerId(req), planId);

    res.json({ ok: true });
  }),
);

plansRouter.patch(
  "/api/plans/update-item",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as { itemId: number; status: PlanItemStatus };

    const result = await plansService.updateItem(callerId(req), body);

    res.json(result);
  }),
);
