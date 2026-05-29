# Design Document: get-current-timestamp

## Overview

This feature adds a `get_current_timestamp` function to the `StellarSaveContract` in `contracts/stellar-save/src/lib.rs`. The function wraps `env.ledger().timestamp()` and exposes it both as a public contract method (callable by external clients) and as an internal helper (callable by other contract functions).

The motivation is to establish a single, canonical source of time within the contract. Currently, several functions (`create_group`, `record_contribution`, `pause_contract`, etc.) each call `env.ledger().timestamp()` inline. Centralizing this behind a named function improves readability, makes the intent explicit, and simplifies future auditing of all time-dependent logic.

The implementation is intentionally minimal: no storage reads or writes, no authorization checks, no pause-state checks. It simply returns the ledger timestamp.

## Architecture

The function lives on `StellarSaveContract` in `lib.rs`, consistent with all other public contract methods. No new modules or files are required.

```mermaid
graph TD
    A[External Caller / Test] -->|invoke| B[get_current_timestamp]
    B -->|reads| C[env.ledger().timestamp()]
    C -->|u64| B
    B -->|u64| A

    D[create_group] -->|calls| B
    E[record_contribution] -->|calls| B
    F[pause_contract] -->|calls| B
```

The function is stateless: it reads only from the Soroban host environment, not from contract storage.

## Components and Interfaces

### Public Contract Method

```rust
/// Returns the current ledger timestamp as Unix epoch seconds.
///
/// This is the canonical time source for all time-dependent logic in the contract.
/// It performs no storage reads or writes and does not check pause state.
///
/// # Returns
/// The current ledger timestamp as `u64` (Unix epoch seconds).
pub fn get_current_timestamp(env: Env) -> u64 {
    env.ledger().timestamp()
}
```

This method is added to the `#[contractimpl]` block on `StellarSaveContract`.

### Internal Helper Usage

Other functions that currently call `env.ledger().timestamp()` inline can optionally delegate to this method. For example, in `create_group`:

```rust
// Before
let current_time = env.ledger().timestamp();

// After (optional refactor, not required by this spec)
let current_time = Self::get_current_timestamp(env.clone());
```

The requirement is that `get_current_timestamp` is *available* for internal callers; wholesale refactoring of existing call sites is out of scope for this feature.

### Relationship to `is_cycle_deadline_passed`

`is_cycle_deadline_passed` in `helpers.rs` already accepts `current_time: u64` as a parameter rather than calling `env.ledger().timestamp()` directly. Call sites that pass the timestamp to this helper can obtain it via `get_current_timestamp`, keeping the time source consistent.

## Data Models

No new data types or storage keys are introduced by this feature.

The function signature uses only existing types:

| Element | Type | Description |
|---------|------|-------------|
| `env` | `soroban_sdk::Env` | Soroban host environment (passed by value per SDK convention) |
| return value | `u64` | Unix epoch seconds from `env.ledger().timestamp()` |

The Soroban `Env` object is the standard entry point for all host functions including ledger access. `env.ledger().timestamp()` returns a `u64` representing seconds since the Unix epoch, consistent with how all other time values are stored and compared throughout the contract.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Timestamp round-trip

*For any* ledger timestamp value `T` set in the test environment, calling `get_current_timestamp` must return exactly `T`.

This property subsumes several related criteria: it implies idempotence (two calls in the same ledger both return `T`), it implies the return value is positive whenever `T > 0`, and it implies consistency with any other code that reads `env.ledger().timestamp()` in the same ledger context.

**Validates: Requirements 1.2, 1.4, 2.2, 2.3, 3.2, 3.3, 3.4**

## Error Handling

`get_current_timestamp` has no error conditions. It cannot fail:

- It performs no storage access, so there are no missing-key or deserialization errors.
- It does not check authorization, so there are no `Unauthorized` errors.
- It does not check pause state, so `ContractPaused` is never returned.
- `env.ledger().timestamp()` is a host function that always succeeds within a valid Soroban execution context.

The return type is `u64` (not `Result<u64, StellarSaveError>`), reflecting the infallibility of the operation.

## Testing Strategy

### Unit Tests

Unit tests cover specific examples and the pause-state edge case. They live in the `#[cfg(test)]` block in `lib.rs` (or a dedicated test module).

1. Basic invocation — set ledger timestamp to a known value, call `get_current_timestamp`, assert the return equals that value.
2. Paused contract — initialize and pause the contract, call `get_current_timestamp`, assert it still returns the correct ledger timestamp (verifies the function ignores pause state).

These tests are fast, deterministic, and document the expected behavior concretely.

### Property-Based Tests

Property-based tests use [`proptest`](https://github.com/proptest-rs/proptest) (the standard PBT library for Rust). Each test runs a minimum of 100 iterations with randomly generated inputs.

**Property Test 1: Timestamp round-trip**

```rust
// Feature: get-current-timestamp, Property 1: Timestamp round-trip
proptest! {
    #[test]
    fn prop_get_current_timestamp_returns_ledger_value(t in 1u64..=u64::MAX) {
        let env = Env::default();
        env.ledger().with_mut(|l| l.timestamp = t);
        let result = StellarSaveContract::get_current_timestamp(env);
        prop_assert_eq!(result, t);
    }
}
```

This single property covers Requirements 1.2, 1.4, 2.2, 2.3, 3.2, 3.3, and 3.4 by generating random `u64` timestamps and asserting the function returns them unchanged.

### Test Configuration

- Minimum 100 iterations per property test (proptest default is 256, which exceeds this).
- Each property test is tagged with a comment referencing the design property: `Feature: get-current-timestamp, Property {number}: {property_text}`.
- Unit tests and property tests are complementary: unit tests pin specific examples, property tests verify the general rule.
