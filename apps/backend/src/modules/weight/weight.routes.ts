import { Router } from "express";
import { asyncHandler, callerId, requireAuth } from "../../lib/http.js";
import { weightService } from "./weight.service.js";

/**
 * Weight tracking endpoints.
 *
 * - GET  /api/weight                every weight log for the caller
 * - POST /api/weight                record a weight
 * - GET  /api/user/weight-targets   the caller's current and target weight
 * - PATCH /api/user/weight-targets  set the current and target weight
 */
export const weightRouter = Router();

weightRouter.get(
  "/api/weight",
  requireAuth,
  asyncHandler(async (req, res) => {
    const logs = await weightService.listLogs(callerId(req));
    res.json({ logs });
  }),
);

weightRouter.post(
  "/api/weight",
  requireAuth,
  asyncHandler(async (req, res) => {
    const log = await weightService.createLog(callerId(req), req.body ?? {});
    res.status(201).json({ log });
  }),
);

weightRouter.get(
  "/api/user/weight-targets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const targets = await weightService.getTargets(callerId(req));
    res.json(targets);
  }),
);

weightRouter.patch(
  "/api/user/weight-targets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const targets = await weightService.updateTargets(
      callerId(req),
      req.body ?? {},
    );
    res.json(targets);
  }),
);
