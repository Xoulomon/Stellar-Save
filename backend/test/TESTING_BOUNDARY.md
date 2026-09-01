# Test Boundary: Unit vs Integration

This document defines the boundary between unit and integration tests in the
`contracts/stellar-save` codebase. Follow these rules when adding new tests.

---

## Boundary Definition

| Level | Location | What it tests | Env dependency |
|-------|----------|---------------|----------------|
| **Unit** | Inline `#[cfg(test)]` in each `*.rs` module | Pure logic, data structures, state transitions, validation rules — no I/O | `Env::default()` only for `Address::generate`; no storage reads/writes |
| **Integration** | `payout_executor.rs` tests that exercise storage | Wiring between business logic and Soroban storage: correct key used, correct value written, round-trip read | Full `Env` with `env.storage().persistent()` reads/writes |

### Rule of thumb

> **Unit tests own the logic. Integration tests own the wiring.**
>
> If a test calls `env.storage().persistent().get(...)` or `.set(...)` to
> assert a result, it is an integration test and belongs in the module that
> owns the storage operation.  
> If a test only manipulates in-memory structs and calls `.is_ok()` /
> `.unwrap_err()`, it is a unit test and belongs in the struct's own module.

---

## Module Ownership Map

| Module | Level | Owns |
|--------|-------|------|
| `contribution.rs` | Unit | `ContributionRecord` construction, validation, query methods |
| `cycle_advancement.rs` | Unit | Pure cycle-increment logic (`advance_group_cycle_logic`) |
| `error.rs` | Unit | Error codes, categories, string representations |
| `events.rs` | Unit | Event emission field values |
| `group.rs` | Unit | `Group` struct lifecycle, status transitions, validation |
| `helpers.rs` | Unit | Format utilities, deadline calculations, current-cycle math |
| `payout.rs` | Unit | `PayoutRecord` construction, validation, query methods |
| `pool.rs` | Unit | `calculate_total_pool`, `PoolInfo` derived fields |
| `security.rs` | Unit | ed25519 input length validation |
| `status.rs` | Unit | `GroupStatus` state-machine transitions, serialisation |
| `storage.rs` | Unit | `StorageKeyBuilder` key construction and uniqueness |
| `payout_executor.rs` | **Integration** | Storage persistence wiring: `record_payout`, `update_member_status`, `advance_cycle_or_complete` (storage key correctness only) |

---

## What Belongs Where — Examples

### ✅ Unit test (keep in the struct's own module)

```rust
// payout.rs — owns PayoutRecord
#[test]
fn test_invalid_amount() {
    // Tests that PayoutRecord::new panics on amount == 0.
    // Pure constructor logic — no storage involved.
    PayoutRecord::new(recipient, 1, 0, 0, 1234567890); // should panic
}
```

### ✅ Integration test (keep in payout_executor.rs)

```rust
// payout_executor.rs — owns the storage wiring
#[test]
fn test_record_payout_stores_both_keys() {
    // Tests that record_payout writes to BOTH storage keys
    // (payout_record + payout_recipient). This is wiring, not logic.
    let result = record_payout(&env, group_id, cycle, recipient, amount, ts);
    assert!(result.is_ok());
    // Verify both keys are present in storage
    let record: Option<PayoutRecord> = env.storage().persistent().get(&record_key);
    let recip:  Option<Address>       = env.storage().persistent().get(&recip_key);
    assert!(record.is_some());
    assert!(recip.is_some());
}
```

### ❌ Do NOT add this to payout_executor.rs (duplicate of payout.rs unit test)

```rust
// This belongs in payout.rs, not payout_executor.rs
#[test]
#[should_panic(expected = "amount must be greater than 0")]
fn test_record_payout_zero_amount() {
    // Tests PayoutRecord::new validation — pure unit test
    record_payout(&env, group_id, cycle, recipient, 0, ts); // wrong level
}
```

---

## Deduplication History

See `backend/test/AUDIT.md` for the full overlap audit.

**Summary of duplicates removed (PR #1543):**

| Removed from | Reason | Canonical home |
|-------------|--------|----------------|
| `payout_executor.rs::test_advance_cycle_or_complete_valid` | Same logic as `cycle_advancement.rs::test_advance_group_cycle_logic_success` | `cycle_advancement.rs` |
| `payout_executor.rs::test_advance_cycle_or_complete_to_completion` | Same as `cycle_advancement.rs::test_advance_group_cycle_logic_completion` | `cycle_advancement.rs` |
| `payout_executor.rs::test_advance_cycle_or_complete_small_group` | Same as above (2-member variant) | `cycle_advancement.rs` |
| `payout_executor.rs::test_advance_cycle_or_complete_large_group` | Same as `test_advance_group_cycle_logic_progression` | `cycle_advancement.rs` |
| `payout_executor.rs::test_advance_cycle_or_complete_increments_by_one` | Same as `test_advance_group_cycle_logic_success` | `cycle_advancement.rs` |
| `payout_executor.rs::test_advance_cycle_or_complete_already_complete` | Same as `test_advance_group_cycle_logic_error_on_already_complete` | `cycle_advancement.rs` |
| `payout_executor.rs::test_record_payout_zero_amount` | Same as `payout.rs::test_invalid_amount` | `payout.rs` |
| `payout_executor.rs::test_record_payout_negative_amount` | Same as `payout.rs::test_invalid_amount` | `payout.rs` |
| `payout_executor.rs::test_record_payout_validation` | Same as `payout.rs::test_validate` | `payout.rs` |

---

## Running Tests

```bash
# All contract tests (from repo root)
cargo test --manifest-path contracts/stellar-save/Cargo.toml -- --test-threads=1

# Single module
cargo test --manifest-path contracts/stellar-save/Cargo.toml payout_executor
cargo test --manifest-path contracts/stellar-save/Cargo.toml cycle_advancement
cargo test --manifest-path contracts/stellar-save/Cargo.toml payout

# With output
cargo test --manifest-path contracts/stellar-save/Cargo.toml -- --nocapture --test-threads=1
```
