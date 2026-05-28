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

| Module | Responsibility |
|---|---|
| `lib.rs` | Contract entry points and public API |
| `group.rs` | Group creation and configuration |
| `contribution.rs` | Contribution logic and tracking |
| `payout.rs` / `payout_executor.rs` | Payout rotation and distribution |
| `storage.rs` | On-chain data layout |
| `security.rs` | Authorization and access control |
| `error.rs` | Typed error variants |
| `events.rs` | Soroban event emission |

**Frontend** (`frontend/src/`): React 19 + TypeScript SPA using MUI, React Router, and `@stellar/stellar-sdk`.

For full architecture details see [docs/architecture.md](docs/architecture.md).

---

## Development Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | 1.81.0 (pinned) | [rustup.rs](https://rustup.rs) |
| Soroban / Stellar CLI | latest | [Stellar CLI docs](https://developers.stellar.org/docs/tools/stellar-cli) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | bundled with Node.js |

The Rust toolchain version is pinned in `rust-toolchain.toml`. Running any `cargo` command will install it automatically via rustup.

### Clone and install

```bash
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save

# Install root-level tooling (commitlint, husky)
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

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
npm run dev
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

- Run `cargo fmt` before every commit — formatting is enforced in CI
- Run `cargo clippy -- -D warnings` and fix all warnings before opening a PR
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

### General

- `.editorconfig` is present — use an editor that respects it (UTF-8, LF line endings, final newline)
- Do not commit secrets, private keys, or `.env` files — `.gitignore` covers common cases but double-check before staging

---

## Commit Message Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Commits are validated by commitlint via a Husky `commit-msg` hook.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Allowed types

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring without behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, tooling |
| `ci` | CI/CD configuration changes |
| `revert` | Reverting a previous commit |

### Rules

- Use imperative mood: "add" not "added" or "adds"
- Keep the subject line under 100 characters
- Reference issues in the footer: `Closes #42`
- Use `feat!` or add `BREAKING CHANGE:` in the footer for breaking changes

### Examples

```
feat(contract): add penalty mechanism for missed contributions

fix(frontend): correct off-by-one in payout position display

docs: expand contributing guide with architecture overview

test(contract): add fuzz tests for contribution overflow edge cases

chore: update soroban-sdk to 23.0.3
```

---

## Testing Requirements

### Smart contract (Rust)

All new public functions must have tests covering:
- The happy path
- Expected error cases (use `assert_eq!(result, Err(ContractError::...))`)

Run the full test suite before opening a PR:

```bash
# All contracts
cargo test --workspace

# Stellar-save contract only
cargo test -p stellar-save

# With stdout output
cargo test -- --nocapture

# With coverage (requires cargo-tarpaulin)
cargo tarpaulin --config contracts/stellar-save/tarpaulin.toml
```

Test snapshots live in `contracts/stellar-save/test_snapshots/`. Update them if your change intentionally affects output.

### Frontend (TypeScript)

Add tests for new utility functions and hooks. Component tests are encouraged.

```bash
cd frontend

# Watch mode (development)
npm test

# Single run (CI)
npm test run

# With coverage
npm run test:coverage

# Accessibility checks are included via jest-axe / vitest-axe
```

Test files live alongside source files as `*.test.ts` / `*.test.tsx`. Setup is in `src/test/setup.ts`.

### General rules

- Do not reduce overall test coverage — PRs that delete tests without replacement will be rejected
- If you find a bug, write a failing test that reproduces it before fixing it
- CI must be green before requesting review

---

## Pull Request Process

1. **Open an issue first** for non-trivial changes — discuss the approach before investing time coding
2. **Branch from `main`** — never commit directly to `main`

   ```bash
   git checkout main && git pull origin main
   git checkout -b feat/your-feature-name
   ```

   Branch naming conventions:
   - `feat/description` — new feature
   - `fix/description` — bug fix
   - `docs/description` — documentation
   - `refactor/description` — refactoring
   - `test/description` — tests only

3. **Keep PRs focused** — one feature or fix per PR; avoid bundling unrelated changes
4. **Fill in the PR template** completely — describe what changed, why, and how to test it
5. **Ensure CI passes** — all checks must be green before requesting review
6. **Request a review** from at least one maintainer
7. **Address review comments** — push follow-up commits to the same branch; do not force-push after review has started
8. **Squash on merge** — maintainers squash commits when merging to keep history clean

### PR title format

Follow the same Conventional Commits format as commit messages:

```
feat(contract): implement penalty for missed contributions
fix(frontend): resolve wallet connection timeout on mobile
```

---

## Drips Wave Contributions

Stellar-Save participates in **Drips Wave** — a contributor funding program. Funded issues are labelled `wave-ready` on GitHub and categorised by effort:

| Label | Points | Examples |
|---|---|---|
| `trivial` | 100 | Documentation fixes, simple tests, minor UI copy |
| `medium` | 150 | Helper functions, validation logic, moderate features |
| `high` | 200 | Core features, complex integrations, security enhancements |

See [docs/wave-guide.md](docs/wave-guide.md) for how to claim and earn funding.

---

## Getting Help

- **GitHub Issues** — bug reports and feature requests
- **GitHub Discussions** — questions, ideas, and general conversation
- **Telegram** — [@Xoulomon](https://t.me/Xoulomon) for quick questions

If you are unsure whether your idea fits the project, open a Discussion before writing code. We are happy to help you get your contribution across the line.
