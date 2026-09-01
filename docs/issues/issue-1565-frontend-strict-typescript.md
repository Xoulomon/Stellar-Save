# Issue #1565 — Add Strict TypeScript Config (`strict: true`) to Frontend

## Summary

The issue description states that `frontend/tsconfig.json` "may not have
`strict` mode fully enabled". Reading the actual config files shows the
situation is more nuanced: `strict: true` is already present in every
TypeScript project file, but there are meaningful gaps between what is declared
and what is actually enforced across the full build surface. This document maps
those gaps precisely and defines the path to a fully clean, verified strict
typecheck.

---

## Actual State of the TypeScript Configs

The frontend uses a composite project with three config files:

### `frontend/tsconfig.json` (root / legacy)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src"]
}
```

- Has `strict: true` ✓
- Missing `noUncheckedSideEffectImports`, `erasableSyntaxOnly`, `verbatimModuleSyntax`
- Missing `moduleDetection: "force"` — module/script ambiguity not resolved
- Uses `ES2020` target, older than the `tsconfig.app.json` target of `ES2022`
- No `composite`, no `tsBuildInfoFile` — not part of the project reference chain

### `frontend/tsconfig.app.json` (the file Vite/tsc actually uses for `src/`)

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force"
  },
  "include": ["src"]
}
```

- Has `strict: true` ✓
- Has the full set of linting flags ✓
- This is the config the build system (`tsc -b`) uses for `src/`

### `frontend/tsconfig.node.json` (Vite config files)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

- Has `strict: true` ✓

---

## The Real Gaps

### Gap 1 — `tsconfig.json` is the file `tsc --noEmit` resolves when run without `-p`

When `npm run build` calls `tsc -b`, it uses the project references and picks
up `tsconfig.app.json`. But if a developer or CI step runs a bare `tsc --noEmit`
from `frontend/`, TypeScript resolves `tsconfig.json` — the older, weaker
config with `ES2020`, no `moduleDetection`, and no `verbatimModuleSyntax`. This
means:

- `import type` enforcement (`verbatimModuleSyntax`) is not checked
- Module/script ambiguity (`moduleDetection: "force"`) is not checked
- The `tsBuildInfoFile` incremental cache is bypassed — typechecks are slower
  and may miss incremental errors

### Gap 2 — No standalone `typecheck` script

`frontend/package.json` has no `"typecheck"` script (unlike the backend which
has `"typecheck": "tsc --noEmit"`). The build script is `"build": "tsc -b &&
vite build"` — it typechecks as a side effect of building but there is no
fast, artifact-free check command for CI or pre-commit hooks.

### Gap 3 — `// @ts-ignore` and `// eslint-disable @typescript-eslint/no-explicit-any` suppressions

`frontend/src/types.d.ts` uses `[key: string]: any` in the `jest-axe`
declaration module to paper over missing types. While this is reasonable for a
third-party declaration shim, it sets a precedent. Under full strict mode,
every `any` in `src/` that is not behind a documented `// eslint-disable-next-line`
must be typed properly.

### Gap 4 — `tsconfig.json` includes `src/` but `tsconfig.app.json` also includes `src/`

Both configs include the same `src/` directory. If `tsconfig.json` is the
`references`-unaware root, files included by it may be type-checked twice with
different settings, or the older settings may silently win in an IDE that
resolves the root config.

---

## Acceptance Criteria

### AC1 — `strict: true` enabled repo-wide with no carve-outs

All three config files retain `strict: true`. No new `"strict": false`,
`"strictNullChecks": false`, `"noImplicitAny": false`, or similar overrides
may be added.

### AC2 — `tsconfig.json` aligned with `tsconfig.app.json`

The root `tsconfig.json` must match `tsconfig.app.json` in every flag that
affects type safety. At minimum:

```jsonc
// frontend/tsconfig.json — proposed alignment
{
  "compilerOptions": {
    "target": "ES2022",                    // was ES2020
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals"],

    /* Strict */
    "strict": true,
    "verbatimModuleSyntax": true,          // new
    "moduleDetection": "force",            // new

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,  // new
    "erasableSyntaxOnly": true             // new
  },
  "include": ["src"]
}
```

### AC3 — `typecheck` script added

```json
// frontend/package.json — add to "scripts"
"typecheck": "tsc --noEmit -p tsconfig.app.json"
```

This gives CI and pre-commit hooks a fast, build-artifact-free check against
the correct (composite-aware) config.

### AC4 — Zero type errors

```powershell
cd frontend
npm run typecheck
```

exits with code `0` and produces no diagnostic output.

### AC5 — No new suppressions

No `// @ts-ignore`, `// @ts-expect-error`, or `any` casts may be added to pass
the typecheck. Every error must be properly fixed.

---

## What `strict: true` Enables (for completeness)

`strict: true` is a shorthand that enables all of the following sub-flags:

| Flag | What it catches |
|---|---|
| `strictNullChecks` | `null` / `undefined` not assignable to non-nullable types |
| `strictFunctionTypes` | Contravariant function parameter checking |
| `strictBindCallApply` | Typed `bind` / `call` / `apply` |
| `strictPropertyInitialization` | Class properties must be assigned in constructor |
| `noImplicitAny` | Variables must have an explicit or inferred type |
| `noImplicitThis` | `this` in non-method functions must be typed |
| `useUnknownInCatchVariables` | `catch (e)` gives `e: unknown`, not `any` |
| `alwaysStrict` | Emits `"use strict"` in all output files |

