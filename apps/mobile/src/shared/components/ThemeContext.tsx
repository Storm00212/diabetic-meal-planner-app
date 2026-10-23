import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "glucoplate-theme";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  const loadTheme = useCallback(async () => {
    try {
      const saved = await SecureStore.getItemAsync(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
      } else {
        const system = Appearance.getColorScheme() ?? "light";
        setThemeState(system as Theme);
      }
    } catch {
      /* fall back to light */
    } finally {
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    void loadTheme();
  }, [loadTheme]);

  const persistTheme = useCallback(
    async (next: Theme) => {
      try {
        await SecureStore.setItemAsync(STORAGE_KEY, next);
      } catch {
        /* persist failure is non-fatal */
      }
    },
    [],
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      void persistTheme(next);
    },
    [persistTheme],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      void persistTheme(next);
      return next;
    });
  }, [persistTheme]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Returns surface colors for the current theme, drawing on the shared
 * design tokens in @glucoplate/ui.
 */
export function useThemeColors() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    background: isDark ? "#0f172a" : "#f8fafc",
    surface: isDark ? "#1e293b" : "#ffffff",
    border: isDark ? "#334155" : "#cbd5e1",
    text: isDark ? "#f1f5f9" : "#0f172a",
    textMuted: isDark ? "#64748b" : "#64748b",
    brand: isDark ? "#2dd4bf" : "#0d9488",
  } as const;
}

/**
 * React Native scheme name (light/dark) for StatusBar / Appearance consumers.
 */
export function useThemeScheme(): ColorSchemeName {
  const { theme } = useTheme();
  return theme;
}
