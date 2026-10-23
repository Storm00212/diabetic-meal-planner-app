"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/app/api";

export default function ProfileForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    diabetesType: "type2",
    allergies: "",
    dislikes: "",
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api.user.profile();
        setFormData({
          diabetesType: data.diabetesType ?? "none",
          allergies: data.allergies ?? "",
          dislikes: data.dislikes ?? "",
        });
      } catch {
        /* keep the defaults */
      }
    }
    void loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.user.updateProfile(formData);
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Health Profile</h3>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Diabetes Type</label>
        <select
          value={formData.diabetesType}
          onChange={(e) => setFormData({ ...formData, diabetesType: e.target.value })}
          className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
        >
          <option value="type1">Type 1</option>
          <option value="type2">Type 2</option>
          <option value="gestational">Gestational</option>
          <option value="prediabetes">Prediabetes</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Allergies</label>
        <input
          type="text"
          value={formData.allergies}
          onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          placeholder="e.g. Peanuts, Shellfish"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Dislikes</label>
        <input
          type="text"
          value={formData.dislikes}
          onChange={(e) => setFormData({ ...formData, dislikes: e.target.value })}
          className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          placeholder="e.g. Mushrooms, Olives"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
