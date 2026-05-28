# Implementation Plan: calculate_current_cycle

## Overview

Add a pure `calculate_current_cycle` helper function to `contracts/stellar-save/src/helpers.rs`. The function reads a `Group` from persistent storage and the current ledger timestamp, then returns the capped cycle index as `Result<u32, StellarSaveError>`.

## Tasks

- [x] 1. Implement `calculate_current_cycle` in `helpers.rs`
  - Add the function after `is_cycle_deadline_passed` in `contracts/stellar-save/src/helpers.rs`
  - Import `StellarSaveError` and `StorageKeyBuilder` at the top of the file (they are already available via `crate::`)
  - Implement the four-step logic: load group → early-return if not started or clock skew → integer division → cap and cast
  - Signature: `pub fn calculate_current_cycle(env: &Env, group_id: u64) -> Result<u32, StellarSaveError>`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

- [x] 2. Write unit tests for `calculate_current_cycle`
  - Add tests inside the existing `#[cfg(test)] mod tests` block in `helpers.rs`
  - [x] 2.1 Test: non-existent `group_id` returns `Err(GroupNotFound)`
    - _Requirements: 1.2, 5.1, 6.1_
  - [x] 2.2 Test: group with `started = false` returns `Ok(0)`
    - _Requirements: 1.3, 6.2_
  - [x] 2.3 Test: query at exactly `started_at` (zero elapsed) returns `Ok(0)`
    - _Requirements: 2.2, 6.5_
  - [x] 2.4 Test: query at `started_at + cycle_duration * N` returns `Ok(N)` for N = 1, 2, 3
    - _Requirements: 3.1, 3.3, 6.3_
  - [x] 2.5 Test: query at `started_at + cycle_duration * N - 1` returns `Ok(N-1)` (no partial cycle)
    - _Requirements: 3.3, 6.3_
  - [x] 2.6 Test: query far in the future returns `Ok(max_members - 1)` (cap)
    - _Requirements: 4.2, 4.4, 6.4_

- [x] 3. Checkpoint — Ensure all unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Write property-based tests using `proptest`
  - Add a `proptest!` block inside the `#[cfg(test)] mod tests` block in `helpers.rs`
  - `proptest` is already listed in `[dev-dependencies]` in `contracts/stellar-save/Cargo.toml`
  - [ ]* 4.1 Write property test for Property 1: GroupNotFound for unknown group_id
    - Generate random `u64` group_ids that have not been stored; assert `Err(GroupNotFound)`
    - **Property 1: GroupNotFound for unknown group_id**
    - **Validates: Requirements 1.2, 5.1**
  - [ ]* 4.2 Write property test for Property 2: Unstarted group always returns cycle 0
    - Generate random `Group` values with `started = false`; assert `Ok(0)`
    - **Property 2: Unstarted group always returns cycle 0**
    - **Validates: Requirements 1.3**
  - [ ]* 4.3 Write property test for Property 3: Cycle count correctness formula
    - Generate random started groups and `current_time >= started_at`; assert result equals `min(floor((current_time - started_at) / cycle_duration), max_members - 1) as u32`
    - **Property 3: Cycle count correctness formula**
    - **Validates: Requirements 2.2, 3.1, 3.3, 4.2, 6.3**
  - [ ]* 4.4 Write property test for Property 4: Result is always a valid cycle index
    - Generate random started groups and `current_time >= started_at`; assert `0 <= n <= max_members - 1`
    - **Property 4: Result is always a valid cycle index**
    - **Validates: Requirements 4.4**
  - [ ]* 4.5 Write property test for Property 5: Determinism — same inputs produce same result
    - Call `calculate_current_cycle` twice with identical env state and inputs; assert results are equal
    - **Property 5: Determinism — same inputs produce same result**
    - **Validates: Requirements 6.6**

- [x] 5. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `proptest` is already in `[dev-dependencies]` — no Cargo.toml changes needed
- All arithmetic stays in `u64`; the `u32` cast happens only after the cap is applied
- The function is a free function (not a method on `StellarSaveContract`), consistent with `format_group_id` and `is_cycle_deadline_passed`
