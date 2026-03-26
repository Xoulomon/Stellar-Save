# Implementation Plan: Comprehensive Input Validation

## Overview

Add structured input validation to all public functions of the `StellarSaveContract`, replacing panics and partial checks with typed `StellarSaveError` returns. Tasks are ordered so each step builds on the previous, ending with full integration and test coverage.

## Tasks

- [x] 1. Add early numeric guards to `create_group`
  - Before any storage write, check `contribution_amount > 0` → `StellarSaveError::InvalidAmount`
  - Check `cycle_duration > 0` → `StellarSaveError::InvalidState`
  - Check `max_members >= 2` → `StellarSaveError::InvalidState`
  - When `ContractConfig` is present, validate all three values against configured bounds
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 1.1 Write unit tests for `create_group` numeric validation
    - Test zero `contribution_amount` → `InvalidAmount`
    - Test zero `cycle_duration` → `InvalidState`
    - Test `max_members` = 1 → `InvalidState`
    - Test out-of-config-bounds values → `InvalidAmount` / `InvalidState`
    - Test happy path succeeds
    - _Requirements: 10.1, 10.2, 10.3, 10.10_

- [x] 2. Add early numeric guards to `update_group`
  - Before any storage write, check `new_contribution > 0` → `StellarSaveError::InvalidAmount`
  - Check `new_duration > 0` → `StellarSaveError::InvalidState`
  - Check `new_max_members >= 2` → `StellarSaveError::InvalidState`
  - When `ContractConfig` is present, validate all three values against configured bounds
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.1 Write unit tests for `update_group` numeric validation
    - Test each invalid numeric parameter returns the correct error
    - Test out-of-bounds config values → `InvalidState`
    - Test happy path on a `Pending` group succeeds
    - _Requirements: 10.10_

- [x] 3. Add address validation to `create_group`, `join_group`, and `update_config`
  - In `create_group`: reject `creator == env.current_contract_address()` → `StellarSaveError::Unauthorized`
  - In `join_group`: reject `member == env.current_contract_address()` → `StellarSaveError::Unauthorized`
  - In `update_config`: reject `new_config.admin == env.current_contract_address()` → `StellarSaveError::Unauthorized`
  - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [ ]* 3.1 Write unit tests for address validation
    - Test contract-self address rejected in each function
    - Test valid external address accepted
    - _Requirements: 10.10_

- [x] 4. Add state-transition guards to `join_group`, `activate_group`, `pause_group`, and `resume_group`
  - `join_group`: reject if `status` is `Completed` or `Cancelled` → `StellarSaveError::InvalidState`
  - `activate_group`: reject if `status` is not `Pending` → `StellarSaveError::InvalidState`
  - `pause_group`: reject if `status` is not `Active` → `StellarSaveError::InvalidState`
  - `resume_group`: reject if `status` is not `Paused` → `StellarSaveError::InvalidState`
  - For any transition to a terminal state, reject if already terminal → `StellarSaveError::InvalidState`
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.1 Write unit tests for state-transition guards
    - Test each function with a disallowed status returns `InvalidState`
    - Test each function with the correct status proceeds
    - _Requirements: 10.10_

- [x] 5. Add validation to `contribute`: state, address, amount exactness, and duplicate prevention
  - Reject if group `status != Active` → `StellarSaveError::InvalidState`
  - Reject if `member` is not a registered member → `StellarSaveError::NotMember`
  - Reject if `amount <= 0` → `StellarSaveError::InvalidAmount`
  - Reject if `amount != group.contribution_amount` → `StellarSaveError::InvalidAmount`
  - Reject if member already contributed this cycle → `StellarSaveError::AlreadyContributed`
  - _Requirements: 3.3, 4.1, 5.1, 5.2, 5.3, 6.1, 6.2_

  - [ ]* 5.1 Write unit tests for `contribute` validation
    - Test contribution on `Paused` group → `InvalidState`
    - Test non-member address → `NotMember`
    - Test wrong amount → `InvalidAmount`
    - Test zero amount → `InvalidAmount`
    - Test duplicate contribution → `AlreadyContributed`
    - Test correct amount by registered member succeeds
    - _Requirements: 10.4, 10.5, 10.6, 10.10_

  - [ ]* 5.2 Write property test for contribution amount exactness
    - **Property: For all valid amounts `a` equal to `group.contribution_amount`, the validator accepts `a` and rejects `a + 1` and `a - 1`**
    - **Validates: Requirements 5.4**

- [x] 6. Add validation to `execute_payout`: state, recipient eligibility, cycle completeness
  - Reject if group `status != Active` → `StellarSaveError::InvalidState`
  - Reject if `recipient` is not a registered member → `StellarSaveError::InvalidRecipient`
  - Reject if `recipient.payout_position != group.current_cycle` → `StellarSaveError::InvalidRecipient`
  - Reject if recipient already received a payout → `StellarSaveError::PayoutAlreadyProcessed`
  - Reject if current cycle pool is not complete → `StellarSaveError::CycleNotComplete`
  - _Requirements: 3.4, 4.2, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 6.1 Write unit tests for `execute_payout` validation
    - Test payout on non-`Active` group → `InvalidState`
    - Test non-member recipient → `InvalidRecipient`
    - Test wrong `payout_position` → `InvalidRecipient`
    - Test already-paid recipient → `PayoutAlreadyProcessed`
    - Test incomplete cycle pool → `CycleNotComplete`
    - Test all conditions met → payout proceeds
    - _Requirements: 10.7, 10.8, 10.10_

- [x] 7. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Strengthen `update_config` validation
  - Reject `min_contribution <= 0` → `StellarSaveError::InvalidState`
  - Reject `max_contribution < min_contribution` → `StellarSaveError::InvalidState`
  - Reject `min_members < 2` → `StellarSaveError::InvalidState`
  - Reject `max_members < min_members` → `StellarSaveError::InvalidState`
  - Reject `min_cycle_duration == 0` → `StellarSaveError::InvalidState`
  - Reject `max_cycle_duration < min_cycle_duration` → `StellarSaveError::InvalidState`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 8.1 Write unit tests for `update_config` validation
    - Test each invalid field combination returns `InvalidState`
    - Test `max_contribution < min_contribution` → `InvalidState`
    - Test valid config with authorized admin succeeds
    - _Requirements: 10.9, 10.10_

- [x] 9. Audit and fix checked arithmetic across all public functions
  - Replace any unchecked `+`, `-`, `*` on `i128`/`u64`/`u32` with `checked_add`, `checked_sub`, `checked_mul`
  - Return `StellarSaveError::Overflow` on overflow/underflow
  - Verify `PoolCalculator::calculate_total_pool` returns `StellarSaveError::InternalError` on overflow
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 9.1 Write unit tests for overflow-safe arithmetic
    - Test `calculate_total_pool` with `i128::MAX` contribution → `InternalError`
    - Test counter increment at `u64::MAX` → `Overflow`
    - Test safe inputs produce correct results
    - _Requirements: 9.3, 9.4_

  - [ ]* 9.2 Write property test for overflow safety
    - **Property: For any `contribution_amount` and `member_count` whose product exceeds `i128::MAX`, `calculate_total_pool` returns `Err(InternalError)`**
    - **Validates: Requirements 9.3**

- [x] 10. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All implementation is in `contracts/stellar-save/src/lib.rs` and supporting modules
- `proptest` is already a dev-dependency in `Cargo.toml`
- Soroban's `env.current_contract_address()` is used for self-address checks
