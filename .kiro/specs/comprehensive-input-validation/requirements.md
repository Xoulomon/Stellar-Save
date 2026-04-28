# Requirements Document

## Introduction

This feature adds comprehensive input validation to all public functions of the Stellar-Save Soroban smart contract. The contract implements a rotational savings and credit association (ROSCA) on the Stellar blockchain. Currently, some public functions rely on panics or partial checks rather than returning structured errors for invalid inputs. This feature ensures every public function validates all numeric inputs, all address inputs, and all state transitions before executing any logic, returning typed `StellarSaveError` values on failure. Validation tests are added to cover all new guard paths.

## Glossary

- **Validator**: The input validation logic embedded in each public contract function.
- **Contract**: The `StellarSaveContract` Soroban smart contract.
- **Group**: A rotational savings group (ROSCA) managed by the Contract.
- **Member**: A Stellar address that has joined a Group.
- **Stroops**: The smallest unit of XLM (1 XLM = 10,000,000 stroops). All monetary amounts are expressed in stroops.
- **Cycle**: A single round of contributions and payout within a Group.
- **GroupStatus**: The lifecycle state of a Group: `Pending`, `Active`, `Paused`, `Completed`, or `Cancelled`.
- **ContractConfig**: The global configuration struct storing min/max bounds for contribution amounts, member counts, and cycle durations.
- **Admin**: The address stored in `ContractConfig` with authority to pause/unpause the Contract and update configuration.
- **Payout_Position**: A zero-indexed integer indicating which cycle a Member receives the pooled funds.

---

## Requirements

### Requirement 1: Numeric Input Validation for Group Creation

**User Story:** As a smart contract developer, I want all numeric parameters in `create_group` to be validated before any state is written, so that invalid groups are never persisted.

#### Acceptance Criteria

1. WHEN `create_group` is called with a `contribution_amount` of 0 or less, THE Validator SHALL return `StellarSaveError::InvalidAmount` before writing any storage.
2. WHEN `create_group` is called with a `cycle_duration` of 0, THE Validator SHALL return `StellarSaveError::InvalidState` before writing any storage.
3. WHEN `create_group` is called with a `max_members` less than 2, THE Validator SHALL return `StellarSaveError::InvalidState` before writing any storage.
4. WHEN `ContractConfig` is present and `contribution_amount` is outside `[min_contribution, max_contribution]`, THE Validator SHALL return `StellarSaveError::InvalidAmount`.
5. WHEN `ContractConfig` is present and `cycle_duration` is outside `[min_cycle_duration, max_cycle_duration]`, THE Validator SHALL return `StellarSaveError::InvalidState`.
6. WHEN `ContractConfig` is present and `max_members` is outside `[min_members, max_members]`, THE Validator SHALL return `StellarSaveError::InvalidState`.
7. WHEN all numeric inputs are valid, THE Validator SHALL allow `create_group` to proceed without returning a validation error.

---

### Requirement 2: Numeric Input Validation for Group Updates

**User Story:** As a group creator, I want `update_group` to reject out-of-range numeric parameters, so that a group's configuration cannot be set to an invalid state.

#### Acceptance Criteria

1. WHEN `update_group` is called with a `new_contribution` of 0 or less, THE Validator SHALL return `StellarSaveError::InvalidAmount`.
2. WHEN `update_group` is called with a `new_duration` of 0, THE Validator SHALL return `StellarSaveError::InvalidState`.
3. WHEN `update_group` is called with a `new_max_members` less than 2, THE Validator SHALL return `StellarSaveError::InvalidState`.
4. WHEN `ContractConfig` is present and any updated numeric parameter is outside its configured bounds, THE Validator SHALL return `StellarSaveError::InvalidState`.
5. WHEN all numeric inputs are valid and the group is in `Pending` status, THE Validator SHALL allow `update_group` to proceed.

---

### Requirement 3: Address Input Validation

**User Story:** As a security-conscious developer, I want all public functions that accept an `Address` parameter to verify the address is not the zero/default address, so that operations cannot be performed on behalf of an invalid identity.

#### Acceptance Criteria

