# First-Time Contributor Guide

Welcome to Stellar-Save! This guide walks you through making your first contribution from zero — no prior Stellar or Soroban experience required.

---

## What is Stellar-Save?

Stellar-Save is a decentralized **ROSCA** (Rotating Savings and Credit Association) — a community savings system common in Nigeria and across Africa where members contribute a fixed amount each cycle and take turns receiving the full pool. We have built this on the Stellar blockchain using Soroban smart contracts, making it trustless, transparent, and accessible globally.

---

## Before you write any code

### 1. Read the basics

- [README.md](../README.md) — project overview and quick start
- [docs/architecture.md](architecture.md) — how the system fits together
- [CONTRIBUTING.md](../CONTRIBUTING.md) — full contributor reference

### 2. Find something to work on

The easiest place to start is a `wave-ready` issue on GitHub. These are pre-scoped, funded tasks with clear acceptance criteria:

- **`trivial` (100 points)** — documentation fixes, simple tests, minor UI copy changes
- **`medium` (150 points)** — helper functions, validation logic, moderate features
- **`high` (200 points)** — core features, complex integrations, security enhancements

Filter issues by the `good first issue` label if you want something even smaller to start with.

### 3. Comment on the issue

Before starting, leave a comment on the issue saying you are working on it. This prevents duplicate effort and gives maintainers a chance to share context that is not in the issue description.

---

## Setting up your environment

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

The project pins Rust to **1.81.0** via `rust-toolchain.toml`. Rustup will install the correct version automatically when you run any `cargo` command inside the repo.

### Install the Stellar CLI

```bash
cargo install --locked stellar-cli --features opt
```

Verify:

```bash
stellar --version
```

### Install Node.js

Download from [nodejs.org](https://nodejs.org) or use a version manager like `nvm`:

```bash
nvm install 20
nvm use 20
```

### Fork and clone the repository

1. Click **Fork** on the GitHub repository page
2. Clone your fork:

```bash
git clone https://github.com/<your-username>/Stellar-Save.git
cd Stellar-Save
```

3. Add the upstream remote so you can pull future changes:

```bash
git remote add upstream https://github.com/Xoulomon/Stellar-Save.git
```

### Install dependencies

```bash
# Root-level tooling (commitlint, husky)
npm install

# Frontend
cd frontend && npm install && cd ..
```

### Verify the setup

```bash
# Build the smart contract
cargo build --target wasm32-unknown-unknown --release

# Run contract tests
cargo test -p stellar-save

# Run frontend tests
cd frontend && npm test run && cd ..
```

All tests should pass. If something fails, open an issue or ask in GitHub Discussions before proceeding.

---

## Making your first change

### 1. Create a branch

Always branch from an up-to-date `main`:

```bash
git checkout main
git pull upstream main
git checkout -b docs/improve-faq
```

Use a descriptive branch name that matches the type of change:
- `feat/` — new feature
- `fix/` — bug fix
- `docs/` — documentation
- `test/` — tests only
- `refactor/` — restructuring

### 2. Make your changes

Keep changes focused. A PR that does one thing is much easier to review than one that does five.

**For Rust changes**, run these before committing:

```bash
cargo fmt
cargo clippy -- -D warnings
cargo test -p stellar-save
```

**For frontend changes**, run:

```bash
cd frontend
npm run lint
npm test run
```

### 3. Commit your changes

We use [Conventional Commits](https://www.conventionalcommits.org/). The format is:

```
<type>(<scope>): <short description>
```

Examples:

```bash
git commit -m "docs: fix typo in architecture overview"
git commit -m "fix(contract): handle zero-amount contribution correctly"
git commit -m "feat(frontend): add group search filter"
```

A Husky hook will validate your commit message format automatically. If it rejects your message, check the [commit types table in CONTRIBUTING.md](../CONTRIBUTING.md#commit-message-conventions).

### 4. Push and open a PR

```bash
git push -u origin docs/improve-faq
```

Then open a pull request on GitHub from your fork to `Xoulomon/Stellar-Save:main`. Fill in the PR template completely — the more context you provide, the faster the review.

---

## Understanding the codebase

### Smart contract structure

The main contract lives in `contracts/stellar-save/src/`. Key files to read first:

| File | What it does |
|---|---|
| `lib.rs` | Public contract API — all callable functions |
| `group.rs` | Group creation, configuration, membership |
| `contribution.rs` | Contribution recording and validation |
| `payout.rs` | Payout rotation logic |
| `error.rs` | All error types — read this to understand failure modes |
| `storage.rs` | How data is stored on-chain |

### Frontend structure

The frontend lives in `frontend/src/`. Key directories:

| Directory | What it contains |
|---|---|
| `components/` | Reusable UI components |
| `pages/` | Top-level route pages |
| `hooks/` | Custom React hooks (wallet, groups, transactions) |
| `test/` | Test setup and integration tests |

### How a contribution flows

1. User clicks "Contribute" in the frontend
2. Frontend builds a Soroban transaction using `@stellar/stellar-sdk`
3. User signs the transaction with their Freighter wallet
4. Transaction is submitted to the Stellar network
5. The `contribute()` function in `lib.rs` is invoked on-chain
6. `contribution.rs` validates and records the contribution
7. If all members have contributed, `payout_executor.rs` triggers the payout
8. Events are emitted and the frontend updates via Soroban event subscriptions

---

## Common questions

**Do I need XLM to contribute?**
For development, use the testnet. You can get free testnet XLM from the [Stellar Friendbot](https://friendbot.stellar.org).

**How do I run a local Stellar node?**
The easiest option is to use the testnet (`STELLAR_NETWORK=testnet` in your `.env`). For a fully local setup, see [docs/deployment.md](deployment.md).

**My commit was rejected by the hook — what do I do?**
Check the error message from commitlint. The most common issues are: wrong type (use one from the allowed list), subject line too long (keep it under 100 characters), or wrong format (must be `type(scope): description`).

**Can I contribute without knowing Rust?**
Yes. Documentation, frontend, tests, and tooling contributions are all valuable and do not require Rust knowledge.

**How long does review take?**
We aim to review PRs within a few days. If you have not heard back after a week, leave a comment on the PR to ping maintainers.

---

## Useful commands reference

```bash
# Build contract
cargo build --target wasm32-unknown-unknown --release

# Run all contract tests
cargo test --workspace

# Run contract tests with output
cargo test -p stellar-save -- --nocapture

# Format Rust code
cargo fmt

# Lint Rust code
cargo clippy -- -D warnings

# Run frontend dev server
cd frontend && npm run dev

# Run frontend tests (watch)
cd frontend && npm test

# Run frontend tests (single run)
cd frontend && npm test run

# Run frontend linter
cd frontend && npm run lint

# Deploy to testnet
./scripts/deploy_testnet.sh
```

---

## Still stuck?

- Open a [GitHub Discussion](https://github.com/Xoulomon/Stellar-Save/discussions) — no question is too small
- Comment on the issue you are working on
- Reach out on Telegram: [@Xoulomon](https://t.me/Xoulomon)

We want your contribution to succeed. Do not hesitate to ask for help.
