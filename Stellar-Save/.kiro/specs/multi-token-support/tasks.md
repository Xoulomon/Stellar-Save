# Implementation Plan: Multi-Token Support

## Overview

Extend the Stellar-Save ROSCA contract to support any SEP-41-compliant Soroban token (USDC, EURC, native XLM, etc.) by binding each savings group to a specific token at creation time. All contributions and payouts within a group use that token exclusively via the SEP-41 `transfer_from` / `transfer` interface.

## Tasks

- [x] 1. Add new error variants to `error.rs`
  - Add `InvalidToken = 5001` to the `StellarSaveError` enum with doc comment
  - Add `TokenTransferFailed = 5002` to the `StellarSaveError` enum with doc comment
  - Add `message()` match arms for both new variants
  - Add `recovery_guidance()` match arms for both new variants
  - Update `category()` to map 5000–5999 to a new `ErrorCategory::Token` variant (or `ErrorCategory::System` if preferred)
  - _Requirements: 4.4, 4.5_

- [ ]* 1.1 Write unit tests for new error variants
  - Verify `InvalidToken.code() == 5001`
  - Verify `TokenTransferFailed.code() == 5002`
  - Verify both variants have non-empty `message()` and `recovery_guidance()` strings
  - _Requirements: 4.4, 4.5_

- [x] 2. Add `TokenConfig` struct and storage keys
  - Define `TokenConfig { token_address: Address, token_decimals: u32 }` in `group.rs` with `#[contracttype]` and `#[derive(Clone, Debug, Eq, PartialEq)]`
  - Add `TokenConfig(u64)` variant to `GroupKey` enum in `storage.rs`
  - Add `AllowedTokens` variant to `CounterKey` enum in `storage.rs`
  - Add `StorageKeyBuilder::group_token_config(group_id: u64) -> StorageKey` helper
  - Add `StorageKeyBuilder::allowed_tokens() -> StorageKey` helper
  - _Requirements: 2.1, 2.5, 6.1_

- [ ]* 2.1 Write property test for `TokenConfig` round-trip serialization
  - **Property 1: Token_Config round-trip**
  - For any valid `token_address` and `token_decimals` in [0, 38], storing a `TokenConfig` in the Soroban test environment and reading it back should produce an identical value
  - **Validates: Requirements 1.2, 2.1, 2.5, 3.1**

- [x] 3. Implement token validation helper
  - Create `fn validate_token(env: &Env, token_address: &Address) -> Result<u32, StellarSaveError>` (private) in `lib.rs` or a new `token.rs` module
  - Use `soroban_sdk::token::TokenClient::new(env, token_address).decimals()` to call the token contract
  - Return `Ok(decimals)` if the call succeeds and `decimals <= 38`
  - Return `Err(StellarSaveError::InvalidToken)` if the call fails or `decimals > 38`
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 3.1 Write property test for invalid token rejection
  - **Property 2: Invalid token rejection**
  - For any address that does not implement a callable `decimals()` returning a value in [0, 38], `validate_token` should return `Err(StellarSaveError::InvalidToken)`
  - **Validates: Requirements 1.4, 4.2, 4.3**

- [x] 4. Update `create_group` to accept and store `token_address`
  - Add `token_address: Address` as the last parameter to `create_group` in `lib.rs`
  - If an allowlist is configured (i.e., `AllowedTokens` key exists in storage), check that `token_address` is present — return `InvalidToken` if not
  - Call `validate_token(&env, &token_address)` — return `InvalidToken` on failure
  - After generating `group_id`, store `TokenConfig { token_address: token_address.clone(), token_decimals }` under `StorageKeyBuilder::group_token_config(group_id)`
  - Include `token_address` in the `GroupCreated` event payload (add as second event data field)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1_

- [ ]* 4.1 Write property test for `GroupCreated` event includes token address
  - **Property 3: GroupCreated event includes token address**
  - For any successful `create_group` call with a valid token address, the emitted `GroupCreated` event payload should contain the `token_address` that was provided
  - **Validates: Requirements 1.5**

