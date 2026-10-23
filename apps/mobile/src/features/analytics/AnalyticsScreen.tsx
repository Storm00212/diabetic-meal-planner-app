import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { money } from '@glucoplate/domain';
import { giBand } from '@glucoplate/domain';
import { apiFetch } from '@/lib/api-client';
import { Icons } from '@/shared/components/Icons';

export default function AnalyticsScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await apiFetch("/api/analytics");
        setData(res);
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
        <Text className="text-slate-500 mt-2">Analyzing your data...</Text>
      </SafeAreaView>
    );
  }

  if (!data || data.error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center p-6">
        <View className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center w-full">
          <Text className="text-slate-500 text-center">No analytics data available yet. Log some meals first!</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { summary, carbTrends, nutritionDist } = data;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-slate-900">Health & Budget Analytics</Text>
          <Text className="text-sm text-slate-500 mt-1">
            Track your nutritional trends and budget efficiency over time.
          </Text>
        </View>

        {/* Top Level Stats */}
        <View className="flex-col gap-4 mb-8">
          <StatCard
            label="Total Plans"
            value={summary.totalPlans}
            iconKey="calendar"
            description="Days planned"
          />
          <StatCard
            label="Money Saved"
            value={money(summary.savings)}
            iconKey="budget"
            description="Budget vs Actual"
          />
          <StatCard
            label="Avg. Spend"
            value={money(summary.totalSpent / (summary.totalPlans || 1))}
            iconKey="trend_down"
            description="Per planned day"
          />
        </View>

        <View className="flex-col gap-8">
          {/* Carb Trend */}
          <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-6">Carb Intake Trend</Text>
            <View className="flex-row items-end justify-between h-40">
              {carbTrends.map((plan: any, i: number) => {
                const height = Math.min(100, (plan.carbs / 200) * 100);
                return (
                  <View key={i} className="flex-1 items-center gap-2 mx-0.5">
                    <View
                      className="w-full bg-teal-500 rounded-t-sm"
                      style={{ height: `${height}%` }}
                    />
                    <Text className="text-[8px] text-slate-400" numberOfLines={1}>
                      {plan.date.slice(5)}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text className="mt-4 text-sm text-slate-500 text-center">
              Last {carbTrends.length} plans
            </Text>
          </View>

          {/* GI Distribution */}
          <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
            <Text className="text-lg font-bold text-slate-900 mb-6">Eaten Meal Quality</Text>
            <View className="flex-col gap-4">
              {["Low GI", "Medium GI", "High GI"].map((bandLabel) => {
                const dist = nutritionDist.find((d: any) =>
                  giBand(d.gi).label === bandLabel
                );
                const count = dist?.count || 0;
                const total = nutritionDist.reduce((sum: number, d: any) => sum + d.count, 0);
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <View key={bandLabel} className="flex-col gap-1">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm font-medium text-slate-700">{bandLabel}</Text>
                      <Text className="text-sm text-slate-500">{percentage}%</Text>
                    </View>
                    <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <View
                        className={`h-full ${
                          bandLabel === "Low GI" ? "bg-emerald-500" :
                          bandLabel === "Medium GI" ? "bg-amber-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, iconKey, description }: { label: string; value: any; iconKey: keyof typeof Icons; description: string }) {
  const Icon = Icons[iconKey];
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <View className="flex-row items-center gap-3 mb-4">
        <Icon size={26} strokeWidth={2} />
        <Text className="text-sm font-medium text-slate-500">{label}</Text>
      </View>
      <Text className="text-3xl font-bold text-slate-900">{value}</Text>
      <Text className="mt-1 text-xs text-slate-400">{description}</Text>
    </View>
  );
}
