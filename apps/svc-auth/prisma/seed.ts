import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "../generated/prisma/index.js";
import { PERSONAS } from "@glucoplate/data";

const prisma = new PrismaClient();

/**
 * A persona as it sits in `personas.json`.
 *
 * The activity fields the portion calculator reads are optional, so a fixture
 * that does not name them still seeds.
 */
type PersonaFixture = (typeof PERSONAS)[number] & {
  sex?: string;
  activityLevel?: string;
};

/** Same format as `hashPassword` in src/modules/auth/auth.service.ts. */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Seeds the demo accounts.
 *
 * Idempotent: an account that already exists is updated, not duplicated.
 */
async function main() {
  console.log("Seeding svc-auth …");

  for (const persona of PERSONAS as PersonaFixture[]) {
    const data = {
      name: persona.name,
      passwordHash: hashPassword(persona.password),
      role: persona.role,
      setting: persona.setting,
      diabetesLevel: persona.diabetesLevel,
      region: persona.region,
      dailyCarbTarget: persona.dailyCarbTarget,
      dailyGiLimit: persona.dailyGiLimit,
      dailyCalorieLimit: persona.dailyCalorieLimit,
      dailyBudget: persona.dailyBudget,
      budgetAmount: persona.budgetAmount,
      budgetPeriod: persona.budgetPeriod,
      budgetCurrency: persona.budgetCurrency,
      isPremium: persona.isPremium,
      needsClinicianReview: persona.needsClinicianReview,
      allergies: persona.allergies,
      dislikes: persona.dislikes,
      age: persona.age,
      heightCm: persona.heightCm,
      currentWeight: persona.currentWeight,
      targetWeight: persona.targetWeight,
      sex: persona.sex ?? "unspecified",
      activityLevel: persona.activityLevel ?? "light",
      updatedAt: new Date(),
    };

    await prisma.user.upsert({
      where: { email: persona.email.toLowerCase() },
      update: data,
      create: {
        ...data,
        email: persona.email.toLowerCase(),
        premiumSince: persona.isPremium ? new Date() : null,
      },
    });

    console.log(
      `  ✓ ${persona.email.padEnd(28)} ${persona.password.padEnd(12)} (${persona.setting} / ${persona.diabetesLevel} / ${data.sex} / ${data.activityLevel})`,
    );
  }

  const total = await prisma.user.count();
  console.log(`Seeded svc-auth: ${total} accounts.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
