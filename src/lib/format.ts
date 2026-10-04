export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatDate(d: string): string {
  const date = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const MEAL_TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Any time",
};
