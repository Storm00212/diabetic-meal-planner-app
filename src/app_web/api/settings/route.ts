import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const dailyBudget = Number(body.dailyBudget);
    const dailyCarbTarget = Number(body.dailyCarbTarget);
    const name = body.name !== undefined ? String(body.name).trim() : undefined;

    const updates: Record<string, unknown> = {};
    if (!Number.isNaN(dailyBudget) && dailyBudget >= 0)
      updates.dailyBudget = dailyBudget;
    if (!Number.isNaN(dailyCarbTarget) && dailyCarbTarget >= 0)
      updates.dailyCarbTarget = Math.round(dailyCarbTarget);
    if (name) updates.name = name;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        dailyBudget: users.dailyBudget,
        dailyCarbTarget: users.dailyCarbTarget,
      });

    return Response.json({ user: updated });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
