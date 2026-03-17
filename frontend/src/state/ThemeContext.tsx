import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const THEME_STORAGE_KEY = "wp_theme_mode";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedMode === "light" || storedMode === "dark") return storedMode;
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialThemeMode);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDarkMode: mode === "dark",
      toggleTheme: () => setMode((current) => (current === "dark" ? "light" : "dark")),
      setThemeMode: setMode
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }
  return context;
}
