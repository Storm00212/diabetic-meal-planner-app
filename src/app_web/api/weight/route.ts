import { db } from "@/db";
import { users, weightLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const logs = await db
      .select()
      .from(weightLogs)
      .where(eq(weightLogs.userId, user.id))
      .orderBy(desc(weightLogs.date));

    return Response.json({ logs });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to fetch weight logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const weight = Number(body.weight);
    const date = body.date || new Date().toISOString().slice(0, 10);

    if (isNaN(weight)) {
      return Response.json({ error: "Invalid weight value" }, { status: 400 });
    }

    await db.insert(weightLogs).values({
      userId: user.id,
      weight,
      date,
    });

    return Response.json({ success: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to log weight" }, { status: 500 });
  }
}
