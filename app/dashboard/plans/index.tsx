import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { money, formatDate } from '@/lib/format';
import { giBand } from '@/lib/planner';
import { apiFetch } from '@/lib/mobile/api-client';
import type { SavedPlan } from '@/lib/types';

const SLOT_META: Record<string, { label: string; icon: string }> = {
  morning: { label: "Morning", icon: "🌅" },
  afternoon: { label: "Afternoon", icon: "☀️" },
  evening: { label: "Evening", icon: "🌙" },
};
const SLOT_ORDER = ["morning", "afternoon", "evening"];

export default function PlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const data = await apiFetch('/api/plans');
      setPlans(data.plans ?? []);
    } catch (err) {
      showToast("Failed to load plans");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(itemId: number, status: "eaten" | "skipped") {
    const prev = plans;
    setPlans((ps) =>
      ps.map((p) => ({
        ...p,
        items: p.items.map((i) => (i.id === itemId ? { ...i, status } : i)),
      }))
    );

    try {
      await apiFetch("/api/plans/update-item", {
        method: "PATCH",
        body: JSON.stringify({ itemId, status }),
      });
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

  async function handleDelete(plan: SavedPlan) {
    Alert.alert(
      "Delete Plan",
      `Delete the plan for ${plan.planDate}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const prev = plans;
            setPlans((ps) => ps.filter((p) => p.id !== plan.id));
            try {
              await apiFetch(`/api/plans/${plan.id}`, { method: "DELETE" });
              showToast("Plan deleted.");
            } catch {
              setPlans(prev);
              showToast("Could not delete plan.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-4">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-slate-900">Saved Plans</Text>
            <Text className="text-sm text-slate-500 mt-1">
              Your generated daily meal plans.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/dashboard/planner")}
            className="rounded-lg bg-teal-600 px-4 py-2 font-semibold"
          >
            <Text className="text-white text-sm font-bold">+ New plan</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center p-10">
            <ActivityIndicator size="large" color="#0d9488" />
            <Text className="text-slate-500 mt-2">Loading plans...</Text>
          </View>
        ) : plans.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 items-center text-center">
            <Text className="text-4xl mb-3">📅</Text>
            <Text className="text-lg font-semibold text-slate-800">No saved plans yet</Text>
            <Text className="mt-1 text-slate-500">
              Generate a daily meal plan and save it to see it here.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/dashboard/planner")}
              className="mt-5 rounded-lg bg-teal-600 px-4 py-2.5 font-semibold"
            >
              <Text className="text-white font-bold text-sm">Create your first plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-col gap-4 pb-20">
            {plans.map((plan) => {
              const onBudget = plan.totalCost <= plan.budget;
              return (
                <View
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <View>
                      <Text className="font-semibold text-slate-900 text-base">
                        {formatDate(plan.planDate)}
                      </Text>
                      <Text className="text-xs text-slate-500">
                        {money(plan.totalCost)} of {money(plan.budget)} ·{" "}
                        {plan.totalCarbs}g carbs · {plan.totalCalories} kcal
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className={`rounded-full px-2 py-1 ${
                        onBudget ? "bg-emerald-100" : "bg-rose-100"
                      }`}>
                        <Text className={`text-[10px] font-semibold ${
                          onBudget ? "text-emerald-700" : "text-rose-700"
                        }`}>
                          {onBudget ? "On budget" : "Over budget"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(plan)}
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600"
                      >
                        <Text className="text-rose-600 text-xs font-medium">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-3 mb-4">
                    <View className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <View
                        className={`h-full ${onBudget ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(100, (plan.totalCost / plan.budget) * 100)}%` }}
                      />
                    </View>
                    <Text className="text-xs font-medium text-slate-500">
                      {Math.round((plan.totalCost / plan.budget) * 100)}% of budget
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap gap-3">
                    {SLOT_ORDER.map((slot) => {
                      const item = plan.items.find((i) => i.slot === slot);
                      const meta = SLOT_META[slot];
                      return (
                        <View
                          key={slot}
                          className="flex-1 min-w-[100px] rounded-xl border border-slate-100 bg-slate-50 p-3"
                        >
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-xs">{meta.icon}</Text>
                            <Text className="text-xs font-semibold text-slate-500">{meta.label}</Text>
                          </View>
                          {item ? (
                            <View>
                              <Text className="mt-1 font-medium text-slate-800 text-sm">{item.dishName}</Text>
                              <View className="flex-row flex-wrap gap-1.5 mt-1">
                                <View className={`rounded-full px-2 py-0.5 ${giBand(item.glycemicIndex).badge}`}>
                                  <Text className={`text-[10px] font-semibold ${giBand(item.glycemicIndex).badge.includes('teal') ? 'text-teal-700' : 'text-slate-700'}`}>
                                    GI {item.glycemicIndex}
                                  </Text>
                                </View>
                                <Text className="text-[10px] text-slate-500">
                                  {money(item.cost)} · {item.carbsG}g
                                </Text>
                              </View>
                              <View className="flex-row gap-2 mt-2">
                                <TouchableOpacity
                                  onPress={() => handleUpdateStatus(item.id, "eaten")}
                                  disabled={item.status === "eaten"}
                                  className={`flex-1 rounded-lg py-1 items-center ${
                                    item.status === "eaten"
                                      ? "bg-emerald-500"
                                      : "bg-white border border-slate-200"
                                  }`}
                                >
                                  <Text className={`text-[10px] font-bold ${item.status === "eaten" ? "text-white" : "text-slate-600"}`}>
                                    {item.status === "eaten" ? "✓ Eaten" : "Mark Eaten"}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleUpdateStatus(item.id, "skipped")}
                                  disabled={item.status === "skipped"}
                                  className={`flex-1 rounded-lg py-1 items-center ${
                                    item.status === "skipped"
                                      ? "bg-slate-400"
                                      : "bg-white border border-slate-200"
                                  }`}
                                >
                                  <Text className={`text-[10px] font-bold ${item.status === "skipped" ? "text-white" : "text-slate-600"}`}>
                                    {item.status === "skipped" ? "✕ Skipped" : "Skip"}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <Text className="mt-1 text-sm text-slate-400">—</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
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
