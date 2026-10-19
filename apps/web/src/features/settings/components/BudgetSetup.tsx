"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/app/api";
import type { BudgetPeriod } from "@glucoplate/types";

export default function BudgetSetup() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    budgetAmount: 300,
    budgetPeriod: "daily" as BudgetPeriod,
    budgetCurrency: "KES",
    paydayDate: "",
  });

  useEffect(() => {
    async function loadBudget() {
      try {
        const data = await api.user.budget();
        setFormData({
          ...data,
          budgetPeriod: data.budgetPeriod as BudgetPeriod,
          paydayDate: data.paydayDate
            ? new Date(data.paydayDate).toISOString().split("T")[0]
            : "",
        });
      } catch {
        /* keep the defaults */
      }
    }
    void loadBudget();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.user.updateBudget(formData);
      alert("Budget updated successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold">Budget Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Total Budget Amount</label>
          <input
            type="number"
            value={formData.budgetAmount}
            onChange={(e) => setFormData({ ...formData, budgetAmount: parseFloat(e.target.value) })}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Currency</label>
          <input
            type="text"
            value={formData.budgetCurrency}
            onChange={(e) => setFormData({ ...formData, budgetCurrency: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Budget Period</label>
        <select
          value={formData.budgetPeriod}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    budgetPeriod: e.target.value as BudgetPeriod,
                  })
                }
          className="w-full p-2 border rounded"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="until_payday">Until Next Payday</option>
        </select>
      </div>
      {formData.budgetPeriod === "until_payday" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Next Payday Date</label>
          <input
            type="date"
            value={formData.paydayDate}
            onChange={(e) => setFormData({ ...formData, paydayDate: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-300"
      >
        {loading ? "Saving..." : "Save Budget"}
      </button>
    </form>
  );
}
