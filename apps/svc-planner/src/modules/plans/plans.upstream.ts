import type {
  ActivityLevel,
  BudgetPeriod,
  Dish,
  MealTime,
  PublicUser,
  Sex,
  UserRole,
  UserSetting,
} from "@glucoplate/types";
import { ACTIVITY_LEVELS, MEAL_TIMES, SEXES } from "@glucoplate/types";
import { config } from "../../config.js";
import { ApiError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

/**
 * Service-to-service calls, with a short in-memory cache.
 *
 * The planner service owns neither the dish catalogue nor the user profile,
 * so it has to ask svc-catalog and svc-auth for them. Two extra network hops
 * on every request would be wasteful, and a sleeping downstream service must
 * not make the caller wait — so both answers are cached for a minute.
 *
 * The caller's `Authorization` header is forwarded, because every service
 * verifies the same JWT: the downstream service knows exactly who is asking.
 */

/** How long a downstream answer is reused before it is fetched again. */
const CACHE_TTL_MS = 60_000;

/** How long the planner waits for a downstream service before giving up. */
/**
 * How long to wait for another service.
 *
 * The hosted database scales to zero, so the first query after a pause has to
 * wake the compute. The timeout has to allow for that, otherwise a service
 * that is perfectly healthy is treated as unreachable.
 */
const UPSTREAM_TIMEOUT_MS = 20000;

type CacheEntry<T> = {
  value: T;
  storedAt: number;
  expiresAt: number;
};

/** The catalogue is global; a user is cached under their own id. */
const CACHE_KEY_CATALOGUE = "catalogue";
const CACHE_KEY_USER = (userId: number) => `user:${userId}`;

const cache = new Map<string, CacheEntry<unknown>>();

function read<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined;
}

function write<T>(key: string, value: T): void {
  const now = Date.now();
  cache.set(key, { value, storedAt: now, expiresAt: now + CACHE_TTL_MS });
}

/**
 * Returns the cached value when it is still fresh, otherwise fetches it.
 *
 * If the fetch fails the last known value is served instead, so a brief
 * outage downstream does not empty the planner. When there is nothing cached
 * at all the caller gets a 503 with a message that says what went wrong.
 */