- [ ]* 4.2 Write property test for allowlist rejection
  - **Property 9: Allowlist rejection**
  - For any token address not present in the admin allowlist when an allowlist is configured, `create_group` should return `StellarSaveError::InvalidToken`
  - **Validates: Requirements 6.1**

- [x] 5. Implement `get_token_config` public function
  - Add `pub fn get_token_config(env: Env, group_id: u64) -> Result<TokenConfig, StellarSaveError>` to `StellarSaveContract` in `lib.rs`
  - Load `TokenConfig` from `StorageKeyBuilder::group_token_config(group_id)`
  - Return `Err(StellarSaveError::GroupNotFound)` if the key does not exist
  - _Requirements: 2.3, 2.4_

- [ ]* 5.1 Write unit tests for `get_token_config`
  - `test_get_token_config_success` — create a group with a mock token, verify returned `TokenConfig` matches
  - `test_get_token_config_not_found` — verify `GroupNotFound` for unknown `group_id`
  - _Requirements: 2.3, 2.4_

- [x] 6. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update `contribute` to use SEP-41 `transfer_from`
  - Load `TokenConfig` for the group at the start of the contribute flow in `lib.rs`
  - Build `soroban_sdk::token::TokenClient::new(&env, &token_config.token_address)`
  - Before recording the contribution, call `token_client.transfer_from(&env.current_contract_address(), &member, &env.current_contract_address(), &amount)`
  - If the call panics or returns an error, return `Err(StellarSaveError::TokenTransferFailed)` without recording the contribution
  - Acquire the existing `ReentrancyGuard` before calling `transfer_from` and release it after
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 4.6, 4.7_

- [ ]* 7.1 Write property test for exact amount enforcement
  - **Property 4: Exact amount enforcement**
  - For any group with a configured `contribution_amount` and any amount not exactly equal to it, `contribute` should return `StellarSaveError::InvalidAmount` and contribution state should remain unchanged
  - **Validates: Requirements 3.3, 3.4**

- [ ]* 7.2 Write property test for insufficient allowance rejection
  - **Property 6: Insufficient allowance rejection**
  - For any member who has not granted the contract a token allowance of at least `contribution_amount`, `contribute` should return `StellarSaveError::TokenTransferFailed` and no `ContributionRecord` should be stored
  - **Validates: Requirements 4.6, 4.7, 5.2, 5.4**

- [ ]* 7.3 Write property test for contribution balance change
  - **Property 7: Contribution token transfer round-trip**
  - After `contribute` succeeds, the contract's token balance should have increased by `amount` and the member's token balance should have decreased by `amount`
  - **Validates: Requirements 5.1, 5.3**

- [x] 8. Update `execute_payout` to use SEP-41 `transfer`
  - In `payout_executor.rs`, replace the `execute_transfer` placeholder with a real SEP-41 transfer
  - Load `TokenConfig` for the group before executing the transfer
  - Build `soroban_sdk::token::TokenClient::new(&env, &token_config.token_address)`
  - Replace the placeholder body of `execute_transfer` with `token_client.transfer(&env.current_contract_address(), recipient, &amount)`
  - Remove the now-redundant `verify_contract_balance` placeholder (the token client will panic on insufficient balance, which Soroban reverts)
  - On any failure, return `Err(StellarSaveError::PayoutFailed)` and do not advance the cycle
  - _Requirements: 5.5, 5.6_

- [ ]* 8.1 Write property test for payout balance change
  - **Property 8: Payout token transfer correctness**
  - After `execute_payout` succeeds, the recipient's token balance should have increased by `contribution_amount * member_count` and the contract's token balance should have decreased by the same amount
  - **Validates: Requirements 5.5**

- [ ]* 8.2 Write property test for pool amount precision
  - **Property 5: Pool amount precision**
  - For any group with `contribution_amount` C and `max_members` N, the total pool amount computed by the contract should equal exactly `C * N` with no rounding or truncation
  - **Validates: Requirements 3.6**

