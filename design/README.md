# design/

This directory holds design artifacts created during the UI/UX design phase of Stellar-Save.
It is **not part of any build pipeline** — no build tool (Vite, tsc, Vitest, Jest, Stryker)
includes this directory. TypeScript files here are standalone reference implementations that are
not imported by any frontend or backend source module.

## Why files live here instead of `frontend/src/`

`tokens.ts` and `theme-switcher.ts` were authored as self-contained design-system references.
They define the canonical token values and theme-switching logic that informed the actual
implementation in `frontend/src/`. They are retained here as the source of truth for the
design system so designers and developers can review or extend them without touching application
code. If you want to integrate them into the live app, import from `frontend/src/` equivalents
or migrate these files there.

## Contents

### TypeScript (reference implementations — not compiled by the app build)

| File | Purpose |
|------|---------|
| `tokens.ts` | Centralized design tokens: colors, spacing, typography, border radius, and shadows. Also exports `generateCSSVars()` for runtime CSS custom-property injection. Closes #1173. |
| `theme-switcher.ts` | Runtime theme switching (light / dark / system). Persists preference to `localStorage`. Imports `generateCSSVars` from `tokens.ts`. Closes #1173. |

### CSS (reference stylesheet — not bundled by Vite)

| File | Purpose |
|------|---------|
| `tokens.css` | CSS custom properties mirroring `tokens.ts` values. Provides a no-JS fallback with a `prefers-color-scheme: dark` media query. Useful as a drop-in stylesheet for static prototypes. |

### Wireframes & UI spec text files

These are plain-text UI specification and wireframe notes produced during the design phase.
They document intended layouts, component states, and interaction flows.

| File | Purpose |
|------|---------|
| `UI Design.txt` | Overall UI design principles and component guidelines |
| `dashboard.txt` | Dashboard screen layout and data display spec |
| `Group Flow UI.txt` | Group creation and management flow specification |
| `Group DEtail UI.txt` | Group detail screen layout and state descriptions |
| `Wallet Ui.txt` | Wallet connection and display UI specification |
| `Profile Ui.txt` | User profile screen layout specification |
| `Notification UI.txt` | Notification panel and alert UI specification |
| `Empty scrreens.txt` | Empty-state screen designs for all major views |
| `Design System & Style Guide.txt` | Typography, color, and spacing style guide |
| `wireframe.txt` | General wireframe notes |
| `Wireframe` | Wireframe overview (no extension — plain text) |
| `Wireframe - Mobile Navigation` | Mobile navigation wireframe (no extension — plain text) |
| `Wireframe - Contribution Flow` | Contribution flow wireframe (no extension — plain text) |
| `Wireframe - Loading & Empty States.txt` | Loading and empty-state wireframe spec |
| `Mobile Navigation` | Mobile nav structure notes (no extension — plain text) |
| `Design High-Fidelity Mockups` | High-fidelity mockup reference notes (no extension — plain text) |
| `creatingintertiveprptotype` | Notes on building the interactive prototype (no extension — plain text) |

## Build tool confirmation

All active build tools are scoped to `src/` directories inside their respective workspace:

- `frontend/tsconfig.json` / `tsconfig.app.json`: `"include": ["src"]`
- `backend/tsconfig.json`: `"include": ["src/**/*"]`
- `frontend/vitest.config.ts`: coverage scoped to `src/components/`
- `frontend/stryker.config.mjs`: mutates `src/**/*.{ts,tsx}`
- `backend/jest.config.js`: testMatch covers `src/tests/**` and `test/unit/**`

No changes to build configuration are required. This directory will never be compiled,
tested, or bundled by the current toolchain.
