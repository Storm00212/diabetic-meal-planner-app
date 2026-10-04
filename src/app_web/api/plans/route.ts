import { db } from "@/db";
import { dishes, mealPlans, mealPlanItems } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generatePlan, SLOTS, type Slot } from "@/lib/planner";
import { MOCK_PLANS } from "@/lib/mock-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plans = await db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.userId, user.id))
      .orderBy(desc(mealPlans.createdAt));

    if (plans.length === 0) {
      return Response.json({ plans: MOCK_PLANS });
    }

    const planIds = plans.map((p) => p.id);
    const items = await db
      .select({
        id: mealPlanItems.id,
        planId: mealPlanItems.planId,
        slot: mealPlanItems.slot,
        dishId: mealPlanItems.dishId,
        dishName: dishes.name,
        cost: dishes.cost,
        carbsG: dishes.carbsG,
        calories: dishes.calories,
        glycemicIndex: dishes.glycemicIndex,
      })
      .from(mealPlanItems)
      .innerJoin(dishes, eq(mealPlanItems.dishId, dishes.id))
      .where(inArray(mealPlanItems.planId, planIds));

    const withItems = plans.map((p) => ({
      ...p,
      items: items.filter((i) => i.planId === p.id),
    }));

    return Response.json({ plans: withItems });
  } catch (e) {
    console.warn("DB error in /api/plans, returning mock data:", e);
    return Response.json({ plans: MOCK_PLANS });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const budget = Number(body.budget) > 0 ? Number(body.budget) : user.dailyBudget;
  const carbTarget =
    Number(body.carbTarget) > 0 ? Number(body.carbTarget) : user.dailyCarbTarget;
  const planDate =
    typeof body.planDate === "string" && body.planDate
      ? body.planDate
      : new Date().toISOString().slice(0, 10);

  try {
    const rows = await db.select().from(dishes).where(eq(dishes.userId, user.id));
    if (rows.length === 0) {
      return Response.json(
        { error: "Your bucket is empty. Add some dishes first." },
        { status: 400 },
      );
    }

    const result = generatePlan(rows, budget, carbTarget);

    const [plan] = await db
      .insert(mealPlans)
      .values({
        userId: user.id,
        planDate,
        budget,
        totalCost: result.totalCost,
        totalCarbs: result.totalCarbs,
        totalCalories: result.totalCalories,
      })
      .returning();

    const itemsToInsert = SLOTS.map((slot: Slot) => {
      const dish = result.slots[slot];
      return dish
        ? { planId: plan.id, dishId: dish.id, slot: slot as string }
        : null;
    }).filter(
      (v): v is { planId: number; dishId: number; slot: string } => v !== null,
    );

    if (itemsToInsert.length > 0) {
      await db.insert(mealPlanItems).values(itemsToInsert);
    }

    return Response.json({ plan, result });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Database error occurred" }, { status: 500 });
  }
}
