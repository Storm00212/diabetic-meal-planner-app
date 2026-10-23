/**
 * Lucide icon replacements for emojis.
 * Use these instead of emoji characters for consistent rendering.
 */

import * as Lucide from "lucide-react";

export const Icons = {
  // Theme
  themeLight: Lucide.Sun,
  themeDark: Lucide.Moon,

  // Navigation / Layout
  bucket: Lucide.Folder,
  planner: Lucide.Utensils,
  plans: Lucide.Calendar,
  analytics: Lucide.BarChart,
  health: Lucide.Hospital,
  settings: Lucide.Settings,

  // Meal slots
  morning: Lucide.Sun,
  afternoon: Lucide.Sun,
  evening: Lucide.Moon,

  // Actions
  generate: Lucide.Zap,
  regenerate: Lucide.RefreshCw,
  save: Lucide.Save,
  add: Lucide.Plus,
  edit: Lucide.Edit,
  delete: Lucide.Trash2,
  swap: Lucide.Shuffle,

  // Status
  success: Lucide.Check,
  error: Lucide.X,
  warning: Lucide.AlertTriangle,
  info: Lucide.Info,

  // Health
  weight: Lucide.Scale,
  target: Lucide.Target,
  trend_up: Lucide.ChevronUp,
  trend_down: Lucide.ChevronDown,
  trend_stable: Lucide.Minus,

  // AI
  ai: Lucide.Bot,
  spark: Lucide.Lightbulb,
  star: Lucide.Star,

  // Dashboard cards
  budget: Lucide.Wallet,
  carbs: Lucide.Droplet,
  calendar: Lucide.Calendar,
  bucket_card: Lucide.Folder,

  // Misc
  tip: Lucide.Lightbulb,
  celebrate: Lucide.PartyPopper,
  confetti: Lucide.Sparkles,
  search: Lucide.Search,
  filter: Lucide.Filter,
  close: Lucide.X,
  check: Lucide.Check,
  chevron_down: Lucide.ChevronDown,
  chevron_up: Lucide.ChevronUp,
  chevron_left: Lucide.ChevronLeft,
  chevron_right: Lucide.ChevronRight,
  menu: Lucide.Menu,
  stethoscope: Lucide.Stethoscope,
} as const;

export type IconKey = keyof typeof Icons;

/**
 * Get icon component by key with fallback to nothing.
 */
export function getIcon(key: IconKey): typeof Icons[IconKey] {
  return Icons[key];
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
    menu: "Menu",
    stethoscope: "Medical disclaimer",
    themeLight: "Switch to light mode",
    themeDark: "Switch to dark mode",
  };
  return labels[key] ?? key;
}
