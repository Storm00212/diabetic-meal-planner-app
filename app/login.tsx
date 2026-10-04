import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { apiFetch, setAuthToken } from '@/lib/mobile/api-client';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password || (mode === 'register' && !name)) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login" ? { email, password } : { name, email, password };

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      // Save token to SecureStore
      if (data.token) {
        await setAuthToken(data.token);
      }

      router.replace("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fillDemo() {
    setError(null);
    setLoading(true);
    const creds = { email: "demo@glucoplate.app", password: "demo123" };

    try {
      let res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(creds),
      });

      if (!res.ok) {
        res = await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name: "Demo Patient", ...creds }),
        });
      }

      const data = await res.json();
      if (res.ok && data.token) {
        await setAuthToken(data.token);
        router.replace("/dashboard");
      } else {
        setError("Could not start demo. Try again.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-6 justify-center">
        <View className="mb-8 items-center">
          <Text className="text-3xl">🍽️</Text>
          <Text className="text-2xl font-bold text-teal-700">GlucoPlate</Text>
        </View>

        <View className="mb-8">
          <Text className="text-2xl font-bold text-slate-900">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </Text>
          <Text className="mt-1 text-slate-500">
            {mode === "login"
              ? "Log in to plan today's meals."
              : "Start planning affordable, sugar-safe meals."}
          </Text>
        </View>

        <View className="space-y-4">
          {mode === "register" && (
            <View>
              <Text className="text-sm font-medium text-slate-700 mb-1">Full name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              />
            </View>
          )}
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
            />
          </View>

          {error && (
            <View className="rounded-lg bg-rose-50 border border-rose-200 p-3">
              <Text className="text-sm text-rose-700">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-teal-600 py-3 items-center"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white text-base">
                {mode === "login" ? "Log in" : "Create account"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={fillDemo}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 py-3 items-center bg-white"
          >
            <Text className="font-medium text-slate-700 text-base">✨ Explore the demo account</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-6 items-center">
          <TouchableOpacity
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            <Text className="text-sm text-slate-500">
              {mode === "login" ? "New to GlucoPlate?" : "Already have an account?"}{" "}
              <Text className="font-semibold text-teal-600">
                {mode === "login" ? "Create an account" : "Log in"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
