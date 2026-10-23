"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/api";
import { money } from "@glucoplate/domain";
import { giBand } from "@glucoplate/domain";
import { Icons } from "@/shared/components/Icons";

export function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const result = await api.health.analytics();
        if (!cancelled) setData(result);
      } catch {
        /* leave the dashboard empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
            >
              <div className="skeleton h-4 w-1/3 rounded mb-4" />
              <div className="skeleton h-8 w-1/2 rounded" />
            </div>
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="skeleton h-6 w-1/4 rounded mb-8" />
          <div className="skeleton h-32 w-full rounded" />
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          No analytics data available yet. Log some meals first!
        </p>
      </div>
    );
  }

  const { summary, carbTrends, nutritionDist } = data;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Total Plans"
          value={summary.totalPlans}
          icon="calendar"
          description="Days planned"
        />
        <StatCard
          label="Money Saved"
          value={money(summary.savings)}
          icon="budget"
          description="Budget vs Actual"
        />
        <StatCard
          label="Avg. Spend"
          value={money(summary.totalSpent / (summary.totalPlans || 1))}
          icon="trend_down"
          description="Per planned day"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Carb Trend */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
            Carb Intake Trend
          </h3>
          <div className="flex items-end gap-2 h-40">
            {carbTrends.map((plan: any, i: number) => {
              const height = Math.min(100, (plan.carbs / 200) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-teal-500 rounded-t-sm transition-all duration-500"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-slate-400 rotate-45 truncate w-8">
                    {plan.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center">
            Last {carbTrends.length} plans
          </p>
        </div>

        {/* GI Distribution */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
            Eaten Meal Quality
          </h3>
          <div className="space-y-4">
            {["Low GI", "Medium GI", "High GI"].map((bandLabel) => {
              const dist = nutritionDist.find((d: any) =>
                giBand(d.gi).label === bandLabel
              );
              const count = dist?.count || 0;
              const total = nutritionDist.reduce(
                (sum: number, d: any) => sum + d.count,
                0
              );
              const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={bandLabel} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {bandLabel}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        bandLabel === "Low GI" ? "bg-emerald-500" :
                        bandLabel === "Medium GI" ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, description }: { label: string; value: React.ReactNode; icon: keyof typeof Icons; description: string }) {
  const Icon = Icons[icon];
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="text-2xl" strokeWidth={2} />
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{description}</p>
    </div>
  );
}
