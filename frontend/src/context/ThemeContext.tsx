/* eslint-disable react-refresh/only-export-components */
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { lightTheme, darkTheme } from '../ui/theme/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'stellar-save-theme';

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (SSR / private browsing)
  }
  return 'system';
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemPref, setSystemPref] = useState<'light' | 'dark'>(getSystemPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => setSystemPref(event.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode === 'system' ? systemPref : mode);
  }, [mode, systemPref]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const resolved = prev === 'system' ? systemPref : prev;
      return resolved === 'dark' ? 'light' : 'dark';
    });
  }, [systemPref]);

  const resolvedMode = useMemo<'light' | 'dark'>(
    () => (mode === 'system' ? systemPref : mode),
    [mode, systemPref]
  );
  const theme = useMemo(() => (resolvedMode === 'dark' ? darkTheme : lightTheme), [resolvedMode]);
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      setMode,
      toggleTheme,
      isDark: resolvedMode === 'dark',
    }),
    [mode, resolvedMode, setMode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the current theme mode and toggle function.
 * Must be used inside `<AppThemeProvider>`.
 */
export function useThemeMode(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useThemeMode must be used inside <AppThemeProvider>.');
  }
  return value;
}

/**
 * Access only the stable toggle function. Consumers of this hook do not
 * re-render when the theme mode changes.
 */
export function useToggleTheme(): () => void {
  return useThemeMode().toggleTheme;
}

export function useTheme(): ThemeContextValue {
  return useThemeMode();
}
