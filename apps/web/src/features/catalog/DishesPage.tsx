"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dish, DishFormValues } from "@glucoplate/types";
import { money, MEAL_TIME_LABELS, giBand } from "@glucoplate/domain";
import { api } from "@/app/api";
import DishModal from "./components/DishModal";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
];

export function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await api.catalog.list();
        if (!cancelled) setDishes(data.dishes ?? []);
      } catch {
        if (!cancelled) showToast("Failed to load dishes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      const matchesFilter = filter === "all" || d.mealTime === filter;
      const matchesSearch = d.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [dishes, filter, search]);

  async function handleSubmit(values: DishFormValues) {
    if (editing) {
      // optimistic update
      const prev = dishes;
      const optimistic = { ...editing, ...values };
      setDishes((ds) => ds.map((d) => (d.id === editing.id ? optimistic : d)));
      setModalOpen(false);
      try {
        const data = await api.catalog.update(editing.id, values);
        setDishes((ds) => ds.map((d) => (d.id === editing.id ? data.dish : d)));
        showToast("Dish updated.");
        setEditing(null);
      } catch {
        setDishes(prev);
        showToast("Could not update dish.");
      }
    } else {
      // optimistic add with temp id
      const tempId = -Date.now();
      const optimistic: Dish = {
        id: tempId,
        userId: null,
        createdAt: new Date().toISOString(),
        fatG: 0,
        fiberG: 0,
        region: "Kenya",
        isKenyan: false,
        source: "user",
        servingLabel: "",
        ...values,
      };
      setDishes((ds) => [optimistic, ...ds]);
      setModalOpen(false);
      try {
        const data = await api.catalog.create(values);
        setDishes((ds) => ds.map((d) => (d.id === tempId ? data.dish : d)));
        showToast("Dish added to your bucket.");
      } catch {
        setDishes((ds) => ds.filter((d) => d.id !== tempId));
        showToast("Could not add dish.");
      }
    }
  }

  async function handleDelete(dish: Dish) {
    if (!confirm(`Remove "${dish.name}" from your bucket?`)) return;
    const prev = dishes;
    setDishes((ds) => ds.filter((d) => d.id !== dish.id));
    try {
      await api.catalog.remove(dish.id);
      showToast("Dish removed.");
    } catch {
      setDishes(prev);
      showToast("Could not delete dish.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-in space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Bucket</h1>
          <p className="mt-1 text-slate-500">
            Dishes you can afford to prepare. Add as many as you like — the
            planner picks the safest, cheapest options for each meal.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-700"
        >
          + Add dish
        </button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-teal-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dishes…"
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 sm:w-64"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="skeleton h-5 w-2/3 rounded" />
              <div className="skeleton mt-3 h-3 w-full rounded" />
              <div className="skeleton mt-2 h-3 w-4/5 rounded" />
              <div className="skeleton mt-6 h-8 w-full rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🧺</div>
          <p className="mt-3 text-lg font-semibold text-slate-800">
            {dishes.length === 0
              ? "Your bucket is empty"
              : "No dishes match your filters"}
          </p>
          <p className="mt-1 text-slate-500">
            {dishes.length === 0
              ? "Add the dishes you can prepare within your budget to get started."
              : "Try a different filter or search term."}
          </p>
          {dishes.length === 0 && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="mt-5 rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700"
            >
              + Add your first dish
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((dish) => {
            const band = giBand(dish.glycemicIndex);
            return (
              <div
                key={dish.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{dish.name}</h3>
                    {dish.servingLabel && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {dish.servingLabel}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    dish.isPantryItem
                      ? "bg-amber-100 text-amber-700"
                      : "bg-teal-50 text-teal-700"
                  }`}>
                    {dish.isPantryItem ? "Pantry" : money(dish.cost)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">
                  {dish.description || "No description"}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {MEAL_TIME_LABELS[dish.mealTime]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${band.badge}`}
                  >
                    {band.label} · {dish.glycemicIndex}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {dish.carbsG}g
                    </p>
                    <p className="text-[10px] uppercase text-slate-400">Carbs</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {dish.proteinG}g
                    </p>
                    <p className="text-[10px] uppercase text-slate-400">
                      Protein
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {dish.calories}
                    </p>
                    <p className="text-[10px] uppercase text-slate-400">kcal</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => {
                      setEditing(dish);
                      setModalOpen(true);
                    }}
                    className="flex-1 rounded-lg border border-slate-300 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(dish)}
                    className="flex-1 rounded-lg border border-rose-200 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DishModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
