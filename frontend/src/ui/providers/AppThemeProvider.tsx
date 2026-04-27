import type { ReactNode } from "react";
import { ThemeContextProvider } from "./ThemeContext";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContextProvider>{children}</ThemeContextProvider>;
}
