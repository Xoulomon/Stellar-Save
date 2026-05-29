# Design Document: validate-max-members

## Overview

This feature adds a `validate_max_members` helper function to the Stellar-Save Soroban smart contract. The function validates a proposed `max_members` value against the bounds stored in the contract's global `ContractConfig` (`config.min_members` to `config.max_members`), returning a typed `Result` so callers can handle out-of-range values without panicking.

The function follows the exact same pattern as the two existing range validators in `lib.rs`:
- `validate_cycle_duration` — checks a `u64` against `config.min_cycle_duration` / `config.max_cycle_duration`
- `validate_contribution_amount_range` — checks an `i128` against `config.min_contribution` / `config.max_contribution`

Both existing helpers live on `StellarSaveContract` as `pub fn` methods, load `ContractConfig` from persistent storage, and return `Ok(())` when no config is present (permissive default). `validate_max_members` will be identical in structure.

The requirements also mandate that `create_group` and `update_group` delegate their `max_members` range check to this new helper, eliminating the duplicated inline validation that currently exists in both functions.

---

## Architecture

The change is entirely within the `contracts/stellar-save` crate. No new modules are introduced.

```
contracts/stellar-save/src/
  lib.rs          ← add validate_max_members; refactor create_group & update_group
  helpers.rs      ← no change (formatting/display utilities only)
  error.rs        ← no change (StellarSaveError::InvalidState already exists)
  storage.rs      ← no change (StorageKeyBuilder::contract_config already exists)
```

The function is placed on `StellarSaveContract` (in `lib.rs`) alongside the two existing validators, keeping all validation logic in one place and making it callable from tests via the standard `StellarSaveContract::validate_max_members(&env, value)` pattern.

---

## Components and Interfaces

### New function: `validate_max_members`

```rust
/// Validates that a max_members value is within the allowed range.
///
/// Checks the provided value against the contract's configured
/// minimum and maximum member limits.
///
/// # Arguments
/// * `env` - Soroban environment for storage access
/// * `max_members` - The max_members value to validate
///
/// # Returns
/// * `Ok(())` - The value is valid (or no config is stored)
/// * `Err(StellarSaveError::InvalidState)` - Value is outside allowed range
pub fn validate_max_members(env: &Env, max_members: u32) -> Result<(), StellarSaveError> {
    let config_key = StorageKeyBuilder::contract_config();
    if let Some(config) = env.storage().persistent().get::<_, ContractConfig>(&config_key) {
        if max_members < config.min_members || max_members > config.max_members {
            return Err(StellarSaveError::InvalidState);
        }
    }
    Ok(())
}
```

### Modified function: `create_group`

The existing inline range check for `max_members` inside the `if let Some(config)` block is replaced with a call to `Self::validate_max_members(&env, max_members)?`. The checks for `contribution_amount` and `cycle_duration` remain inline (or can similarly delegate — out of scope for this feature).

### Modified function: `update_group`

Same refactoring as `create_group`: the inline `max_members` range check is replaced with `Self::validate_max_members(&env, new_max_members)?`.

---

## Data Models

No new data structures are introduced. The feature relies entirely on the existing `ContractConfig` struct:

```rust
pub struct ContractConfig {
    pub admin: Address,
    pub min_contribution: i128,
    pub max_contribution: i128,
    pub min_members: u32,      // lower bound for validate_max_members
    pub max_members: u32,      // upper bound for validate_max_members
    pub min_cycle_duration: u64,
    pub max_cycle_duration: u64,
}
```

The storage key used to retrieve the config is `StorageKeyBuilder::contract_config()` → `StorageKey::Counter(CounterKey::ContractConfig)`, which is already in use by `update_config`, `create_group`, and `update_group`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Below-minimum values are rejected

*For any* `ContractConfig` stored in the environment and *for any* `max_members` value strictly less than `config.min_members`, calling `validate_max_members` shall return `Err(StellarSaveError::InvalidState)`.

**Validates: Requirements 1.2**

### Property 2: Above-maximum values are rejected

*For any* `ContractConfig` stored in the environment and *for any* `max_members` value strictly greater than `config.max_members`, calling `validate_max_members` shall return `Err(StellarSaveError::InvalidState)`.

**Validates: Requirements 1.3**

### Property 3: In-range values (including boundaries) are accepted

*For any* `ContractConfig` stored in the environment and *for any* `max_members` value in the inclusive range `[config.min_members, config.max_members]`, calling `validate_max_members` shall return `Ok(())`.

**Validates: Requirements 1.4, 2.1, 2.2**