1. WHEN `create_group` is called with a `creator` address equal to the contract's own address, THE Validator SHALL return `StellarSaveError::Unauthorized`.
2. WHEN `join_group` is called with a `member` address equal to the contract's own address, THE Validator SHALL return `StellarSaveError::Unauthorized`.
3. WHEN `contribute` is called with a `member` address that is not a registered Member of the specified Group, THE Validator SHALL return `StellarSaveError::NotMember`.
4. WHEN `execute_payout` is called with a `recipient` address that is not a registered Member of the specified Group, THE Validator SHALL return `StellarSaveError::InvalidRecipient`.
5. WHEN `update_config` is called with a `new_config` whose `admin` field is the contract's own address, THE Validator SHALL return `StellarSaveError::Unauthorized`.
6. WHEN a valid, registered Member address is provided to any public function, THE Validator SHALL not reject the address on address-validation grounds.

---

### Requirement 4: State Transition Validation

**User Story:** As a contract user, I want all state-changing operations to verify that the current `GroupStatus` permits the requested transition, so that illegal state changes are rejected with a clear error.

#### Acceptance Criteria

1. WHEN `contribute` is called on a Group whose `status` is not `Active`, THE Validator SHALL return `StellarSaveError::InvalidState`.
2. WHEN `execute_payout` is called on a Group whose `status` is not `Active`, THE Validator SHALL return `StellarSaveError::InvalidState`.
3. WHEN `join_group` is called on a Group whose `status` is `Completed` or `Cancelled`, THE Validator SHALL return `StellarSaveError::InvalidState`.
4. WHEN `activate_group` is called on a Group whose `status` is not `Pending`, THE Validator SHALL return `StellarSaveError::InvalidState`.
5. WHEN `pause_group` is called on a Group whose `status` is not `Active`, THE Validator SHALL return `StellarSaveError::InvalidState`.
6. WHEN `resume_group` is called on a Group whose `status` is not `Paused`, THE Validator SHALL return `StellarSaveError::InvalidState`.
7. WHEN a requested state transition is valid according to `GroupStatus::can_transition_to`, THE Validator SHALL allow the operation to proceed.
8. IF a state transition would move a Group to a terminal state (`Completed` or `Cancelled`) and the Group is already in a terminal state, THEN THE Validator SHALL return `StellarSaveError::InvalidState`.

---

### Requirement 5: Contribution Amount Exactness Validation

**User Story:** As a group member, I want the contract to reject contributions that do not exactly match the group's required amount, so that the pool accounting remains consistent.

#### Acceptance Criteria

1. WHEN `contribute` is called with an `amount` that does not equal the Group's `contribution_amount`, THE Validator SHALL return `StellarSaveError::InvalidAmount`.
2. WHEN `contribute` is called with an `amount` of 0 or less, THE Validator SHALL return `StellarSaveError::InvalidAmount` regardless of the Group's `contribution_amount`.
3. WHEN `contribute` is called with an `amount` that exactly equals the Group's `contribution_amount`, THE Validator SHALL allow the contribution to proceed.
4. FOR ALL valid contribution amounts `a` equal to the group's `contribution_amount`, THE Validator SHALL accept `a` and reject any `a + 1` or `a - 1`.

---

### Requirement 6: Duplicate Contribution Prevention

**User Story:** As a group member, I want the contract to prevent me from contributing twice in the same cycle, so that the pool total remains accurate.

#### Acceptance Criteria

1. WHEN `contribute` is called by a Member who has already contributed in the current cycle, THE Validator SHALL return `StellarSaveError::AlreadyContributed`.
2. WHEN `contribute` is called by a Member who has not yet contributed in the current cycle, THE Validator SHALL allow the contribution to proceed.
3. WHEN the cycle advances, THE Contract SHALL allow a Member who contributed in the previous cycle to contribute again in the new cycle.

---

### Requirement 7: Payout Eligibility Validation

**User Story:** As a contract operator, I want `execute_payout` to validate that the recipient's payout position matches the current cycle, so that payouts are distributed in the correct rotation order.

#### Acceptance Criteria

