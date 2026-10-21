import type { Prisma, PrismaClient } from "../../../generated/prisma/index.js";
import { KENYAN_DISHES, type SeedDish } from "@glucoplate/data";

/**
 * The `source` value carried by the shared catalogue rows.
 *
 * The shared Kenyan dishes are owned by nobody (`userId` is null) and are
 * visible to every account. A dish a user adds themselves carries the
 * source `"user"`.
 */
export const CATALOGUE_SOURCE = "catalogue";

/** What one serving is called when the shared data does not say. */
export const DEFAULT_SERVING_LABEL = "1 serving";

/**
 * A catalogue row ready for the database.
 *
 * The name is made required here so the idempotency check can match on it.
 */
export type CatalogueRow = Prisma.DishCreateManyInput & { name: string };

/**
 * The serving label of a shared dish.
 *
 * The label is read defensively: the shared data package does not carry one
 * for every dish, and a missing label falls back to a plain default so the
 * published dish always says what one serving is.
 */
function servingLabelOf(dish: SeedDish): string {
  const label = (dish as SeedDish & { servingLabel?: string }).servingLabel;
  const trimmed = typeof label === "string" ? label.trim() : "";
  return trimmed || DEFAULT_SERVING_LABEL;
}

/** The shared Kenyan dishes, ready to be written to the database. */
export const CATALOGUE_ROWS: CatalogueRow[] = KENYAN_DISHES.map((dish) => ({
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
  servingLabel: servingLabelOf(dish),
  region: dish.region,
  isKenyan: true,
  source: CATALOGUE_SOURCE,
}));

/** What one seed run did to the shared catalogue. */
export type CatalogueSeedResult = {
  inserted: number;
  updated: number;
  skipped: number;
};

/**
 * Writes the shared catalogue, skipping the dishes that are already there.
 *
 * Idempotent: a dish is matched on its name and the catalogue source, so
 * running the seed twice never duplicates a row and never touches a dish a
 * user added themselves. A dish that is already there but carries an old
 * serving label has that label refreshed, so the seed can also repair a
 * catalogue that was written before the label existed.
 */
export async function seedCatalogue(
  client: PrismaClient,
): Promise<CatalogueSeedResult> {
  const existing = await client.dish.findMany({
    where: { source: CATALOGUE_SOURCE },
    select: { name: true, servingLabel: true, region: true },
  });

  const labels = new Map(
    existing.map((dish) => [dish.name, dish.servingLabel] as const),
  );
  const regions = new Map(
    existing.map((dish) => [dish.name, dish.region] as const),
  );
  const missing = CATALOGUE_ROWS.filter((dish) => !labels.has(dish.name));

  if (missing.length > 0) {
    await client.dish.createMany({ data: missing });
  }

  // A dish that is already in the database but carries a stale serving label
  // or a stale region is repaired, so the seed can also fix a catalogue that
  // was written before those fields existed or changed.
  const stale = CATALOGUE_ROWS.filter(
    (dish) =>
      labels.has(dish.name) &&
      (labels.get(dish.name) !== dish.servingLabel ||
        regions.get(dish.name) !== dish.region),
  );

  for (const dish of stale) {
    await client.dish.updateMany({
      where: { name: dish.name, source: CATALOGUE_SOURCE, userId: null },
      data: { servingLabel: dish.servingLabel, region: dish.region },
    });
  }

  return {
    inserted: missing.length,
    updated: stale.length,
    skipped: CATALOGUE_ROWS.length - missing.length,
  };
}
