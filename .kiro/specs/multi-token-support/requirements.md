# Requirements Document

## Introduction

The Stellar-Save smart contract currently supports only XLM (denominated in stroops) as the contribution token for ROSCA savings groups. This feature extends the contract to support multiple Stellar token types — including USDC, EURC, and any other SEP-41-compliant token — alongside XLM. Each savings group will be configured with a specific token at creation time, and all contributions and payouts within that group will use that token exclusively. The feature includes token selection during group creation, decimal-aware amount handling, token contract validation, and comprehensive multi-token test coverage.

## Glossary

- **Token_Contract**: A SEP-41-compliant Soroban token contract deployed on Stellar (e.g., USDC, EURC, or native XLM wrapper).
- **Token_Address**: The contract address (`Address`) identifying a specific Token_Contract on the Stellar network.
- **Token_Decimals**: The number of decimal places a token uses (e.g., XLM = 7, USDC = 7 on Stellar, EURC = 7 on Stellar). Determines the smallest unit of the token.
- **Stroop**: The smallest unit of XLM (1 XLM = 10^7 stroops). Used as the base unit for XLM amounts.
- **Base_Unit**: The smallest indivisible unit of a token, analogous to stroops for XLM. Amounts in the contract are always stored and transferred in base units.
- **Token_Validator**: The contract component responsible for verifying that a given Token_Address refers to a valid, callable SEP-41 token contract.
- **Group**: A ROSCA savings group as defined in the existing contract, extended to include a token configuration.
- **Token_Config**: A new data structure storing the Token_Address and Token_Decimals associated with a Group.
- **StellarSaveContract**: The existing Soroban smart contract being extended.
- **SEP-41**: The Stellar Ecosystem Proposal defining the standard token interface for Soroban contracts.
- **Allowance**: The amount a token holder has pre-approved for the StellarSaveContract to transfer on their behalf, as required by the SEP-41 `transfer_from` pattern.

## Requirements

### Requirement 1: Token Selection at Group Creation

**User Story:** As a group creator, I want to specify which token my savings group uses, so that members can contribute and receive payouts in a token of their choice (e.g., USDC or EURC instead of XLM).

#### Acceptance Criteria

1. WHEN a creator calls `create_group`, THE StellarSaveContract SHALL accept a `token_address` parameter of type `Address` identifying the token to use for the group.
2. THE StellarSaveContract SHALL store the `token_address` as part of the group's persistent data alongside the existing group fields.
3. WHEN `create_group` is called with a `token_address`, THE Token_Validator SHALL verify the token contract is callable before the group is stored.
4. IF the `token_address` fails validation, THEN THE StellarSaveContract SHALL return `StellarSaveError::InvalidToken` and SHALL NOT create the group.
5. WHEN a group is successfully created with a token, THE StellarSaveContract SHALL emit a `GroupCreated` event that includes the `token_address`.
6. THE StellarSaveContract SHALL support the native XLM token address as a valid `token_address`, preserving backward-compatible behavior for XLM groups.

---

### Requirement 2: Token Configuration Storage

**User Story:** As a developer integrating with Stellar-Save, I want to query the token configuration of any group, so that I can display the correct token symbol and format amounts correctly in the UI.

#### Acceptance Criteria

1. THE StellarSaveContract SHALL store a `Token_Config` struct (containing `token_address: Address` and `token_decimals: u32`) for each group in persistent storage.
2. WHEN `get_group` is called, THE StellarSaveContract SHALL return the group data including the associated `Token_Config`.
3. THE StellarSaveContract SHALL provide a `get_token_config(group_id: u64)` function that returns the `Token_Config` for a group.
4. IF `get_token_config` is called with a non-existent `group_id`, THEN THE StellarSaveContract SHALL return `StellarSaveError::GroupNotFound`.
5. THE StellarSaveContract SHALL store `token_decimals` as a `u32` value fetched from the token contract at group creation time and cached in `Token_Config`.

---

### Requirement 3: Token Decimal Handling

**User Story:** As a group member, I want contribution amounts to be validated and processed correctly for the token's decimal precision, so that I am never charged an incorrect amount due to decimal mismatches.

#### Acceptance Criteria

1. WHEN a group is created, THE StellarSaveContract SHALL query the token contract for its `decimals()` value and store it in the group's `Token_Config`.
2. THE StellarSaveContract SHALL store and compare all contribution amounts in the token's base units (the smallest indivisible unit).
3. WHEN a member calls `contribute`, THE StellarSaveContract SHALL validate that the provided `amount` equals the group's `contribution_amount` exactly in base units.
4. IF a member provides an `amount` that does not match the group's `contribution_amount` in base units, THEN THE StellarSaveContract SHALL return `StellarSaveError::InvalidAmount`.
5. THE StellarSaveContract SHALL NOT perform any decimal conversion internally; all callers are responsible for providing amounts in base units.
6. WHEN calculating the total pool amount for a payout cycle, THE StellarSaveContract SHALL compute `contribution_amount * member_count` in base units without loss of precision.

