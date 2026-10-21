import { Router } from "express";
import { requireAuth } from "../../lib/http.js";
import { lookupNutrients } from "./nutrients.service.js";

/**
 * Nutrient lookup endpoints.
 *
 * - GET /api/nutrients?query=ugali  the nutrients of a food
 */
export const nutrientsRouter = Router();

nutrientsRouter.get("/api/nutrients", requireAuth, (req, res) => {
  const query = String(req.query.query ?? "");
  res.json(lookupNutrients(query));
});
