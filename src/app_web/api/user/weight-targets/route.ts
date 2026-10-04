import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [userData] = await db.select().from(users).where(eq(users.id, user.id));
    return Response.json({
      currentWeight: userData?.currentWeight,
      targetWeight: userData?.targetWeight
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to fetch weight targets" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { currentWeight, targetWeight } = body;

    await db.update(users)
      .set({
        ...(currentWeight !== undefined && { currentWeight }),
        ...(targetWeight !== undefined && { targetWeight }),
      })
      .where(eq(users.id, user.id));

    return Response.json({ success: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to update weight targets" }, { status: 500 });
  }
}
