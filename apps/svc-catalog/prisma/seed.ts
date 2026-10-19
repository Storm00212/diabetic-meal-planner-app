import { PrismaClient } from "../generated/prisma/index.js";
import {
  CATALOGUE_ROWS,
  CATALOGUE_SOURCE,
  seedCatalogue,
} from "../src/modules/dish/dish.catalogue.js";

const prisma = new PrismaClient();

/**
 * Seeds the shared Kenyan catalogue.
 *
 * Idempotent: a catalogue dish that already exists is skipped, never
 * duplicated. Dishes a user added themselves are never touched.
 */
async function main() {
  console.log("Seeding svc-catalog …");

  const { inserted, skipped } = await seedCatalogue(prisma);

  console.log(
    `  ✓ inserted ${inserted} catalogue dish(es), skipped ${skipped} already present`,
  );

  const catalogue = await prisma.dish.count({
    where: { source: CATALOGUE_SOURCE, userId: null },
  });
  const userDishes = await prisma.dish.count({ where: { userId: { not: null } } });
  const total = await prisma.dish.count();

  console.log(
    `Seeded svc-catalog: ${catalogue} catalogue dishes, ${userDishes} user dishes, ${total} dishes in total.`,
  );

  if (catalogue !== CATALOGUE_ROWS.length) {
    console.warn(
      `  ! expected ${CATALOGUE_ROWS.length} catalogue dishes, found ${catalogue}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
