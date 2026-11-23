import { ThemeContext, useTheme as useContextTheme, type ThemeMode } from '../context/ThemeContext';

export { ThemeContext };
export type { ThemeMode };

/**
 * Hook to access and toggle the app theme.
 *
 * @example
 * const { mode, toggleTheme, setMode } = useTheme();
 */
export function useTheme() {
  return useContextTheme();
}
