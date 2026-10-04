"use client";

import React, { useState, useEffect } from "react";

export default function ProfileForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    diabetesType: "type2",
    allergies: "",
    dislikes: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
      }
    }
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold">Health Profile</h3>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Diabetes Type</label>
        <select
          value={formData.diabetesType}
          onChange={(e) => setFormData({ ...formData, diabetesType: e.target.value })}
          className="w-full p-2 border rounded"
        >
          <option value="type1">Type 1</option>
          <option value="type2">Type 2</option>
          <option value="gestational">Gestational</option>
          <option value="prediabetes">Prediabetes</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Allergies</label>
        <input
          type="text"
          value={formData.allergies}
          onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          className="w-full p-2 border rounded"
          placeholder="e.g. Peanuts, Shellfish"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Dislikes</label>
        <input
          type="text"
          value={formData.dislikes}
          onChange={(e) => setFormData({ ...formData, dislikes: e.target.value })}
          className="w-full p-2 border rounded"
          placeholder="e.g. Mushrooms, Olives"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
      >
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
