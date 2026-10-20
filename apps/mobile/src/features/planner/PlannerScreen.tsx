import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, SafeAreaView } from "react-native";
import { useRouter } from 'expo-router';
import { money } from '@glucoplate/domain';
import { giBand } from '@glucoplate/domain';
import { apiFetch, apiJson } from '@/lib/api-client';
import type { Dish } from '@glucoplate/types';

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

export default function PlannerScreen() {
  const router = useRouter();
  const [budget, setBudget] = useState(20);
  const [carbTarget, setCarbTarget] = useState(150);
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));
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
      const data = await apiJson("/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({ budget, carbTarget }),
      });
      setPlan(data.plan);
    } catch (err: any) {
      setError(err.message ?? "Could not generate a plan.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    try {
      await apiFetch("/api/plans", {
        method: "POST",
        body: JSON.stringify({ budget, carbTarget, planDate }),
      });
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
                <Text className="text-sm font-medium text-slate-700 mb-1">Daily budget ($)</Text>
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
                <Text className="text-center font-bold">
                  {loading ? "Allocating meals…" : "⚡ Generate meal plan"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {error && (
          <View className="rounded-2xl border border-rose-200 bg-rose-50 p-6 items-center text-center mb-6">
            <Text className="text-3xl mb-2">🧺</Text>
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

        {plan && !loading && (
          <View className="flex-col gap-5 pb-20">
            <View className={`rounded-2xl border p-5 ${
              plan.withinBudget && plan.withinCarbs ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
            }`}>
              <Text className={`font-semibold ${plan.withinBudget && plan.withinCarbs ? "text-emerald-800" : "text-amber-800"}`}>
                {plan.message}
              </Text>
              <View className="flex-row flex-wrap gap-3 mt-4">
                <SummaryStat label="Total cost" value={money(plan.totalCost)} sub={`of ${money(budget)}`} ok={plan.withinBudget} />
                <SummaryStat label="Total carbs" value={`${plan.totalCarbs} g`} sub={`of ${carbTarget} g`} ok={plan.withinCarbs} />
                <SummaryStat label="Calories" value={`${plan.totalCalories}`} sub="kcal" />
                <SummaryStat label="Budget left" value={money(Math.max(0, budget - plan.totalCost))} sub="remaining" ok={plan.withinBudget} />
              </View>
            </View>

            <View className="flex-col gap-4">
              {SLOTS.map((s) => {
                const dish = plan.slots[s.key];
                return (
                  <View key={s.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-2xl">{s.icon}</Text>
                      <View>
                        <Text className="font-semibold text-slate-900">{s.label}</Text>
                        <Text className="text-xs text-slate-400">{s.time}</Text>
                      </View>
                    </View>

                    {dish ? (
                      <View className="mt-4 flex flex-col">
                        <Text className="font-semibold text-slate-800">{dish.name}</Text>
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

            <View className="flex-row gap-3 justify-end">
              <TouchableOpacity
                onPress={generate}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 items-center"
              >
                <Text className="text-sm font-medium text-slate-600">🔄 Regenerate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={save}
                disabled={saving}
                className={`flex-1 rounded-lg py-2.5 items-center ${saving ? 'bg-slate-400' : 'bg-teal-600'}`}
              >
                <Text className="text-sm font-semibold text-white">
                  {saving ? "Saving…" : "💾 Save this plan"}
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