- [x] 9. Implement allowlist management functions
  - Add `pub fn add_allowed_token(env: Env, admin: Address, token_address: Address) -> Result<(), StellarSaveError>` to `StellarSaveContract`
    - Require auth from `admin`; verify `admin` matches the stored `ContractConfig.admin` — return `Unauthorized` if not
    - Load `Vec<Address>` from `StorageKeyBuilder::allowed_tokens()` (default empty)
    - Append `token_address` if not already present; store back
  - Add `pub fn remove_allowed_token(env: Env, admin: Address, token_address: Address) -> Result<(), StellarSaveError>`
    - Same admin check; remove `token_address` from the list if present; store back
  - Add `pub fn is_token_allowed(env: Env, token_address: Address) -> bool`
    - If no `AllowedTokens` key exists, return `true` (open mode)
    - Otherwise return `true` iff `token_address` is in the stored list
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ]* 9.1 Write property test for allowlist admin-only management
  - **Property 10: Allowlist admin-only management**
  - For any caller that is not the contract admin, calling `add_allowed_token` or `remove_allowed_token` should return `StellarSaveError::Unauthorized` and the allowlist should remain unchanged
  - **Validates: Requirements 6.2, 6.3**

- [ ]* 9.2 Write property test for open mode accepts any valid token
  - **Property 11: Open mode accepts any valid token**
  - When no allowlist is configured, `create_group` with any valid SEP-41 token should succeed and `is_token_allowed` should return `true`
  - **Validates: Requirements 6.4**

- [ ]* 9.3 Write property test for `is_token_allowed` round-trip
  - **Property 12: is_token_allowed round-trip**
  - After `add_allowed_token`, `is_token_allowed` returns `true`; after `remove_allowed_token` for the same address, `is_token_allowed` returns `false`
  - **Validates: Requirements 6.5**

- [x] 10. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create multi-token test suite in `tests/multi_token.rs`
  - Create `contracts/stellar-save/src/tests/` directory and `mod.rs` if not present
  - Create `contracts/stellar-save/src/tests/multi_token.rs`
  - Add a `test_helpers` sub-module with:
    - `deploy_mock_token(env, decimals) -> Address` — deploys a mock SEP-41 token using `soroban_sdk::token::StellarAssetClient` or a custom mock contract
    - `mint_tokens(env, token, recipient, amount)` — mints tokens to a test address
    - `approve_tokens(env, token, owner, spender, amount)` — sets allowance via `approve`
    - `create_group_with_token(env, token_address, ...) -> u64` — convenience wrapper around `StellarSaveContract::create_group`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

- [ ] 12. Write unit tests in `multi_token.rs`
  - [ ] 12.1 `test_create_group_with_usdc_mock` — deploy mock USDC (decimals=7), create group, verify `get_token_config` returns correct `token_address`
    - _Requirements: 7.1_
  - [ ] 12.2 `test_create_group_with_eurc_mock` — same for mock EURC
    - _Requirements: 7.2_
  - [ ] 12.3 `test_create_group_with_xlm` — verify native XLM token address is accepted
    - _Requirements: 1.6_
  - [ ] 12.4 `test_create_group_invalid_token` — pass a non-token address, verify `InvalidToken` returned and no group created
    - _Requirements: 7.5_
  - [ ] 12.5 `test_contribute_transfers_correct_token` — mint tokens to member, approve contract, call `contribute`, verify member balance decreased and contract balance increased
    - _Requirements: 7.3_
  - [ ] 12.6 `test_payout_transfers_correct_token` — full cycle: all members contribute, call `execute_payout`, verify recipient balance increased by pool amount
    - _Requirements: 7.4_
  - [ ] 12.7 `test_contribute_wrong_amount` — verify `InvalidAmount` returned for mismatched amount
    - _Requirements: 7.6_
  - [ ] 12.8 `test_contribute_insufficient_allowance` — member does not call `approve`, verify `TokenTransferFailed` returned and no `ContributionRecord` stored
    - _Requirements: 7.9_
  - [ ] 12.9 `test_two_groups_different_tokens_independent` — create two groups with different mock tokens, contribute to each, verify no cross-token contamination in balances or contribution state
    - _Requirements: 7.8_

- [ ]* 12.10 Write property test for cross-group token isolation
  - **Property 13: Cross-group token isolation**
  - For any two groups configured with different tokens, contributions and payouts in one group should not affect the token balances or contribution state of the other group
  - **Validates: Requirements 7.8**

- [ ] 13. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
