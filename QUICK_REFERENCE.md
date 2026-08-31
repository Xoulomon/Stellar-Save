# Stellar-Save Quick Reference & Smart Contract API Guide

This document provides a quick reference to the core Soroban smart contract public entry points, error codes, and instructions for generating full interactive API documentation via `cargo doc`.

## 📚 Rust Documentation (`cargo doc`)

To build and view the complete HTML documentation for all Rust modules and smart contract methods locally:

```bash
# Build documentation for the workspace
cargo doc --workspace --no-deps

# Open the documentation in your default web browser
cargo doc --p stellar-save --no-deps --open
```

Documentation files are generated in `target/doc/stellar_save/index.html`.

---

## 🔑 Core Smart Contract Public API (`StellarSaveContract`)

| Public Function | Parameters | Return Type | Description / Invariants |
|---|---|---|---|
| `get_current_timestamp` | `env: Env` | `u64` | Returns the canonical ledger timestamp (Unix epoch seconds). |
| `validate_contribution_amount` | `env: &Env, group_id: u64, amount: i128` | `Result<(), StellarSaveError>` | Validates that contribution matches group requirement. |
| `validate_cycle_duration` | `env: &Env, cycle_duration: u64` | `Result<(), StellarSaveError>` | Checks if cycle duration lies within contract min/max boundaries. |
| `create_group` | `env: Env, creator: Address, amount: i128, cycle: u64, max_members: u32` | `Result<u64, StellarSaveError>` | Initializes a new savings group with specified contribution parameters. |
| `join_group` | `env: Env, group_id: u64, member: Address` | `Result<(), StellarSaveError>` | Adds a member address to a pending savings group. |
| `contribute` | `env: Env, group_id: u64, member: Address, amount: i128` | `Result<(), StellarSaveError>` | Records member contribution for current cycle and manages escrow. |
| `execute_payout` | `env: Env, group_id: u64` | `Result<Address, StellarSaveError>` | Transfers accumulated pool to the designated recipient for the cycle. |
| `pause_group` | `env: Env, group_id: u64, caller: Address` | `Result<(), StellarSaveError>` | Creator-only emergency pause for group operations. |
| `unpause_group` | `env: Env, group_id: u64, caller: Address` | `Result<(), StellarSaveError>` | Creator-only unpause to resume group activities. |

---

## ⚠️ Common Error Codes (`StellarSaveError` & `ContractError`)

| Error Variant | Cause / Recovery Strategy |
|---|---|
| `GroupNotFound` | Provided `group_id` does not exist in persistent storage. |
| `InvalidAmount` | Contribution amount does not match the configured group contribution requirement. |
| `AlreadyContributed` | Member has already contributed for the current active cycle. |
| `Unauthorized` | Caller lacks authorization (e.g. non-creator attempting administrative action). |
| `GroupPaused` | Operations attempted on a group currently in `Paused` status. |
| `InvalidState` | State transition disallowed by contract state machine rules. |

---

## 🔗 Related Documentation Links

- [Architecture Overview](docs/architecture.md)
- [Contract API Reference](docs/contract-api-reference.md)
- [Storage Layout Guide](docs/storage-layout.md)
- [Security Invariants](docs/security-invariants.md)
- [Contributing Guidelines](CONTRIBUTING.md)
