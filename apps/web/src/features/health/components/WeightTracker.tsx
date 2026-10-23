"use client";

import { useState, useEffect } from "react";
import { api } from "@/app/api";
import { usePopupTriggers } from "@/shared/components/PopupSystem";
import { Icons } from "@/shared/components/Icons";
import { useNavigate } from "react-router-dom";

export function WeightTracker() {
  const { triggerMilestone } = usePopupTriggers();
  const [weight, setWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [hasLoggedBefore, setHasLoggedBefore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await api.health.weightTargets();
        if (cancelled) return;
        setWeight(data.currentWeight);
        setTargetWeight(data.targetWeight);
        setHasLoggedBefore(data.currentWeight !== null);
      } catch {
        /* leave the fields empty */
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const navigate = useNavigate();

  function openTargetWeightSettings() {
    navigate("/dashboard/settings");
  }

  async function handleLog() {
    if (!input) return;
    const isFirstLog = !hasLoggedBefore;
    await api.health.logWeight({
      weight: parseFloat(input),
      date: new Date().toISOString().slice(0, 10),
    });
    setWeight(parseFloat(input));
    setHasLoggedBefore(true);
    setInput("");
    if (isFirstLog) {
      triggerMilestone("first_weight");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Weight Tracker</h2>
        <Icons.weight className="text-2xl" aria-hidden="true" strokeWidth={2} />
      </div>

      <div className="flex items-end gap-4 mb-8">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase">Current Weight</p>
          <p className="text-4xl font-bold text-slate-900">{weight || "--"} <span className="text-lg font-normal text-slate-500">kg</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-500 uppercase">Target</p>
          <div className="flex items-end gap-1">
            <p className="text-xl font-semibold text-teal-600">
              {targetWeight || "--"}
            </p>
            <span className="text-xs text-slate-400">kg</span>
          </div>
          <button
            onClick={openTargetWeightSettings}
            className="mt-1 text-xs font-medium text-teal-600 hover:underline"
          >
            Set target weight
          </button>
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
          "Based on your current meal plan, you are in a slight caloric deficit. Estimated weight trend: "
          <Icons.trend_down className="inline" size={14} strokeWidth={2} /> 0.2kg / week
        </p>
      </div>
    </div>
  );
}