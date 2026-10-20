"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/app/api";
import { useAuth } from "@/app/AuthProvider";
import { ACTIVITY_LABELS } from "@glucoplate/domain";
import type {
  ActivityLevel,
  PortionTargets,
  Sex,
  UpdateSettingsRequest,
} from "@glucoplate/types";

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "unspecified", label: "Unspecified" },
];

const ACTIVITY_OPTIONS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
];

/** The measurements the portion calculator needs, as the form holds them. */
type ProfilePatch = {
  age: number | null;
  heightCm: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  sex: Sex;
  activityLevel: ActivityLevel;
};

/** Turns an empty field into "no value" and anything else into a number. */
function measurement(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [dailyBudget, setDailyBudget] = useState(user?.dailyBudget ?? 300);
  const [dailyCarbTarget, setDailyCarbTarget] = useState(
    user?.dailyCarbLimit ?? 200,
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The portion profile: the physical details behind the daily targets.
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [heightCm, setHeightCm] = useState(
    user?.heightCm ? String(user.heightCm) : "",
  );
  const [currentWeight, setCurrentWeight] = useState(
    user?.currentWeight ? String(user.currentWeight) : "",
  );
  const [targetWeight, setTargetWeight] = useState(
    user?.targetWeight ? String(user.targetWeight) : "",
  );
  const [sex, setSex] = useState<Sex>(user?.sex ?? "unspecified");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    user?.activityLevel ?? "light",
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [targets, setTargets] = useState<PortionTargets | null>(null);
  const [targetsError, setTargetsError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const loadTargets = useCallback(async () => {
    try {
      const data = await api.user.portionTargets();
      setTargets(data);
      setTargetsError(null);
    } catch {
      setTargetsError(
        "Could not load your daily targets right now. Try again in a moment.",
      );
    }
  }, []);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);

    const patch: ProfilePatch = {
      age: measurement(age),
      heightCm: measurement(heightCm),
      currentWeight: measurement(currentWeight),
      targetWeight: measurement(targetWeight),
      sex,
      activityLevel,
    };

    try {
      // A null clears the stored measurement on the server; the shared
      // request type only allows a number, so the patch is cast here.
      await api.user.updateSettings(
        patch as unknown as UpdateSettingsRequest,
      );
      showToast("Portion profile saved.");
      void refresh();
      await loadTargets();
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : "Could not save your portion profile.",
      );
    } finally {
      setProfileSaving(false);
    }
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

      {/* Your portion profile */}
      <form
        onSubmit={saveProfile}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Your portion profile
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            These details shape the portions on your plate, so the plan fits
            your body and your day.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Age
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 34"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Height (cm)
            </label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="e.g. 168"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current weight (kg)
            </label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
              placeholder="e.g. 72"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Target weight (kg)
            </label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="e.g. 68"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sex
            </label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Activity level
            </label>
            <select
              value={activityLevel}
              onChange={(e) =>
                setActivityLevel(e.target.value as ActivityLevel)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {ACTIVITY_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {profileError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {profileError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={profileSaving}
            className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {profileSaving ? "Saving…" : "Save portion profile"}
          </button>
        </div>

        {/* The targets those details produce */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Your daily targets
          </h3>

          {targetsError && (
            <p className="mt-2 text-xs text-rose-600">{targetsError}</p>
          )}

          {targets && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TargetStat label="Calories" value={targets.calories} unit="kcal" />
                <TargetStat label="Carbs" value={targets.carbsG} unit="g" />
                <TargetStat label="Protein" value={targets.proteinG} unit="g" />
                <TargetStat label="Fat" value={targets.fatG} unit="g" />
              </div>
              <p className="mt-3 text-xs text-slate-500">{targets.basis}</p>
              {!targets.personalised && (
                <p className="mt-2 text-xs text-amber-700">
                  These are general adult targets. Add your age, height, weight
                  and activity level to personalise the plan around you.
                </p>
              )}
            </>
          )}
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

function TargetStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-800">
        {value}
        <span className="ml-1 text-xs font-medium text-slate-400">{unit}</span>
      </p>
    </div>
  );
}
