import { db } from "@/db";
import { mealPlans, mealPlanItems, dishes } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Overall Budget Stats
    const budgetStats = await db
      .select({
        totalBudget: sql<number>`sum(${mealPlans.budget})`,
        totalSpent: sql<number>`sum(${mealPlans.totalCost})`,
        count: sql<number>`count(*)`,
      })
      .from(mealPlans)
      .where(eq(mealPlans.userId, user.id));

    const stats = budgetStats[0];

    // 2. Carb Trends (Last 7 plans)
    const recentPlans = await db
      .select({
        date: mealPlans.planDate,
        carbs: mealPlans.totalCarbs,
      })
      .from(mealPlans)
      .where(eq(mealPlans.userId, user.id))
      .orderBy(sql`${mealPlans.planDate} desc`)
      .limit(7);

    // 3. Nutrition Distribution (of Eaten meals)
    const nutritionDist = await db
      .select({
        gi: dishes.glycemicIndex,
        count: sql<number>`count(*)`,
      })
      .from(mealPlanItems)
      .innerJoin(dishes, eq(mealPlanItems.dishId, dishes.id))
      .where(
        and(
          eq(mealPlanItems.status, "eaten"),
          sql`exists (select 1 from ${mealPlans} where ${mealPlans.id} = ${mealPlanItems.planId} and ${mealPlans.userId} = ${user.id})`
        )
      )
      .groupBy(dishes.glycemicIndex);

    return Response.json({
      summary: {
        totalPlans: stats.count || 0,
        totalSpent: stats.totalSpent || 0,
        totalBudget: stats.totalBudget || 0,
        savings: (stats.totalBudget || 0) - (stats.totalSpent || 0),
      },
      carbTrends: recentPlans.reverse(),
      nutritionDist,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