async function cached<T>(
  key: string,
  label: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const entry = read<T>(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;

  try {
    const value = await fetcher();
    write(key, value);
    return value;
  } catch (error) {
    if (entry) {
      logger.warn(`${label} is unreachable, serving the cached copy`, {
        error: error instanceof Error ? error.message : String(error),
        cachedAt: new Date(entry.storedAt).toISOString(),
      });
      return entry.value;
    }

    logger.error(`${label} is unreachable and nothing is cached`, {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ApiError(
      503,
      "upstream_unavailable",
      `The ${label} service is not reachable right now. Please try again in a moment.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Reads a value that has to be one of a fixed set of words.
 *
 * Another service owns these fields, so an unknown word falls back to the
 * safe default rather than reaching the planner as a surprise.
 */
function toEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const text = String(value ?? "").trim().toLowerCase();
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

/** Normalises a timestamp into an ISO string. */
function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

/** Fetches JSON from another service, forwarding the caller's token. */
async function fetchJson(
  url: string,
  authorization: string | undefined,
  label: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${label} responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} did not answer within ${UPSTREAM_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Converts a catalogue dish into the shared `Dish` contract.
 *
 * The catalogue is another service, so nothing about its payload is assumed
 * beyond the field names: a missing number becomes zero and a `Date` becomes
 * an ISO string.
 */
export function toContractDish(raw: unknown): Dish {
  const source = isRecord(raw) ? raw : {};

  const mealTime = String(source.mealTime ?? "any") as MealTime;

  return {
    id: toNumber(source.id),
    userId: source.userId === null || source.userId === undefined ? null : toNumber(source.userId),
    name: String(source.name ?? ""),
    description: String(source.description ?? ""),
    mealTime: MEAL_TIMES.includes(mealTime) ? mealTime : "any",
    cost: toNumber(source.cost),
    isPantryItem: Boolean(source.isPantryItem),
    calories: Math.round(toNumber(source.calories)),
    carbsG: Math.round(toNumber(source.carbsG)),
    proteinG: Math.round(toNumber(source.proteinG)),
    fatG: Math.round(toNumber(source.fatG)),
    fiberG: Math.round(toNumber(source.fiberG)),
    glycemicIndex: Math.round(toNumber(source.glycemicIndex)),
    /** What one serving is, e.g. "1 chapati (60 g)". */
    servingLabel: String(source.servingLabel ?? ""),
    region: String(source.region ?? "Kenya"),
    isKenyan: source.isKenyan === undefined ? true : Boolean(source.isKenyan),
    source: String(source.source ?? "catalogue"),
    createdAt: toIsoString(source.createdAt),
  };
}

/** Converts the auth service's answer into the shared `PublicUser` contract. */
export function toContractUser(raw: unknown, fallbackId: number): PublicUser {
  const body = isRecord(raw) ? raw : {};
  const source = isRecord(body.user) ? body.user : body;

  const dailyCarbLimit = toNumber(source.dailyCarbLimit, Number.NaN);
  if (!Number.isFinite(dailyCarbLimit)) {
    throw new Error("svc-auth returned a user without a carbohydrate limit");
  }

  return {
    id: toNumber(source.id, fallbackId),
    name: String(source.name ?? ""),
    email: String(source.email ?? ""),
    role: String(source.role ?? "user") as UserRole,
    setting: String(source.setting ?? "working_class") as UserSetting,
    diabetesLevel: String(source.diabetesLevel ?? "healthy") as PublicUser["diabetesLevel"],
    diabetesType: String(source.diabetesType ?? ""),
    region: String(source.region ?? ""),
    dailyCarbLimit,
    dailyGiLimit: toNumber(source.dailyGiLimit),
    dailyCalorieLimit: toNumber(source.dailyCalorieLimit),
    dailyBudget: toNumber(source.dailyBudget),
    budgetAmount: toNumber(source.budgetAmount),
    budgetPeriod: String(source.budgetPeriod ?? "daily") as BudgetPeriod,
    budgetCurrency: String(source.budgetCurrency ?? "KES"),
    paydayDate: source.paydayDate ? toIsoString(source.paydayDate) : null,
    isPremium: Boolean(source.isPremium),
    premiumPlan: String(source.premiumPlan ?? "premium"),
    premiumSince: source.premiumSince ? toIsoString(source.premiumSince) : null,
    needsClinicianReview: Boolean(source.needsClinicianReview),
    allergies: String(source.allergies ?? ""),
    dislikes: String(source.dislikes ?? ""),
    age: source.age === null || source.age === undefined ? null : toNumber(source.age),
    heightCm:
      source.heightCm === null || source.heightCm === undefined
        ? null
        : toNumber(source.heightCm),
    currentWeight:
      source.currentWeight === null || source.currentWeight === undefined
        ? null
        : toNumber(source.currentWeight),
    targetWeight:
      source.targetWeight === null || source.targetWeight === undefined
        ? null
        : toNumber(source.targetWeight),
    /** Used by the portion calculator. */
    sex: toEnum(source.sex, SEXES, "unspecified") as Sex,
    /** Used by the portion calculator. */
    activityLevel: toEnum(
      source.activityLevel,
      ACTIVITY_LEVELS,
      "sedentary",
    ) as ActivityLevel,
    createdAt: toIsoString(source.createdAt),
  };
}

/** The dish catalogue, straight from svc-catalog. Cached for a minute. */
export async function fetchCatalogue(
  authorization?: string,
): Promise<Dish[]> {
  return cached(CACHE_KEY_CATALOGUE, "catalogue", async () => {
    const payload = await fetchJson(
      `${config.svcCatalogUrl}/api/dishes`,
      authorization,
      "svc-catalog",
    );

    const list = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.dishes)
        ? payload.dishes
        : [];

    return list.map(toContractDish);
  });
}

/** The signed-in user's clinical limits, from svc-auth. Cached for a minute. */
export async function fetchUser(
  userId: number,
  authorization?: string,
): Promise<PublicUser> {
  return cached(CACHE_KEY_USER(userId), "auth", async () => {
    const payload = await fetchJson(
      `${config.svcAuthUrl}/api/auth/me`,
      authorization,
      "svc-auth",
    );

    return toContractUser(payload, userId);
  });
}
