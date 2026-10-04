import { db } from "@/db";
import { mealPlans } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) {
    return Response.json({ error: "Invalid id." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(mealPlans)
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, user.id)))
    .returning({ id: mealPlans.id });

  if (!deleted) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
