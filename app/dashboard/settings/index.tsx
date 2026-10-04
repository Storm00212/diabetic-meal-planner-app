import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/lib/mobile/api-client';

export default function SettingsScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dailyBudget, setDailyBudget] = useState(0);
  const [dailyCarbTarget, setDailyCarbTarget] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const user = await apiFetch('/api/user/profile');
        setName(user.name || "");
        setDailyBudget(user.dailyBudget || 20);
        setDailyCarbTarget(user.dailyCarbTarget || 150);
      } catch {
        console.error("Failed to load settings");
      }
    }
    loadSettings();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ name, dailyBudget, dailyCarbTarget }),
      });
      showToast("Settings saved.");
    } catch {
      showToast("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-4">
        <View className="flex-col gap-6">
          <View>
            <Text className="text-2xl font-bold text-slate-900">Settings</Text>
            <Text className="text-sm text-slate-500 mt-1">
              Update your profile, daily budget, and carb target.
            </Text>
          </View>

          <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <View className="flex-col gap-4">
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Full name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-700 mb-1">Daily budget ($)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(dailyBudget)}
                    onChangeText={(t) => setDailyBudget(Number(t))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-700 mb-1">Daily carb target (g)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(dailyCarbTarget)}
                    onChangeText={(t) => setDailyCarbTarget(Number(t))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  />
                </View>
              </View>

              <View className="rounded-xl bg-teal-50 p-4">
                <Text className="text-xs text-teal-800 leading-relaxed">
                  🩺 Always coordinate your budget and carb targets with your doctor or
                  dietitian. GlucoPlate is a planning aid, not medical advice.
                </Text>
              </View>

              <TouchableOpacity
                onPress={save}
                disabled={saving}
                className={`rounded-lg py-3 items-center font-semibold ${saving ? 'bg-slate-400' : 'bg-teal-600'}`}
              >
                <Text className="text-white font-bold">
                  {saving ? "Saving…" : "Save changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Text className="text-lg font-semibold mb-4">Health Profile</Text>
            <View className="flex-col gap-4">
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Diabetes Type</Text>
                <TextInput
                  placeholder="e.g. Type 2"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Allergies</Text>
                <TextInput
                  placeholder="e.g. Peanuts, Shellfish"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Dislikes</Text>
                <TextInput
                  placeholder="e.g. Mushrooms, Olives"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
            </View>
          </View>
        </View>

        {toast && (
          <View className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 px-4 py-2.5 shadow-lg">
            <Text className="text-sm font-medium text-white">{toast}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
