import { db } from "@/db";
import { dishes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generatePlan } from "@/lib/planner";
import { money } from "@/lib/format";

// Generate a plan preview WITHOUT saving it
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  // Handle Period-Based Budgeting
  let targetBudget = Number(body.budget) > 0 ? Number(body.budget) : user.dailyBudget;

  if (!body.budget && user.budgetPeriod !== "daily") {
    // If no specific budget was passed, we calculate the daily allowance based on period
    const now = new Date();
    let daysInPeriod = 1;

    if (user.budgetPeriod === "weekly") {
      daysInPeriod = 7;
    } else if (user.budgetPeriod === "until_payday") {
      if (user.paydayDate) {
        const payday = new Date(user.paydayDate);
        const diffTime = payday.getTime() - now.getTime();
        daysInPeriod = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
    }
    targetBudget = user.dailyBudget / daysInPeriod;
  }

  const carbTarget =
    Number(body.carbTarget) > 0 ? Number(body.carbTarget) : user.dailyCarbTarget;

  const rows = await db.select().from(dishes).where(eq(dishes.userId, user.id));

  if (rows.length === 0) {
    return Response.json(
      { error: "Your bucket is empty. Add some dishes first." },
      { status: 400 },
    );
  }

  const result = generatePlan(rows, targetBudget, carbTarget);
  return Response.json({ plan: result, budget: targetBudget, carbTarget });
}
