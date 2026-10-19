import { Router } from "express";
import { asyncHandler } from "../../lib/http.js";
import { proxyRequest } from "../../lib/proxy.js";

/**
 * The catch-all router.
 *
 * It claims every request that the gateway has not already answered and
 * hands it to the upstream that owns the path. When no upstream owns it,
 * `proxyRequest` calls `next()` and the 404 handler takes over.
 */
export const proxyRouter = Router();

proxyRouter.use(asyncHandler(proxyRequest));
