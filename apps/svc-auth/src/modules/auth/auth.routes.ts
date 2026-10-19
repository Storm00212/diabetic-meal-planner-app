import { Router } from "express";
import { PLANNING_AID_NOTICE, clinicianBannerFor, dailyAllowance } from "@glucoplate/domain";
import { asyncHandler, callerId, requireAuth } from "../../lib/http.js";
import { ApiError } from "../../lib/errors.js";
import { authService } from "./auth.service.js";
import { authRepository } from "./auth.repository.js";

/**
 * Authentication endpoints.
 *
 * - POST /api/auth/register  create an account
 * - POST /api/auth/login     exchange credentials for an access token
 * - GET  /api/auth/me        the signed-in user
 * - POST /api/auth/logout    client-side token discard (tokens are stateless)
 */
export const authRouter = Router();

authRouter.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const { token, user } = await authService.register(req.body ?? {});

    res.status(201).json({
      ok: true,
      token,
      user,
      notice: PLANNING_AID_NOTICE,
      banner: clinicianBannerFor(user),
    });
  }),
);

authRouter.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    const { token, user } = await authService.login(email, password);

    res.json({
      ok: true,
      token,
      user,
      notice: PLANNING_AID_NOTICE,
      banner: clinicianBannerFor(user),
    });
  }),
);

authRouter.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(callerId(req));

    res.json({
      user,
      notice: PLANNING_AID_NOTICE,
      banner: clinicianBannerFor(user),
    });
  }),
);

authRouter.post(
  "/api/auth/logout",
  requireAuth,
  asyncHandler(async (_req, res) => {
    // Access tokens are stateless. The client discards the token; the server
    // simply acknowledges, so the mobile app can clear its SecureStore entry.
    res.json({ ok: true });
  }),
);

/**
 * The signed-in user's own profile, preferences and budget.
 *
 * These live on the auth service because it owns the User aggregate.
 */
export const userRouter = Router();

userRouter.get(
  "/api/user/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(callerId(req));
    res.json({ ...user, notice: PLANNING_AID_NOTICE });
  }),
);

userRouter.patch(
  "/api/user/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = callerId(req);
    const { diabetesType, allergies, dislikes, name } = req.body ?? {};

    const current = await authRepository.findById(id);
    if (!current) throw ApiError.notFound("User not found.");

    await authRepository.update(id, {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(diabetesType !== undefined
        ? { diabetesType: String(diabetesType) }
        : {}),
      ...(allergies !== undefined ? { allergies: String(allergies) } : {}),
      ...(dislikes !== undefined ? { dislikes: String(dislikes) } : {}),
      updatedAt: new Date(),
    });

    const user = await authService.me(id);
    res.json({ ...user, success: true });
  }),
);

userRouter.get(
  "/api/user/budget",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authRepository.findById(callerId(req));
    if (!user) throw ApiError.notFound("User not found.");

    res.json({
      dailyBudget: user.dailyBudget,
      budgetAmount: user.budgetAmount,
      budgetPeriod: user.budgetPeriod,
      budgetCurrency: user.budgetCurrency,
      paydayDate: user.paydayDate ? user.paydayDate.toISOString() : null,
    });
  }),
);

userRouter.patch(
  "/api/user/budget",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = callerId(req);
    const { budgetAmount, budgetPeriod, budgetCurrency, paydayDate } = req.body ?? {};

    const current = await authRepository.findById(id);
    if (!current) throw ApiError.notFound("User not found.");

    const nextAmount =
      budgetAmount !== undefined ? Number(budgetAmount) : current.budgetAmount;
    const nextPeriod =
      budgetPeriod !== undefined ? String(budgetPeriod) : current.budgetPeriod;
    const nextPayday =
      paydayDate !== undefined
        ? paydayDate
          ? new Date(paydayDate)
          : null
        : current.paydayDate;

    const amount = Number.isFinite(nextAmount) ? nextAmount : current.budgetAmount;

    // Keep the planner's daily allowance in step with the period total.
    const dailyBudget = dailyAllowance({
      budgetAmount: amount,
      budgetPeriod: nextPeriod,
      dailyBudget: current.dailyBudget,
      paydayDate: nextPayday,
    });

    await authRepository.update(id, {
      budgetAmount: amount,
      budgetPeriod: nextPeriod,
      ...(budgetCurrency !== undefined
        ? { budgetCurrency: String(budgetCurrency) }
        : {}),
      paydayDate: nextPayday,
      dailyBudget,
      updatedAt: new Date(),
    });

    res.json({ success: true, dailyBudget });
  }),
);

userRouter.get(
  "/api/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(callerId(req));
    res.json(user);
  }),
);

userRouter.patch(
  "/api/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = callerId(req);
    const {
      name,
      dailyBudget,
      dailyCarbTarget,
      dailyGiLimit,
      dailyCalorieLimit,
    } = req.body ?? {};

    const current = await authRepository.findById(id);
    if (!current) throw ApiError.notFound("User not found.");

    await authRepository.update(id, {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(dailyBudget !== undefined
        ? { dailyBudget: Number(dailyBudget) }
        : {}),
      ...(dailyCarbTarget !== undefined
        ? { dailyCarbTarget: Math.round(Number(dailyCarbTarget)) }
        : {}),
      ...(dailyGiLimit !== undefined
        ? { dailyGiLimit: Math.round(Number(dailyGiLimit)) }
        : {}),
      ...(dailyCalorieLimit !== undefined
        ? { dailyCalorieLimit: Math.round(Number(dailyCalorieLimit)) }
        : {}),
      updatedAt: new Date(),
    });

    const user = await authService.me(id);
    res.json({ ...user, success: true });
  }),
);
