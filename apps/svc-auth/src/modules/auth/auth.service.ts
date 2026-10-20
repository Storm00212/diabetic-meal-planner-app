import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  DIABETES_LEVELS,
  SEXES,
  USER_SETTINGS,
  type ActivityLevel,
  type PortionProfile,
  type PortionTargets,
  type PublicUser,
  type RegisterRequest,
  type Sex,
} from "@glucoplate/types";
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  levelMeta,
  portionTargets,
} from "@glucoplate/domain";
import { ApiError } from "../../lib/errors.js";
import { signAccessToken } from "../../lib/jwt.js";
import {
  authRepository,
  type UserRow,
  type UserUpdate,
} from "./auth.repository.js";

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

/** The stored sex, narrowed to the shared contract. */
export function toSex(value: string): Sex {
  const candidate = String(value ?? "").trim().toLowerCase();
  return (SEXES as readonly string[]).includes(candidate)
    ? (candidate as Sex)
    : "unspecified";
}

/** The stored activity level, narrowed to the shared contract. */
export function toActivityLevel(value: string): ActivityLevel {
  const candidate = String(value ?? "").trim().toLowerCase();
  return (ACTIVITY_LEVELS as readonly string[]).includes(candidate)
    ? (candidate as ActivityLevel)
    : "light";
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
    sex: toSex(user.sex),
    activityLevel: toActivityLevel(user.activityLevel),
    createdAt: user.createdAt.toISOString(),
  };
}

/** The body `PATCH /api/settings` accepts. Every field is optional. */
export type SettingsBody = {
  name?: unknown;
  dailyBudget?: unknown;
  dailyCarbTarget?: unknown;
  dailyGiLimit?: unknown;
  dailyCalorieLimit?: unknown;
  age?: unknown;
  heightCm?: unknown;
  currentWeight?: unknown;
  targetWeight?: unknown;
  sex?: unknown;
  activityLevel?: unknown;
};

/** The portion targets plus the profile they were calculated from. */
export type PortionTargetsResponse = PortionTargets & { profile: PortionProfile };

/**
 * A measurement the client may set, or clear by sending `null`.
 *
 * A height or a weight is never zero, so zero is rejected rather than stored.
 */
function measurement(
  value: unknown,
  field: string,
  whole = false,
): number | null {
  if (value === null) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw ApiError.badRequest(`${field} must be a positive number.`);
  }

  return whole ? Math.round(parsed) : parsed;
}

/** A limit or a budget the client may set. */
function amount(value: unknown, field: string, whole = false): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw ApiError.badRequest(`${field} must be a number of zero or more.`);
  }

  return whole ? Math.round(parsed) : parsed;
}

/** The sex the client asked for. Only the three known values are accepted. */
function parseSex(value: unknown): Sex {
  const candidate = String(value ?? "").trim().toLowerCase();
  if (!(SEXES as readonly string[]).includes(candidate)) {
    throw ApiError.badRequest(`sex must be one of: ${SEXES.join(", ")}.`, {
      allowed: SEXES,
    });
  }
  return candidate as Sex;
}

/** The activity level the client asked for. */
function parseActivityLevel(value: unknown): ActivityLevel {
  const candidate = String(value ?? "").trim().toLowerCase();
  if (!(ACTIVITY_LEVELS as readonly string[]).includes(candidate)) {
    throw ApiError.badRequest(
      `activityLevel must be one of: ${ACTIVITY_LEVELS.join(", ")}.`,
      { allowed: ACTIVITY_LEVELS, labels: ACTIVITY_LABELS },
    );
  }
  return candidate as ActivityLevel;
}

/**
 * Turns the request body into the columns to update.
 *
 * Only the fields the client actually sent are touched; everything else keeps
 * the value it already has.
 */
export function settingsUpdate(body: SettingsBody): UserUpdate {
  const update: UserUpdate = {};

  if (body.name !== undefined) update.name = String(body.name);
  if (body.dailyBudget !== undefined) {
    update.dailyBudget = amount(body.dailyBudget, "dailyBudget");
  }
  if (body.dailyCarbTarget !== undefined) {
    update.dailyCarbTarget = amount(body.dailyCarbTarget, "dailyCarbTarget", true);
  }
  if (body.dailyGiLimit !== undefined) {
    update.dailyGiLimit = amount(body.dailyGiLimit, "dailyGiLimit", true);
  }
  if (body.dailyCalorieLimit !== undefined) {
    update.dailyCalorieLimit = amount(
      body.dailyCalorieLimit,
      "dailyCalorieLimit",
      true,
    );
  }
  if (body.age !== undefined) update.age = measurement(body.age, "age", true);
  if (body.heightCm !== undefined) {
    update.heightCm = measurement(body.heightCm, "heightCm");
  }
  if (body.currentWeight !== undefined) {
    update.currentWeight = measurement(body.currentWeight, "currentWeight");
  }
  if (body.targetWeight !== undefined) {
    update.targetWeight = measurement(body.targetWeight, "targetWeight");
  }
  if (body.sex !== undefined) update.sex = parseSex(body.sex);
  if (body.activityLevel !== undefined) {
    update.activityLevel = parseActivityLevel(body.activityLevel);
  }

  return update;
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

  /**
   * Updates the caller's settings.
   *
   * Only the fields the client sent are changed; the rest keep their value.
   */
  async updateSettings(userId: number, body: SettingsBody) {
    const current = await authRepository.findById(userId);
    if (!current) throw ApiError.notFound("User not found.");

    await authRepository.update(userId, {
      ...settingsUpdate(body),
      updatedAt: new Date(),
    });

    const user = await authRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found.");
    return toPublicUser(user);
  },

  /**
   * The caller's daily nutrition targets.
   *
   * The maths lives in `@glucoplate/domain`, so every service and every client
   * agrees on the numbers. A profile that is too incomplete to personalise
   * falls back to the general defaults rather than failing.
   */
  async portionTargets(userId: number): Promise<PortionTargetsResponse> {
    const user = await authRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found.");

    const profile: PortionProfile = {
      age: user.age,
      sex: toSex(user.sex),
      heightCm: user.heightCm,
      weightKg: user.currentWeight,
      activityLevel: toActivityLevel(user.activityLevel),
    };

    const targets: PortionTargets = portionTargets(profile);

    return { ...targets, profile };
  },
};
