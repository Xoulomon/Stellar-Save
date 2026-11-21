# Root Config File Audit

**Audit date:** 2026-10-19  
**Issue:** [#1948](https://github.com/Xoulomon/Stellar-Save/issues/1948)

This document records every config file at the repository root, which tool reads
it, whether it is still in use, and what would happen if it were removed.

---

## Files surveyed

### `tsconfig.base.json`

| Field | Value |
|-------|-------|
| Read by | `tsc`, all `packages/*/tsconfig.json`, `frontend/tsconfig.json`, `backend/tsconfig.json`, `mobile/tsconfig.json` (via `"extends": "../../tsconfig.base.json"` or `"extends": "../tsconfig.base.json"`) |
| Still used | Yes — every TypeScript workspace extends this file |
| Workspace duplicate risk | None. Workspace configs only add `outDir`, `rootDir`, `declaration`, etc. The shared flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.) live only here |
| Remove consequence | All workspaces would lose shared compiler flags |

### `vite.config.ts`

| Field | Value |
|-------|-------|
| Read by | Vite CLI when invoked from the repo root (e.g. `vite build` without `--config`) |
| Still used | Minimal — the frontend app uses `frontend/vite.config.ts`, which has all production settings (CSP, chunks, imagetools, visualizer). The root config is a safe fallback stub |
| Workspace duplicate | `frontend/vite.config.ts` is the authoritative config. The root file does not duplicate any non-trivial setting |
| Remove consequence | Root-level `vite` invocations would lose the React plugin. Keep for safety; purpose comment added |

### `turbo.json`

| Field | Value |
|-------|-------|
| Read by | Turborepo CLI (`turbo run build/test/lint/typecheck`) |
| Still used | Yes — Turbo drives the workspace pipeline in CI and locally |
| Workspace duplicate risk | None. No workspace has its own `turbo.json` |
| Remove consequence | `turbo run` commands would fail with no pipeline defined |

### `canary.toml`

| Field | Value |
|-------|-------|
| Read by | `scripts/canary_deploy.sh`, `scripts/canary_monitor.sh`, `scripts/canary_promote.sh`, `scripts/canary_rollback.sh` |
| Still used | Yes — canary deployment is an active workflow (`.github/workflows/canary.yml`) |
| Workspace duplicate risk | None. No workspace has canary config |
| Remove consequence | All canary scripts would use hard-coded defaults or fail |

### `environments.toml`

| Field | Value |
|-------|-------|
| Read by | `scripts/deploy_testnet.sh`, `scripts/deploy_mainnet.sh`, `scripts/verify_contract.sh`, and other scripts that accept a `--network` flag |
| Still used | Yes |
| Workspace duplicate risk | None |
| Remove consequence | Deployment scripts would need hard-coded RPC URLs |

### `codecov.yml`

| Field | Value |
|-------|-------|
| Read by | Codecov service (uploaded by `.github/workflows/coverage.yml`) |
| Still used | Yes — acts as a required PR merge gate |
| Workspace duplicate risk | None. Coverage thresholds in this file complement per-tool gates in `frontend/vitest.config.ts`, `tarpaulin.toml`, and `backend/jest.config.js`, but each layer enforces a different concern (tool-level vs Codecov project/patch gate) |
| Remove consequence | Codecov would use defaults; per-workspace project gates would stop enforcing |

### `tarpaulin.toml`

| Field | Value |
|-------|-------|
| Read by | `cargo tarpaulin --config tarpaulin.toml` (contracts coverage) |
| Still used | Yes — referenced in `README.md` and `coverage.yml` |
| Workspace duplicate risk | `contracts/stellar-save/tarpaulin.toml` exists and sets contract-specific options. The root file sets `workspace = true`, `fail-under = 90`, and shared output settings. The contract-specific file scopes measurement to that crate. No values are duplicated |
| Remove consequence | Root `cargo tarpaulin` would lose the `fail-under` gate and output settings |

### `deny.toml`

| Field | Value |
|-------|-------|
| Read by | `cargo deny check` — invoked by `.github/workflows/dependency-scan.yml` and `scripts/cargo-audit.sh` |
| Still used | Yes |
| Workspace duplicate risk | None. `.cargo/audit.toml` governs `cargo audit` (a different tool); no overlap |
| Remove consequence | Dependency license and advisory checks would not run |

---

## Summary: duplicates found

No settings are duplicated between root and workspace configs without a documented
reason. Each root config serves the whole monorepo and is not redundant with any
workspace-local file.

The only related pair is `tarpaulin.toml` (root, workspace-wide gate) and
`contracts/stellar-save/tarpaulin.toml` (contract-scoped measurement options) —
these are complementary, not duplicates.
