# Contributing to Stellar-Save

Thank you for your interest in contributing to Stellar-Save — a decentralized ROSCA (Rotating Savings and Credit Association) built on Stellar Soroban smart contracts.

This guide covers everything you need to get started: environment setup, coding standards, testing requirements, and the PR process.

> New to the project? Start with [docs/first-time-contributor.md](docs/first-time-contributor.md) for a gentler walkthrough.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Git Hooks](#git-hooks)
- [Commit Message Conventions](#commit-message-conventions)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Drips Wave Contributions](#drips-wave-contributions)
- [Getting Help](#getting-help)

---

## Code of Conduct

By participating in this project you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). We do not tolerate harassment, discrimination, or hostile behaviour. Report violations by opening a private issue or contacting a maintainer directly.

---

## Architecture Overview

Stellar-Save has four main layers:

```
User (Stellar wallet)
       │
       ▼
Frontend (React + TypeScript + Vite)
       │
       ▼
Soroban Smart Contracts (Rust)
       │
       ▼
Stellar Network (on-chain storage + Horizon API)
```

**Smart contract modules** (`contracts/stellar-save/src/`):

| Module                             | Responsibility                       |
| ---------------------------------- | ------------------------------------ |
| `lib.rs`                           | Contract entry points and public API |
| `group.rs`                         | Group creation and configuration     |
| `contribution.rs`                  | Contribution logic and tracking      |
| `payout.rs` / `payout_executor.rs` | Payout rotation and distribution     |
| `storage.rs`                       | On-chain data layout                 |
| `security.rs`                      | Authorization and access control     |
| `error.rs`                         | Typed error variants                 |
| `events.rs`                        | Soroban event emission               |

**Frontend** (`frontend/src/`): React 19 + TypeScript SPA using MUI, React Router, and `@stellar/stellar-sdk`.

For full architecture details see [docs/architecture.md](docs/architecture.md).

---

## Package Manager

> **This repository uses [pnpm@9](https://pnpm.io/) as its sole package manager.**
> See [docs/adr/ADR-006-package-manager.md](docs/adr/ADR-006-package-manager.md) for the full rationale.

### Rule: always use `pnpm`, never `npm` or `yarn`

Running `npm install` or `yarn` in any workspace generates a stale `package-lock.json`
that conflicts with the canonical `pnpm-lock.yaml`. **PRs that add or modify
`package-lock.json` will be rejected.**

| Task                         | Command                                      |
| ---------------------------- | -------------------------------------------- |
| Install all workspace deps   | `pnpm install`                               |
| Add a runtime dependency     | `pnpm add <package>`                         |
| Add a dev dependency         | `pnpm add -D <package>`                      |
| Remove a dependency          | `pnpm remove <package>`                      |
| Run a package.json script    | `pnpm run <script>` or `pnpm <script>`       |
| CI install (strict lockfile) | `pnpm install --frozen-lockfile`             |

Corepack (bundled with Node.js 16.9+) will enforce the exact pnpm version declared
in `package.json → "packageManager"`. Enable it once:

```bash
corepack enable
```

After that, `pnpm` will automatically use the pinned version without a separate install step.

---

## Development Setup

### Prerequisites

| Tool                  | Version         | Install                                                                   |
| --------------------- | --------------- | ------------------------------------------------------------------------- |
| Rust                  | 1.81.0 (pinned) | [rustup.rs](https://rustup.rs)                                            |
| Soroban / Stellar CLI | latest          | [Stellar CLI docs](https://developers.stellar.org/docs/tools/stellar-cli) |
| Node.js               | 18+             | [nodejs.org](https://nodejs.org)                                          |
| pnpm                  | 9.x (pinned)    | `corepack enable` (after Node.js install)                                 |

The Rust toolchain version is pinned in `rust-toolchain.toml`. Running any `cargo` command will install it automatically via rustup.

### Clone and install

```bash
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save

# Enable Corepack so pnpm@9 is used automatically
corepack enable

# Install all workspace dependencies (frontend, backend, mobile, packages/*)
pnpm install
```

The repository uses **pnpm only**. `pnpm-lock.yaml` at the root is the single
source of truth for resolved versions — do not run `npm install` or `yarn` at
the root and do not commit a root `package-lock.json` or `yarn.lock`.

### Environment configuration

```bash
cp .env.example .env
```

Edit `.env` with your network settings. Available networks are defined in `environments.toml`:

- `testnet` — Stellar testnet (recommended for development)
- `futurenet` — Stellar futurenet
- `standalone` — Local development node
- `mainnet` — Production (do not use for development)

### Build the smart contract

```bash
./scripts/build.sh
# or directly:
cargo build --target wasm32-unknown-unknown --release
```

### Run the frontend dev server

```bash
cd frontend
pnpm dev
```

### Deploy to testnet

```bash
# Generate a testnet identity (one-time)
stellar keys generate deployer --network testnet

# Deploy
./scripts/deploy_testnet.sh
```

---

## Project Structure

```
Stellar-Save/
├── contracts/
│   └── stellar-save/        # Main ROSCA smart contract (Rust)
│       └── src/             # Contract modules
├── frontend/                # React + TypeScript SPA
│   └── src/
├── client/                  # Rust client library
├── scripts/                 # Build, deploy, and test scripts
├── docs/                    # Project documentation
├── tests/                   # Integration and shell tests
├── infra/                   # Terraform infrastructure
├── monitoring/              # Prometheus / Grafana / ELK configs
├── .github/workflows/       # CI/CD pipelines
├── Cargo.toml               # Workspace manifest
├── environments.toml        # Network configurations
└── rust-toolchain.toml      # Pinned Rust version
```

---

## Coding Standards

### Rust (smart contract)

- Run `cargo fmt --all` before every commit — formatting is enforced in CI via `cargo fmt --check`
- Run `cargo clippy --all-targets --all-features -- -D warnings` and fix all warnings before opening a PR
- If a Clippy warning is a genuine false positive, suppress it with `#[allow(...)]` and a one-line comment explaining why, e.g.:
  ```rust
  #[allow(clippy::too_many_arguments)] // contract entry point mirrors the on-chain ABI; cannot be split
  ```
- Keep functions small and single-purpose
- Use descriptive names; avoid single-letter variables outside iterators
- Document all public items with `///` doc comments
- Prefer `Result<T, ContractError>` over panics for recoverable errors
- Use the typed error variants in `error.rs` — do not add bare `panic!` calls

```rust
/// Verifies the caller is the group creator.
///
/// # Errors
/// Returns [`ContractError::Unauthorized`] if the caller is not the creator.
pub fn require_creator(env: &Env, group: &Group) -> Result<(), ContractError> {
    let caller = env.invoker();
    if caller != group.creator {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}
```

### TypeScript / React (frontend)

- Use functional components with hooks — no class components
- Type all props and state with TypeScript interfaces or types; avoid `any`
- Use `const` by default; `let` only when reassignment is necessary
- Keep components under ~150 lines; extract sub-components when they grow larger
- Use semantic HTML for accessibility (`<button>`, `<nav>`, `<main>`, etc.)
- Run `npm run lint` before committing — ESLint is enforced in CI
- **`no-unused-vars` and `@typescript-eslint/no-explicit-any` are both set to `error`** repo-wide in `eslint.config.base.js`. Violations block the pre-commit hook and CI. If a genuine exception is needed (e.g. a pending Prisma migration model, a browser-context injection in Playwright), add an inline `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <one-line justification>` comment.
- **Import Ordering**: enforced by `eslint-plugin-import` (`import/order`, error). Groups are separated by a blank line, imports sorted alphabetically (case-insensitive) within each group: `builtin` → `external` → `internal` → `parent`/`sibling` (`../`, `./`) → `index` → `type`. See the `import/order` rule in `eslint.config.base.js`.
- **Circular Dependencies**: Circular dependencies are strictly forbidden (`import/no-cycle`). Ensure modules are strictly decoupled and acyclic
- **No `console.log`**: `no-console` is `error` repo-wide (only `console.warn` / `console.error` are allowed). Use the workspace logger — `frontend/src/utils/logger.ts` or `backend/src/lib/logger.ts` — or `process.stdout.write` in Node CLI scripts. Test files are exempt. Only logger modules may disable the rule inline.

### ESLint configuration

Every workspace extends one shared config, [`eslint.config.base.js`](eslint.config.base.js). Package configs spread it first and add only workspace-specific overrides — never re-declare a shared rule in a workspace config.

| Config                                     | Scope                   | Workspace-specific additions                             |
| ------------------------------------------ | ----------------------- | -------------------------------------------------------- |
| `eslint.config.mjs`                        | repo-root tooling files | CommonJS for `.lintstagedrc.js` / `commitlint.config.js` |
| `frontend/eslint.config.js`                | web app                 | browser globals, React Hooks, React Refresh, jsx-a11y    |
| `backend/eslint.config.mjs`                | API server              | Node globals, CommonJS, ignores `src/generated/**`       |
| `mobile/eslint.config.js`                  | React Native app        | ignores `.expo/`, `android/`, `ios/`                     |
| `packages/sdk/eslint.config.mjs`           | published SDK           | none                                                     |
| `packages/shared-utils/eslint.config.mjs`  | shared utilities        | none                                                     |
| `packages/events-schema/eslint.config.mjs` | codegen scripts         | CommonJS + Node globals for `*.js`, ignores `generated/` |

Shared rules (all from `eslint.config.base.js`):

| Rule                                         | Setting                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `js.configs.recommended`                     | preset                                                                                             |
| `tseslint.configs.recommended`               | preset                                                                                             |
| `@typescript-eslint/no-explicit-any`         | `error`, `fixToUnknown: true`                                                                      |
| `@typescript-eslint/no-unused-vars`          | `error`; names starting with `_` are ignored (args, vars, caught errors, destructured array items) |
| `@typescript-eslint/consistent-type-imports` | `error`, `prefer: 'type-imports'`                                                                  |
| `no-console`                                 | `error`, allows `warn` and `error`; `off` in test files                                            |
| `import/no-cycle`                            | `error`                                                                                            |
| `import/order`                               | `error`, grouped and alphabetized (see above)                                                      |
| ignores                                      | `dist/**`, `node_modules/**`, `coverage/**`, `*.d.ts`                                              |

Test files for the `no-console` exemption: `**/*.test.*`, `**/*.spec.*`, `**/*.e2e.{ts,tsx}`, and anything under `test/`, `tests/`, `tests-e2e/` or `e2e/`.

Prettier config (`.prettierrc`):

- Single quotes, semicolons, trailing commas (ES5), 100-char print width, 2-space indent

```tsx
interface ContributionCardProps {
  amount: bigint;
  member: string;
  isPaid: boolean;
}

const ContributionCard = ({ amount, member, isPaid }: ContributionCardProps) => (
  <article className="contribution-card">
    <span>{member}</span>
    <span>{isPaid ? '✓' : 'Pending'}</span>
  </article>
);
```

### General & Formatting Standards

- `.editorconfig` is present at the repository root and enforced in all environments:
  - **UTF-8** encoding across all files
  - **LF** (`\n`) line endings (no CRLF)
  - **Final newline** inserted on save
  - **Trailing whitespace** trimmed automatically (except in Markdown `.md` files)
  - **Indentation**: 4 spaces for Rust (`.rs`); 2 spaces for TypeScript (`.ts`, `.tsx`), JavaScript, JSON, CSS/SCSS, Shell, TOML, YAML, and SQL
- Do not commit secrets, private keys, or `.env` files — `.gitignore` covers common cases but double-check before staging

### Commented-Out Code

**Never commit commented-out code.** Version control already keeps the history, so
a commented block is never the safe place for code that is "not ready yet" — it is
invisible to the compiler, untested, never type-checked, never linted, and never
reviewed as code. It silently rots, and the next reader cannot tell whether it
is current, intended, or abandoned.

Delete it, or finish it in the same change. If it must not ship yet, open a
tracking issue and link it from the prose.

```ts
// Bad - dead code that still looks like it does something
// const result = await getUserBalance(userId);
// if (result > 0) {
//   showBanner();
// }
// export default router;
```

```ts
// Good - the behaviour is implemented
const result = await getUserBalance(userId);
if (result > 0) {
  showBanner();
}
```

```ts
// Good - a comment that is actually documentation
// Balances are cached for 30s to avoid hammering the RPC on every render.
```

The distinction is intent, not length: a comment that **explains** stays, a
comment that **does** goes.

Comments that are documentation, not code, are fine and expected:

- Explanations of *why* non-obvious code does something
- Section dividers and banners (`// --- Auth middleware ---`)
- Doc comments (`/** ... */`, JSDoc, Rust `///` and `//!`)
- Licence and copyright headers
- Lint/tool directives: `eslint-disable-next-line`, `// @ts-expect-error`,
  `// prettier-ignore`, `#[allow(...)]` — these are consumed by tooling, and
  several of them stop working entirely once the line is edited

Intent markers such as `TODO`, `FIXME`, and `HACK` are also allowed. They must
name the work rather than describe code, and should reference a tracking issue:

```ts
// TODO(#1234): switch to cursor pagination once the API exposes a page token.
```

Guidelines:

1. **Do not comment out code to disable it temporarily.** A feature flag, an
   early `return`, or an actual `if` condition is reviewable and testable;
   commented code is none of those.
2. **If you uncomment something in review, uncomment the tests too**, or delete
   the tests. A test for code that is not wired up is itself dead weight.
3. **The pre-commit gate is a backstop, not a substitute.** `no-unused-vars` and
   `@typescript-eslint/no-explicit-any` (both `error` repo-wide in
   `eslint.config.base.js`) catch the related smell of an unused leftover, but
   no linter can tell that a comment is meant to compile — so this rule is
   enforced in code review. Treat a commented-out block in a diff as a
   blocking comment.

---

## Git Hooks

This repository uses [Husky](https://typicode.github.io/husky) to run quality gates automatically on every `git commit` and `git push`. Hooks are installed automatically when you run `pnpm install` (via the `prepare` script).

### pre-commit — lint + format check on staged files

The `.husky/pre-commit` hook runs **lint-staged** (`.lintstagedrc.js`), which applies the following checks to every staged file:

| File pattern              | Checks run                                    |
| ------------------------- | --------------------------------------------- |
| `*.{ts,tsx}`              | `eslint --max-warnings 0`, `prettier --check` |
| `*.{js,jsx,mjs,cjs}`      | `eslint --max-warnings 0`, `prettier --check` |
| `frontend/**/*.css`       | `stylelint`                                   |
| `*.{json,yaml,yml}`       | `prettier --check`                            |
| `*.md`                    | `prettier --check`                            |

This means:
- **Lint violations** (including `@typescript-eslint/no-explicit-any` and `no-unused-vars`, both set to `error` repo-wide in `eslint.config.base.js`) will block the commit.
- **Formatting violations** detected by Prettier will block the commit.

Run `pnpm format` to auto-fix formatting before committing.

### commit-msg — conventional commit enforcement

The `.husky/commit-msg` hook runs `commitlint` to validate that your commit message follows the [Conventional Commits](https://www.conventionalcommits.org/) format. See [Commit Message Conventions](#commit-message-conventions) for the full spec.

### pre-push — dependency vulnerability audit

The `.husky/pre-push` hook runs a vulnerability audit before every `git push`. See [Security: Pre-push Dependency Audit](#security-pre-push-dependency-audit) for details.

### Bypass policy — `--no-verify`

> ⚠️ **Using `--no-verify` is strongly discouraged** and will be flagged during code review.

`git commit --no-verify` and `git push --no-verify` bypass all hooks. This is intentionally difficult — the hooks exist to catch real problems. The only accepted reasons to bypass are:

- **WIP commits to a personal branch** that you intend to squash before opening a PR (document this in the PR description).
- **Emergency hotfixes** where a critical production issue requires an immediate push and the violation is already tracked as a follow-up issue.

In all other cases, fix the violation before committing. If the hook is producing a false positive, fix the rule (with a justified `eslint-disable` comment or by updating the config) and commit that fix in the same PR.

### Rust local pre-commit recommendation

For Rust code, the CI gate enforces both `cargo fmt --check` and `cargo clippy`. To catch these locally before pushing, add the following to your workflow:

```bash
# Before committing Rust changes:
cargo fmt --all              # auto-fix formatting
cargo clippy --all-targets --all-features -- -D warnings   # must be clean
cargo test --workspace       # must pass
```

These are not wired into the Husky hooks (Rust tooling is not universally available in all contributor environments) but are **required to pass in CI**. A failing clippy or fmt check will block your PR.

---

## Commit Message Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Commits are validated by **commitlint** via a Husky `commit-msg` hook that runs automatically on every `git commit`.

### How the hook works

The hook is installed by Husky and lives at `.husky/commit-msg`. It runs `commitlint` against your message before the commit is recorded. A non-conforming message causes the commit to be **rejected** with an error — nothing is committed until the message is fixed.

**Setup** (one-time, after cloning):

```bash
# Install root dependencies (includes husky + commitlint)
pnpm install
# Husky installs the git hook automatically via the "prepare" script
```

If the hook is not firing, re-run `pnpm exec husky` from the repo root.

**Verify the hook locally:**

```bash
# This should be rejected (no type prefix):
git commit --allow-empty -m "my change"

# This should be accepted:
git commit --allow-empty -m "chore: test commitlint hook"
```

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Allowed types

| Type       | Use for                                     |
| ---------- | ------------------------------------------- |
| `feat`     | New feature                                 |
| `fix`      | Bug fix                                     |
| `docs`     | Documentation only                          |
| `style`    | Formatting, whitespace (no logic change)    |
| `refactor` | Code restructuring without behaviour change |
| `perf`     | Performance improvement                     |
| `test`     | Adding or updating tests                    |
| `chore`    | Build process, dependency updates, tooling  |
| `ci`       | CI/CD configuration changes                 |
| `revert`   | Reverting a previous commit                 |

### Allowed scopes

Scopes are optional, but when present they must match a package or area of this monorepo.
The list is enforced by the `scope-enum` rule in [`commitlint.config.js`](commitlint.config.js)
and is kept in sync with the packages declared in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).

| Scope           | Area                                                         |
| --------------- | ------------------------------------------------------------ |
| `frontend`      | React SPA (`frontend/`)                                      |
| `backend`       | GraphQL / NestJS API (`backend/`)                            |
| `mobile`        | Expo React Native app (`mobile/`)                            |
| `sdk`           | Shared TypeScript SDK (`packages/sdk`)                       |
| `shared-utils`  | Shared utility functions (`packages/shared-utils`)           |
| `events-schema` | Contract event schema and codegen (`packages/events-schema`) |
| `contracts`     | Soroban smart contracts (`contracts/`)                       |
| `database`      | Migration tooling and tests (`database/`)                    |
| `docs`          | Documentation and guides                                     |
| `ci`            | GitHub Actions and pipelines                                 |
| `deps`          | Dependency bumps and lockfile updates                        |
| `release`       | Versioning and changelog                                     |

Omit the scope entirely for changes that span the whole repository, for example
`chore: update prettier config`. When the workspace layout changes, update `scopes` in
`commitlint.config.js` and this table in the same PR.

### Rules

- Use imperative mood: "add" not "added" or "adds"
- Keep the subject line under 100 characters
- Reference issues in the footer: `Closes #42`
- Use `feat!` or add `BREAKING CHANGE:` in the footer for breaking changes

### Examples

```
feat(contracts): add penalty mechanism for missed contributions

fix(frontend): correct off-by-one in payout position display

docs: expand contributing guide with architecture overview

test(contract): add fuzz tests for contribution overflow edge cases

chore: update soroban-sdk to 23.0.3

refactor(mobile): migrate inline stroop formatting to shared SDK utils

style(frontend): remove unused Vite default classes from App.css
```

### Common rejection messages

| Error                                           | Fix                               |
| ----------------------------------------------- | --------------------------------- |
| `subject may not be empty`                      | Add a description after the colon |
| `type must be one of [feat, fix, ...]`          | Use an allowed type listed above  |
| `subject must not be sentence-case`             | Start description with lowercase  |
| `header must not be longer than 100 characters` | Shorten the subject line          |
| `scope must be one of [frontend, ...]`          | Use an allowed scope listed above |

---

## Testing Requirements

### Running the Full Test Suite Locally

Before opening a PR, run all tests to ensure nothing is broken:

```bash
# Run all tests (contract + frontend)
./scripts/test.sh

# Or run individually:
# Contract tests
cargo test --workspace

# Frontend tests
cd frontend && npm test run
```

### Smart Contract Tests (Rust)

All new public functions must have tests covering:

- The happy path
- Expected error cases (use `assert_eq!(result, Err(ContractError::...))`)
- Edge cases (boundary values, empty inputs, etc.)

**Run contract tests:**

```bash
# All contracts
cargo test --workspace

# Stellar-save contract only
cargo test -p stellar-save

# With stdout output (see println! output)
cargo test -- --nocapture

# Single test
cargo test test_contribute_success

# With backtrace on failure
RUST_BACKTRACE=1 cargo test

# With coverage (requires cargo-tarpaulin)
cargo tarpaulin --config contracts/stellar-save/tarpaulin.toml
```

**Test structure:**

```rust
#[test]
fn test_contribute_success() {
    let env = Env::default();
    let contract = create_contract(&env);

    // Setup
    let group_id = contract.create_group(1000, 30, 100);
    let member = Address::random(&env);
    contract.join_group(group_id, member.clone(), None);

    // Execute
    let result = contract.contribute(group_id, member.clone(), 1000);

    // Assert
    assert!(result.is_ok());
}

#[test]
fn test_contribute_insufficient_balance() {
    let env = Env::default();
    let contract = create_contract(&env);

    // Setup
    let group_id = contract.create_group(1000, 30, 100);
    let member = Address::random(&env);
    contract.join_group(group_id, member.clone(), None);

    // Execute & Assert
    let result = contract.contribute(group_id, member.clone(), 500);
    assert_eq!(result, Err(ContractError::InsufficientBalance));
}
```

**Test snapshots:**

Test snapshots live in `contracts/stellar-save/test_snapshots/`. Update them if your change intentionally affects output:

```bash
# Update snapshots
cargo test -- --nocapture --test-threads=1 -- --exact test_name
```

### Frontend Tests (TypeScript)

Add tests for new utility functions and hooks. Component tests are encouraged.

**Run frontend tests:**

```bash
cd frontend

# Watch mode (development)
npm test

# Single run (CI)
npm run test:run

# With coverage
npm run test:coverage

# Accessibility checks (jest-axe / vitest-axe)
npm run test:a11y

# Visual regression tests (Percy page snapshots; needs PERCY_TOKEN)
npm run test:visual

# Component screenshot baselines (committed PNGs; no Percy token)
npm run test:visual:components

# After an intentional visual change, regenerate PNG baselines and commit them
npm run test:visual:components:update

# Mutation testing (Stryker)
npm run test:mutation
```

**Test structure:**

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContractCall } from './useContractCall';

describe('useContractCall', () => {
  it('should fetch group data successfully', async () => {
    const { result } = renderHook(() => useContractCall('get_group', [123]));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.data).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useContractCall('invalid_method', []));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.error).toBeDefined();
  });
});
```

**Test files location:**

Test files live alongside source files:

- `src/hooks/useContractCall.ts` → `src/hooks/useContractCall.test.ts`
- `src/components/GroupCard.tsx` → `src/components/GroupCard.test.tsx`

Setup is in `src/test/setup.ts`.

### Backend Tests (if applicable)

```bash
# Run backend tests
npm test src/tests/indexer.test.ts

# With coverage
npm test -- --coverage
```

### General Testing Rules

- ✅ Do not reduce overall test coverage — PRs that delete tests without replacement will be rejected
- ✅ If you find a bug, write a failing test that reproduces it before fixing it
- ✅ CI must be green before requesting review
- ✅ Aim for >80% code coverage on new code
- ✅ Test both success and failure paths
- ✅ Use descriptive test names: `test_contribute_with_insufficient_balance` not `test_1`

### Snapshot Tests

The repository keeps two kinds of committed snapshots:

| Suite                     | Location                                     | Written by                         |
| ------------------------- | -------------------------------------------- | ---------------------------------- |
| Frontend (Vitest)         | `frontend/src/test/__snapshots__/*.snap`     | `toMatchSnapshot()`                |
| Smart contracts (Soroban) | `contracts/<crate>/test_snapshots/**/*.json` | every test that creates an `Env`   |

Snapshots are only useful if a human reads every change to them. Rules:

- **Never run `-u` / `--update` blindly.** Update snapshots only for the tests
  your change intentionally affects, e.g.
  `cd frontend && pnpm vitest run src/test/GroupDetailPage.snapshot.test.tsx -u`.
- **Explain every snapshot change in the PR description** — which snapshot
  changed and why the new output is correct. Reviewers must reject PRs whose
  snapshot diffs are unexplained.
- **Delete obsolete snapshots in the same PR** that removes or renames a test.
  - Frontend: Vitest prints `obsolete` entries in its summary; remove them with
    `pnpm vitest run -u` scoped to the affected file, then review the diff.
  - Contracts: Soroban does not prune `test_snapshots/` — delete the JSON
    files whose module path / test name no longer exists.
- **Keep snapshots small** — snapshot the component under test, not the whole
  page tree, so diffs stay reviewable.

### CI/CD Pipeline

All tests run automatically on:

- **Pull requests** — must pass before merge
- **Push to main** — must pass before deployment
- **Scheduled** — nightly runs for extended test suites

View CI status in GitHub Actions tab.

---

## Security: Pre-push Dependency Audit

Before pushing a branch, run the local vulnerability scan to catch known CVEs early:

```bash
# Full audit (npm + cargo)
./scripts/pre-push-audit.sh

# npm only (frontend + backend)
./scripts/pre-push-audit.sh --npm

# Rust only
./scripts/pre-push-audit.sh --cargo
```

This script is also installed as a Husky **pre-push** git hook, so it runs automatically on every `git push`. If you need to bypass it (e.g., pushing a WIP branch that you know has a known-safe advisory), run:

```bash
git push --no-verify
```

### Triage policy

See [docs/dependency-update-policy.md](docs/dependency-update-policy.md) for the full triage process. In short:

| Severity       | Required action                                                                   |
| -------------- | --------------------------------------------------------------------------------- |
| CRITICAL       | Must fix or receive explicit maintainer approval before merge                     |
| HIGH           | Must fix or document accepted risk in `.cargo/audit.toml` / `npm audit` allowlist |
| MODERATE / LOW | Log and track; do not block push                                                  |

The script exits non-zero only on HIGH or CRITICAL findings. Lower-severity advisories are reported but do not fail the check.

---

## Pull Request Process

### Branch Naming Conventions

Always branch from `main` and use descriptive names following this format:

```
<type>/<description>
```

| Type        | Use for            | Example                    |
| ----------- | ------------------ | -------------------------- |
| `feat/`     | New feature        | `feat/penalty-mechanism`   |
| `fix/`      | Bug fix            | `fix/wallet-timeout`       |
| `docs/`     | Documentation      | `docs/contributing-guide`  |
| `refactor/` | Code restructuring | `refactor/storage-layout`  |
| `test/`     | Tests only         | `test/payout-edge-cases`   |
| `perf/`     | Performance        | `perf/gas-optimization`    |
| `chore/`    | Tooling, deps      | `chore/update-soroban-sdk` |

**Example workflow:**

```bash
# Create and switch to new branch
git checkout main && git pull origin main
git checkout -b feat/penalty-mechanism

# Make changes, commit, push
git add .
git commit -m "feat(contract): implement penalty for missed contributions"
git push -u origin feat/penalty-mechanism
```

### PR Title Format

Follow Conventional Commits format:

```
<type>(<scope>): <description>
```

**Examples:**

- `feat(contract): implement penalty for missed contributions`
- `fix(frontend): resolve wallet connection timeout on mobile`
- `docs: expand contributing guide with development workflow`
- `test(contract): add fuzz tests for contribution overflow`

### PR Description Template

Fill in all sections:

```markdown
## Description

Brief summary of changes

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Performance improvement
- [ ] Breaking change

## How to Test

Step-by-step instructions to verify the changes

## Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Every snapshot change is explained in the description, and obsolete snapshots are deleted (see [Snapshot Tests](#snapshot-tests))
```

### PR Process Steps

1. **Open an issue first** for non-trivial changes — discuss the approach before investing time coding
2. **Create a branch** from `main` using naming conventions above
3. **Keep PRs focused** — one feature or fix per PR; avoid bundling unrelated changes
4. **Fill in the PR template** completely — describe what changed, why, and how to test it
5. **Ensure CI passes** — all checks must be green before requesting review
6. **Request a review** from at least one maintainer
7. **Address review comments** — push follow-up commits to the same branch; do not force-push after review has started
8. **Squash on merge** — maintainers squash commits when merging to keep history clean

### Code Review Guidelines

**For reviewers:**

- Check that tests are comprehensive
- Verify code follows style guidelines
- Ensure commit messages are clear
- Test locally if possible

**For authors:**

- Respond to all comments
- Push fixes as new commits (don't amend)
- Request re-review after addressing feedback
- Be respectful and collaborative

---

## Drips Wave Contributions

Stellar-Save participates in **Drips Wave** — a contributor funding program. Funded issues are labelled `wave-ready` on GitHub and categorised by effort:

| Label     | Points | Examples                                                   |
| --------- | ------ | ---------------------------------------------------------- |
| `trivial` | 100    | Documentation fixes, simple tests, minor UI copy           |
| `medium`  | 150    | Helper functions, validation logic, moderate features      |
| `high`    | 200    | Core features, complex integrations, security enhancements |

### How to Claim a Wave-Ready Issue

1. **Find an issue** labeled `wave-ready` on [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues?q=label%3Awave-ready)
2. **Comment on the issue** to claim it:
   ```
   I'd like to work on this issue. I'll submit a PR by [date].
   ```
3. **Create a branch** following naming conventions (see [Branch Naming Conventions](#branch-naming-conventions))
4. **Work on the issue** — follow all coding standards and testing requirements
5. **Open a PR** with a clear description and link to the issue
6. **Get reviewed** — address feedback from maintainers
7. **Merge** — once approved, your PR will be merged
8. **Claim funding** — follow instructions in [docs/wave-guide.md](docs/wave-guide.md)

### Wave-Ready Issue Categories

**Trivial (100 points)** — Good for first-time contributors

- Documentation improvements
- Simple test additions
- Minor UI/UX fixes
- Code comment improvements
- Example code

**Medium (150 points)** — Intermediate difficulty

- Helper functions and utilities
- Validation logic
- Moderate feature additions
- Performance improvements
- Bug fixes with moderate complexity

**High (200 points)** — Advanced contributors

- Core feature implementations
- Complex integrations
- Security enhancements
- Major refactoring
- Performance optimizations

### Tips for Wave-Ready Issues

- ✅ Start with `trivial` issues to get familiar with the codebase
- ✅ Read the issue description carefully — it contains specific requirements
- ✅ Ask questions in the issue comments if anything is unclear
- ✅ Follow all coding standards and testing requirements
- ✅ Write clear commit messages and PR descriptions
- ✅ Be responsive to review feedback
- ✅ One issue per PR — don't bundle multiple issues

### Funding Process

After your PR is merged:

1. Verify your PR is merged to `main`
2. Follow the instructions in [docs/wave-guide.md](docs/wave-guide.md)
3. Submit your claim with:
   - GitHub username
   - PR link
   - Issue number
   - Points claimed
4. Receive funding via Drips protocol

See [docs/wave-guide.md](docs/wave-guide.md) for detailed funding instructions.

---

## Getting Help

- **GitHub Issues** — bug reports and feature requests
- **GitHub Discussions** — questions, ideas, and general conversation
- **Telegram** — [@Xoulomon](https://t.me/Xoulomon) for quick questions

If you are unsure whether your idea fits the project, open a Discussion before writing code. We are happy to help you get your contribution across the line.
