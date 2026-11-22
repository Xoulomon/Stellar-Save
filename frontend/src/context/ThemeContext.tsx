/**
 * ThemeContext — Issue #772
 *
 * Provides a dark/light mode toggle that:
 * - Persists the user's preference in localStorage
 * - Exposes `mode` and `toggleTheme` to the whole app
 * - Wraps MUI ThemeProvider with the correct theme object
 */
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

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

// Split by concern: `mode` changes on toggle, while `toggleTheme` is stable, so
// components that only toggle don't re-render when the mode changes.
const ThemeModeContext = createContext<ThemeMode | undefined>(undefined);
const ThemeToggleContext = createContext<(() => void) | undefined>(undefined);

const STORAGE_KEY = 'stellar-save:theme-mode';

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      // localStorage unavailable (SSR / private browsing)
    }
    return 'light';
  });

  // Persist preference whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  return (
    <ThemeToggleContext.Provider value={toggleTheme}>
      <ThemeModeContext.Provider value={mode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </ThemeToggleContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the current theme mode and toggle function.
 * Must be used inside `<AppThemeProvider>`.
 */
export function useThemeMode(): ThemeContextValue {
  const mode = useContext(ThemeModeContext);
  const toggleTheme = useContext(ThemeToggleContext);
  const value = useMemo(
    () => (mode && toggleTheme ? { mode, toggleTheme } : undefined),
    [mode, toggleTheme]
  );
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
  const toggleTheme = useContext(ThemeToggleContext);
  if (!toggleTheme) {
    throw new Error('useToggleTheme must be used inside <AppThemeProvider>.');
  }
  return toggleTheme;
}
