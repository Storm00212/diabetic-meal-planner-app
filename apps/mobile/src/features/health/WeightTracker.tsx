import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { apiFetch, apiJson } from '@/lib/api-client';

export function WeightTracker() {
  const [weight, setWeight] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadWeight() {
      try {
        const data = await apiJson("/api/user/weight-targets");
        setCurrent(data.currentWeight);
        setTarget(data.targetWeight);
      } catch (err) {
        console.error("Failed to load weight data", err);
      }
    }
    loadWeight();
  }, []);

  async function handleUpdate() {
    if (!weight || isNaN(Number(weight))) {
      Alert.alert("Invalid input", "Please enter a valid number for weight.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/weight", {
        method: "POST",
        body: JSON.stringify({ weight: Number(weight) }),
      });
      setCurrent(Number(weight));
      Alert.alert("Success", "Weight updated successfully.");
      setWeight("");
    } catch {
      Alert.alert("Error", "Could not update weight.");
    } finally {
      setLoading(false);
    }
  }

  const diff = (current !== null && target !== null)
    ? (current - target).toFixed(1)
    : null;

  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-lg font-bold text-slate-900">Weight Tracking</Text>
        <Text className="text-2xl">⚖️</Text>
      </View>

      <View className="flex-row justify-between items-center bg-slate-50 rounded-xl p-4 mb-6">
        <View className="items-center">
          <Text className="text-xs text-slate-500 uppercase font-semibold">Current</Text>
          <Text className="text-xl font-bold text-slate-900">{current ? `${current} kg` : "---"}</Text>
        </View>
        <View className="h-8 w-px bg-slate-200" />
        <View className="items-center">
          <Text className="text-xs text-slate-500 uppercase font-semibold">Target</Text>
          <Text className="text-xl font-bold text-slate-900">{target ? `${target} kg` : "---"}</Text>
        </View>
        <View className="h-8 w-px bg-slate-200" />
        <View className="items-center">
          <Text className="text-xs text-slate-500 uppercase font-semibold">Diff</Text>
          <Text className={`text-xl font-bold ${Number(diff) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {diff ? `${Number(diff) > 0 ? '+' : ''}${diff} kg` : "---"}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <TextInput
          value={weight}
          onChangeText={setWeight}
          placeholder="New weight (kg)"
          keyboardType="numeric"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 bg-white"
        />
        <TouchableOpacity
          onPress={handleUpdate}
          disabled={loading}
          className={`rounded-lg px-4 py-2 font-semibold ${loading ? 'bg-slate-400' : 'bg-teal-600'}`}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-bold">Update</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
