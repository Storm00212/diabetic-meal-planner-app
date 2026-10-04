import Link from "next/link";
import { db } from "@/db";
import { dishes, mealPlans } from "@/db/schema";
import { eq, desc, count, avg } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { giBand } from "@/lib/planner";
import { MOCK_DISHES, MOCK_PLANS } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = (await getCurrentUser())!;

  // MOCK MODE: Use mock data when in development to avoid DB crashes
  const isMock = process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL;

  let stats: { total: number; avgCost: number | string | null; avgGi: number | string | null } | undefined;
  let planStats: { total: number } | undefined;
  let recent: any[] = [];

  if (isMock) {
    stats = {
      total: MOCK_DISHES.length,
      avgCost: MOCK_DISHES.reduce((s, d) => s + d.cost, 0) / MOCK_DISHES.length,
      avgGi: MOCK_DISHES.reduce((s, d) => s + d.glycemicIndex, 0) / MOCK_DISHES.length,
    };
    planStats = { total: MOCK_PLANS.length };
    recent = MOCK_PLANS.slice(0, 3);
  } else {
    const [s] = await db
      .select({
        total: count(dishes.id),
        avgCost: avg(dishes.cost),
        avgGi: avg(dishes.glycemicIndex),
      })
      .from(dishes)
      .where(eq(dishes.userId, user.id));
    stats = s;

    const [ps] = await db
      .select({ total: count(mealPlans.id) })
      .from(mealPlans)
      .where(eq(mealPlans.userId, user.id));
    planStats = ps;

    recent = await db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.userId, user.id))
      .orderBy(desc(mealPlans.createdAt))
      .limit(3);
  }

  const dishCount = Number(stats?.total ?? 0);
  const avgCost = Number(stats?.avgCost ?? 0);
  const avgGi = Math.round(Number(stats?.avgGi ?? 0));
  const band = giBand(avgGi);

  const cards = [
    {
      label: "Dishes in bucket",
      value: dishCount.toString(),
      icon: "🧺",
      hint: "Available to plan meals",
    },
    {
      label: "Daily budget",
      value: money(user.dailyBudget),
      icon: "💰",
      hint: "Your spending target",
    },
    {
      label: "Carb target",
      value: `${user.dailyCarbTarget} g`,
      icon: "🩸",
      hint: "Keeps sugars stable",
    },
    {
      label: "Plans generated",
      value: Number(planStats?.total ?? 0).toString(),
      icon: "📅",
      hint: "Saved meal plans",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl animate-fade-in space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-slate-500">
          Here&apos;s your meal-planning snapshot for staying affordable and
          sugar-safe.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{c.icon}</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-sm font-medium text-slate-600">{c.label}</p>
            <p className="mt-1 text-xs text-slate-400">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard/dishes"
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/40"
            >
              <div className="text-2xl">🧺</div>
              <p className="mt-2 font-semibold text-slate-800">
                Manage your bucket
              </p>
              <p className="text-sm text-slate-500">
                Add or edit dishes you can afford to prepare.
              </p>
            </Link>
            <Link
              href="/dashboard/planner"
              className="group rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/40"
            >
              <div className="text-2xl">🍽️</div>
              <p className="mt-2 font-semibold text-slate-800">
                Generate a meal plan
              </p>
              <p className="text-sm text-slate-500">
                Get a morning, afternoon &amp; evening plan within budget.
              </p>
            </Link>
          </div>

          <div className="mt-6 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 p-5 text-white">
            <p className="text-sm/relaxed">
              💡 <strong>Tip:</strong> Add plenty of low-GI dishes (index ≤ 55)
              to your bucket. GlucoPlate always prioritises the safest, cheapest
              options so your blood sugar stays stable.
            </p>
          </div>
        </div>

        {/* Bucket health */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Bucket health</h2>
          {dishCount === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No dishes yet. Add some to see insights here.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-slate-500">Average dish cost</p>
                <p className="text-xl font-bold text-slate-900">
                  {money(avgCost)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Average glycemic index</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xl font-bold text-slate-900">{avgGi}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${band.badge}`}
                  >
                    {band.label}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent plans */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent plans</h2>
          <Link
            href="/dashboard/plans"
            className="text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <div className="text-3xl">📅</div>
            <p className="mt-2 font-medium text-slate-700">No plans yet</p>
            <p className="text-sm text-slate-500">
              Generate your first daily meal plan to see it here.
            </p>
            <Link
              href="/dashboard/planner"
              className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Create a plan
            </Link>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {recent.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    Plan for {p.planDate}
                  </p>
                  <p className="text-sm text-slate-500">
                    {money(p.totalCost)} · {p.totalCarbs}g carbs ·{" "}
                    {p.totalCalories} kcal
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    p.totalCost <= p.budget
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {p.totalCost <= p.budget ? "On budget" : "Over budget"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
