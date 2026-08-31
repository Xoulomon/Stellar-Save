# Design Document: Multi-Token Support

## Overview

The Stellar-Save ROSCA contract currently hard-codes XLM (in stroops) as the only contribution token. This feature extends the contract to support any SEP-41-compliant Soroban token by introducing a `TokenConfig` struct stored per group at creation time.

Each group is permanently bound to a single token. All contributions and payouts within that group use that token exclusively. The token is validated at group creation via a live `decimals()` call to the token contract. An optional admin-managed allowlist can restrict which tokens are permitted.

The design touches five areas of the existing codebase:
1. A new `TokenConfig` data type in `group.rs`
2. Storage additions for token config and the optional allowlist
3. Token validation logic (SEP-41 `decimals()` call)
4. Updated `create_group`, `contribute`, and `execute_payout` functions
5. Two new error variants in `error.rs`

---

## Architecture

```mermaid
flowchart TD
    Creator -->|create_group with token_address| Contract
    Contract -->|decimals()| TokenContract[SEP-41 Token Contract]
    TokenContract -->|u32| Contract
    Contract -->|store TokenConfig| Storage[(Persistent Storage)]

    Member -->|approve contract for amount| TokenContract
    Member -->|contribute group_id amount| Contract
    Contract -->|transfer_from member to contract| TokenContract

    Executor -->|execute_payout group_id| Contract
    Contract -->|transfer contract to recipient| TokenContract
```

The contract never holds token addresses in hard-coded form. Every token interaction goes through a dynamically-constructed SEP-41 client built from the `token_address` stored in `TokenConfig`.

---

## Components and Interfaces

### TokenConfig struct (new, in `group.rs`)

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenConfig {
    /// The SEP-41 token contract address for this group.
    pub token_address: Address,
    /// Decimal precision of the token, cached from decimals() at group creation.
    pub token_decimals: u32,
}
```

`TokenConfig` is stored separately from `Group` under a new `GroupKey::TokenConfig(u64)` storage key. This keeps the `Group` struct backward-compatible and avoids re-serializing the entire group when only the token config is needed.

### Storage additions (`storage.rs`)

Two new storage key variants:

```rust
// In GroupKey enum
TokenConfig(u64),   // stores TokenConfig for a group

// In CounterKey enum
AllowedTokens,      // stores Vec<Address> of allowed tokens (optional allowlist)
```

New `StorageKeyBuilder` helpers:
- `group_token_config(group_id: u64) -> StorageKey`
- `allowed_tokens() -> StorageKey`

### Token Validator

A new helper function validates a token address before a group is created:

```rust
/// Calls decimals() on the token contract at token_address.
/// Returns Ok(decimals) if the call succeeds and decimals <= 38.
/// Returns Err(StellarSaveError::InvalidToken) otherwise.
fn validate_token(env: &Env, token_address: &Address) -> Result<u32, StellarSaveError>
```

The validator uses `soroban_sdk::token::TokenClient` to call `decimals()`. If the token contract does not exist or does not implement `decimals()`, the Soroban runtime will revert the transaction, which the contract surfaces as `InvalidToken`.

### Updated public functions

#### `create_group` signature change

```rust
pub fn create_group(
    env: Env,
    creator: Address,
    contribution_amount: i128,
    cycle_duration: u64,
    max_members: u32,
    token_address: Address,   // NEW parameter
) -> Result<u64, StellarSaveError>
```

New steps added to `create_group`:
1. If an allowlist is configured, check `token_address` is in the list — return `InvalidToken` if not.
2. Call `validate_token(&env, &token_address)` — return `InvalidToken` on failure.
3. Store `TokenConfig { token_address, token_decimals }` under `GroupKey::TokenConfig(group_id)`.
4. Include `token_address` in the `GroupCreated` event payload.

#### `contribute` changes

The existing `contribute` function has a placeholder transfer. It must be updated to:
1. Load `TokenConfig` for the group.
2. Build a `token::Client` from `token_config.token_address`.
3. Call `token_client.transfer_from(&env, &member, &contract_address, &amount)`.
4. On any failure, return `TokenTransferFailed` without recording the contribution.

#### `execute_payout` changes

The existing `execute_transfer` placeholder must be updated to:
1. Load `TokenConfig` for the group.
2. Build a `token::Client` from `token_config.token_address`.
3. Call `token_client.transfer(&env, &contract_address, &recipient, &payout_amount)`.
4. On any failure, return `PayoutFailed`.

#### New public functions

```rust
/// Returns the TokenConfig for a group.
pub fn get_token_config(env: Env, group_id: u64) -> Result<TokenConfig, StellarSaveError>

/// Adds a token to the admin allowlist.
pub fn add_allowed_token(env: Env, admin: Address, token_address: Address) -> Result<(), StellarSaveError>

