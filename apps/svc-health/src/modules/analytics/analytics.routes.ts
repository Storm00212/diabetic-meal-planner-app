import { Router } from "express";
import { asyncHandler, callerId, requireAuth } from "../../lib/http.js";
import { analyticsService } from "./analytics.service.js";

/**
 * Analytics endpoints.
 *
 * - GET /api/analytics  the caller's budget summary, carb trend and nutrition
 *   distribution, computed from the plans saved in svc-planner.
 */
export const analyticsRouter = Router();

analyticsRouter.get(
  "/api/analytics",
  requireAuth,
  asyncHandler(async (req, res) => {
    const analytics = await analyticsService.getAnalytics(
      callerId(req),
      req.header("authorization"),
    );

    res.json(analytics);
  }),
);
