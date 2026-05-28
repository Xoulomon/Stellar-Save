# Requirements Document

## Introduction

This feature adds a `get_current_timestamp` helper function to the Stellar-Save Soroban smart contract. The function queries the current ledger timestamp via the Soroban environment and returns it as a `u64` value (Unix epoch seconds). It will be exposed as a public contract method and as an internal helper used by other contract logic (e.g., cycle deadline checks, rate limiting, contribution recording). Tests will cover normal operation, consistency with the ledger, and integration with existing helpers.

## Glossary

- **Contract**: The `StellarSaveContract` Soroban smart contract defined in `lib.rs`.
- **Env**: The Soroban `Env` object that provides access to ledger data, storage, and other host functions.
- **Ledger_Timestamp**: The Unix epoch timestamp (seconds) of the current ledger, accessed via `env.ledger().timestamp()`.
- **Helper_Function**: A utility function in `helpers.rs` or on `StellarSaveContract` that encapsulates reusable logic.
- **Caller**: Any external account or contract invoking a public contract method.

---

## Requirements

### Requirement 1: Query and Return Ledger Timestamp

**User Story:** As a smart contract developer, I want a dedicated helper function that returns the current blockchain timestamp, so that I have a single, consistent source of truth for time-based logic across the contract.

#### Acceptance Criteria

1. THE Contract SHALL expose a public function `get_current_timestamp(env: Env) -> u64` that returns the current ledger timestamp.
2. WHEN `get_current_timestamp` is invoked, THE Contract SHALL return the value of `env.ledger().timestamp()` without modification.
3. THE Contract SHALL NOT perform any storage reads or writes when executing `get_current_timestamp`.
4. WHEN `get_current_timestamp` is called multiple times within the same ledger, THE Contract SHALL return the same value for each call.

---

### Requirement 2: Internal Helper Availability

**User Story:** As a smart contract developer, I want the timestamp logic available as an internal helper, so that other contract functions can call it without duplicating `env.ledger().timestamp()` inline.

#### Acceptance Criteria

1. THE Helper_Function `get_current_timestamp` SHALL be callable from other functions within the contract (e.g., `create_group`, `record_contribution`, cycle deadline checks).
2. WHEN an internal caller invokes `get_current_timestamp` with a valid `Env`, THE Helper_Function SHALL return a `u64` value greater than zero.
3. THE Helper_Function SHALL be consistent with the value used by `is_cycle_deadline_passed` and other time-dependent helpers that already reference `env.ledger().timestamp()`.

---

### Requirement 3: Test Coverage

**User Story:** As a smart contract developer, I want automated tests for `get_current_timestamp`, so that I can verify correct behavior and prevent regressions.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a test that verifies `get_current_timestamp` returns the ledger timestamp set in the test environment.
2. WHEN the test environment ledger timestamp is set to a specific value `T`, THE Test_Suite SHALL assert that `get_current_timestamp` returns exactly `T`.
3. THE Test_Suite SHALL include a test that verifies calling `get_current_timestamp` twice in the same ledger state returns identical values (idempotence).
4. THE Test_Suite SHALL include a test that verifies the returned timestamp is a non-zero `u64` under normal ledger conditions.
5. WHERE the contract is paused, THE Test_Suite SHALL verify that `get_current_timestamp` still returns the ledger timestamp (the function does not check pause state).
