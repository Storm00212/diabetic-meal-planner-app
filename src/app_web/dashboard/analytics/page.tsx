import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Health & Budget Analytics</h1>
        <p className="mt-1 text-slate-500">
          Track your nutritional trends and budget efficiency over time.
        </p>
      </header>
      <AnalyticsClient />
    </div>
  );
}
