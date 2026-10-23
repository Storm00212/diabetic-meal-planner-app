"use client";

import { useState } from "react";
import { api } from "@/app/api";
import { Sparkles } from "lucide-react";
import { Icons } from "@/shared/components/Icons";
import type { Dish, DishFormValues } from "@glucoplate/types";

const MEAL_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
];

const empty: DishFormValues = {
  name: "",
  description: "",
  mealTime: "any",
  cost: 0,
  isPantryItem: false,
  calories: 0,
  carbsG: 0,
  proteinG: 0,
  glycemicIndex: 45,
};

export default function DishModal({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Dish | null;
  onClose: () => void;
  onSubmit: (values: DishFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<DishFormValues>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingNutrients, setFetchingNutrients] = useState(false);
  const [lastEditing, setLastEditing] = useState(editing);
  const [lastOpen, setLastOpen] = useState(open);

  // Reset the form when the modal is opened for a different dish. Doing this
  // during render (instead of in an effect) avoids a second render pass.
  if (editing !== lastEditing || open !== lastOpen) {
    setLastEditing(editing);
    setLastOpen(open);
    setValues(
      editing
        ? {
            name: editing.name,
            description: editing.description,
            mealTime: editing.mealTime,
            cost: editing.cost,
            isPantryItem: editing.isPantryItem,
            calories: editing.calories,
            carbsG: editing.carbsG,
            proteinG: editing.proteinG,
            glycemicIndex: editing.glycemicIndex,
          }
        : empty,
    );
    setError(null);
  }

  if (!open) return null;

  async function fetchNutrients() {
    if (!values.name.trim()) {
      setError("Please enter a dish name first.");
      return;
    }
    setFetchingNutrients(true);
    setError(null);
    try {
      const data = await api.health.nutrients(values.name);

      setValues((v) => ({
        ...v,
        calories: data.calories,
        carbsG: data.carbsG,
        proteinG: data.proteinG,
        glycemicIndex: data.glycemicIndex,
      }));
    } catch {
      setError("Could not automatically find nutrients. Please enter them manually.");
    } finally {
      setFetchingNutrients(false);
    }
  }

  function set<K extends keyof DishFormValues>(key: K, val: DishFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Dish name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch {
      setError("Could not save. Please try again.");
      setSaving(false);
    }
  }

  /**
   * The serving the catalogue recorded for this dish, e.g. "1 chapati (60 g)".
   * It stands in for the description when the dish has none.
   */
  const servingLabel = editing?.servingLabel?.trim() ?? "";
  const descriptionIsEmpty = values.description.trim() === "";

  const numField = (
    label: string,
    key: keyof DishFormValues,
    step = "1",
    suffix?: string,
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
        {label}
        {suffix ? <span className="text-slate-400 dark:text-slate-500"> ({suffix})</span> : null}
      </label>
      <input
        type="number"
        min="0"
        step={step}
        value={values[key] as number}
        onChange={(e) => set(key, Number(e.target.value) as never)}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg animate-fade-in rounded-t-2xl bg-white dark:bg-slate-800 p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {editing ? "Edit dish" : "Add a dish to your bucket"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Icons.close size={18} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
              Dish name
            </label>
            <div className="relative">
              <input
                type="text"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Grilled Chicken Salad"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                type="button"
                onClick={fetchNutrients}
                disabled={fetchingNutrients}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-50 transition"
                title="Auto-calculate nutrients"
                aria-label="Auto-calculate nutrients"
              >
                <Sparkles className={`h-4 w-4 ${fetchingNutrients ? "animate-spin" : ""}`} />
              </button>
            </div>
            {servingLabel && !descriptionIsEmpty && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{servingLabel}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
              Description
            </label>
            <textarea
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Short note about the dish"
              className="w-full resize-none rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            {servingLabel && descriptionIsEmpty && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{servingLabel}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
                Best for
              </label>
              <select
                value={values.mealTime}
                onChange={(e) =>
                  set("mealTime", e.target.value as DishFormValues["mealTime"])
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              >
                {MEAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPantryItem"
                checked={values.isPantryItem}
                onChange={(e) => set("isPantryItem", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 dark:text-teal-400 focus:ring-teal-500"
              />
              <label htmlFor="isPantryItem" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Pantry item (free)
              </label>
            </div>
            {numField("Cost", "cost", "0.1", "KSh")}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {numField("Calories", "calories", "1", "kcal")}
            {numField("Carbs", "carbsG", "1", "g")}
            {numField("Protein", "proteinG", "1", "g")}
            {numField("GI", "glycemicIndex", "1", "0-100")}
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Add dish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
