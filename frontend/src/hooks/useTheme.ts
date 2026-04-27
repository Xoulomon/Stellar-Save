import { useContext } from "react";
import { ThemeContext } from "../ui/providers/ThemeContext";

export { ThemeContext };
export type { ThemeMode } from "../ui/providers/ThemeContext";

/**
 * Hook to access and toggle the app theme.
 *
 * @example
 * const { mode, toggleTheme, setMode } = useTheme();
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within AppThemeProvider");
  }
  return ctx;
}
