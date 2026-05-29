# Requirements Document

## Introduction

This feature adds a `validate_max_members` helper function to the Stellar-Save smart contract. The function checks whether a proposed `max_members` value falls within the allowed range defined by the contract's global `ContractConfig` (i.e., `config.min_members` to `config.max_members`). It returns a typed validation result so callers can handle out-of-range values without panicking. The function lives in `helpers.rs` and follows the same pattern as the existing `validate_cycle_duration` and `validate_contribution_amount_range` helpers in `lib.rs`.

## Glossary

- **Validator**: The `validate_max_members` helper function being introduced.
- **ContractConfig**: The on-chain configuration struct (`ContractConfig`) that stores `min_members` and `max_members` bounds.
- **max_members**: The `u32` value representing the maximum number of members a group may have.
- **min_members**: The lower bound for `max_members` as stored in `ContractConfig`.
- **config_max_members**: The upper bound for `max_members` as stored in `ContractConfig`.
- **StellarSaveError**: The contract's error enum defined in `error.rs`.
- **ContractResult**: The `Result<T, StellarSaveError>` type alias used throughout the contract.

---

## Requirements

### Requirement 1: Validate max_members Against Allowed Range

**User Story:** As a contract developer, I want a helper function that validates a `max_members` value against the configured bounds, so that group creation and update logic can delegate this check without duplicating code.

#### Acceptance Criteria

1. THE Validator SHALL accept a reference to the Soroban `Env` and a `u32` value representing the proposed `max_members`.
2. WHEN the `ContractConfig` is present in storage and the proposed `max_members` is less than `config.min_members`, THE Validator SHALL return `Err(StellarSaveError::InvalidState)`.
3. WHEN the `ContractConfig` is present in storage and the proposed `max_members` is greater than `config.max_members`, THE Validator SHALL return `Err(StellarSaveError::InvalidState)`.
4. WHEN the `ContractConfig` is present in storage and the proposed `max_members` is within the inclusive range `[config.min_members, config.max_members]`, THE Validator SHALL return `Ok(())`.
5. WHEN no `ContractConfig` is present in storage, THE Validator SHALL return `Ok(())` (permissive default, consistent with existing helpers).

### Requirement 2: Boundary Values Are Accepted

**User Story:** As a contract developer, I want the boundary values (`min_members` and `config_max_members`) to be treated as valid, so that groups configured at the exact limits are not incorrectly rejected.

#### Acceptance Criteria

1. WHEN the proposed `max_members` equals `config.min_members`, THE Validator SHALL return `Ok(())`.
2. WHEN the proposed `max_members` equals `config.max_members`, THE Validator SHALL return `Ok(())`.

### Requirement 3: Integration With Group Creation and Update

**User Story:** As a contract developer, I want `create_group` and `update_group` to use the Validator, so that `max_members` validation is not duplicated across call sites.

#### Acceptance Criteria

1. WHEN `create_group` is called with an out-of-range `max_members`, THE StellarSaveContract SHALL return `Err(StellarSaveError::InvalidState)` by delegating to the Validator.
2. WHEN `update_group` is called with an out-of-range `max_members`, THE StellarSaveContract SHALL return `Err(StellarSaveError::InvalidState)` by delegating to the Validator.

### Requirement 4: Test Coverage

**User Story:** As a contract developer, I want unit tests for the Validator, so that correctness is verified and regressions are caught.

#### Acceptance Criteria

1. THE test suite SHALL include a test that verifies `Ok(())` is returned when `max_members` equals `config.min_members` (lower boundary).
2. THE test suite SHALL include a test that verifies `Ok(())` is returned when `max_members` equals `config.max_members` (upper boundary).
3. THE test suite SHALL include a test that verifies `Ok(())` is returned for a value strictly between `config.min_members` and `config.max_members`.
4. THE test suite SHALL include a test that verifies `Err(StellarSaveError::InvalidState)` is returned when `max_members` is below `config.min_members`.
5. THE test suite SHALL include a test that verifies `Err(StellarSaveError::InvalidState)` is returned when `max_members` exceeds `config.max_members`.
6. THE test suite SHALL include a test that verifies `Ok(())` is returned when no `ContractConfig` is stored (no-config permissive path).
7. FOR ALL valid `max_members` values `v` in `[config.min_members, config.max_members]`, calling the Validator twice with the same `v` SHALL produce the same result (idempotence property).
