# Clippy Policy — contracts/stellar-save

This document describes the Clippy lint policy for the `stellar-save` Soroban
smart contract, how to run the linter, the pre-push hook setup, and how to handle
justified exceptions.

---

## Policy

All code in `contracts/stellar-save` must pass:

```bash
cargo clippy --locked --manifest-path contracts/stellar-save/Cargo.toml --all-targets -- -D warnings
```

**Warnings are treated as errors** (via `-D warnings`). A PR cannot be merged if
Clippy reports any warning.

---

## Running Clippy Locally

```bash
# From the workspace root
cargo +1.94.1 clippy \
  --locked \
  --manifest-path contracts/stellar-save/Cargo.toml \
  --all-targets \
  -- -D warnings
```

Auto-fix suggestions (safe fixes only):

```bash
cargo +1.94.1 clippy --fix \
  --locked \
  --manifest-path contracts/stellar-save/Cargo.toml \
  --lib -p stellar-save
```

> The project pins to **Rust 1.81** via `rust-toolchain.toml`. Clippy CI uses
> **Rust 1.94.1** because some transitive dependencies require `edition = 2024`
> support. Both compile the same contract code; only the toolchain used to invoke
> Clippy differs.

---

## CI Workflow

The `.github/workflows/clippy.yml` workflow runs automatically on every push and
pull request that touches contract code. It:

1. Installs Rust 1.94.1 with the `clippy` component
2. Runs `cargo clippy --all-targets -- -D warnings`
3. Runs `cargo test` to confirm no regressions

A failing Clippy job blocks PR merges.

---

## Pre-push Hook

A Git pre-push hook at `.husky/pre-push` runs Clippy before every push.
It is installed automatically by Husky (`npm ci` in the `frontend/` directory
sets up the hooks).

To run it manually:

```bash
bash .husky/pre-push
```

To bypass in a genuine emergency (record the reason in the PR):

```bash
git push --no-verify
```

---

## Exception Process

If a Clippy lint must be suppressed, follow these steps:

### Step 1 — Confirm the lint is a false positive or unavoidable

Common justified reasons:
- The lint fires on generated/macro-expanded code that cannot be changed
- The Soroban SDK pattern requires a construct Clippy flags (e.g. specific
  `unsafe` or overly-complex match arms in contract entry points)
- The lint is `clippy::pedantic` / `clippy::nursery` and the suggested
  refactor would make the intent less clear

### Step 2 — Add an `#[allow(...)]` with a comment

Place the attribute on the smallest possible scope (single expression >
function > module > crate). Always include a comment explaining why:

```rust
// The Soroban macro expands this function signature; env is required
// by the contract ABI even though the body does not use it.
#[allow(unused_variables)]
pub fn some_contract_fn(env: Env, arg: u32) -> u32 {
    arg * 2
}
```

### Step 3 — Document the exception below

Add a row to the **Active Exceptions** table in this file. The PR reviewer
must confirm the justification before merging.

---

## Active Exceptions

| Lint | Location | Justification | Added |
|------|----------|---------------|-------|
| *(none)* | — | — | — |

---

## Fixed Violations (history)

| Lint | File | Fix applied | PR |
|------|------|-------------|-----|
| `unused_variables` (`env`) | `src/lib.rs:35` | Renamed to `_env` | #1357 |
| `clippy::bool_assert_comparison` | `src/group.rs:276` | Replaced `assert_eq!(x, true)` with `assert!(x)` | #1357 |
