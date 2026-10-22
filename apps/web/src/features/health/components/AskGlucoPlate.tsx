import { useState, useRef, useEffect } from "react";
import { api } from "@/app/api";
import type { AskResponse } from "@glucoplate/types";

type Message = { role: "user" | "assistant"; text: string; fallback?: boolean };

export function AskGlucoPlate() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setError(null);

    const userMsg: Message = { role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await api.llm.ask({ question });
      const assistantMsg: Message = {
        role: "assistant",
        text: data.answer,
        fallback: data.fallback,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.disclaimer) setShowDisclaimer(true);
    } catch {
      setError("Could not get answer. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const suggestedQuestions = [
    "How do I set my daily budget?",
    "What is glycemic index?",
    "How do I add a dish to my bucket?",
    "What does premium unlock?",
    "How do I log my weight?",
    "Can I swap a dish in my plan?",
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🤖</span>
        <h3 className="text-lg font-semibold text-slate-900">Ask GlucoPlate</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2" style={{ maxHeight: 320 }}>
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <p className="font-medium">Ask about the app, Kenyan diet, or diabetes meal planning.</p>
            <p className="text-xs mt-1">I cannot answer medication, insulin, or diagnosis questions.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-3 ${
                msg.role === "user"
                  ? "bg-teal-600 text-white rounded-br-none"
                  : "bg-slate-100 text-slate-900 rounded-bl-none"
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              {msg.fallback && msg.role === "assistant" && (
                <span className="block mt-1 text-[10px] opacity-70">Cached response</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {showDisclaimer && (
        <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-800">
            Disclaimer: I am an AI, not a doctor. Please consult your healthcare provider before making dietary changes.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about budget, carbs, GI, weight, planning..."
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {loading ? "..." : "Ask"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setInput(q);
                handleSubmit({ preventDefault: () => {} } as React.FormEvent);
              }}
              disabled={loading}
              className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}