---

### Requirement 4: Token Validation

**User Story:** As a contract administrator, I want the contract to validate token addresses before accepting them, so that groups cannot be created with invalid or malicious token contracts.

#### Acceptance Criteria

1. WHEN a `token_address` is provided to `create_group`, THE Token_Validator SHALL attempt to call the `decimals()` function on the token contract at that address.
2. IF the `decimals()` call succeeds and returns a value in the range [0, 38], THEN THE Token_Validator SHALL consider the token valid.
3. IF the `decimals()` call fails or panics, THEN THE Token_Validator SHALL consider the token invalid and THE StellarSaveContract SHALL return `StellarSaveError::InvalidToken`.
4. THE StellarSaveContract SHALL define a new error variant `InvalidToken = 5001` in the `StellarSaveError` enum for token validation failures.
5. THE StellarSaveContract SHALL define a new error variant `TokenTransferFailed = 5002` in the `StellarSaveError` enum for token transfer failures during contribution or payout.
6. WHEN a contribution is made, THE StellarSaveContract SHALL verify the member has granted sufficient Allowance to the contract before initiating the token transfer.
7. IF the member's Allowance is insufficient, THEN THE StellarSaveContract SHALL return `StellarSaveError::TokenTransferFailed` without modifying any contribution state.

---

### Requirement 5: Multi-Token Contribution Flow

**User Story:** As a group member, I want to contribute using the token my group was configured with, so that my contribution is correctly transferred and recorded on-chain.

#### Acceptance Criteria

1. WHEN a member calls `contribute(group_id, amount)`, THE StellarSaveContract SHALL transfer `amount` base units of the group's configured token from the member's address to the contract's address using the SEP-41 `transfer_from` interface.
2. THE StellarSaveContract SHALL require the member to have called `approve` on the token contract granting the StellarSaveContract an Allowance of at least `amount` before calling `contribute`.
3. WHEN the token transfer succeeds, THE StellarSaveContract SHALL record the `ContributionRecord` with the transferred `amount`.
4. IF the token transfer fails for any reason, THEN THE StellarSaveContract SHALL return `StellarSaveError::TokenTransferFailed` and SHALL NOT record the contribution.
5. WHEN all members have contributed in a cycle, THE StellarSaveContract SHALL transfer the total pool amount in the group's configured token to the cycle's designated payout recipient using the SEP-41 `transfer` interface.
6. IF the payout token transfer fails, THEN THE StellarSaveContract SHALL return `StellarSaveError::PayoutFailed` and SHALL NOT advance the cycle.

---

### Requirement 6: Supported Token Allowlist (Optional Feature)

**User Story:** As a contract administrator, I want to optionally restrict which tokens are allowed in the contract, so that I can prevent groups from being created with low-quality or unsupported tokens.

#### Acceptance Criteria

1. WHERE an admin allowlist is configured, THE StellarSaveContract SHALL reject `create_group` calls with a `token_address` not present in the allowlist, returning `StellarSaveError::InvalidToken`.
2. WHERE an admin allowlist is configured, THE StellarSaveContract SHALL provide an `add_allowed_token(token_address: Address)` function callable only by the contract admin.
3. WHERE an admin allowlist is configured, THE StellarSaveContract SHALL provide a `remove_allowed_token(token_address: Address)` function callable only by the contract admin.
4. WHERE no allowlist is configured, THE StellarSaveContract SHALL accept any token address that passes the Token_Validator check (open mode).
5. THE StellarSaveContract SHALL provide an `is_token_allowed(token_address: Address)` query function that returns `true` if the token is permitted.

---

### Requirement 7: Multi-Token Test Coverage

**User Story:** As a developer, I want comprehensive tests for multi-token behavior, so that I can be confident the contract handles all token types correctly and edge cases are covered.

#### Acceptance Criteria

1. THE test suite SHALL include a test verifying that a group can be created with a mock USDC token contract and that the token address is stored correctly.
2. THE test suite SHALL include a test verifying that a group can be created with a mock EURC token contract and that the token address is stored correctly.
3. THE test suite SHALL include a test verifying that `contribute` transfers the correct token amount from the member to the contract.
4. THE test suite SHALL include a test verifying that payout transfers the correct token amount from the contract to the recipient.
5. THE test suite SHALL include a test verifying that `create_group` fails with `InvalidToken` when given an invalid token address.
6. THE test suite SHALL include a test verifying that contributing with an incorrect amount returns `InvalidAmount`.
7. THE test suite SHALL include a round-trip property test: FOR ALL valid `Token_Config` values, serializing then deserializing the `Token_Config` SHALL produce an equivalent value.
8. THE test suite SHALL include a test verifying that two groups with different tokens operate independently without cross-token contamination.
9. THE test suite SHALL include a test verifying that a member with insufficient token Allowance receives `TokenTransferFailed` when calling `contribute`.
