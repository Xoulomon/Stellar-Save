/**
 * Design Tokens — centralized color, spacing, and typography definitions.
 * Closes #1173
 */

export const tokens = {
  color: {
    brand:      { primary: "#1A73E8", secondary: "#34A853", accent: "#FBBC04" },
    neutral:    { 0: "#FFFFFF", 100: "#F8F9FA", 200: "#E8EAED", 800: "#3C4043", 900: "#202124" },
    semantic:   { success: "#34A853", warning: "#FBBC04", error: "#EA4335", info: "#1A73E8" },
  },
  spacing: {
    xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px", xxl: "64px",
  },
  typography: {
    fontFamily: { base: "'Inter', system-ui, sans-serif", mono: "'JetBrains Mono', monospace" },
    fontSize:   { xs: "12px", sm: "14px", md: "16px", lg: "20px", xl: "24px", xxl: "32px" },
    fontWeight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, base: 1.5, relaxed: 1.75 },
  },
  radius: { sm: "4px", md: "8px", lg: "16px", full: "9999px" },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,.08)",
    md: "0 4px 12px rgba(0,0,0,.12)",
    lg: "0 8px 24px rgba(0,0,0,.16)",
  },
} as const;

// --- CSS custom properties ---

type Theme = "light" | "dark";

const themeVars: Record<Theme, Record<string, string>> = {
  light: {
    "--color-bg":       tokens.color.neutral[0],
    "--color-surface":  tokens.color.neutral[100],
    "--color-border":   tokens.color.neutral[200],
    "--color-text":     tokens.color.neutral[900],
    "--color-text-sub": tokens.color.neutral[800],
    "--color-primary":  tokens.color.brand.primary,
    "--color-success":  tokens.color.semantic.success,
    "--color-error":    tokens.color.semantic.error,
  },
  dark: {
    "--color-bg":       "#0F1117",
    "--color-surface":  "#1C1F26",
    "--color-border":   "#2D3139",
    "--color-text":     "#E8EAED",
    "--color-text-sub": "#9AA0A6",
    "--color-primary":  "#8AB4F8",
    "--color-success":  "#81C995",
    "--color-error":    "#F28B82",
  },
};

/**
 * Generates a <style> block with CSS custom properties for the given theme.
 * Call on theme switch to inject into document.head.
 */
export function generateCSSVars(theme: Theme): string {
  const vars = Object.entries(themeVars[theme])
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${vars}\n}`;
}

export type { Theme };
export { themeVars };
