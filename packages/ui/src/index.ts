/**
 * @glucoplate/ui
 *
 * Platform-neutral design tokens.
 *
 * The web app maps these into its Tailwind theme; the mobile app maps them
 * into its React Native theme. One source of truth for colour, spacing and
 * typography means the two clients cannot drift apart.
 */

export const palette = {
  brand: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
  },
  emerald: {
    100: "#d1fae5",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
  },
  rose: {
    100: "#ffe4e6",
    500: "#f43f5e",
    600: "#e11d48",
    700: "#be123c",
    800: "#9f1239",
  },
  amber: {
    100: "#fef3c7",
    700: "#b45309",
  },
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  white: "#ffffff",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

/** The Tailwind theme extension the web app applies. */
export const tailwindTheme = {
  colors: {
    brand: {
      50: palette.brand[50],
      100: palette.brand[100],
      200: palette.brand[200],
      300: palette.brand[300],
      400: palette.brand[400],
      500: palette.brand[500],
      600: palette.brand[600],
      700: palette.brand[700],
      800: palette.brand[800],
      900: palette.brand[900],
    },
  },
  borderRadius: {
    md: `${radii.md}px`,
    lg: `${radii.lg}px`,
    xl: `${radii.xl}px`,
  },
} as const;

/** Light-mode color values used by both platforms. */
export const lightColors = {
  brand: palette.brand[600],
  brandLight: palette.brand[100],
  brandDark: palette.brand[800],
  success: palette.emerald[600],
  successLight: palette.emerald[100],
  danger: palette.rose[600],
  dangerLight: palette.rose[100],
  warning: palette.amber[700],
  warningLight: palette.amber[100],
  text: palette.slate[900],
  textMuted: palette.slate[500],
  border: palette.slate[200],
  surface: palette.white,
  background: palette.slate[50],
} as const;

/** Dark-mode color values used by both platforms. */
export const darkColors = {
  brand: palette.brand[400],
  brandLight: palette.brand[900],
  brandDark: palette.brand[300],
  success: palette.emerald[600],
  successLight: palette.emerald[700],
  danger: palette.rose[600],
  dangerLight: palette.rose[800],
  warning: palette.amber[700],
  warningLight: palette.amber[700],
  text: palette.slate[100],
  textMuted: palette.slate[400],
  border: palette.slate[700],
  surface: palette.slate[900],
  background: palette.slate[900],
} as const;

/** The React Native theme object the mobile app applies. */
export const nativeTheme = {
  colors: {
    ...lightColors,
  },
  darkColors,
  lightColors,
  spacing: {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
    "2xl": spacing["2xl"],
    "3xl": spacing["3xl"],
  },
  radius: {
    sm: radii.sm,
    md: radii.md,
    lg: radii.lg,
    xl: radii.xl,
    pill: radii.pill,
  },
} as const;

/**
 * The badge styles for a glycemic index band, in a form both platforms can
 * render (a background colour and a text colour).
 */
export const giBandStyles = {
  low: { background: palette.emerald[100], text: palette.emerald[700], label: "Low GI" },
  medium: { background: palette.amber[100], text: palette.amber[700], label: "Medium GI" },
  high: { background: palette.rose[100], text: palette.rose[700], label: "High GI" },
} as const;

export type GiBandKey = keyof typeof giBandStyles;

export function giBandKey(gi: number): GiBandKey {
  if (gi <= 55) return "low";
  if (gi <= 69) return "medium";
  return "high";
}
