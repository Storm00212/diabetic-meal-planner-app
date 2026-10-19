import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  DIABETES_LEVELS,
  USER_SETTINGS,
  type PublicUser,
  type RegisterRequest,
} from "@glucoplate/types";
import { levelMeta } from "@glucoplate/domain";
import { ApiError } from "../../lib/errors.js";
import { signAccessToken } from "../../lib/jwt.js";
import { authRepository, type UserRow } from "./auth.repository.js";

/** Hashes a password with scrypt and a random 16-byte salt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

/** Constant-time comparison of a plain password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;

  const derived = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== derived.length) return false;

  return timingSafeEqual(keyBuffer, derived);
}

/** Strips the password hash and normalises the limits for the API. */
export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as PublicUser["role"],
    setting: user.setting as PublicUser["setting"],
    diabetesLevel: user.diabetesLevel as PublicUser["diabetesLevel"],
    diabetesType: user.diabetesType,
    region: user.region,
    dailyCarbLimit: user.dailyCarbTarget,
    dailyGiLimit: user.dailyGiLimit,
    dailyCalorieLimit: user.dailyCalorieLimit,
    dailyBudget: user.dailyBudget,
    budgetAmount: user.budgetAmount,
    budgetPeriod: user.budgetPeriod as PublicUser["budgetPeriod"],
    budgetCurrency: user.budgetCurrency,
    paydayDate: user.paydayDate ? user.paydayDate.toISOString() : null,
    isPremium: user.isPremium,
    premiumPlan: user.premiumPlan,
    premiumSince: user.premiumSince ? user.premiumSince.toISOString() : null,
    needsClinicianReview: user.needsClinicianReview,
    allergies: user.allergies,
    dislikes: user.dislikes,
    age: user.age,
    heightCm: user.heightCm,
    currentWeight: user.currentWeight,
    targetWeight: user.targetWeight,
    createdAt: user.createdAt.toISOString(),
  };
}

export const authService = {
  async register(body: RegisterRequest) {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name || !email || !password) {
      throw ApiError.badRequest("Name, email, and password are required.");
    }
    if (password.length < 8) {
      throw ApiError.badRequest("Password must be at least 8 characters.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw ApiError.badRequest("Please enter a valid email address.");
    }

    const existing = await authRepository.findByEmail(email);
    if (existing) {
      throw ApiError.conflict("An account with that email already exists.");
    }

    const requestedSetting = String(body.setting ?? "");
    const setting = USER_SETTINGS.includes(requestedSetting as never)
      ? requestedSetting
      : "working_class";

    const requestedLevel = String(body.diabetesLevel ?? "");
    const diabetesLevel = DIABETES_LEVELS.includes(requestedLevel as never)
      ? requestedLevel
      : "healthy";

    const meta = levelMeta(diabetesLevel);

    const user = await authRepository.create({
      name,
      email,
      passwordHash: hashPassword(password),
      setting,
      diabetesLevel,
      dailyCarbTarget: meta.carbLimit,
      dailyGiLimit: meta.giLimit,
      dailyCalorieLimit: meta.calorieLimit,
      needsClinicianReview: meta.requiresClinician,
    });

    const token = await signAccessToken(user);

    return { token, user: toPublicUser(user) };
  },

  async login(email: string, password: string) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      throw ApiError.badRequest("Email and password are required.");
    }

    const user = await authRepository.findByEmail(normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    await authRepository.touchLogin(user.id);

    const token = await signAccessToken(user);
    return { token, user: toPublicUser(user) };
  },

  async me(userId: number) {
    const user = await authRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found.");
    return toPublicUser(user);
  },
};