The additional flags in `tsconfig.app.json` beyond `strict` add:

| Flag | What it catches |
|---|---|
| `noUnusedLocals` | Declared but unused local variables |
| `noUnusedParameters` | Declared but unused function parameters |
| `verbatimModuleSyntax` | Enforces `import type` for type-only imports |
| `moduleDetection: "force"` | Treats all `.ts` files as modules, not scripts |
| `noUncheckedSideEffectImports` | Imports with no bindings must be explicitly side-effect imports |
| `erasableSyntaxOnly` | Bans TypeScript-only syntax that requires emit (e.g. old-style `enum`) |

---

## Incremental Fix Strategy (if errors surface)

The issue mentions a "file-by-file allowlist if needed". The recommended
approach for the Stellar-Save frontend:

### Step 1 — Run the aligned typecheck and capture the error list

```powershell
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | Tee-Object -FilePath ts-errors.txt
```

### Step 2 — Categorise errors

Common error categories after adding the new flags:

| Error code | Flag responsible | Typical fix |
|---|---|---|
| `TS2345`, `TS2322` | `strictNullChecks` | Add `| null` / `| undefined` to types, or narrow with guards |
| `TS7006` | `noImplicitAny` | Add explicit types to parameters |
| `TS1484` | `verbatimModuleSyntax` | Change `import { Foo }` to `import type { Foo }` for type-only imports |
| `TS2802` | `useUnknownInCatchVariables` | Change `catch (e) { e.message }` to `catch (e) { (e as Error).message }` or use a type guard |
| `TS6133` | `noUnusedLocals` / `noUnusedParameters` | Remove unused variable or prefix with `_` |

### Step 3 — File-by-file allowlist (only if error count is very large)

If the initial run produces more than ~50 errors, use a path-based
`tsconfig.strict.json` that excludes known-problematic files while the fixes
are applied incrementally:

```jsonc
// frontend/tsconfig.strict.json  (temporary, delete when clean)
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src"],
  "exclude": [
    // Add files here temporarily while fixing, remove as each is fixed:
    // "src/hooks/useSomething.ts",
  ]
}
```

The `typecheck` script is updated to use this file while the allowlist is
populated, then reverted to `tsconfig.app.json` once the list is empty.

### Step 4 — Remove the allowlist file

Once `tsconfig.strict.json` has an empty `exclude` array, delete it and switch
`typecheck` back to `tsconfig.app.json`. This satisfies the "Remove allowlist
once clean" acceptance criterion.

---

## Key Files to Watch

Based on the `src/` directory structure:

| Area | Files | Likely issue |
|---|---|---|
| Hooks | `useContract.ts`, `useGroup.ts`, `useGroups.ts`, `useBalance.ts` | `strictNullChecks` on optional returns from contract calls |
| Wallet | `wallet/WalletProvider.tsx`, `wallet/types.ts` | `strictNullChecks` on `WalletContext` initial value |
| Utils | `utils/groupApi.ts`, `utils/payoutApi.ts`, `utils/api.ts` | `noImplicitAny` on fetch response handling |
| Services | `lib/EventService.ts`, `lib/client.ts` | `useUnknownInCatchVariables` in catch blocks |
| Pages | `pages/` (30+ files) | `verbatimModuleSyntax` — type-only import enforcement |
| Type declarations | `types.d.ts` | `[key: string]: any` shims — acceptable with documented `eslint-disable` |

---

## Relationship to Issue #1566

Issue #1566 (backend strict TypeScript) removes `strictPropertyInitialization:
false` from `backend/tsconfig.json`. That change is more surgical — one flag
removal in a mostly-strict config. This issue (#1565) is broader: it closes the
gap between the root `tsconfig.json` (used by bare `tsc`) and `tsconfig.app.json`
(used by the build), and adds a `typecheck` script so the strict surface is
always verifiable without building.

---

## Affected Files

| File | Change type |
|---|---|
| `frontend/tsconfig.json` | Align flags with `tsconfig.app.json`: bump target, add `verbatimModuleSyntax`, `moduleDetection`, `erasableSyntaxOnly`, `noUncheckedSideEffectImports` |
| `frontend/package.json` | Add `"typecheck": "tsc --noEmit -p tsconfig.app.json"` to scripts |
| `frontend/src/**/*.ts(x)` | Fix any type errors surfaced by the aligned config |
| `frontend/tsconfig.strict.json` | Temporary allowlist (create only if error count justifies it, delete when clean) |

---

## Related

- Issue #1566 — Backend strict TypeScript (`strictPropertyInitialization: false` removal)
- Issue #111 — Original tracking issue for strict TypeScript across the monorepo
- `frontend/tsconfig.app.json` — the config Vite/tsc actually uses for `src/`
- `frontend/tsconfig.json` — the root config resolved by bare `tsc` invocations
- TypeScript strict mode docs: https://www.typescriptlang.org/tsconfig#strict
