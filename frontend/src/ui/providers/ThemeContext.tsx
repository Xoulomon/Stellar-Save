import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { lightTheme, darkTheme } from "../theme/theme";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  /** Resolved mode actually applied ("light" | "dark") */
  resolvedMode: "light" | "dark";
  /** User preference including "system" option */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "stellar-save-theme";

function getSystemPreference(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? getSystemPreference() : mode;
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable (SSR / private browsing)
  }
  return "system";
}

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemPref, setSystemPref] = useState<"light" | "dark">(
    getSystemPreference
  );

  // Keep system preference in sync
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setSystemPref(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const resolved = prev === "system" ? systemPref : prev;
      return resolved === "dark" ? "light" : "dark";
    });
  }, [setMode, systemPref]);

  const resolvedMode = useMemo<"light" | "dark">(
    () => (mode === "system" ? systemPref : mode),
    [mode, systemPref]
  );

  const muiTheme = resolvedMode === "dark" ? darkTheme : lightTheme;

  // Apply data-theme attribute so plain CSS can react to it
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedMode);
  }, [resolvedMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedMode,
      mode,
      setMode,
      toggleTheme,
      isDark: resolvedMode === "dark",
    }),
    [resolvedMode, mode, setMode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
