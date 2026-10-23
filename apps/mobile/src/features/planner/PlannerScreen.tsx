import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, SafeAreaView } from "react-native";
import { useRouter } from 'expo-router';
import { explainDish, giBand, money, summariseSlots } from '@glucoplate/domain';
import { api, apiFetch, apiJson } from '@/lib/api-client';
import { Icons } from '@/shared/components/Icons';
import type {
  Dish,
  GeneratePlanResponse,
  MealSlot,
  PlanResult,
  SwapCandidate,
} from '@glucoplate/types';

const SLOTS: { key: MealSlot; label: string; iconKey: keyof typeof Icons; time: string }[] = [
  { key: "morning", label: "Morning", iconKey: "morning", time: "Breakfast" },
  { key: "afternoon", label: "Afternoon", iconKey: "afternoon", time: "Lunch" },
  { key: "evening", label: "Evening", iconKey: "evening", time: "Dinner" },
];

/** A pantry item is free, so it never counts towards the budget. */
function effectiveCost(dish: Dish): number {
  return dish.isPantryItem ? 0 : dish.cost;
}

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

export default function PlannerScreen() {
  const router = useRouter();
  const [budget, setBudget] = useState(300);
  const [carbTarget, setCarbTarget] = useState(150);
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState<PlanResult | null>(null);
  /** The glycemic index ceiling the plan was generated with. */
  const [giLimit, setGiLimit] = useState(55);
  /** The dish the person swapped in, per slot. `null` means "the planner's dish". */
  const [overrides, setOverrides] = useState<Record<MealSlot, Dish | null>>({
    morning: null,
    afternoon: null,
    evening: null,
  });
  /** The slot whose alternatives are open, and the alternatives themselves. */
  const [swapSlot, setSwapSlot] = useState<MealSlot | null>(null);
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
      const data = await apiJson<GeneratePlanResponse>("/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({ budget, carbTarget }),
      });
      if (!data?.plan) {
        throw new Error("Could not generate a plan.");
      }
      setPlan(data.plan);
      setGiLimit(data.giLimit ?? 55);
    } catch (err: any) {
      setError(err.message ?? "Could not generate a plan.");
    } finally {
      setLoading(false);
    }
  }

  /** Opens (or closes) the list of cheaper, lower-GI alternatives for a slot. */
  async function openSwap(slot: MealSlot, dish: Dish) {
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
    } catch (err: any) {
      setSwapError(err?.message ?? "Could not find any alternatives.");
    } finally {
      setSwapLoading(false);
    }
  }

  /** Replaces the dish in a slot and closes the alternatives list. */
  function applySwap(slot: MealSlot, candidate: SwapCandidate) {
    setOverrides((prev) => ({ ...prev, [slot]: candidate }));
    setSwapSlot(null);
    setSwapOptions([]);
    setSwapError(null);
    showToast(`Swapped in ${candidate.name}.`);
  }

  /** The plan as it currently stands, swaps included. */
  const effectiveSlots = useMemo<Record<MealSlot, Dish | null>>(() => {
    if (!plan) return { morning: null, afternoon: null, evening: null };
    return {
      morning: overrides.morning ?? plan.slots.morning,
      afternoon: overrides.afternoon ?? plan.slots.afternoon,
      evening: overrides.evening ?? plan.slots.evening,
    };
  }, [plan, overrides]);

  /** The totals for the plan as it currently stands, swaps included. */
  const totals = useMemo<PreviewTotals | null>(() => {
    if (!plan) return null;

    const summarised = summariseSlots(effectiveSlots);

    return {
      totalCost: summarised.totalCost,
      totalCarbs: summarised.totalCarbs,
      totalCalories: summarised.totalCalories,
      highestGi: summarised.highestGi,
      withinBudget: summarised.totalCost <= budget + 0.0001,
      withinCarbs: summarised.totalCarbs <= carbTarget,
      withinGi: summarised.highestGi <= giLimit,
    };
  }, [plan, effectiveSlots, budget, carbTarget, giLimit]);

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

      const response = await apiFetch("/api/plans", {
        method: "POST",
        body: JSON.stringify({ budget, carbTarget, planDate, overrides: swapped }),
      });
      if (!response.ok) {
        throw new Error(`Could not save plan (${response.status}).`);
      }
      showToast("Plan saved!");
      setTimeout(() => router.push("/dashboard/plans"), 800);
    } catch {
      showToast("Could not save plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-4">
        <View className="flex-col gap-4 mb-6">
          <View>
            <Text className="text-2xl font-bold text-slate-900">Meal Planner</Text>
            <Text className="text-sm text-slate-500 mt-1">
              Set your budget and carb target, then let GlucoPlate allocate an
              affordable, blood-sugar-friendly plan for the day.
            </Text>
          </View>

          <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <View className="flex-col gap-4">
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Daily budget (KSh)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={String(budget)}
                  onChangeText={(t) => setBudget(Number(t))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Carb target (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={String(carbTarget)}
                  onChangeText={(t) => setCarbTarget(Number(t))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Plan date</Text>
                <TextInput
                  value={planDate}
                  onChangeText={setPlanDate}
                  placeholder="YYYY-MM-DD"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
              <TouchableOpacity
                onPress={generate}
                disabled={loading}
                className={`mt-2 w-full rounded-lg py-3 font-semibold text-white ${loading ? 'bg-slate-400' : 'bg-teal-600'}`}
              >
                <View className="flex-row items-center justify-center gap-2">
                  {!loading && <Icons.generate size={16} strokeWidth={2} />}
                  <Text className="font-bold">
                    {loading ? "Allocating meals…" : "Generate meal plan"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {error && (
          <View className="rounded-2xl border border-rose-200 bg-rose-50 p-6 items-center text-center mb-6">
            <Icons.bucket size={32} strokeWidth={2} />
            <Text className="font-semibold text-rose-800">{error}</Text>
            <TouchableOpacity
              onPress={() => router.push("/dashboard/dishes")}
              className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Text>Go to My Bucket</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View className="flex-row flex-wrap justify-between gap-4">
            {SLOTS.map((s) => (
              <View key={s.key} className="w-[48%] h-56 rounded-2xl border border-slate-200 bg-white p-5">
                <View className="h-6 w-1/2 bg-slate-100 rounded mb-4" />
                <View className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
                <View className="h-4 w-2/3 bg-slate-100 rounded mb-8" />
                <View className="h-12 w-full bg-slate-100 rounded" />
              </View>
            ))}
          </View>
        )}

        {plan && totals && !loading && (
          <View className="flex-col gap-5 pb-20">
            <View className={`rounded-2xl border p-5 ${
              totals.withinBudget && totals.withinCarbs && totals.withinGi
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}>
              <Text className={`font-semibold ${totals.withinBudget && totals.withinCarbs && totals.withinGi ? "text-emerald-800" : "text-amber-800"}`}>
                {hasOverrides ? swappedMessage(totals) : plan.message}
              </Text>
              <View className="flex-row flex-wrap gap-3 mt-4">
                <SummaryStat label="Total cost" value={money(totals.totalCost)} sub={`of ${money(budget)}`} ok={totals.withinBudget} />
                <SummaryStat label="Total carbs" value={`${totals.totalCarbs} g`} sub={`of ${carbTarget} g`} ok={totals.withinCarbs} />
                <SummaryStat label="Calories" value={`${totals.totalCalories}`} sub="kcal" />
                <SummaryStat label="Highest GI" value={`${totals.highestGi}`} sub={`limit ${giLimit}`} ok={totals.withinGi} />
                <SummaryStat label="Budget left" value={money(Math.max(0, budget - totals.totalCost))} sub="remaining" ok={totals.withinBudget} />
              </View>
            </View>

            <View className="flex-col gap-4">
              {SLOTS.map((s) => {
                const original = plan.slots[s.key];
                const dish = overrides[s.key] ?? original;
                const swapped = overrides[s.key] !== null;
                const SlotIcon = Icons[s.iconKey];
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
                  <View key={s.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <View className="flex-row items-center gap-2">
                      <SlotIcon size={28} strokeWidth={2} />
                      <View>
                        <Text className="font-semibold text-slate-900">{s.label}</Text>
                        <Text className="text-xs text-slate-400">{s.time}</Text>
                      </View>
                    </View>

                    {dish ? (
                      <View className="mt-4 flex flex-col">
                        <View className="flex-row items-start justify-between gap-2">
                          <Text className="flex-1 font-semibold text-slate-800">{dish.name}</Text>
                          <TouchableOpacity
                            onPress={() => void openSwap(s.key, dish)}
                            accessibilityLabel={`Swap ${dish.name} for a cheaper, lower-glycemic-index dish`}
                            className="rounded-full border border-slate-200 px-2 py-0.5"
                          >
                            <Text className="text-xs font-medium text-teal-600">Swap</Text>
                          </TouchableOpacity>
                        </View>
                        <Text className="mt-1 text-sm text-slate-500" numberOfLines={2}>
                          {dish.description || "No description"}
                        </Text>
                        <View className="mt-3 flex-row flex-wrap gap-1.5">
                          <View className={`rounded-full px-2 py-0.5 ${giBand(dish.glycemicIndex).badge}`}>
                            <Text className={`text-xs font-semibold ${giBand(dish.glycemicIndex).badge.includes('teal') ? 'text-teal-700' : 'text-slate-700'}`}>
                              {giBand(dish.glycemicIndex).label}
                            </Text>
                          </View>
                          <View className={`rounded-full px-2 py-0.5 ${dish.isPantryItem ? "bg-amber-100" : "bg-teal-50"}`}>
                            <Text className={`text-xs font-semibold ${dish.isPantryItem ? "text-amber-700" : "text-teal-700"}`}>
                              {dish.isPantryItem ? "Pantry" : money(dish.cost)}
                            </Text>
                          </View>
                        </View>

                        {/* Why this dish */}
                        {reasons.length > 0 && (
                          <View className="mt-3 gap-1">
                            {reasons.map((reason, index) => (
                              <View key={`${index}-${reason}`} className="flex-row gap-1.5">
                                <Text className="text-xs text-slate-400">•</Text>
                                <Text className="flex-1 text-xs text-slate-500">{reason}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Swap alternatives */}
                        {swapSlot === s.key && (
                          <View className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {swapLoading && (
                              <Text className="text-xs text-slate-500">Looking for alternatives…</Text>
                            )}
                            {!swapLoading && swapError && (
                              <Text className="text-xs text-rose-600">{swapError}</Text>
                            )}
                            {!swapLoading && !swapError && swapOptions.length > 0 && (
                              <View className="gap-2">
                                {swapOptions.map((alt) => (
                                  <TouchableOpacity
                                    key={alt.id}
                                    onPress={() => applySwap(s.key, alt)}
                                    accessibilityLabel={`Use ${alt.name} instead of ${dish.name}, ${money(alt.cost)}, glycemic index ${alt.glycemicIndex}`}
                                    className="rounded-lg border border-slate-200 bg-white p-2.5"
                                  >
                                    <View className="flex-row items-baseline justify-between gap-2">
                                      <Text className="flex-1 text-sm font-medium text-slate-800">{alt.name}</Text>
                                      <Text className="text-xs font-semibold text-slate-600">{money(alt.cost)}</Text>
                                    </View>
                                    <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
                                      <View className={`rounded-full px-1.5 py-0.5 ${giBand(alt.glycemicIndex).badge}`}>
                                        <Text className={`text-xs font-semibold ${giBand(alt.glycemicIndex).badge.includes('teal') ? 'text-teal-700' : 'text-slate-700'}`}>
                                          GI {alt.glycemicIndex}
                                        </Text>
                                      </View>
                                      <Text className="flex-1 text-xs text-slate-500">{alt.reason}</Text>
                                    </View>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        )}

                        <View className="mt-auto grid flex-row justify-between bg-slate-50 rounded-lg p-2 mt-4">
                          <MiniStat value={`${dish.carbsG}g`} label="Carbs" />
                          <MiniStat value={`${dish.proteinG}g`} label="Protein" />
                          <MiniStat value={`${dish.calories}`} label="kcal" />
                        </View>
                      </View>
                    ) : (
                      <View className="mt-6 flex flex-col items-center justify-center text-center">
                        <Text className="text-2xl">🍂</Text>
                        <Text className="mt-2 text-sm text-slate-500">No suitable dish for this slot.</Text>
                        <TouchableOpacity onPress={() => router.push("/dashboard/dishes")} className="mt-2">
                          <Text className="text-xs font-semibold text-teal-600">Add one →</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {hasOverrides && (
              <Text className="text-xs text-slate-400">
                Your swaps are saved with the plan, so the meals you follow are the ones you chose.
              </Text>
            )}

            <View className="flex-row flex-wrap gap-3 justify-end">
              {hasOverrides && (
                <TouchableOpacity
                  onPress={resetSwaps}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 items-center"
                >
                  <Text className="text-sm font-medium text-slate-600">↺ Reset swaps</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={generate}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 items-center"
              >
                <View className="flex-row items-center justify-center gap-1">
                  <Icons.regenerate size={14} strokeWidth={2} />
                  <Text className="text-sm font-medium text-slate-600">Regenerate</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={save}
                disabled={saving}
                className={`flex-1 rounded-lg py-2.5 items-center ${saving ? 'bg-slate-400' : 'bg-teal-600'}`}
              >
                <Text className="text-sm font-semibold text-white">
                  {saving ? "Saving…" : (
                    <View className="flex-row items-center justify-center gap-1">
                      <Icons.save size={14} strokeWidth={2} />
                      <Text className="text-sm font-semibold text-white">Save this plan</Text>
                    </View>
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {toast && (
          <View className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 px-4 py-2.5 shadow-lg">
            <Text className="text-sm font-medium text-white">{toast}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value, sub, ok }: { label: string; value: string; sub: string; ok?: boolean }) {
  return (
    <View className="rounded-xl bg-white/70 p-3 flex-1">
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
      <Text className={`text-lg font-bold ${ok === undefined ? "text-slate-800" : ok ? "text-emerald-700" : "text-rose-600"}`}>
        {value}
      </Text>
      <Text className="text-xs text-slate-400">{sub}</Text>
    </View>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center px-2">
      <Text className="text-sm font-bold text-slate-800">{value}</Text>
      <Text className="text-[10px] uppercase text-slate-400">{label}</Text>
    </View>
  );
}
