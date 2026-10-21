import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal } from "react-native";
import { Sparkles } from 'lucide-react-native';
import type { Dish, DishFormValues } from '@glucoplate/types';


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

  async function fetchNutrients() {
    if (!values.name.trim()) {
      setError("Please enter a dish name first.");
      return;
    }
    setFetchingNutrients(true);
    setError(null);
    try {
      const res = await fetch(`/api/nutrients?query=${encodeURIComponent(values.name)}`);
      if (!res.ok) throw new Error("Failed to fetch nutrients");
      const data = await res.json();

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

  function setFieldValue<K extends keyof DishFormValues>(key: K, val: DishFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  /**
   * The serving the catalogue recorded for this dish, e.g. "1 chapati (60 g)".
   * It stands in for the description when the dish has none.
   */
  const servingLabel = editing?.servingLabel?.trim() ?? "";
  const descriptionIsEmpty = values.description.trim() === "";

  async function handleFormSubmit() {
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

  const renderNumField = (
    label: string,
    key: keyof DishFormValues,
    suffix?: string,
  ) => (
    <View className="flex-1">
      <Text className="text-sm font-medium text-slate-700 mb-1">
        {label}
        {suffix ? <Text className="text-slate-400"> ({suffix})</Text> : null}
      </Text>
      <TextInput
        keyboardType="numeric"
        value={String(values[key])}
        onChangeText={(text) => setFieldValue(key, Number(text) as any)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      />
    </View>
  );

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-slate-900/40 p-0 sm:p-4">
        <View className="w-full max-w-lg mx-auto bg-white rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-bold text-slate-900">
              {editing ? "Edit dish" : "Add a dish to your bucket"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-1.5"
            >
              <Text className="text-slate-400 text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="mt-5 space-y-4">
            <View className="relative">
              <Text className="text-sm font-medium text-slate-700 mb-1">Dish name</Text>
              <View className="flex-row items-center">
                <TextInput
                  value={values.name}
                  onChangeText={(text) => setFieldValue("name", text)}
                  placeholder="e.g. Grilled Chicken Salad"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                <TouchableOpacity
                  onPress={fetchNutrients}
                  disabled={fetchingNutrients}
                  className="ml-2 p-2"
                >
                  <Sparkles size={20} color={fetchingNutrients ? "#94a3b8" : "#0d9488"} />
                </TouchableOpacity>
              </View>
              {servingLabel && !descriptionIsEmpty ? (
                <Text className="mt-1 text-xs text-slate-400">{servingLabel}</Text>
              ) : null}
            </View>

            <View>
              <Text className="text-sm font-medium text-slate-700 mb-1">Description</Text>
              <TextInput
                value={values.description}
                onChangeText={(text) => setFieldValue("description", text)}
                multiline
                numberOfLines={2}
                placeholder="Short note about the dish"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              {servingLabel && descriptionIsEmpty ? (
                <Text className="mt-1 text-xs text-slate-400">{servingLabel}</Text>
              ) : null}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-700 mb-1">Best for</Text>
                {/* In a real app, we would use @react-native-picker/picker here.
                    For this conversion, we'll use a simple text-based selection or just a TextInput for brevity
                    unless the user specifically wants the Picker implementation.
                    Using a simple implementation for now. */}
                <TextInput
                  value={values.mealTime}
                  onChangeText={(text) => setFieldValue("mealTime", text as any)}
                  placeholder="morning, afternoon, evening, any"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </View>
              <View className="flex-1 flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => setFieldValue("isPantryItem", !values.isPantryItem)}
                  className="flex-row items-center gap-2"
                >
                  <View className={`h-4 w-4 rounded border ${values.isPantryItem ? 'bg-teal-600 border-teal-600' : 'border-slate-300'}`} />
                  <Text className="text-sm font-medium text-slate-700">Pantry Item (Free)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row gap-3">
              {renderNumField("Cost", "cost", "KSh")}
            </View>

            <View className="flex-row gap-3">
              {renderNumField("Calories", "calories", "kcal")}
              {renderNumField("Carbs", "carbsG", "g")}
              {renderNumField("Protein", "proteinG", "g")}
              {renderNumField("GI", "glycemicIndex", "0-100")}
            </View>

            {error && (
              <View className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                <Text className="text-sm text-rose-700">{error}</Text>
              </View>
            )}

            <View className="flex-row justify-end gap-3 pt-2">
              <TouchableOpacity
                onPress={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2"
              >
                <Text className="text-sm font-medium text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFormSubmit}
                disabled={saving}
                className={`rounded-lg px-4 py-2 ${saving ? 'bg-slate-400' : 'bg-teal-600'}`}
              >
                <Text className="text-sm font-semibold text-white">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add dish"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
