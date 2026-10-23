"use client";

import { useState, useEffect } from "react";
import { api } from "@/app/api";
import { money, formatDate } from "@glucoplate/domain";
import { giBand } from "@glucoplate/domain";
import type { MealPlanItem, MealPlanWithItems } from "@glucoplate/types";
import { Link } from "react-router-dom";
import { Icons } from "@/shared/components/Icons";

const SLOT_META: Record<string, { label: string; iconKey: keyof typeof Icons }> = {
  morning: { label: "Morning", iconKey: "morning" },
  afternoon: { label: "Afternoon", iconKey: "afternoon" },
  evening: { label: "Evening", iconKey: "evening" },
};
const SLOT_ORDER = ["morning", "afternoon", "evening"];

/**
 * Why a saved dish was chosen, when the planner recorded one.
 *
 * The shared `MealPlanItem` contract does not declare the field, so it is
 * read defensively and only shown when it is a non-empty string.
 */
function reasonFor(item: MealPlanItem): string | null {
  const reason = (item as { reason?: string }).reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

export function PlansPage() {
  const [plans, setPlans] = useState<MealPlanWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await api.planner.list();
        if (!cancelled) setPlans(data.plans ?? []);
      } catch {
        if (!cancelled) showToast("Failed to load plans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpdateStatus(itemId: number, status: "eaten" | "skipped") {
    const prev = plans;
    // Optimistic update
    setPlans((ps) =>
      ps.map((p) => ({
        ...p,
        items: p.items.map((i) => (i.id === itemId ? { ...i, status } : i)),
      }))
    );

    try {
      await api.planner.updateItem({ itemId, status });
      showToast(`Meal marked as ${status}.`);
    } catch {
      setPlans(prev);
      showToast("Could not update meal status.");
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleDelete(plan: MealPlanWithItems) {
    if (!confirm(`Delete the plan for ${plan.planDate}?`)) return;
    const prev = plans;
    setPlans((ps) => ps.filter((p) => p.id !== plan.id));
    try {
      await api.planner.remove(plan.id);
    } catch {
      setPlans(prev);
      showToast("Could not delete plan.");
      return;
    }
    showToast("Plan deleted.");
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saved Plans</h1>
          <p className="mt-1 text-slate-500">
            Your generated daily meal plans, kept for reference.
          </p>
        </div>
            <Link
              to="/dashboard/planner"
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-700"
        >
          + New plan
        </Link>
      </header>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton mt-4 h-20 w-full rounded" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Icons.calendar className="text-4xl" strokeWidth={2} />
            <p className="mt-3 text-lg font-semibold text-slate-800">
              No saved plans yet
          </p>
          <p className="mt-1 text-slate-500">
            Generate a daily meal plan and save it to see it here.
          </p>
          <Link
            to="/dashboard/planner"
            className="mt-5 inline-block rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700"
          >
            Create your first plan
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const onBudget = plan.totalCost <= plan.budget;
            return (
              <div
                key={plan.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatDate(plan.planDate)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {money(plan.totalCost)} of {money(plan.budget)} ·{" "}
                      {plan.totalCarbs}g carbs · {plan.totalCalories} kcal
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        onBudget
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {onBudget ? "On budget" : "Over budget"}
                    </span>
                    <button
                      onClick={() => handleDelete(plan)}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${onBudget ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, (plan.totalCost / plan.budget) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    {Math.round((plan.totalCost / plan.budget) * 100)}% of budget
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {SLOT_ORDER.map((slot) => {
                    const item = plan.items.find((i) => i.slot === slot);
                    const meta = SLOT_META[slot];
                    const reason = item ? reasonFor(item) : null;
                    const SlotIcon = Icons[meta.iconKey];
                    return (
                      <div
                        key={slot}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <SlotIcon size={14} strokeWidth={2} />{" "}
                          {meta.label}
                        </p>
                        {item ? (
                          <>
                            <p className="mt-1 font-medium text-slate-800">
                              {item.dishName}
                            </p>
                            {reason && (
                              <p className="mt-1 text-xs text-slate-500">
                                {reason}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${giBand(item.glycemicIndex).badge}`}
                              >
                                GI {item.glycemicIndex}
                              </span>
                              <span className="text-xs text-slate-500">
                                {money(item.cost)} · {item.carbsG}g
                              </span>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => handleUpdateStatus(item.id, "eaten")}
                                disabled={item.status === "eaten"}
                                className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition ${
                                  item.status === "eaten"
                                    ? "bg-emerald-500 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                                >
                                {item.status === "eaten" ? "Eaten" : "Mark Eaten"}
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(item.id, "skipped")}
                                disabled={item.status === "skipped"}
                                className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition ${
                                  item.status === "skipped"
                                    ? "bg-slate-400 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {item.status === "skipped" ? "Skipped" : "Skip"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-slate-400">—</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
