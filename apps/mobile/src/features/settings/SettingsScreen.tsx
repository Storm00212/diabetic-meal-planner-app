import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, SafeAreaView } from "react-native";

import { ACTIVITY_LABELS } from '@glucoplate/domain';
import { api } from '@/lib/api-client';
import type {
  ActivityLevel,
  Sex,
  UpdateSettingsRequest,
} from '@glucoplate/types';

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

/** The portion targets as the API returns them, profile included. */
type PortionTargetsResponse = Awaited<
  ReturnType<typeof api.user.portionTargets>
>;

/** The measurements the portion calculator needs, as the form holds them. */
type PortionPatch = {
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

/** ACTIVITY_LABELS reads "<title> — <hint>", so split it into the two. */
function activityParts(option: ActivityLevel): { title: string; hint: string } {
  const [title, ...rest] = ACTIVITY_LABELS[option].split("—");
  return { title: title.trim(), hint: rest.join("—").trim() };
}

export default function SettingsScreen() {
  const [name, setName] = useState("");
  const [dailyBudget, setDailyBudget] = useState(0);
  const [dailyCarbTarget, setDailyCarbTarget] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The health profile: what the planner has to avoid.
  const [diabetesType, setDiabetesType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // The portion profile: the physical details behind the daily targets.
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [sex, setSex] = useState<Sex>("unspecified");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [targets, setTargets] = useState<PortionTargetsResponse | null>(null);
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
        "Could not load your daily targets right now. Try again in a moment."
      );
    }
  }, []);

  useEffect(() => {
    async function loadSettings() {
      try {
        const user = await api.user.profile();
        setName(user.name || "");
        setDailyBudget(user.dailyBudget || 300);
        setDailyCarbTarget(user.dailyCarbLimit || 200);
        setDiabetesType(user.diabetesType || "");
        setAllergies(user.allergies || "");
        setDislikes(user.dislikes || "");
        setAge(user.age ? String(user.age) : "");
        setHeightCm(user.heightCm ? String(user.heightCm) : "");
        setCurrentWeight(user.currentWeight ? String(user.currentWeight) : "");
        setTargetWeight(user.targetWeight ? String(user.targetWeight) : "");
        setSex(user.sex ?? "unspecified");
        setActivityLevel(user.activityLevel ?? "light");
      } catch {
        console.error("Failed to load settings");
      }
    }

    void loadSettings();
    void loadTargets();
  }, [loadTargets]);

  async function save() {
    setSaving(true);
    try {
      await api.user.updateSettings({ name, dailyBudget, dailyCarbTarget });
      showToast("Settings saved.");
    } catch {
      showToast("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function saveHealthProfile() {
    setHealthSaving(true);
    setHealthError(null);
    try {
      await api.user.updateProfile({ diabetesType, allergies, dislikes });
      showToast("Health profile saved.");
    } catch (err) {
      setHealthError(
        err instanceof Error
          ? err.message
          : "Could not save your health profile."
      );
    } finally {
      setHealthSaving(false);
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileError(null);

    const patch: PortionPatch = {
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
      await api.user.updateSettings(patch as unknown as UpdateSettingsRequest);
      showToast("Portion profile saved.");
      await loadTargets();
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : "Could not save your portion profile."
      );
    } finally {
      setProfileSaving(false);
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
                  <Text className="text-sm font-medium text-slate-700 mb-1">Daily budget (KSh)</Text>
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
                  value={diabetesType}
                  onChangeText={setDiabetesType}
                  placeholder="e.g. Type 2"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Allergies</Text>
                <TextInput
                  value={allergies}
                  onChangeText={setAllergies}
                  placeholder="e.g. Peanuts, Shellfish"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-slate-700 mb-1">Dislikes</Text>
                <TextInput
                  value={dislikes}
                  onChangeText={setDislikes}
                  placeholder="e.g. Mushrooms, Olives"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                />
              </View>

              {healthError && (
                <View className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                  <Text className="text-sm text-rose-700">{healthError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={saveHealthProfile}
                disabled={healthSaving}
                className={`rounded-lg py-3 items-center font-semibold ${healthSaving ? 'bg-slate-400' : 'bg-teal-600'}`}
              >
                <Text className="text-white font-bold">
                  {healthSaving ? "Saving…" : "Save health profile"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Text className="text-lg font-semibold mb-1">Your portion profile</Text>
            <Text className="text-sm text-slate-500 mb-4">
              These details shape the portions on your plate, so the plan fits
              your body and your day.
            </Text>

            <View className="flex-col gap-4">
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-700 mb-1">Age</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={age}
                    onChangeText={setAge}
                    placeholder="e.g. 34"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-700 mb-1">Height (cm)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="e.g. 168"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  />
                </View>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-700 mb-1">Current weight (kg)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={currentWeight}
                    onChangeText={setCurrentWeight}
                    placeholder="e.g. 72"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-700 mb-1">Target weight (kg)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={targetWeight}
                    onChangeText={setTargetWeight}
                    placeholder="e.g. 68"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  />
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-slate-700 mb-2">Sex</Text>
                <View className="flex-row gap-2">
                  {SEX_OPTIONS.map((option) => {
                    const active = sex === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => setSex(option.value)}
                        className={`flex-1 rounded-lg border py-2 items-center ${
                          active
                            ? "bg-teal-600 border-teal-600"
                            : "bg-white border-slate-300"
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            active ? "text-white" : "text-slate-600"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-slate-700 mb-2">Activity level</Text>
                <View className="flex-col gap-2">
                  {ACTIVITY_OPTIONS.map((option) => {
                    const active = activityLevel === option;
                    const { title, hint } = activityParts(option);
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setActivityLevel(option)}
                        className={`rounded-lg border px-3 py-2 ${
                          active
                            ? "border-teal-500 bg-teal-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <View className="flex-row items-center gap-2">
                          <View
                            className={`h-4 w-4 rounded-full border items-center justify-center ${
                              active ? "border-teal-600" : "border-slate-300"
                            }`}
                          >
                            {active ? (
                              <View className="h-2 w-2 rounded-full bg-teal-600" />
                            ) : null}
                          </View>
                          <Text
                            className={`text-sm font-semibold ${
                              active ? "text-teal-800" : "text-slate-700"
                            }`}
                          >
                            {title}
                          </Text>
                        </View>
                        <Text className="text-xs text-slate-500 mt-0.5 ml-6">
                          {hint}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {profileError && (
                <View className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                  <Text className="text-sm text-rose-700">{profileError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={saveProfile}
                disabled={profileSaving}
                className={`rounded-lg py-3 items-center font-semibold ${profileSaving ? 'bg-slate-400' : 'bg-teal-600'}`}
              >
                <Text className="text-white font-bold">
                  {profileSaving ? "Saving…" : "Save portion profile"}
                </Text>
              </TouchableOpacity>

              {/* The targets those details produce */}
              <View className="border-t border-slate-100 pt-5">
                <Text className="text-sm font-semibold text-slate-900">
                  Your daily targets
                </Text>

                {targetsError && (
                  <Text className="mt-2 text-xs text-rose-600">{targetsError}</Text>
                )}

                {targets && (
                  <>
                    <View className="mt-3 flex-row flex-wrap gap-3">
                      <TargetStat label="Calories" value={targets.calories} unit="kcal" />
                      <TargetStat label="Carbs" value={targets.carbsG} unit="g" />
                      <TargetStat label="Protein" value={targets.proteinG} unit="g" />
                      <TargetStat label="Fat" value={targets.fatG} unit="g" />
                    </View>
                    <Text className="mt-3 text-xs text-slate-500 leading-relaxed">
                      {targets.basis}
                    </Text>
                    {!targets.personalised && (
                      <View className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <Text className="text-xs text-amber-700 leading-relaxed">
                          These are general adult targets. Add your age, height,
                          weight and activity level to personalise the plan around
                          you.
                        </Text>
                      </View>
                    )}
                  </>
                )}
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
    <View className="flex-1 min-w-[120px] rounded-xl bg-slate-50 p-3">
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
      <Text className="text-lg font-bold text-slate-800">
        {value}
        <Text className="ml-1 text-xs font-medium text-slate-400">{unit}</Text>
      </Text>
    </View>
  );
}