### Property 4: Contract entry points reject out-of-range max_members

*For any* `ContractConfig` stored in the environment and *for any* `max_members` value outside `[config.min_members, config.max_members]`, both `create_group` and `update_group` shall return `Err(StellarSaveError::InvalidState)`.

**Validates: Requirements 3.1, 3.2**

### Property 5: Validator is deterministic (idempotence)

*For any* environment state and *for any* `max_members` value, calling `validate_max_members` twice with the same value shall produce the same result.

**Validates: Requirements 4.7**

---

## Error Handling

| Scenario | Return value |
|---|---|
| `max_members < config.min_members` (config present) | `Err(StellarSaveError::InvalidState)` |
| `max_members > config.max_members` (config present) | `Err(StellarSaveError::InvalidState)` |
| `max_members` in `[config.min_members, config.max_members]` | `Ok(())` |
| No `ContractConfig` in storage | `Ok(())` (permissive default) |

`StellarSaveError::InvalidState` (code 1003) is the correct error because an out-of-range `max_members` represents a group configuration that violates the contract's global policy — the same error used by `validate_cycle_duration` for the analogous out-of-range case.

No new error variants are needed.

---

## Testing Strategy

### Unit tests (in `lib.rs` `#[cfg(test)]` block)

Unit tests cover the concrete examples and edge cases required by Requirement 4:

| Test name | Scenario |
|---|---|
| `test_validate_max_members_at_min_boundary` | `max_members == config.min_members` → `Ok(())` |
| `test_validate_max_members_at_max_boundary` | `max_members == config.max_members` → `Ok(())` |
| `test_validate_max_members_in_range` | `min < max_members < max` → `Ok(())` |
| `test_validate_max_members_below_min` | `max_members < config.min_members` → `Err(InvalidState)` |
| `test_validate_max_members_above_max` | `max_members > config.max_members` → `Err(InvalidState)` |
| `test_validate_max_members_no_config` | no config stored → `Ok(())` |

### Property-based tests

The project uses Rust's built-in test framework. For property-based testing, use the [`proptest`](https://github.com/proptest-rs/proptest) crate (add `proptest = "1"` under `[dev-dependencies]` in `contracts/stellar-save/Cargo.toml`).

Each property test runs a minimum of 100 iterations (proptest default is 256, which exceeds this).

**Tag format used in comments:** `Feature: validate-max-members, Property {N}: {property_text}`

```rust
// Feature: validate-max-members, Property 1: below-minimum values are rejected
proptest! {
    #[test]
    fn prop_below_min_rejected(min in 2u32..=100u32, delta in 1u32..=50u32) {
        let max = min + 50;
        let value = min.saturating_sub(delta);
        if value < min {
            // set up env with config(min, max), call validate_max_members(value)
            // assert Err(InvalidState)
        }
    }
}

// Feature: validate-max-members, Property 2: above-maximum values are rejected
proptest! {
    #[test]
    fn prop_above_max_rejected(min in 2u32..=50u32, max_offset in 0u32..=50u32, delta in 1u32..=50u32) {
        let max = min + max_offset;
        let value = max.saturating_add(delta);
        // set up env with config(min, max), call validate_max_members(value)
        // assert Err(InvalidState)
    }
}

// Feature: validate-max-members, Property 3: in-range values are accepted
proptest! {
    #[test]
    fn prop_in_range_accepted(min in 2u32..=50u32, max_offset in 0u32..=50u32, value_offset in 0u32..=50u32) {
        let max = min + max_offset;
        let value = min + (value_offset % (max_offset + 1));
        // set up env with config(min, max), call validate_max_members(value)
        // assert Ok(())
    }
}

// Feature: validate-max-members, Property 4: contract entry points reject out-of-range
proptest! {
    #[test]
    fn prop_create_group_rejects_out_of_range(min in 2u32..=10u32, delta in 1u32..=10u32) {
        let max = min + 5;
        let bad_value = max + delta;
        // set up env with config, call create_group with bad_value
        // assert Err(InvalidState)
    }
}

// Feature: validate-max-members, Property 5: validator is deterministic
proptest! {
    #[test]
    fn prop_validator_deterministic(min in 2u32..=50u32, max_offset in 0u32..=50u32, value in 0u32..=200u32) {
        let max = min + max_offset;
        // set up env with config(min, max)
        // call validate_max_members(value) twice
        // assert both results are equal
    }
}
```

Unit tests catch concrete bugs at specific values; property tests verify the general correctness rules hold across the full input space.
