/**
 * Theme Switcher — runtime theme switching with user preference persistence.
 * Supports light, dark, and system-preference modes.
 * Closes #1173
 */

import { generateCSSVars, type Theme } from "./tokens";

const STORAGE_KEY = "stellar-save:theme";

export type ThemePreference = Theme | "system";

function resolveTheme(pref: ThemePreference): Theme {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  // Inject or update <style id="theme-vars">
  let el = document.getElementById("theme-vars") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "theme-vars";
    document.head.appendChild(el);
  }
  el.textContent = generateCSSVars(theme);
  document.documentElement.dataset.theme = theme;
}

export function setTheme(pref: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(resolveTheme(pref));
}

export function loadTheme(): void {
  const saved = (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? "system";
  applyTheme(resolveTheme(saved));

  // React to OS-level changes when preference is "system"
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((localStorage.getItem(STORAGE_KEY) ?? "system") === "system") applyTheme(resolveTheme("system"));
  });
}

export function getThemePreference(): ThemePreference {
  return (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? "system";
}