1. WHEN `execute_payout` is called and the recipient's `payout_position` does not equal `group.current_cycle`, THE Validator SHALL return `StellarSaveError::InvalidRecipient`.
2. WHEN `execute_payout` is called and the recipient has already received a payout in a prior cycle, THE Validator SHALL return `StellarSaveError::PayoutAlreadyProcessed`.
3. WHEN `execute_payout` is called and the current cycle's pool is not complete (not all members have contributed), THE Validator SHALL return `StellarSaveError::CycleNotComplete`.
4. WHEN all payout eligibility conditions are met, THE Validator SHALL allow `execute_payout` to proceed.

---

### Requirement 8: ContractConfig Validation

**User Story:** As an admin, I want `update_config` to reject configurations with invalid or inconsistent bounds, so that the contract cannot be configured in a way that makes group creation impossible.

#### Acceptance Criteria

1. WHEN `update_config` is called with `min_contribution` of 0 or less, THE Validator SHALL return `StellarSaveError::InvalidState`.
2. WHEN `update_config` is called with `max_contribution` less than `min_contribution`, THE Validator SHALL return `StellarSaveError::InvalidState`.
3. WHEN `update_config` is called with `min_members` less than 2, THE Validator SHALL return `StellarSaveError::InvalidState`.
4. WHEN `update_config` is called with `max_members` less than `min_members`, THE Validator SHALL return `StellarSaveError::InvalidState`.
5. WHEN `update_config` is called with `min_cycle_duration` of 0, THE Validator SHALL return `StellarSaveError::InvalidState`.
6. WHEN `update_config` is called with `max_cycle_duration` less than `min_cycle_duration`, THE Validator SHALL return `StellarSaveError::InvalidState`.
7. WHEN all configuration fields are valid and the caller is the current Admin, THE Validator SHALL allow `update_config` to proceed.

---

### Requirement 9: Overflow-Safe Arithmetic Validation

**User Story:** As a developer, I want all arithmetic operations on numeric inputs to use checked arithmetic, so that integer overflow cannot corrupt contract state.

#### Acceptance Criteria

1. WHEN any addition or multiplication of `i128` or `u64` values in a public function would overflow, THE Contract SHALL return `StellarSaveError::Overflow` instead of panicking.
2. WHEN any subtraction of `u32` or `u64` values would underflow, THE Contract SHALL return `StellarSaveError::Overflow` instead of panicking or wrapping.
3. WHEN `PoolCalculator::calculate_total_pool` is called with inputs whose product exceeds `i128::MAX`, THE Contract SHALL return `StellarSaveError::InternalError`.
4. WHEN arithmetic inputs are within safe bounds, THE Contract SHALL compute the correct result without error.

---

### Requirement 10: Validation Test Coverage

**User Story:** As a developer, I want unit tests for every validation path added by this feature, so that regressions are caught automatically.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a test that passes a zero `contribution_amount` to `create_group` and asserts `StellarSaveError::InvalidAmount` is returned.
2. THE Test_Suite SHALL include a test that passes a zero `cycle_duration` to `create_group` and asserts `StellarSaveError::InvalidState` is returned.
3. THE Test_Suite SHALL include a test that passes a `max_members` of 1 to `create_group` and asserts `StellarSaveError::InvalidState` is returned.
4. THE Test_Suite SHALL include a test that calls `contribute` on a `Paused` group and asserts `StellarSaveError::InvalidState` is returned.
5. THE Test_Suite SHALL include a test that calls `contribute` with an incorrect amount and asserts `StellarSaveError::InvalidAmount` is returned.
6. THE Test_Suite SHALL include a test that calls `contribute` twice in the same cycle and asserts `StellarSaveError::AlreadyContributed` is returned on the second call.
7. THE Test_Suite SHALL include a test that calls `execute_payout` with a recipient whose `payout_position` does not match `current_cycle` and asserts `StellarSaveError::InvalidRecipient` is returned.
8. THE Test_Suite SHALL include a test that calls `execute_payout` before all members have contributed and asserts `StellarSaveError::CycleNotComplete` is returned.
9. THE Test_Suite SHALL include a test that calls `update_config` with `max_contribution` less than `min_contribution` and asserts `StellarSaveError::InvalidState` is returned.
10. FOR ALL validation error paths introduced by this feature, THE Test_Suite SHALL include at least one test that triggers the exact error and one test that confirms the happy path succeeds.
