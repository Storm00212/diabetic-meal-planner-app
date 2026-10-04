import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.id),
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      dailyBudget: user.dailyBudget,
      budgetAmount: user.budgetAmount,
      budgetPeriod: user.budgetPeriod,
      budgetCurrency: user.budgetCurrency,
      paydayDate: user.paydayDate,
    });
  } catch (error) {
    console.error("Budget GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { budgetAmount, budgetPeriod, budgetCurrency, paydayDate } = body;

    await db.update(users)
      .set({
        budgetAmount: budgetAmount !== undefined ? budgetAmount : undefined,
        budgetPeriod: budgetPeriod !== undefined ? budgetPeriod : undefined,
        budgetCurrency: budgetCurrency !== undefined ? budgetCurrency : undefined,
        paydayDate: paydayDate !== undefined ? new Date(paydayDate) : undefined,
      })
      .where(eq(users.id, session.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Budget PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
