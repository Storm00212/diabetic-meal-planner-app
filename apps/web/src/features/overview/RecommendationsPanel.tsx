import { useEffect, useState } from "react";
import { api } from "@/app/api";
import type { RecommendationResponse } from "@glucoplate/types";
import { Icons } from "@/shared/components/Icons";

export function RecommendationsPanel() {
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.llm.recommendation();
      setRecommendation(data);
    } catch {
      setError("Could not load recommendation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="skeleton h-5 w-1/4 rounded" />
        </div>
        <div className="mt-3 skeleton h-12 w-full rounded" />
        <div className="mt-2 skeleton h-8 w-3/4 rounded" />
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 text-center">No recommendation available right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icons.spark size={22} strokeWidth={2} />
        <h3 className="text-lg font-semibold text-teal-900 dark:text-teal-300">Your Recommendation</h3>
        {recommendation.fallback && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
            Cached
          </span>
        )}
      </div>
      <p className="text-teal-800 dark:text-teal-200">{recommendation.recommendation}</p>
      <details className="mt-3">
        <summary className="text-xs text-teal-600 dark:text-teal-400 cursor-pointer">Show facts used</summary>
        <pre className="mt-2 text-[10px] text-teal-700 dark:text-teal-300 bg-white/50 dark:bg-slate-800/20 p-3 rounded overflow-x-auto whitespace-pre-wrap">
          {recommendation.facts}
        </pre>
      </details>
      <p className="mt-3 text-xs text-teal-600 dark:text-teal-400">{recommendation.notice}</p>
    </div>
  );
}
