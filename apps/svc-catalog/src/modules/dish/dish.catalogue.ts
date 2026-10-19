import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { KENYAN_DISHES } from "@glucoplate/data";

/**
 * The `source` value carried by the shared catalogue rows.
 *
 * The shared Kenyan dishes are owned by nobody (`userId` is null) and are
 * visible to every account. A dish a user adds themselves carries the
 * source `"user"`.
 */
export const CATALOGUE_SOURCE = "catalogue";

/**
 * A catalogue row ready for the database.
 *
 * The name is made required here so the idempotency check can match on it.
 */
export type CatalogueRow = Prisma.DishCreateManyInput & { name: string };

/** The 42 shared Kenyan dishes, ready to be written to the database. */
export const CATALOGUE_ROWS: CatalogueRow[] = KENYAN_DISHES.map(
  (dish) => ({
    userId: null,
    name: dish.name,
    description: dish.description,
    mealTime: dish.mealTime,
    cost: dish.cost,
    isPantryItem: dish.isPantryItem,
    calories: dish.calories,
    carbsG: dish.carbsG,
    proteinG: dish.proteinG,
    fatG: dish.fatG,
    fiberG: dish.fiberG,
    glycemicIndex: dish.glycemicIndex,
    region: dish.region,
    isKenyan: true,
    source: CATALOGUE_SOURCE,
  }),
);

/**
 * Writes the shared catalogue, skipping the dishes that are already there.
 *
 * Idempotent: a dish is matched on its name and the catalogue source, so
 * running the seed twice never duplicates a row and never touches a dish a
 * user added themselves.
 */
export async function seedCatalogue(
  client: PrismaClient,
): Promise<{ inserted: number; skipped: number }> {
  const existing = await client.dish.findMany({
    where: { source: CATALOGUE_SOURCE },
    select: { name: true },
  });

  const names = new Set(existing.map((dish) => dish.name));
  const missing = CATALOGUE_ROWS.filter((dish) => !names.has(dish.name));

  if (missing.length === 0) {
    return { inserted: 0, skipped: CATALOGUE_ROWS.length };
  }

  await client.dish.createMany({ data: missing });

  return { inserted: missing.length, skipped: CATALOGUE_ROWS.length - missing.length };
}
