import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { money, MEAL_TIME_LABELS } from '@glucoplate/domain';
import { giBand } from '@glucoplate/domain';
import { apiFetch, apiJson } from '@/lib/api-client';
import DishModal from './DishModal';
import type { Dish, DishFormValues } from '@glucoplate/types';

const FILTERS = [
  { value: "all", label: "All" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
];

export default function DishesScreen() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tempIdRef = useRef(0);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await apiJson('/api/dishes');
        if (!cancelled) setDishes(data.dishes ?? []);
      } catch {
        if (!cancelled) showToast("Failed to load dishes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

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
      const prev = dishes;
      const optimistic = { ...editing, ...values };
      setDishes((ds) => ds.map((d) => (d.id === editing.id ? optimistic : d)));
      setModalOpen(false);
      try {
        const data = await apiJson(`/api/dishes/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        setDishes((ds) => ds.map((d) => (d.id === editing.id ? data.dish : d)));
        showToast("Dish updated.");
        setEditing(null);
      } catch {
        setDishes(prev);
        showToast("Could not update dish.");
      }
    } else {
      const tempId = --tempIdRef.current;
      const optimistic: Dish = {
        id: tempId,
        userId: null,
        createdAt: new Date().toISOString(),
        fatG: 0,
        fiberG: 0,
        servingLabel: "1 serving",
        region: "Kenya",
        isKenyan: false,
        source: "user",
        ...values,
      };
      setDishes((ds) => [optimistic, ...ds]);
      setModalOpen(false);
      try {
        const data = await apiJson("/api/dishes", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setDishes((ds) => ds.map((d) => (d.id === tempId ? data.dish : d)));
        showToast("Dish added to your bucket.");
      } catch {
        setDishes((ds) => ds.filter((d) => d.id !== tempId));
        showToast("Could not add dish.");
      }
    }
  }

  async function handleDelete(dish: Dish) {
    Alert.alert(
      "Remove Dish",
      `Remove "${dish.name}" from your bucket?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
      const prev = [...dishes];
            setDishes((ds) => ds.filter((d) => d.id !== dish.id));
            try {
              await apiFetch(`/api/dishes/${dish.id}`, { method: "DELETE" });
              showToast("Dish removed.");
            } catch {
              setDishes(prev);
              showToast("Could not delete dish.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-4">
        <View className="flex-col gap-4 mb-6">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-2xl font-bold text-slate-900">My Bucket</Text>
              <Text className="text-sm text-slate-500 mt-1">
                Dishes you can afford to prepare.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white"
            >
              <Text className="text-white font-semibold text-sm">+ Add dish</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-col gap-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  className={`rounded-full px-3.5 py-1.5 ${
                    filter === f.value
                      ? "bg-teal-600"
                      : "bg-white border border-slate-200"
                  }`}
                >
                  <Text className={`text-xs font-medium ${filter === f.value ? "text-white" : "text-slate-600"}`}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search dishes…"
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white"
            />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center p-10">
            <ActivityIndicator size="large" color="#0d9488" />
            <Text className="text-slate-500 mt-2">Loading your bucket...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 items-center text-center">
            <Text className="text-4xl mb-3">🧺</Text>
            <Text className="text-lg font-semibold text-slate-800">
              {dishes.length === 0
                ? "Your bucket is empty"
                : "No dishes match your filters"}
            </Text>
            <Text className="mt-1 text-slate-500">
              {dishes.length === 0
                ? "Add the dishes you can prepare within your budget to get started."
                : "Try a different filter or search term."}
            </Text>
            {dishes.length === 0 && (
              <TouchableOpacity
                onPress={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
                className="mt-5 rounded-lg bg-teal-600 px-4 py-2.5 font-semibold"
              >
                <Text className="text-white font-semibold text-sm">+ Add your first dish</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="flex-col gap-4 pb-20">
            {filtered.map((dish) => {
              const band = giBand(dish.glycemicIndex);
              return (
                <View
                  key={dish.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <View className="flex-row justify-between items-start gap-3">
                    <Text className="font-semibold text-slate-900 text-base">{dish.name}</Text>
                    <View className={`rounded-full px-2.5 py-0.5 ${
                      dish.isPantryItem
                        ? "bg-amber-100"
                        : "bg-teal-50"
                    }`}>
                      <Text className={`text-xs font-semibold ${
                        dish.isPantryItem ? "text-amber-700" : "text-teal-700"
                      }`}>
                        {dish.isPantryItem ? "Pantry" : money(dish.cost)}
                      </Text>
                    </View>
                  </View>

                  <Text className="mt-1 text-sm text-slate-500" numberOfLines={2}>
                    {dish.description || "No description"}
                  </Text>

                  <View className="mt-3 flex-row flex-wrap gap-1.5">
                    <View className="rounded-full bg-slate-100 px-2 py-0.5">
                      <Text className="text-xs font-medium text-slate-600">
                        {MEAL_TIME_LABELS[dish.mealTime]}
                      </Text>
                    </View>
                    <View className={`rounded-full px-2 py-0.5 ${band.badge}`}>
                      <Text className={`text-xs font-semibold ${band.badge.includes('teal') ? 'text-teal-700' : 'text-slate-700'}`}>
                        {band.label} · {dish.glycemicIndex}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3 flex-row rounded-lg bg-slate-50 p-2 justify-between">
                    <View className="items-center flex-1">
                      <Text className="text-sm font-bold text-slate-800">{dish.carbsG}g</Text>
                      <Text className="text-[10px] uppercase text-slate-400">Carbs</Text>
                    </View>
                    <View className="items-center flex-1 border-x border-slate-200">
                      <Text className="text-sm font-bold text-slate-800">{dish.proteinG}g</Text>
                      <Text className="text-[10px] uppercase text-slate-400">Protein</Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-sm font-bold text-slate-800">{dish.calories}</Text>
                      <Text className="text-[10px] uppercase text-slate-400">kcal</Text>
                    </View>
                  </View>

                  <View className="mt-4 flex-row gap-2 border-t border-slate-100 pt-3">
                    <TouchableOpacity
                      onPress={() => {
                        setEditing(dish);
                        setModalOpen(true);
                      }}
                      className="flex-1 rounded-lg border border-slate-300 py-2 items-center"
                    >
                      <Text className="text-sm font-medium text-slate-600">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(dish)}
                      className="flex-1 rounded-lg border border-rose-200 py-2 items-center"
                    >
                      <Text className="text-sm font-medium text-rose-600">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
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
          <View className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 px-4 py-2.5 shadow-lg">
            <Text className="text-sm font-medium text-white">{toast}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
