"use client";

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/app/api";
import { useAuth } from "@/app/AuthProvider";
import { explainDish, giBand, money } from "@glucoplate/domain";
import type { Dish, MealSlot, PlanResult, SwapCandidate } from "@glucoplate/types";

type Slot = MealSlot;
const SLOTS: { key: Slot; label: string; icon: string; time: string }[] = [
  { key: "morning", label: "Morning", icon: "🌅", time: "Breakfast" },
  { key: "afternoon", label: "Afternoon", icon: "☀️", time: "Lunch" },
  { key: "evening", label: "Evening", icon: "🌙", time: "Dinner" },
];

/** The totals the summary banner shows for the plan as it currently stands. */
type PreviewTotals = {
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  highestGi: number;
  withinBudget: boolean;
  withinCarbs: boolean;
  withinGi: boolean;
};

/** A pantry item costs nothing, so it never counts towards the budget. */
function effectiveCost(dish: Dish): number {
  return dish.isPantryItem ? 0 : dish.cost;
}

/** A short summary of the preview, once the swaps have been applied. */
function swappedMessage(totals: PreviewTotals): string {
  const problems: string[] = [];
  if (!totals.withinBudget) problems.push("over your budget");
  if (!totals.withinCarbs) problems.push("over your carb target");
  if (!totals.withinGi) problems.push("above your glycemic index limit");

  if (problems.length === 0) {
    return "After your swaps: affordable, within your carb target and under your glycemic index limit.";
  }
  return `After your swaps: this plan is ${problems.join(", ")}.`;
}

