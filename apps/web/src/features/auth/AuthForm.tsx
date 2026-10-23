"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import { Icons } from "@/shared/components/Icons";

export function AuthForm() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp({ name, email, password });
      }
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error. Please try again.",
      );
      setLoading(false);
    }
  }

  async function fillDemo() {
    setError(null);
    setLoading(true);
    // Try to log into the seeded demo account, otherwise create it
    const creds = { email: "demo@glucoplate.app", password: "demo123" };
    try {
      await signIn(creds.email, creds.password);
    } catch {
      try {
        await signUp({ name: "Demo Patient", ...creds });
      } catch {
        setError("Could not start demo. Try again.");
        setLoading(false);
        return;
      }
    }
    navigate("/dashboard");
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="mb-8 lg:hidden flex items-center gap-2 text-2xl font-bold text-teal-700">
        <Icons.bucket_card size={24} strokeWidth={2} /> GlucoPlate
      </div>

      <h2 className="text-2xl font-bold text-slate-900">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h2>
      <p className="mt-1 text-slate-500">
        {mode === "login"
          ? "Log in to plan today's meals."
          : "Start planning affordable, sugar-safe meals."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {mode === "register" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>

      <button
        onClick={fillDemo}
        disabled={loading}
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        <Icons.spark size={18} strokeWidth={2} className="mr-2" /> Explore the demo account
      </button>

      <p className="mt-6 text-center text-sm text-slate-500">
        {mode === "login" ? "New to GlucoPlate?" : "Already have an account?"}{" "}
        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          className="font-semibold text-teal-600 hover:text-teal-700"
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </div>
  );
}
