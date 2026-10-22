/**
 * Simple text-based icon replacements for emojis.
 * Use these instead of emoji characters for consistent rendering.
 */

export const Icons = {
  // Navigation / Layout
  bucket: "🧺",
  planner: "🍽️",
  plans: "📅",
  analytics: "📊",
  health: "🏥",
  settings: "⚙️",
  
  // Meal slots
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌙",
  
  // Actions
  generate: "⚡",
  regenerate: "🔄",
  save: "💾",
  add: "+",
  edit: "✏️",
  delete: "🗑️",
  swap: "⇄",
  
  // Status
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
  
  // Health
  weight: "⚖️",
  target: "🎯",
  trend_up: "▲",
  trend_down: "▼",
  trend_stable: "●",
  
  // AI
  ai: "🤖",
  spark: "💡",
  star: "⭐",
  
  // Dashboard cards
  budget: "💰",
  carbs: "🩸",
  calendar: "📅",
  bucket_card: "🧺",
  
  // Misc
  tip: "💡",
  celebrate: "🎉",
  confetti: "✨",
  search: "🔍",
  filter: "🔽",
  close: "✕",
  check: "✓",
  chevron_down: "▼",
  chevron_up: "▲",
  chevron_left: "◀",
  chevron_right: "▶",
} as const;

export type IconKey = keyof typeof Icons;

/**
 * Get icon by key with fallback.
 */
export function getIcon(key: IconKey): string {
  return Icons[key] ?? "";
}

/**
 * For accessibility: returns aria-label for icon.
 */
export function iconLabel(key: IconKey): string {
  const labels: Record<IconKey, string> = {
    bucket: "My Bucket",
    planner: "Meal Planner",
    plans: "Saved Plans",
    analytics: "Analytics",
    health: "Health Hub",
    settings: "Settings",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    generate: "Generate",
    regenerate: "Regenerate",
    save: "Save",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    swap: "Swap",
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
    weight: "Weight",
    target: "Target",
    trend_up: "Trending Up",
    trend_down: "Trending Down",
    trend_stable: "Stable",
    ai: "AI Assistant",
    spark: "Tip",
    star: "Star",
    budget: "Budget",
    carbs: "Carbs",
    calendar: "Calendar",
    bucket_card: "Bucket",
    tip: "Tip",
    celebrate: "Celebrate",
    confetti: "Confetti",
    search: "Search",
    filter: "Filter",
    close: "Close",
    check: "Check",
    chevron_down: "Expand",
    chevron_up: "Collapse",
    chevron_left: "Back",
    chevron_right: "Forward",
  };
  return labels[key] ?? key;
}