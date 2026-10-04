import { db } from "@/db";
import { dishes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const MEAL_TIMES = ["morning", "afternoon", "evening", "any"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dishId = Number(id);
  if (!Number.isInteger(dishId)) {
    return Response.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "Dish name is required." }, { status: 400 });
    }
    const mealTime = MEAL_TIMES.includes(body.mealTime) ? body.mealTime : "any";

    const [dish] = await db
      .update(dishes)
      .set({
        name,
        description: String(body.description ?? "").trim(),
        mealTime,
        cost: Number(body.cost) || 0,
        calories: Math.round(Number(body.calories) || 0),
        carbsG: Math.round(Number(body.carbsG) || 0),
        proteinG: Math.round(Number(body.proteinG) || 0),
        glycemicIndex: Math.min(100, Math.max(0, Math.round(Number(body.glycemicIndex) || 50))),
      })
      .where(and(eq(dishes.id, dishId), eq(dishes.userId, user.id)))
      .returning();

    if (!dish) return Response.json({ error: "Not found." }, { status: 404 });
    return Response.json({ dish });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dishId = Number(id);
  if (!Number.isInteger(dishId)) {
    return Response.json({ error: "Invalid id." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.userId, user.id)))
    .returning({ id: dishes.id });

  if (!deleted) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