/// Removes a token from the admin allowlist.
pub fn remove_allowed_token(env: Env, admin: Address, token_address: Address) -> Result<(), StellarSaveError>

/// Returns true if the token is permitted.
pub fn is_token_allowed(env: Env, token_address: Address) -> bool
```

### New error variants (`error.rs`)

```rust
/// Token address failed SEP-41 validation or is not on the allowlist.
/// Error Code: 5001
InvalidToken = 5001,

/// SEP-41 transfer_from or transfer call failed.
/// Error Code: 5002
TokenTransferFailed = 5002,
```

---

## Data Models

### TokenConfig

| Field | Type | Description |
|---|---|---|
| `token_address` | `Address` | SEP-41 contract address |
| `token_decimals` | `u32` | Cached result of `decimals()`, range [0, 38] |

### Storage layout additions

| Key | Type | Description |
|---|---|---|
| `Group(TokenConfig(group_id))` | `TokenConfig` | Token config per group |
| `Counter(AllowedTokens)` | `Vec<Address>` | Optional admin allowlist |

### Group struct (unchanged)

The `Group` struct itself is not modified. `TokenConfig` is stored under a separate key to preserve backward compatibility with existing serialized groups.

### SEP-41 token interface used

The contract uses `soroban_sdk::token::TokenClient` which exposes:
- `decimals() -> u32` — used during validation
- `transfer_from(spender, from, to, amount)` — used during contribution
- `transfer(from, to, amount)` — used during payout

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token_Config round-trip

*For any* valid SEP-41 token address and decimals value in [0, 38], creating a group with that token address and then calling `get_token_config` should return a `TokenConfig` with the same `token_address` and the `token_decimals` value reported by the token contract's `decimals()` function.

**Validates: Requirements 1.2, 2.1, 2.5, 3.1**

---

### Property 2: Invalid token rejection

*For any* address that does not implement a callable `decimals()` function returning a value in [0, 38], calling `create_group` with that address as `token_address` should return `StellarSaveError::InvalidToken` and no group should be created.

**Validates: Requirements 1.4, 4.2, 4.3**

---

### Property 3: GroupCreated event includes token address

*For any* successful `create_group` call with a valid token address, the emitted `GroupCreated` event payload should contain the `token_address` that was provided.

**Validates: Requirements 1.5**

---

### Property 4: Exact amount enforcement

*For any* group with a configured `contribution_amount` and *for any* amount that is not exactly equal to `contribution_amount`, calling `contribute` with that amount should return `StellarSaveError::InvalidAmount` and the contribution state should remain unchanged.

**Validates: Requirements 3.3, 3.4**

---

### Property 5: Pool amount precision

*For any* group with `contribution_amount` C and `max_members` N, the total pool amount computed by the contract should equal exactly `C * N` with no rounding or truncation.

**Validates: Requirements 3.6**

---

### Property 6: Insufficient allowance rejection

*For any* member who has not granted the contract a token allowance of at least `contribution_amount`, calling `contribute` should return `StellarSaveError::TokenTransferFailed` and no `ContributionRecord` should be stored.

**Validates: Requirements 4.6, 4.7, 5.2, 5.4**

---

### Property 7: Contribution token transfer round-trip

*For any* valid contribution, after `contribute` succeeds, the contract's token balance should have increased by `amount` and the member's token balance should have decreased by `amount`.

**Validates: Requirements 5.1, 5.3**

---

### Property 8: Payout token transfer correctness

*For any* group where all members have contributed in the current cycle, after `execute_payout` succeeds, the designated recipient's token balance should have increased by `contribution_amount * member_count` and the contract's token balance should have decreased by the same amount.

**Validates: Requirements 5.5**

---

### Property 9: Allowlist rejection

*For any* token address not present in the admin allowlist when an allowlist is configured, calling `create_group` with that token address should return `StellarSaveError::InvalidToken`.

**Validates: Requirements 6.1**

---

### Property 10: Allowlist admin-only management

*For any* caller that is not the contract admin, calling `add_allowed_token` or `remove_allowed_token` should return `StellarSaveError::Unauthorized` and the allowlist should remain unchanged.

**Validates: Requirements 6.2, 6.3**

---

### Property 11: Open mode accepts any valid token

*For any* valid SEP-41 token address when no allowlist is configured, `create_group` should succeed and `is_token_allowed` should return `true`.

**Validates: Requirements 6.4**

---

### Property 12: is_token_allowed round-trip

*For any* token address, after `add_allowed_token` is called, `is_token_allowed` should return `true`; after `remove_allowed_token` is called for the same address, `is_token_allowed` should return `false`.

**Validates: Requirements 6.5**

---

### Property 13: Cross-group token isolation

*For any* two groups configured with different tokens, contributions and payouts in one group should not affect the token balances or contribution state of the other group.

**Validates: Requirements 7.8**

---

## Error Handling

| Scenario | Error Returned | State Change |
|---|---|---|
| `token_address` not callable or no `decimals()` | `InvalidToken (5001)` | No group created |
| `token_address` not on allowlist | `InvalidToken (5001)` | No group created |
| `decimals()` returns value > 38 | `InvalidToken (5001)` | No group created |
| `contribute` with wrong amount | `InvalidAmount (3001)` | No state change |
| `contribute` with insufficient allowance | `TokenTransferFailed (5002)` | No state change |
| `transfer_from` fails for any other reason | `TokenTransferFailed (5002)` | No state change |
| `execute_payout` transfer fails | `PayoutFailed (4001)` | Cycle not advanced |
| `get_token_config` with unknown group_id | `GroupNotFound (1001)` | No state change |
| `add_allowed_token` by non-admin | `Unauthorized (2003)` | Allowlist unchanged |

**Atomicity guarantee**: Soroban's transaction model ensures that if `transfer_from` or `transfer` panics, all storage writes in the same invocation are reverted. The contract relies on this guarantee rather than implementing manual rollback.

**Reentrancy**: The existing `ReentrancyGuard` storage key in `payout_executor.rs` already protects `execute_payout`. The `contribute` function should acquire the same guard before calling `transfer_from`.

---

## Testing Strategy

### Unit tests

Unit tests cover specific examples and error conditions:

- `test_create_group_with_usdc_mock` — creates a group with a mock USDC token, verifies `token_address` stored (Req 7.1)
- `test_create_group_with_eurc_mock` — same for EURC (Req 7.2)
- `test_create_group_with_xlm` — verifies native XLM token address is accepted (Req 1.6)
- `test_create_group_invalid_token` — verifies `InvalidToken` returned for a non-token address (Req 7.5)
- `test_get_token_config_not_found` — verifies `GroupNotFound` for unknown group_id (Req 2.4)
- `test_error_codes` — verifies `InvalidToken = 5001` and `TokenTransferFailed = 5002` (Req 4.4, 4.5)
- `test_contribute_wrong_amount` — verifies `InvalidAmount` for mismatched amount (Req 7.6)
- `test_contribute_insufficient_allowance` — verifies `TokenTransferFailed` (Req 7.9)
- `test_two_groups_different_tokens_independent` — verifies cross-group isolation (Req 7.8)

### Property-based tests

The project uses Rust's `proptest` crate for property-based testing. Each property test runs a minimum of 100 iterations.

**Mock token setup**: Tests use a `MockToken` contract deployed in the Soroban test environment (`Env::default()`). The mock implements the SEP-41 interface and allows configuring `decimals()` return values and simulating transfer failures.

Tag format: `// Feature: multi-token-support, Property {N}: {property_text}`

