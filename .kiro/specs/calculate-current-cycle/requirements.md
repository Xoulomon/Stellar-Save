# Requirements Document

## Introduction

This feature adds a `calculate_current_cycle` helper function to the Stellar-Save Soroban smart contract. The function determines the current cycle number for a savings group based on the time elapsed since the group was started. It reads the group's `started_at` timestamp and `cycle_duration` from storage, retrieves the current ledger timestamp, and computes how many full cycles have elapsed. This is a pure helper used internally by other contract operations (e.g., contribution validation, payout scheduling) to avoid duplicating cycle-calculation logic.

## Glossary

- **Helper**: A Rust function in `helpers.rs` that performs a reusable computation without directly mutating contract state.
- **Cycle**: A fixed time window during which all group members are expected to contribute. Indexed from 0.
- **Cycle_Duration**: The length of one cycle in seconds, stored on the `Group` struct as `cycle_duration: u64`.
- **Started_At**: The Unix timestamp (seconds) at which the group was activated, stored on the `Group` struct as `started_at: u64`.
- **Current_Time**: The current ledger timestamp in seconds, obtained via `env.ledger().timestamp()`.
- **Elapsed_Seconds**: The difference `current_time - started_at` in seconds.
- **Cycle_Calculator**: The helper function `calculate_current_cycle` being specified here.
- **Group**: The `Group` struct defined in `group.rs`, loaded from persistent storage via `StorageKeyBuilder::group_data(group_id)`.
- **StellarSaveError**: The contract error enum defined in `error.rs`.

---

## Requirements

### Requirement 1: Retrieve Group Start Time

**User Story:** As a contract developer, I want the helper to load the group's start time from storage, so that cycle calculations are always based on authoritative on-chain data.

#### Acceptance Criteria

1. WHEN `calculate_current_cycle` is called with a valid `group_id`, THE `Cycle_Calculator` SHALL load the `Group` struct from persistent storage using `StorageKeyBuilder::group_data(group_id)`.
2. IF the `group_id` does not exist in storage, THEN THE `Cycle_Calculator` SHALL return `Err(StellarSaveError::GroupNotFound)`.
3. IF the `Group` has `started` set to `false`, THEN THE `Cycle_Calculator` SHALL return `Ok(0)` indicating no cycles have elapsed.

---

### Requirement 2: Retrieve Current Ledger Time

**User Story:** As a contract developer, I want the helper to use the current ledger timestamp, so that cycle calculations reflect the actual on-chain time.

#### Acceptance Criteria

1. THE `Cycle_Calculator` SHALL obtain the current time by calling `env.ledger().timestamp()`.
2. WHILE the group is started and `current_time >= started_at`, THE `Cycle_Calculator` SHALL compute `elapsed_seconds = current_time - started_at`.
3. IF `current_time < started_at`, THEN THE `Cycle_Calculator` SHALL return `Ok(0)` to handle any clock skew or edge cases without panicking.

---

### Requirement 3: Calculate Cycles Elapsed

**User Story:** As a contract developer, I want the helper to compute the number of complete cycles elapsed, so that the contract can determine which cycle is currently active.

#### Acceptance Criteria

1. WHEN `elapsed_seconds` and `cycle_duration` are both available, THE `Cycle_Calculator` SHALL compute `cycles_elapsed = elapsed_seconds / cycle_duration` using integer division.
2. THE `Cycle_Calculator` SHALL perform the division using `u64` arithmetic to avoid signed-integer overflow.
3. THE `Cycle_Calculator` SHALL NOT count a partial cycle as a completed cycle (integer division truncates toward zero).

---

### Requirement 4: Return Cycle Number

**User Story:** As a contract developer, I want the helper to return the current cycle number capped at the group's maximum, so that callers always receive a valid, bounded cycle index.

#### Acceptance Criteria

1. THE `Cycle_Calculator` SHALL return the cycle number as `Ok(u32)`.
2. WHEN `cycles_elapsed` exceeds `group.max_members - 1`, THE `Cycle_Calculator` SHALL return `Ok(group.max_members - 1)` to cap the result at the last valid cycle index.
3. THE `Cycle_Calculator` SHALL cast `cycles_elapsed` from `u64` to `u32` only after applying the cap, preventing truncation errors on large elapsed values.
4. FOR ALL started groups where `current_time >= started_at`, the returned cycle number SHALL satisfy `0 <= result <= group.max_members - 1`.

---

### Requirement 5: Error Handling

**User Story:** As a contract developer, I want the helper to return typed errors for all failure conditions, so that callers can handle failures without panicking.

#### Acceptance Criteria

1. IF the group is not found in storage, THEN THE `Cycle_Calculator` SHALL return `Err(StellarSaveError::GroupNotFound)`.
2. THE `Cycle_Calculator` SHALL NOT panic under any valid input combination.
3. THE `Cycle_Calculator` SHALL return `Result<u32, StellarSaveError>` as its return type.

---

### Requirement 6: Tests

**User Story:** As a contract developer, I want unit tests for `calculate_current_cycle`, so that correctness is verified and regressions are caught.

#### Acceptance Criteria

1. THE test suite SHALL include a test verifying that calling `calculate_current_cycle` with a non-existent `group_id` returns `Err(StellarSaveError::GroupNotFound)`.
2. THE test suite SHALL include a test verifying that a group that has not been started returns `Ok(0)`.
3. THE test suite SHALL include a test verifying that a group started at time `T` with `cycle_duration` `D`, queried at time `T + D * N`, returns `Ok(N)` for representative values of `N`.
4. THE test suite SHALL include a test verifying that the returned cycle is capped at `max_members - 1` when more cycles have elapsed than the group has members.
5. THE test suite SHALL include a test verifying that querying at exactly `started_at` (zero elapsed seconds) returns `Ok(0)`.
6. FOR ALL valid started groups, parsing the cycle number and re-computing it from the same inputs SHALL produce the same result (idempotence / determinism property).
