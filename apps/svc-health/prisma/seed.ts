import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

/**
 * Seeds the health service.
 *
 * This service owns no reference data: the weight log and the weight targets
 * belong to the people using the app, and the demo accounts live in
 * svc-auth. So the seed only checks that the schema is there and reports
 * what is in it. It is idempotent — running it twice changes nothing.
 */
async function main() {
  console.log("Seeding svc-health …");

  const logs = await prisma.weightLog.count();
  const targets = await prisma.weightTarget.count();

  console.log(`  ✓ ${logs} weight log(s)`);
  console.log(`  ✓ ${targets} weight target row(s)`);
  console.log("Seeded svc-health: nothing to insert, the tables are ready.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
