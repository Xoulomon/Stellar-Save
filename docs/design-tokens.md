# Design Token System & Theme Switching
<!-- Closes #1173 -->

Centralized design token management enabling runtime theme switching and personalization.

## Token Taxonomy

All visual decisions extracted into three layers:

| Layer | Description | Example |
|-------|-------------|---------|
| **Primitives** | Raw values, never used in components directly | `--color-blue-500: #3b82f6` |
| **Semantic** | Role-based aliases mapped to primitives | `--color-primary: var(--color-blue-500)` |
| **Component** | Component-scoped overrides | `--btn-bg: var(--color-primary)` |

## CSS Custom Properties

`src/styles/tokens.css` — the single source of truth:

```css
/* ── Primitives ── */
:root {
  /* Colors */
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-gray-50:  #f9fafb;
  --color-gray-900: #111827;
  --color-green-500: #22c55e;
  --color-red-500:   #ef4444;

  /* Spacing (4-point grid) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-8: 2rem;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --font-medium: 500;
  --font-bold:   700;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}

/* ── Semantic (light theme default) ── */
:root, [data-theme="light"] {
  --color-bg:           var(--color-gray-50);
  --color-surface:      #ffffff;
  --color-primary:      var(--color-blue-500);
  --color-primary-hover:var(--color-blue-600);
  --color-text:         var(--color-gray-900);
  --color-text-muted:   #6b7280;
  --color-success:      var(--color-green-500);
  --color-danger:       var(--color-red-500);
  --color-border:       #e5e7eb;
}

/* ── Dark theme ── */
[data-theme="dark"] {
  --color-bg:           #0f172a;
  --color-surface:      #1e293b;
  --color-primary:      #60a5fa;
  --color-primary-hover:#93c5fd;
  --color-text:         #f1f5f9;
  --color-text-muted:   #94a3b8;
  --color-border:       #334155;
}
```

## Theme Switcher UI

`src/components/ThemeSwitcher.tsx`:

```tsx
import { useTheme } from '../hooks/useTheme';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

`src/hooks/useTheme.ts`:

```typescript
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
```

## User Preference & Dark Mode Support

| Priority | Source | Mechanism |
|----------|--------|-----------|
| 1 (highest) | Explicit user choice | `localStorage['theme']` → `data-theme` attribute |
| 2 | OS preference | `prefers-color-scheme` media query (read on first load) |
| 3 (default) | Light theme | Fallback when neither is set |

`@media (prefers-color-scheme: dark)` also applies the dark token set as a CSS fallback so the page renders correctly even before JS hydrates:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg:      #0f172a;
    --color-surface: #1e293b;
    /* … same as [data-theme="dark"] … */
  }
}
```

## Migration Checklist

- [ ] Audit all hardcoded hex/rgb values in existing CSS → replace with semantic tokens
- [ ] Audit all hardcoded spacing/font-size values → replace with space/text tokens
- [ ] Add `data-theme` attribute to `<html>` in `_document.tsx` (SSR safe)
- [ ] Smoke-test both themes in Chromium, Firefox, Safari, and mobile viewport
- [ ] Verify contrast ratios meet WCAG AA (4.5:1 text, 3:1 large text) for both themes
