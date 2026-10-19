"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/app/api";
import { useAuth } from "@/app/AuthProvider";
import { giBand, money } from "@glucoplate/domain";
import type { Dish } from "@glucoplate/types";

type Slot = "morning" | "afternoon" | "evening";
const SLOTS: { key: Slot; label: string; icon: string; time: string }[] = [
  { key: "morning", label: "Morning", icon: "🌅", time: "Breakfast" },
  { key: "afternoon", label: "Afternoon", icon: "☀️", time: "Lunch" },
  { key: "evening", label: "Evening", icon: "🌙", time: "Dinner" },
];

type PlanResult = {
  slots: Record<Slot, Dish | null>;
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  withinBudget: boolean;
  withinCarbs: boolean;
  message: string;
};

export function PlannerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [budget, setBudget] = useState(user?.dailyBudget ?? 300);
  const [carbTarget, setCarbTarget] = useState(user?.dailyCarbLimit ?? 200);
  const [planDate, setPlanDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const data = await api.planner.generate({ budget, carbTarget });
      setPlan(data.plan);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate a plan.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    try {
      await api.planner.save({ budget, carbTarget, planDate });
      showToast("Plan saved!");
      setTimeout(() => navigate("/dashboard/plans"), 800);
    } catch {
      showToast("Could not save plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Meal Planner</h1>
        <p className="mt-1 text-slate-500">
          Set your budget and carb target, then let GlucoPlate allocate an
          affordable, blood-sugar-friendly plan for the day.
        </p>
      </header>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Daily budget ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Carb target (g)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={carbTarget}
              onChange={(e) => setCarbTarget(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Plan date
            </label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Allocating meals…" : "⚡ Generate meal plan"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <div className="text-3xl">🧺</div>
          <p className="mt-2 font-semibold text-rose-800">{error}</p>
          <Link
            to="/dashboard/dishes"
            className="mt-4 inline-block rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Go to My Bucket
          </Link>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {SLOTS.map((s) => (
            <div
              key={s.key}
              className="h-56 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="skeleton h-6 w-1/2 rounded" />
              <div className="skeleton mt-4 h-4 w-3/4 rounded" />
              <div className="skeleton mt-2 h-4 w-2/3 rounded" />
              <div className="skeleton mt-8 h-12 w-full rounded" />
            </div>
          ))}
        </div>
      )}

      {plan && !loading && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div
            className={`rounded-2xl border p-5 ${
              plan.withinBudget && plan.withinCarbs
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`font-semibold ${
                plan.withinBudget && plan.withinCarbs
                  ? "text-emerald-800"
                  : "text-amber-800"
              }`}
            >
              {plan.message}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStat
                label="Total cost"
                value={money(plan.totalCost)}
                sub={`of ${money(budget)}`}
                ok={plan.withinBudget}
              />
              <SummaryStat
                label="Total carbs"
                value={`${plan.totalCarbs} g`}
                sub={`of ${carbTarget} g`}
                ok={plan.withinCarbs}
              />
              <SummaryStat
                label="Calories"
                value={`${plan.totalCalories}`}
                sub="kcal"
              />
              <SummaryStat
                label="Budget left"
                value={money(Math.max(0, budget - plan.totalCost))}
                sub="remaining"
                ok={plan.withinBudget}
              />
            </div>
          </div>

          {/* Slots */}
          <div className="grid gap-4 sm:grid-cols-3">
            {SLOTS.map((s) => {
              const dish = plan.slots[s.key];
              return (
                <div
                  key={s.key}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <p className="font-semibold text-slate-900">{s.label}</p>
                      <p className="text-xs text-slate-400">{s.time}</p>
                    </div>
                  </div>

                  {dish ? (
                    <div className="mt-4 flex flex-1 flex-col">
                      <p className="font-semibold text-slate-800">
                        {dish.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {dish.description || "No description"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${giBand(dish.glycemicIndex).badge}`}
                        >
                          {giBand(dish.glycemicIndex).label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          dish.isPantryItem
                            ? "bg-amber-100 text-amber-700"
                            : "bg-teal-50 text-teal-700"
                        }`}>
                          {dish.isPantryItem ? "Pantry" : money(dish.cost)}
                        </span>
                      </div>
                      <div className="mt-auto grid grid-cols-3 gap-2 pt-4 text-center">
                        <MiniStat value={`${dish.carbsG}g`} label="Carbs" />
                        <MiniStat value={`${dish.proteinG}g`} label="Protein" />
                        <MiniStat value={`${dish.calories}`} label="kcal" />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
                      <div className="text-2xl">🍂</div>
                      <p className="mt-2 text-sm text-slate-500">
                        No suitable dish for this slot.
                      </p>
                      <Link
                        to="/dashboard/dishes"
                        className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700"
                      >
                        Add one →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={generate}
              className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
            >
              🔄 Regenerate
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "💾 Save this plan"}
            </button>
          </div>
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

function SummaryStat({
  label,
  value,
  sub,
  ok,
}: {
  label: string;
  value: string;
  sub: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/70 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`text-lg font-bold ${
          ok === undefined
            ? "text-slate-800"
            : ok
              ? "text-emerald-700"
              : "text-rose-600"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-1.5">
      <p className="text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
    </div>
  );
}
