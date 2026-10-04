import { db } from "@/db";
import { mealPlanItems, mealPlans, dishes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { itemId, status } = body;

    if (!itemId || !status) {
      return Response.json({ error: "Missing itemId or status" }, { status: 400 });
    }

    const validStatuses = ["planned", "eaten", "skipped"];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    // 1. Update the item status and get the associated planId
    const [updatedItem] = await db
      .update(mealPlanItems)
      .set({ status })
      .where(eq(mealPlanItems.id, itemId))
      .returning();

    if (!updatedItem) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // 2. Dynamic Budget Re-balancing:
    // Recalculate totalCost for the plan by summing costs of all items that are NOT skipped.
    // Pantry items are handled by the dish.cost being 0 or handled during initial generation.
    // We use a subquery to sum the costs of dishes associated with the plan's non-skipped items.
    await db
      .update(mealPlans)
      .set({
        totalCost: sql`(
          SELECT COALESCE(SUM(d.cost), 0)
          FROM meal_plan_items mpi
          JOIN dishes d ON mpi.dish_id = d.id
          WHERE mpi.plan_id = ${updatedItem.planId} AND mpi.status != 'skipped'
        )`,
      })
      .where(eq(mealPlans.id, updatedItem.planId));

    return Response.json({ success: true, item: updatedItem });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
