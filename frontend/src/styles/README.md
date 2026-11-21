# Styles

This folder owns the application-level style concerns that cross-cut
individual components.

## Color tokens

Design tokens are defined in `../index.css`. Every token that carries a
colour value is audited for WCAG 2.1 AA compliance (≥ 4.5 : 1 for normal
text, ≥ 3 : 1 for UI components and large text).

### Fixes applied in issue #2035

| Token | Before | After | Worst-case contrast |
|---|---|---|---|
| `--color-success` (light) | `#10b981` | `#047857` | 4.96 : 1 on `--color-bg` |
| `--color-warning` (light) | `#f59e0b` | `#b45309` | 4.54 : 1 on `--color-bg` |

The two original values failed WCAG AA at 2.36 : 1 and 2.07 : 1
respectively. All other tokens in both light and dark themes already met
the 4.5 : 1 threshold.

Dark-theme equivalents (`#34d399`, `#fbbf24`) were already compliant and
are unchanged.
