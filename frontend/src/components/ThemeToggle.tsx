import { useTheme } from "../hooks/useTheme";
import "./ThemeToggle.css";

interface ThemeToggleProps {
  /** Render as a compact icon button (default) or a labelled button */
  variant?: "icon" | "labelled";
  className?: string;
}

/**
 * Button that toggles between light and dark mode.
 *
 * @example
 * // In header
 * <ThemeToggle />
 *
 * @example
 * // In settings with label
 * <ThemeToggle variant="labelled" />
 */
export function ThemeToggle({ variant = "icon", className = "" }: ThemeToggleProps) {
  const { isDark, toggleTheme, resolvedMode } = useTheme();

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const icon = isDark ? "☀️" : "🌙";

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${variant} ${className}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {icon}
      </span>
      {variant === "labelled" && (
        <span className="theme-toggle__label">
          {resolvedMode === "dark" ? "Dark mode" : "Light mode"}
        </span>
      )}
    </button>
  );
}