export function PlannerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [budget, setBudget] = useState(user?.dailyBudget ?? 300);
  const [carbTarget, setCarbTarget] = useState(user?.dailyCarbLimit ?? 200);
  const [planDate, setPlanDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [giLimit, setGiLimit] = useState(user?.dailyGiLimit ?? 55);
  /** The dish the user swapped in, per slot. `null` means "the planner's dish". */
  const [overrides, setOverrides] = useState<Record<Slot, Dish | null>>({
    morning: null,
    afternoon: null,
    evening: null,
  });
  /** The slot whose alternatives are open, and the alternatives themselves. */
  const [swapSlot, setSwapSlot] = useState<Slot | null>(null);
  const [swapOptions, setSwapOptions] = useState<SwapCandidate[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  /** Puts every slot back to the dish the planner chose. */
  function resetSwaps() {
    setOverrides({ morning: null, afternoon: null, evening: null });
    setSwapSlot(null);
    setSwapOptions([]);
    setSwapError(null);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setPlan(null);
    resetSwaps();
    try {
      const data = await api.planner.generate({ budget, carbTarget });
      setPlan(data.plan);
      setGiLimit(data.giLimit);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate a plan.",
      );
    } finally {
      setLoading(false);
    }
  }

  /** Opens (or closes) the list of cheaper, lower-GI alternatives for a slot. */
  async function openSwap(slot: Slot, dish: Dish) {
    if (swapSlot === slot) {
      setSwapSlot(null);
      setSwapOptions([]);
      setSwapError(null);
      return;
    }

    setSwapSlot(slot);
    setSwapOptions([]);
    setSwapError(null);
    setSwapLoading(true);
    try {
      const result = await api.catalog.swap(dish.id, 3);
      const alternatives = result.alternatives ?? [];
      setSwapOptions(alternatives);
      if (alternatives.length === 0) {
        setSwapError(
          "No cheaper, lower-glycemic-index dish in your bucket yet. Add one and try again.",
        );
      }
    } catch (err) {
      setSwapError(
        err instanceof Error
          ? err.message
          : "Could not find any alternatives.",
      );
    } finally {
      setSwapLoading(false);
    }
  }

  /** Replaces the dish in a slot and closes the alternatives list. */
  function applySwap(slot: Slot, candidate: SwapCandidate) {
    setOverrides((prev) => ({ ...prev, [slot]: candidate }));
    setSwapSlot(null);
    setSwapOptions([]);
    setSwapError(null);
    showToast(`Swapped in ${candidate.name}.`);
  }

  /** The totals for the plan as it currently stands, swaps included. */
  const totals = useMemo<PreviewTotals | null>(() => {
    if (!plan) return null;

    const dishes = SLOTS.map((s) => overrides[s.key] ?? plan.slots[s.key]).filter(
      (dish): dish is Dish => Boolean(dish),
    );

    const totalCost = dishes.reduce((sum, d) => sum + effectiveCost(d), 0);
    const totalCarbs = dishes.reduce((sum, d) => sum + d.carbsG, 0);
    const totalCalories = dishes.reduce((sum, d) => sum + d.calories, 0);
    const highestGi = dishes.reduce(
      (max, d) => Math.max(max, d.glycemicIndex),
      0,
    );

    return {
      totalCost,
      totalCarbs,
      totalCalories,
      highestGi,
      withinBudget: totalCost <= budget + 0.0001,
      withinCarbs: totalCarbs <= carbTarget,
      withinGi: highestGi <= giLimit,
    };
  }, [plan, overrides, budget, carbTarget, giLimit]);

  const hasOverrides = SLOTS.some((s) => overrides[s.key] !== null);

  async function save() {
    if (!plan) return;
    setSaving(true);
    try {
      // The swapped dishes travel with the request, so what is saved is
      // exactly what the person saw.
      const swapped: Record<string, number> = {};
      for (const slot of SLOTS) {
        const dish = overrides[slot.key];
        if (dish) swapped[slot.key] = dish.id;
      }

      await api.planner.save({
        budget,
        carbTarget,
        planDate,
        ...(Object.keys(swapped).length > 0 ? { overrides: swapped } : {}),
      });
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
              Daily budget (KSh)
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

      {plan && totals && !loading && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div
            className={`rounded-2xl border p-5 ${
              totals.withinBudget && totals.withinCarbs && totals.withinGi
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`font-semibold ${
                totals.withinBudget && totals.withinCarbs && totals.withinGi
                  ? "text-emerald-800"
                  : "text-amber-800"
              }`}
            >
              {hasOverrides ? swappedMessage(totals) : plan.message}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <SummaryStat
                label="Total cost"
                value={money(totals.totalCost)}
                sub={`of ${money(budget)}`}
                ok={totals.withinBudget}
              />
              <SummaryStat
                label="Total carbs"
                value={`${totals.totalCarbs} g`}
                sub={`of ${carbTarget} g`}
                ok={totals.withinCarbs}
              />
              <SummaryStat
                label="Calories"
                value={`${totals.totalCalories}`}
                sub="kcal"
              />
              <SummaryStat
                label="Highest GI"
                value={`${totals.highestGi}`}
                sub={`limit ${giLimit}`}
                ok={totals.withinGi}
              />
              <SummaryStat
                label="Budget left"
                value={money(Math.max(0, budget - totals.totalCost))}
                sub="remaining"
                ok={totals.withinBudget}
              />
            </div>
          </div>

          {/* Slots */}
          <div className="grid gap-4 sm:grid-cols-3">
            {SLOTS.map((s) => {
              const original = plan.slots[s.key];
              const dish = overrides[s.key] ?? original;
              const swapped = overrides[s.key] !== null;
              // The planner explains its own choices. A swapped-in dish is
              // explained here, against the same limits, so the numbers stay
              // true after the swap.
              const reasons = !dish
                ? []
                : swapped
                  ? explainDish(dish, {
                      budget,
                      carbTarget,
                      giLimit,
                      slotLabel: s.label,
                      replaced: original
                        ? {
                            name: original.name,
                            cost: effectiveCost(original),
                            glycemicIndex: original.glycemicIndex,
                          }
                        : null,
                    })
                  : (plan.reasons?.[s.key] ?? []);

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
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-800">
                          {dish.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => void openSwap(s.key, dish)}
                          aria-expanded={swapSlot === s.key}
                          aria-controls={`swap-${s.key}`}
                          aria-label={`Swap ${dish.name} for a cheaper, lower-glycemic-index dish`}
                          className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                        >
                          Swap
                        </button>
                      </div>
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

                      {/* Why this dish */}
                      {reasons.length > 0 && (
                        <ul
                          className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-500"
                          aria-label={`Why ${dish.name}`}
                        >
                          {reasons.map((reason, index) => (
                            <li key={`${index}-${reason}`}>{reason}</li>
                          ))}
                        </ul>
                      )}

                      {/* Swap alternatives */}
                      {swapSlot === s.key && (
                        <div
                          id={`swap-${s.key}`}
                          className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          {swapLoading && (
                            <p className="text-xs text-slate-500">
                              Looking for alternatives…
                            </p>
                          )}
                          {!swapLoading && swapError && (
                            <p className="text-xs text-rose-600">{swapError}</p>
                          )}
                          {!swapLoading && !swapError && swapOptions.length > 0 && (
                            <ul className="space-y-2">
                              {swapOptions.map((alt) => (
                                <li key={alt.id}>
                                  <button
                                    type="button"
                                    onClick={() => applySwap(s.key, alt)}
                                    aria-label={`Use ${alt.name} instead of ${dish.name}, ${money(alt.cost)}, glycemic index ${alt.glycemicIndex}`}
                                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                                  >
                                    <span className="flex items-baseline justify-between gap-2">
                                      <span className="text-sm font-medium text-slate-800">
                                        {alt.name}
                                      </span>
                                      <span className="shrink-0 text-xs font-semibold text-slate-600">
                                        {money(alt.cost)}
                                      </span>
                                    </span>
                                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                      <span
                                        className={`rounded-full px-1.5 py-0.5 font-semibold ${giBand(alt.glycemicIndex).badge}`}
                                      >
                                        GI {alt.glycemicIndex}
                                      </span>
                                      <span>{alt.reason}</span>
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

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

          {hasOverrides && (
            <p className="text-xs text-slate-400">
              Your swaps are saved with the plan, so the meals you follow are
              the ones you chose.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {hasOverrides && (
              <button
                type="button"
                onClick={resetSwaps}
                className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
              >
                ↺ Reset swaps
              </button>
            )}
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
