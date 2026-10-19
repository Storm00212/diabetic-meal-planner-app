"use client";

import { useState } from "react";
import { api } from "@/app/api";
import { useAuth } from "@/app/AuthProvider";

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [dailyBudget, setDailyBudget] = useState(user?.dailyBudget ?? 300);
  const [dailyCarbTarget, setDailyCarbTarget] = useState(
    user?.dailyCarbLimit ?? 200,
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await api.user.updateSettings({
      name,
      dailyBudget,
      dailyCarbTarget,
    });
    setSaving(false);
    if (!res) {
      showToast("Could not save settings.");
      return;
    }
    showToast("Settings saved.");
    void refresh();
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">
          Update your profile, daily budget, and carb target. The planner uses
          these to build affordable, sugar-safe plans.
        </p>
      </header>

      <form
        onSubmit={save}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Daily food budget (KSh)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <p className="mt-1 text-xs text-slate-400">
              Total you can spend on a day&apos;s meals.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Daily carb target (g)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={dailyCarbTarget}
              onChange={(e) => setDailyCarbTarget(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <p className="mt-1 text-xs text-slate-400">
              Keeps sugars within your stable range.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800">
          🩺 Always coordinate your budget and carb targets with your doctor or
          dietitian. GlucoPlate is a planning aid, not medical advice.
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
