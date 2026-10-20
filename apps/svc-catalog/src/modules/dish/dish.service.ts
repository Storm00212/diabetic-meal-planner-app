import type { Prisma } from "../../../generated/prisma/index.js";
import { swapCandidates } from "@glucoplate/domain";
import type {
  Dish,
  DishInput,
  MealTime,
  SwapCandidate,
} from "@glucoplate/types";
import { MEAL_TIMES } from "@glucoplate/types";
import { ApiError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import {
  DEFAULT_SERVING_LABEL,
  seedCatalogue,
} from "./dish.catalogue.js";
import { dishRepository, type DishRow } from "./dish.repository.js";

/** The glycemic index is a 0–100 scale, so it is clamped on every write. */
const MIN_GI = 0;
const MAX_GI = 100;
const DEFAULT_GI = 50;

/** The `source` carried by a dish a user added themselves. */
const USER_SOURCE = "user";

/**
 * The dish body this service accepts.
 *
 * `servingLabel` is optional and is not part of the shared `DishInput`
 * contract, so it is read from the request body defensively.
 */
export type DishBody = DishInput & { servingLabel?: string };

/** The alternatives for one dish, plus the dish they replace. */
export type SwapResult = {
  dish: { id: number; name: string };
  alternatives: SwapCandidate[];
};

/** Turns a database row into the `Dish` shape the API publishes. */
export function toDish(row: DishRow): Dish {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    mealTime: row.mealTime as MealTime,
    cost: row.cost,
    isPantryItem: row.isPantryItem,
    calories: row.calories,
    carbsG: row.carbsG,
    proteinG: row.proteinG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    glycemicIndex: row.glycemicIndex,
    servingLabel: row.servingLabel,
    region: row.region,
    isKenyan: row.isKenyan,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Clamps a glycemic index into 0–100. */
function clampGi(value: unknown, fallback: number): number {
  const gi = Math.round(Number(value));
  if (!Number.isFinite(gi)) return fallback;
  return Math.min(MAX_GI, Math.max(MIN_GI, gi));
}

/** Reads a non-negative number, falling back when the value is unusable. */
function nonNegativeNumber(value: unknown, fallback: number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, amount);
}

/** Reads a non-negative whole number, falling back when unusable. */
function nonNegativeInt(value: unknown, fallback: number): number {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, amount);
}

/** Accepts only one of the known meal times. */
function mealTimeOr(value: unknown, fallback: MealTime): MealTime {
  const candidate = String(value ?? "");
  const known = MEAL_TIMES as readonly string[];
  return known.includes(candidate) ? (candidate as MealTime) : fallback;
}

/** What one serving is called. An empty label falls back to the default. */
function servingLabelOr(value: unknown): string {
  const label = String(value ?? "").trim();
  return label || DEFAULT_SERVING_LABEL;
}

/** Rounds to a fixed number of decimal places. */
function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Makes sure the shared catalogue exists.
 *
 * A fresh database has no catalogue rows, so the very first read seeds it
 * from `@glucoplate/data`. That keeps the service self-healing: it works
 * even when the seed script was never run. A failure here is logged but
 * never breaks the request.
 */
