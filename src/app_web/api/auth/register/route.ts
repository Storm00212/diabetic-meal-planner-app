import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSession } from "@/lib/auth";
import { seedDishesForUser } from "@/lib/seed";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name || !email || !password) {
      return Response.json(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash: hashPassword(password) })
      .returning();

    // Give new patients a starter bucket of demo dishes so the app feels alive
    await seedDishesForUser(user.id);
    await createSession(user.id);

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
