# Implementation Plan: validate-max-members

## Overview

Add `validate_max_members` to `StellarSaveContract` in `lib.rs`, following the same pattern as `validate_cycle_duration` and `validate_contribution_amount_range`. Then refactor `create_group` and `update_group` to delegate their inline `max_members` range check to the new helper. Finally, add `proptest` property tests alongside unit tests.

## Tasks

- [x] 1. Add `validate_max_members` to `StellarSaveContract` in `lib.rs`
  - Add the function after `validate_contribution_amount_range`, following the same structure
  - Load `ContractConfig` via `StorageKeyBuilder::contract_config()`; if absent return `Ok(())`
  - Return `Err(StellarSaveError::InvalidState)` when `max_members < config.min_members || max_members > config.max_members`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Refactor `create_group` to use `validate_max_members`
  - Inside the existing `if let Some(config)` block in `create_group`, replace the inline `max_members < config.min_members || max_members > config.max_members` check with `Self::validate_max_members(&env, max_members)?`
  - Keep the remaining inline checks for `contribution_amount` and `cycle_duration` unchanged
  - _Requirements: 3.1_

- [x] 3. Refactor `update_group` to use `validate_max_members`
  - Inside the existing `if let Some(config)` block in `update_group`, replace the inline `new_max_members < config.min_members || new_max_members > config.max_members` check with `Self::validate_max_members(&env, new_max_members)?`
  - Keep the remaining inline checks unchanged
  - _Requirements: 3.2_

- [x] 4. Write unit tests for `validate_max_members`
  - [x] 4.1 Add unit tests in the `#[cfg(test)]` block in `lib.rs`
    - `test_validate_max_members_at_min_boundary` — `max_members == config.min_members` → `Ok(())`
    - `test_validate_max_members_at_max_boundary` — `max_members == config.max_members` → `Ok(())`
    - `test_validate_max_members_in_range` — `min < max_members < max` → `Ok(())`
    - `test_validate_max_members_below_min` — `max_members < config.min_members` → `Err(InvalidState)`
    - `test_validate_max_members_above_max` — `max_members > config.max_members` → `Err(InvalidState)`
    - `test_validate_max_members_no_config` — no config stored → `Ok(())`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write property test for Property 1 — below-minimum values are rejected
    - **Property 1: Below-minimum values are rejected**
    - **Validates: Requirements 1.2**
    - Use `proptest!` macro; generate arbitrary `(min, delta)` such that `value = min.saturating_sub(delta) < min`; assert `Err(StellarSaveError::InvalidState)`

  - [ ]* 4.3 Write property test for Property 2 — above-maximum values are rejected
    - **Property 2: Above-maximum values are rejected**
    - **Validates: Requirements 1.3**
    - Use `proptest!` macro; generate arbitrary `(min, max_offset, delta)` such that `value = max.saturating_add(delta) > max`; assert `Err(StellarSaveError::InvalidState)`

  - [ ]* 4.4 Write property test for Property 3 — in-range values (including boundaries) are accepted
    - **Property 3: In-range values are accepted**
    - **Validates: Requirements 1.4, 2.1, 2.2**
    - Use `proptest!` macro; generate arbitrary `(min, max_offset, value_offset)` and clamp `value` to `[min, max]`; assert `Ok(())`

  - [ ]* 4.5 Write property test for Property 4 — contract entry points reject out-of-range max_members
    - **Property 4: Contract entry points reject out-of-range max_members**
    - **Validates: Requirements 3.1, 3.2**
    - Use `proptest!` macro; call `create_group` with `bad_value > config.max_members`; assert `Err(StellarSaveError::InvalidState)`

  - [ ]* 4.6 Write property test for Property 5 — validator is deterministic
    - **Property 5: Validator is deterministic (idempotence)**
    - **Validates: Requirements 4.7**
    - Use `proptest!` macro; call `validate_max_members` twice with the same value and same env state; assert both results are equal

- [ ] 5. Checkpoint — Ensure all tests pass
  - Run `cargo test -p stellar-save` and confirm all unit and property tests pass; ask the user if any questions arise.
