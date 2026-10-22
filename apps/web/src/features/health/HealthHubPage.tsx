"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { MedicalDisclaimer } from "@/shared/components/MedicalDisclaimer";
import { WeightTracker } from "./components/WeightTracker";
import { AskGlucoPlate } from "./components/AskGlucoPlate";

export function HealthHubPage() {
  const [showCelebration, setShowCelebration] = useState(false);

  const triggerCelebration = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#0d9488", "#2dd4bf", "#ffffff"],
    });
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 5000);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Health Hub</h1>
          <p className="text-slate-500">Your biometric tracking and medical support center.</p>
        </div>
        <button
          onClick={triggerCelebration}
          className="text-xs text-teal-600 hover:underline font-medium"
        >
          Test Celebration
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <WeightTracker />
        <AskGlucoPlate />
      </div>

      <div className="bg-teal-50 rounded-2xl p-6 border border-teal-100">
        <h3 className="text-lg font-semibold text-teal-900 mb-2">Health Tips</h3>
        <p className="text-sm text-teal-800 leading-relaxed">
          Consistency is key. Try to log your weight every Monday morning for the most accurate trends.
          Remember to coordinate your carb targets with your healthcare provider.
        </p>
        <MedicalDisclaimer className="mt-4" />
      </div>

      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-teal-500 text-center space-y-4">
              <span className="text-6xl">⭐</span>
              <h2 className="text-3xl font-bold text-slate-900">Congratulations!</h2>
              <p className="text-slate-600">You&apos;ve completed your meal plan for the day!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}