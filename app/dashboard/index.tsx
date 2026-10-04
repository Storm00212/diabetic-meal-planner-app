import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Link } from 'expo-router';
import { apiFetch } from '@/lib/mobile/api-client';
import { money } from '@/lib/format';
import { giBand } from '@/lib/planner';
import { Activity, Utensils, Wallet, Calendar } from 'lucide-react-native';

export default function OverviewPage() {
  // In a real app, we'd use a hook to fetch this data from the API
  // For the conversion phase, we're mirroring the logic from the web page

  const user = {
    name: "User",
    dailyBudget: 20,
    dailyCarbTarget: 150,
  };

  const stats = {
    total: 12,
    avgCost: 5.50,
    avgGi: 52,
  };

  const planStats = { total: 5 };
  const recent = [
    { id: 1, planDate: '2023-10-01', totalCost: 15, budget: 20, totalCarbs: 120, totalCalories: 1800 },
    { id: 2, planDate: '2023-10-02', totalCost: 22, budget: 20, totalCarbs: 130, totalCalories: 1900 },
  ];

  const dishCount = stats.total;
  const avgCost = stats.avgCost;
  const avgGi = Math.round(stats.avgGi);
  const band = giBand(avgGi);

  const cards = [
    { label: "Dishes in bucket", value: dishCount.toString(), icon: <Utensils size={24} color="#0d9488" />, hint: "Available to plan meals" },
    { label: "Daily budget", value: money(user.dailyBudget), icon: <Wallet size={24} color="#0d9488" />, hint: "Your spending target" },
    { label: "Carb target", value: `${user.dailyCarbTarget} g`, icon: <Activity size={24} color="#0d9488" />, hint: "Keeps sugars stable" },
    { label: "Plans generated", value: planStats.total.toString(), icon: <Calendar size={24} color="#0d9488" />, hint: "Saved meal plans" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="mx-auto max-w-6xl p-4 space-y-8">
        <View className="space-y-2">
          <Text className="text-2xl font-bold text-slate-900">
            Welcome back, {user.name} 👋
          </Text>
          <Text className="text-slate-500">
            Here's your meal-planning snapshot for staying affordable and sugar-safe.
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between gap-4">
          {cards.map((c) => (
            <View key={c.label} className="w-[48%] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <View className="flex-row justify-between items-center">
                {c.icon}
              </View>
              <Text className="mt-3 text-xl font-bold text-slate-900">{c.value}</Text>
              <Text className="text-sm font-medium text-slate-600">{c.label}</Text>
              <Text className="mt-1 text-xs text-slate-400">{c.hint}</Text>
            </View>
          ))}
        </View>

        <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Text className="text-lg font-semibold text-slate-900">Quick actions</Text>
          <View className="mt-4 flex-row flex-wrap justify-between gap-3">
            <Link href="/dashboard/dishes" asChild>
              <TouchableOpacity className="w-[48%] rounded-xl border border-slate-200 p-4 bg-white">
                <Utensils size={24} color="#0d9488" />
                <Text className="mt-2 font-semibold text-slate-800">Manage your bucket</Text>
                <Text className="text-sm text-slate-500">Add or edit dishes.</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/dashboard/planner" asChild>
              <TouchableOpacity className="w-[48%] rounded-xl border border-slate-200 p-4 bg-white">
                <Calendar size={24} color="#0d9488" />
                <Text className="mt-2 font-semibold text-slate-800">Generate a plan</Text>
                <Text className="text-sm text-slate-500">Get a sugar-safe plan.</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View className="mt-6 rounded-xl bg-teal-600 p-5">
            <Text className="text-sm text-white leading-relaxed">
              💡 <Text className="font-bold">Tip:</Text> Add plenty of low-GI dishes (index ≤ 55).
              GlucoPlate prioritises the safest, cheapest options.
            </Text>
          </View>
        </View>

        <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-semibold text-slate-900">Recent plans</Text>
            <Link href="/dashboard/plans" className="text-sm font-medium text-teal-600">
              View all →
            </Link>
          </View>

          {recent.length === 0 ? (
            <View className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 items-center">
              <Text className="text-3xl">📅</Text>
              <Text className="mt-2 font-medium text-slate-700">No plans yet</Text>
              <Link href="/dashboard/planner" asChild>
                <TouchableOpacity className="mt-4 rounded-lg bg-teal-600 px-4 py-2">
                  <Text className="text-sm font-semibold text-white">Create a plan</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            <View className="mt-4 space-y-4">
              {recent.map((p) => (
                <View key={p.id} className="flex-row justify-between items-center py-3 border-b border-slate-100">
                  <View>
                    <Text className="font-medium text-slate-800">Plan for {p.planDate}</Text>
                    <Text className="text-sm text-slate-500">
                      {money(p.totalCost)} · {p.totalCarbs}g carbs · {p.totalCalories} kcal
                    </Text>
                  </View>
                  <View className={`rounded-full px-2.5 py-1 ${p.totalCost <= p.budget ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                    <Text className={`text-xs font-semibold ${p.totalCost <= p.budget ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {p.totalCost <= p.budget ? "On budget" : "Over budget"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
