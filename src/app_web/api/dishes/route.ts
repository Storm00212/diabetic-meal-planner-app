import { db } from "@/db";
import { dishes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { MOCK_DISHES } from "@/lib/mock-data";

const MEAL_TIMES = ["morning", "afternoon", "evening", "any"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(dishes)
      .where(eq(dishes.userId, user.id))
      .orderBy(desc(dishes.createdAt));

    if (rows.length === 0) {
      return Response.json({ dishes: MOCK_DISHES });
    }

    return Response.json({ dishes: rows });
  } catch (e) {
    console.warn("DB error in /api/dishes, returning mock data:", e);
    return Response.json({ dishes: MOCK_DISHES });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "Dish name is required." }, { status: 400 });
    }
    const mealTime = MEAL_TIMES.includes(body.mealTime) ? body.mealTime : "any";

    const [dish] = await db
      .insert(dishes)
      .values({
        userId: user.id,
        name,
        description: String(body.description ?? "").trim(),
        mealTime,
        cost: Number(body.cost) || 0,
        calories: Math.round(Number(body.calories) || 0),
        carbsG: Math.round(Number(body.carbsG) || 0),
        proteinG: Math.round(Number(body.proteinG) || 0),
        glycemicIndex: Math.min(100, Math.max(0, Math.round(Number(body.glycemicIndex) || 50))),
      })
      .returning();

    return Response.json({ dish });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
