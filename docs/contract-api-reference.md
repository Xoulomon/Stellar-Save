# Stellar-Save Contract API Reference

**Version:** 1.0.0
**Focus:** `group.rs`, `contribution.rs`, `payout.rs`

This document covers all public types and functions defined in the contract modules listed above. It includes parameter definitions, return values, error handling, and Stellar CLI examples for contract invocation.

## Table of Contents

1. [Data Types](#data-types)
2. [Error Codes](#error-codes)
3. [Group Types and Helpers](#group-types-and-helpers)
4. [Contribution Types and Helpers](#contribution-types-and-helpers)
5. [Payout Types and Helpers](#payout-types-and-helpers)
6. [Stellar CLI Examples](#stellar-cli-examples)

---

## Data Types

### `Group`

Represents a rotational savings group and its runtime state.

```rust
pub struct Group {
    pub id: u64,
    pub creator: Address,
    pub contribution_amount: i128,
    pub cycle_duration: u64,
    pub max_members: u32,
    pub min_members: u32,
    pub member_count: u32,
    pub current_cycle: u32,
    pub is_active: bool,
    pub status: GroupStatus,
    pub created_at: u64,
    pub started: bool,
    pub started_at: u64,
    pub require_contribution_proof: bool,
    pub allow_dynamic_contributions: bool,
    pub grace_period_seconds: u64,
    pub invitation_only: bool,
    pub reward_pool: i128,
    pub paused: bool,
    pub penalty_enabled: bool,
    pub penalty_amount: i128,
    pub dispute_active: bool,
    pub name: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub archived: bool,
    pub payout_order: crate::payout::PayoutOrder,
}
```

### `GroupStatus`

Enumerates the lifecycle states for a group.

```rust
pub enum GroupStatus {
    Pending,
    Active,
    Paused,
    Completed,
    Cancelled,
}
```

### `ContributionRecord`

Tracks a member contribution for a specific group cycle.

```rust
pub struct ContributionRecord {
    pub member_address: Address,
    pub group_id: u64,
    pub cycle_number: u32,
    pub amount: i128,
    pub timestamp: u64,
}
```

### `PayoutOrder`

Defines the payout ordering strategy for a group.

```rust
pub enum PayoutOrder {
    Sequential,
    Random,
    Bid,
}
```

### `PayoutRecord`

Tracks an executed payout distribution.

```rust
pub struct PayoutRecord {
    pub recipient: Address,
    pub group_id: u64,
    pub cycle_number: u32,
    pub amount: i128,
    pub timestamp: u64,
}
```

---

## Error Codes

The contract uses `ContractError` codes from `contracts/stellar-save/src/errors.rs`.

| Code | Error | Description |
|------|-------|-------------|
| 1001 | `GroupNotFound` | The specified group ID does not exist |
| 1002 | `GroupFull` | The group has reached maximum member capacity |
| 1003 | `InvalidState` | The group is not in a valid state for the requested operation |
| 1004 | `InvalidMetadata` | Metadata is invalid for the group |
| 1005 | `MaxMembersExceeded` / `MergeIncompatible` | Group limits exceeded or incompatible merge parameters |
| 1006 | `DisputeActive` | A dispute is active, blocking payouts |
| 1007 | `GroupNotArchivable` | Group cannot be archived until terminal state |
| 2001 | `AlreadyMember` | Address is already a member of the group |
| 2002 | `NotMember` | Address is not a member of the group |
| 2003 | `Unauthorized` | Caller is not authorized |
| 2004 | `NotInvited` | Address is not invited to an invitation-only group |
| 2005 | `AlreadyVoted` | Member already voted on current dispute |
| 3001 | `InvalidAmount` | Contribution amount is invalid |
| 3002 | `AlreadyContributed` | Member already contributed for this cycle |
| 3003 | `CycleNotComplete` | Current cycle is not complete |
| 3004 | `ContributionNotFound` | Contribution record not found |
| 3005 | `DeadlineNotReached` / `CycleDeadlineExpired` | Cycle deadline conditions are not met |
| 3006 | `ContributionTooLow` | Contribution below configured minimum |
| 3007 | `ContributionTooHigh` | Contribution above configured maximum |
| 3008 | `InsufficientBalance` | Member balance is insufficient for auto-contribution |
| 4001 | `PayoutFailed` | Payout operation failed |
| 4002 | `PayoutAlreadyProcessed` | Payout already processed for this cycle |
| 4003 | `InvalidRecipient` | Recipient is not eligible for payout |
| 5001 | `InvalidToken` | Token is invalid or not allowed |
| 5002 | `TokenTransferFailed` | Token transfer failed during contribution or payout |
| 6001 | `RewardAlreadyClaimed` | Completion reward already claimed |
| 6002 | `RewardNotEligible` | Member not eligible for completion reward |
| 6003 | `AlreadyRefunded` | Contribution already refunded |
| 6004 | `RefundNotEligible` | Refund is not eligible at this time |
| 7001 | `DeadlineExtensionExceedsMax` | Requested deadline extension is too long |
| 7002 | `AlreadyVotedDissolve` | Member already voted to dissolve the group |
| 7003 | `GroupAlreadyDissolved` | Group has already been dissolved |
| 9001 | `InternalError` | Internal contract error occurred |
| 9002 | `DataCorruption` | Contract data is corrupted |
| 9003 | `Overflow` | Arithmetic overflow or maximum counter reached |

---

## Group Types and Helpers

### `Group::new`

Creates a new `Group` value with required group settings.

**Signature:**
```rust
pub fn new(
    env: &Env,
    id: u64,
    creator: Address,
    contribution_amount: i128,
    cycle_duration: u64,
    max_members: u32,
    min_members: u32,
    created_at: u64,
    grace_period_seconds: u64,
) -> Self
```

**Parameters:**
- `env`: Soroban environment.
- `id`: Unique group identifier.
- `creator`: Group creator address.
- `contribution_amount`: Required contribution amount in stroops.
- `cycle_duration`: Cycle duration in seconds.
- `max_members`: Maximum number of allowed members.
- `min_members`: Minimum members needed to activate.
- `created_at`: Group creation timestamp.
- `grace_period_seconds`: Grace period after cycle deadline.

**Returns:** `Group`

**Panics when:**
- `contribution_amount <= 0`
- `cycle_duration == 0`
- `max_members < 2`
- `min_members < 2`
- `min_members > max_members`
- `grace_period_seconds > 604800`

---

### `Group::new_with_penalty`

Creates a new `Group` value with explicit penalty settings.

**Signature:**
```rust
pub fn new_with_penalty(
    env: &Env,
    id: u64,
    creator: Address,
    contribution_amount: i128,
    cycle_duration: u64,
    max_members: u32,
    min_members: u32,
    created_at: u64,
    grace_period_seconds: u64,
    penalty_enabled: bool,
    penalty_amount: i128,
) -> Self
```

**Parameters:**
- `penalty_enabled`: Enables missed-contribution penalties.
- `penalty_amount`: Fixed penalty in stroops (`0` means percentage-based penalty).

**Returns:** `Group`

**Panics when:** Same validation rules as `Group::new`.

---

### `Group::is_complete`

Checks whether the group has finished all payout cycles.

**Signature:**
```rust
pub fn is_complete(&self) -> bool
```

**Returns:** `true` when the group has completed all cycles or status is `Completed`.

---

### `Group::complete`

Marks the group as completed.

**Signature:**
```rust
pub fn complete(&mut self, env: &soroban_sdk::Env)
```

**Parameters:**
- `env`: Soroban environment used for event emission.

**Returns:** `()`

**Panics when:** The group is already complete.

---

### `Group::advance_cycle`

Moves the group to the next payout cycle.

**Signature:**
```rust
pub fn advance_cycle(&mut self, env: &soroban_sdk::Env)
```

**Parameters:**
- `env`: Soroban environment used for event emission.

**Returns:** `()`

**Panics when:** The group is already complete.

---

### `Group::deactivate`

Sets the group inactive without changing its lifecycle status.

**Signature:**
```rust
pub fn deactivate(&mut self)
```

**Returns:** `()`

---

### `Group::reactivate`

Reactivates a non-complete group.

**Signature:**
```rust
pub fn reactivate(&mut self)
```

**Returns:** `()`

**Panics when:** The group has already completed.

---

### `Group::activate`

Starts the first payout cycle when minimum members have joined.

**Signature:**
```rust
pub fn activate(&mut self, timestamp: u64)
```

**Parameters:**
- `timestamp`: Current Unix timestamp in seconds.

**Returns:** `()`

**Panics when:**
- The group already started.
- `member_count < min_members`.

---

### `Group::can_activate`

Checks if the group is ready to start.

**Signature:**
```rust
pub fn can_activate(&self) -> bool
```

**Returns:** `true` when the group has enough members and is not yet started.

---

### `Group::total_pool_amount`

Calculates the total payout pool for the group.

**Signature:**
```rust
pub fn total_pool_amount(&self) -> i128
```

**Returns:** Computed pool amount in stroops.

---

### `Group::checked_total_pool_amount`

Same as `total_pool_amount`, but returns `Option<i128>` to avoid panicking on overflow.

**Signature:**
```rust
pub fn checked_total_pool_amount(&self) -> Option<i128>
```

---

### `Group::validate`

Validates the internal group state.

**Signature:**
```rust
pub fn validate(&self) -> bool
```

**Returns:** `true` when the group configuration is internally consistent.

---

### `Group::add_member`

Increments the group's member count.

**Signature:**
```rust
pub fn add_member(&mut self)
```

**Returns:** `()`

---

### `Group::is_paused`

Returns whether the group is paused by the creator or state machine.

**Signature:**
```rust
pub fn is_paused(&self) -> bool
```

**Returns:** `true` when group contributions and payouts are blocked.

---

## Contribution Types and Helpers

### `ContributionRecord::new`

Creates a new contribution record.

**Signature:**
```rust
pub fn new(
    member_address: Address,
    group_id: u64,
    cycle_number: u32,
    amount: i128,
    timestamp: u64,
) -> Self
```

**Returns:** `ContributionRecord`

**Panics when:** `amount <= 0`

---

### `ContributionRecord::validate`

Validates the contribution record contents.

**Signature:**
```rust
pub fn validate(&self) -> bool
```

**Returns:** `true` when `amount > 0`.

---

### `ContributionRecord::matches_group_and_cycle`

Checks whether a contribution matches a specific group and cycle.

**Signature:**
```rust
pub fn matches_group_and_cycle(
    &self,
    expected_group_id: u64,
    expected_cycle: u32,
) -> bool
```

**Returns:** `true` when both group ID and cycle number match.

---

### `ContributionRecord::is_from_member`

Checks whether the contribution was made by a specific member.

**Signature:**
```rust
pub fn is_from_member(&self, address: &Address) -> bool
```

**Returns:** `true` when the member address matches.

---

## Payout Types and Helpers

### `PayoutRecord::new`

Creates a new payout record.

**Signature:**
```rust
pub fn new(
    recipient: Address,
    group_id: u64,
    cycle_number: u32,
    amount: i128,
    timestamp: u64,
) -> Self
```

**Returns:** `PayoutRecord`

**Panics when:** `amount <= 0`

---

### `PayoutRecord::validate`

Validates the payout record contents.

**Signature:**
```rust
pub fn validate(&self) -> bool
```

**Returns:** `true` when `amount > 0`.

---

### `PayoutRecord::matches_group_and_cycle`

Checks whether a payout matches a specific group and cycle.

**Signature:**
```rust
pub fn matches_group_and_cycle(
    &self,
    expected_group_id: u64,
    expected_cycle: u32,
) -> bool
```

**Returns:** `true` when both fields match.

---

### `PayoutRecord::is_for_recipient`

Checks whether the payout recipient matches a given address.

**Signature:**
```rust
pub fn is_for_recipient(&self, address: &Address) -> bool
```

**Returns:** `true` when the recipient matches.

---

### `PayoutRecord::belongs_to_group`

Verifies payout ownership by group.

**Signature:**
```rust
pub fn belongs_to_group(&self, group_id: u64) -> bool
```

**Returns:** `true` when the payout belongs to the specified group.

---

### `PayoutRecord::amount_in_xlm`

Returns the payout amount converted from stroops to whole XLM units.

**Signature:**
```rust
pub fn amount_in_xlm(&self) -> i128
```

**Returns:** payout amount in XLM (truncated to whole units).

---

### `get_next_recipient`

Returns the next scheduled payout recipient for a group.

**Signature:**
```rust
pub fn get_next_recipient(env: &Env, group_id: u64) -> Result<Address, StellarSaveError>
```

**Parameters:**
- `env`: Soroban environment.
- `group_id`: Target group ID.

**Returns:**
- `Ok(Address)`: Next payout recipient.
- `Err(StellarSaveError::GroupNotFound)`: Group does not exist.
- `Err(StellarSaveError::InvalidState)`: Group is not active or recipient lookup failed.

---

## Stellar CLI Examples

### Create a group

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account creator \
  -- create_group \
  --creator "$CREATOR_ADDRESS" \
  --contribution_amount 100000000 \
  --cycle_duration 604800 \
  --max_members 5 \
  --token_address "$TOKEN_ADDRESS" \
  --grace_period_seconds 86400 \
  --payout_order Sequential
```

### Join a group

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account member1 \
  -- join_group \
  --group_id 1 \
  --member "$MEMBER1_ADDRESS"
```

### Contribute to a group

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account member1 \
  -- contribute \
  --group_id 1 \
  --member "$MEMBER1_ADDRESS" \
  --amount 100000000
```

### Activate a group before contributions

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account creator \
  -- activate_group \
  --group_id 1 \
  --creator "$CREATOR_ADDRESS"
```

### Trigger a payout

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account creator \
  -- execute_payout \
  --group_id 1
```

### Query next payout recipient

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account viewer \
  -- get_next_recipient \
  --group_id 1
```
