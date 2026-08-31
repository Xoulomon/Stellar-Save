# Test Coverage Enforcement

Stellar-Save tracks and enforces test coverage across all three workspaces and
publishes results to [Codecov](https://codecov.io/gh/Xoulomon/Stellar-Save) for
public reporting and historical trend analysis.

## Overview

| Workspace  | Language / Runtime | Coverage tool       | Codecov flag | Report format       |
|------------|--------------------|---------------------|--------------|---------------------|
| frontend   | React + TS (Vite)  | vitest + `@vitest/coverage-v8` | `frontend`   | `lcov` / `cobertura` |
| contracts  | Rust (Soroban)     | `cargo-tarpaulin`   | `contracts`  | `cobertura` (XML)    |
| backend    | Node + TS          | `jest` (`ts-jest`)  | `backend`    | `lcov` / `cobertura` |

Coverage runs in CI via [`.github/workflows/coverage.yml`](../.github/workflows/coverage.yml),
which has a dedicated job per workspace. Each job runs the workspace's coverage
command and uploads the result to Codecov under the matching flag, on every
push to `main` and on every pull request.

## Coverage thresholds (gates)

Thresholds are enforced in two complementary places:

1. **Per-tool gates** — fail the build locally and in CI before upload.
2. **Codecov status checks** — the PR merge gates (see below).

| Workspace  | Lines | Branches | Functions | Statements | Enforced by |
|------------|-------|----------|-----------|------------|-------------|
| frontend   | 80%   | 70%      | 80%       | 80%        | `frontend/vitest.config.ts` (`coverage.thresholds`) + Codecov flag `frontend` |
| contracts  | 90%   | —        | —         | —          | `tarpaulin.toml` (`fail-under = 90`) + `contracts/cargo-llvm-cov.toml` + Codecov flag `contracts` |
| backend    | 85%   | 85%      | 85%       | 85%        | `backend/jest.config.js` (`coverageThreshold`) + Codecov flag `backend` |

### Why these numbers

- **contracts (90%)** — smart contracts are the highest-risk component, enforced at 90%+ via tarpaulin and cargo-llvm-cov baseline.
- **frontend (80%)** — matches the thresholds configured in vitest coverage.
- **backend (85%)** — established minimum unit & integration test coverage baseline across backend services.

The previous global Codecov target of 95% was unrealistic across all three
workspaces simultaneously and has been replaced with the per-flag targets above
plus an `auto` project default (no drop versus the base commit).

## PR merge gate

The merge gate is provided by **Codecov status checks** defined in
[`codecov.yml`](../codecov.yml):

- `coverage.status.project.<flag>` — fails if a workspace's overall coverage
  falls below its target.
- `coverage.status.project.default` (`target: auto`) — fails if overall
  coverage drops versus the PR base commit.
- `coverage.status.patch` — fails if the lines changed in the PR are not
  sufficiently covered (80% default, 60% for `backend`).

To make these blocking, add the Codecov status contexts (e.g.
`codecov/project/frontend`, `codecov/project/contracts`,
`codecov/project/backend`, `codecov/patch`) as **required status checks** in the
GitHub branch protection rules for `main`. Once required, a PR cannot be merged
while any coverage check is failing.

> A `CODECOV_TOKEN` repository secret is required for uploads on private repos
> and recommended for public repos to avoid rate limiting.

## Running coverage locally

```bash
# Contracts (Rust) — tarpaulin & cargo-llvm-cov
cargo tarpaulin --config tarpaulin.toml
cargo llvm-cov --config contracts/cargo-llvm-cov.toml --html

# Frontend (vitest) — produces ./frontend/coverage (lcov.info, cobertura, html)
cd frontend && npm run test:coverage

# Backend (jest) — produces ./backend/coverage (lcov.info, cobertura)
cd backend && npm run test:coverage
```

## Historical trends

Codecov automatically retains coverage history per commit and per flag. View
trends, sunburst graphs, and per-file coverage at:

<https://codecov.io/gh/Xoulomon/Stellar-Save>

Per-flag dashboards:

- frontend: <https://codecov.io/gh/Xoulomon/Stellar-Save?flags[0]=frontend>
- contracts: <https://codecov.io/gh/Xoulomon/Stellar-Save?flags[0]=contracts>
- backend: <https://codecov.io/gh/Xoulomon/Stellar-Save?flags[0]=backend>