async function ensureCatalogue(): Promise<void> {
  try {
    const count = await dishRepository.countCatalogue();
    if (count > 0) return;

    const { inserted } = await seedCatalogue(prisma);
    if (inserted > 0) {
      logger.info("Seeded the shared catalogue", { inserted });
    }
  } catch (error) {
    logger.error("Catalogue seeding failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const dishService = {
  /** The shared catalogue plus the caller's own dishes. */
  async listFor(userId: number): Promise<Dish[]> {
    await ensureCatalogue();

    const rows = await dishRepository.findVisibleTo(userId);
    return rows.map(toDish);
  },

  /** Creates a dish owned by the caller. */
  async createFor(userId: number, input: DishBody): Promise<Dish> {
    const name = String(input.name ?? "").trim();
    if (!name) {
      throw ApiError.badRequest("A dish name is required.");
    }

    const row = await dishRepository.create({
      userId,
      name,
      description:
        input.description === undefined ? "" : String(input.description),
      mealTime: mealTimeOr(input.mealTime, "any"),
      cost: nonNegativeNumber(input.cost, 0),
      isPantryItem: Boolean(input.isPantryItem),
      calories: nonNegativeInt(input.calories, 0),
      carbsG: nonNegativeInt(input.carbsG, 0),
      proteinG: nonNegativeInt(input.proteinG, 0),
      fatG: nonNegativeInt(input.fatG, 0),
      fiberG: nonNegativeInt(input.fiberG, 0),
      glycemicIndex: clampGi(input.glycemicIndex, DEFAULT_GI),
      servingLabel: servingLabelOr(input.servingLabel),
      region: input.region === undefined ? undefined : String(input.region),
      isKenyan: false,
      source: USER_SOURCE,
    });

    return toDish(row);
  },

  /**
   * Updates one of the caller's own dishes.
   *
   * A catalogue dish is not the caller's to change, so it is a 404 — the
   * same answer as a dish that does not exist.
   */
  async updateFor(userId: number, id: number, input: DishBody): Promise<Dish> {
    const data: Prisma.DishUpdateManyMutationInput = {};

    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (!name) {
        throw ApiError.badRequest("A dish name is required.");
      }
      data.name = name;
    }
    if (input.description !== undefined) {
      data.description = String(input.description);
    }
    if (input.mealTime !== undefined) {
      data.mealTime = mealTimeOr(input.mealTime, "any");
    }
    if (input.cost !== undefined) {
      data.cost = nonNegativeNumber(input.cost, 0);
    }
    if (input.isPantryItem !== undefined) {
      data.isPantryItem = Boolean(input.isPantryItem);
    }
    if (input.calories !== undefined) {
      data.calories = nonNegativeInt(input.calories, 0);
    }
    if (input.carbsG !== undefined) {
      data.carbsG = nonNegativeInt(input.carbsG, 0);
    }
    if (input.proteinG !== undefined) {
      data.proteinG = nonNegativeInt(input.proteinG, 0);
    }
    if (input.fatG !== undefined) {
      data.fatG = nonNegativeInt(input.fatG, 0);
    }
    if (input.fiberG !== undefined) {
      data.fiberG = nonNegativeInt(input.fiberG, 0);
    }
    if (input.glycemicIndex !== undefined) {
      data.glycemicIndex = clampGi(input.glycemicIndex, DEFAULT_GI);
    }
    if (input.servingLabel !== undefined) {
      data.servingLabel = servingLabelOr(input.servingLabel);
    }
    if (input.region !== undefined) {
      data.region = String(input.region);
    }

    const updated = await dishRepository.updateOwned(id, userId, data);
    if (updated === 0) {
      throw ApiError.notFound("Dish not found.");
    }

    const row = await dishRepository.findById(id);
    if (!row) {
      throw ApiError.notFound("Dish not found.");
    }

    return toDish(row);
  },

  /** Deletes one of the caller's own dishes. */
  async deleteFor(userId: number, id: number): Promise<void> {
    const deleted = await dishRepository.deleteOwned(id, userId);
    if (deleted === 0) {
      throw ApiError.notFound("Dish not found.");
    }
  },

  /** Totals and averages over the shared catalogue plus the caller's dishes. */
  async statsFor(userId: number): Promise<{
    total: number;
    avgCost: number;
    avgGi: number;
  }> {
    const stats = await dishRepository.stats(userId);

    return {
      total: stats.total,
      avgCost: round(stats.avgCost, 2),
      avgGi: round(stats.avgGi, 1),
    };
  },

  /**
   * Cheaper, lower-glycemic-index alternatives for one dish.
   *
   * The catalogue is the shared Kenyan catalogue plus the caller's own
   * dishes — the same set `GET /api/dishes` returns. The swap rules live in
   * `@glucoplate/domain`, so this service never re-implements them: it only
   * supplies the dish, the catalogue and the caller's exclusions.
   *
   * A dish the caller cannot see is a 404, exactly like a dish that does
   * not exist.
   */
  async swapFor(
    userId: number,
    id: number,
    options: { limit: number; excludeNames: string[] },
  ): Promise<SwapResult> {
    await ensureCatalogue();

    const catalogue = (await dishRepository.findVisibleTo(userId)).map(toDish);

    const dish = catalogue.find((entry) => entry.id === id);
    if (!dish) {
      throw ApiError.notFound("Dish not found.");
    }

    const alternatives = swapCandidates(dish, catalogue, {
      limit: options.limit,
      excludeNames: options.excludeNames,
    });

    return {
      dish: { id: dish.id, name: dish.name },
      alternatives,
    };
  },
};
