"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { money } from "@/lib/format";

export function WeightTracker() {
  const [weight, setWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    fetch("/api/user/weight-targets")
      .then(res => res.json())
      .then(data => {
        setWeight(data.currentWeight);
        setTargetWeight(data.targetWeight);
      });
  }, []);

  async function handleLog() {
    if (!input) return;
    await fetch("/api/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: parseFloat(input), date: new Date().toISOString().slice(0, 10) }),
    });
    setWeight(parseFloat(input));
    setInput("");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Weight Tracker</h2>
        <span className="text-2xl">⚖️</span>
      </div>

      <div className="flex items-end gap-4 mb-8">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">Current Weight</p>
          <p className="text-4xl font-bold text-slate-900">{weight || "--"} <span className="text-lg font-normal text-slate-500">kg</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-500 uppercase">Target</p>
          <p className="text-xl font-semibold text-teal-600">{targetWeight || "--"} kg</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter weight (kg)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          onClick={handleLog}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition"
        >
          Log
        </button>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
        <p className="text-sm text-slate-600 italic">
          "Based on your current meal plan, you are in a slight caloric deficit. Estimated weight trend: <span className="text-emerald-600 font-semibold">↓ 0.2kg / week</span>"
        </p>
      </div>
    </div>
  );
}