| Property | Test name | Library | Iterations |
|---|---|---|---|
| P1: Token_Config round-trip | `prop_token_config_round_trip` | proptest | 100 |
| P2: Invalid token rejection | `prop_invalid_token_rejected` | proptest | 100 |
| P3: GroupCreated event includes token | `prop_group_created_event_has_token` | proptest | 100 |
| P4: Exact amount enforcement | `prop_wrong_amount_rejected` | proptest | 100 |
| P5: Pool amount precision | `prop_pool_amount_no_precision_loss` | proptest | 100 |
| P6: Insufficient allowance rejection | `prop_insufficient_allowance_rejected` | proptest | 100 |
| P7: Contribution balance change | `prop_contribute_balance_change` | proptest | 100 |
| P8: Payout balance change | `prop_payout_balance_change` | proptest | 100 |
| P9: Allowlist rejection | `prop_allowlist_rejects_unlisted_token` | proptest | 100 |
| P10: Allowlist admin-only | `prop_allowlist_non_admin_rejected` | proptest | 100 |
| P11: Open mode accepts valid token | `prop_open_mode_accepts_valid_token` | proptest | 100 |
| P12: is_token_allowed round-trip | `prop_is_token_allowed_round_trip` | proptest | 100 |
| P13: Cross-group isolation | `prop_cross_group_token_isolation` | proptest | 100 |

### Test architecture

All multi-token tests live in `contracts/stellar-save/src/tests/multi_token.rs`. A shared `test_helpers` module provides:

- `deploy_mock_token(env, decimals) -> Address` — deploys a mock SEP-41 token
- `mint_tokens(env, token, recipient, amount)` — mints tokens to a test address
- `approve_tokens(env, token, owner, spender, amount)` — sets allowance
- `create_group_with_token(env, token_address, ...) -> u64` — convenience wrapper

This avoids duplicating setup code across tests and makes the token-specific behavior explicit.
