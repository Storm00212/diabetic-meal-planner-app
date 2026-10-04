import { NextResponse } from "next/server";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const prefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.id),
    });

    return NextResponse.json(prefs || {
      diabetesType: "type2",
      allergies: "",
      dislikes: "",
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { diabetesType, allergies, dislikes } = body;

    await db.insert(userPreferences)
      .values({
        userId: session.id,
        diabetesType: diabetesType || "type2",
        allergies: allergies || "",
        dislikes: dislikes || "",
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { diabetesType, allergies, dislikes },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
