"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

type Message = {
  role: "user" | "ai";
  text: string;
  disclaimer?: string;
};

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Hello! I can help you find evidence-based dietary information. What would you like to know today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg.text }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: "ai",
        text: data.answer,
        disclaimer: data.disclaimer
      } as Message]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "ai", text: "Sorry, I'm having trouble connecting to my sources right now." } as Message]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-[450px]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Medical Assistant</h2>
        <span className="text-2xl">🤖</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              m.role === "user"
                ? "bg-teal-600 text-white rounded-tr-none"
                : "bg-slate-100 text-slate-700 rounded-tl-none"
            }`}>
              {m.text}
              {m.role === "ai" && m.disclaimer && (
                <p className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-400 italic">
                  {m.disclaimer}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-2 text-sm text-slate-400 animate-pulse">
              Searching verified sources...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about nutrients or foods..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition disabled:opacity-60"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
