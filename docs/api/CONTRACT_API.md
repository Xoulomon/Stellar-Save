# Stellar-Save Contract API Reference

## Overview
The Stellar-Save smart contract implements a decentralized ROSCA (Rotating Savings and Credit Association) on Stellar Soroban. This document covers all public contract functions, their parameters, return types, error conditions, and usage examples.

**Contract Address**: Deployed via `soroban contract deploy`
**Entry Point**: `StellarSaveContract` in `src/lib.rs`
**Error Type**: `StellarSaveError` (u32 codes 1001-9003)

## Error Codes Reference

| Code | Error | Category | Description |
|------|--------|----------|-------------|
| 1001 | `GroupNotFound` | Group | Specified group ID does not exist |
| 1002 | `GroupFull` | Group | Group reached maximum member capacity |
| 1003 | `InvalidState` | Group | Group not in valid state for operation |
| 2001 | `AlreadyMember` | Member | Address already member of group |
| 2002 | `NotMember` | Member | Address not member of group |
| 2003 | `Unauthorized` | Member | Caller not authorized |
| 3001 | `InvalidAmount` | Contribution | Invalid contribution amount |
| 3002 | `AlreadyContributed` | Contribution | Already contributed this cycle |
| 3003 | `CycleNotComplete` | Contribution | Cycle missing contributions |
| 3004 | `ContributionNotFound` | Contribution | Contribution record not found |
| 4001 | `PayoutFailed` | Payout | Payout operation failed |
| 4002 | `PayoutAlreadyProcessed` | Payout | Payout already processed |
| 4003 | `InvalidRecipient` | Payout | Recipient not eligible |
| 9001 | `InternalError` | System | Internal contract error |
| 9002 | `DataCorruption` | System | Contract data corrupted |
| 9003 | `Overflow` | System | Counter/calculation overflow |

**Full Error Handling**: See [error.rs](contracts/stellar-save/src/error.rs)

## Core Functions

### Group Management

#### `create_group`
```rust
pub fn create_group(
    env: Env,
    creator: Address,
    contribution_amount: i128,  // stroops (1 XLM = 10_000_000)
    cycle_duration: u64,        // seconds
    max_members: u32,
) -> Result<u64, StellarSaveError>
```
**Creates new ROSCA group**
- **Returns**: New group ID
- **Errors**: `InvalidState` (config limits), `RateLimitExceeded`, `ContractPaused`
- **Example**:
```rust
let group_id = client.create_group(&env, &creator, &10_000_000, &604800, &5)?;
```

#### `get_group`
```rust
pub fn get_group(env: Env, group_id: u64) -> Result<Group, StellarSaveError>
```
**Retrieves group details**
- **Returns**: `Group` struct
- **Errors**: `GroupNotFound`

#### `update_group`
```rust
pub fn update_group(
    env: Env,
    group_id: u64,
    new_contribution: i128,
    new_duration: u64,
    new_max_members: u32,
) -> Result<(), StellarSaveError>
```
**Updates pending group params (creator only)**
- **Errors**: `InvalidState` (not pending), `Unauthorized`

#### `delete_group`
```rust
pub fn delete_group(env: Env, group_id: u64) -> Result<(), StellarSaveError>
```
**Deletes empty group (creator only)**

#### `join_group`
```rust
pub fn join_group(env: Env, group_id: u64, member: Address) -> Result<(), StellarSaveError>
```
**Member joins pending group**
- **Errors**: `GroupFull`, `AlreadyMember`, `InvalidState`, `RateLimitExceeded`

### Member Management

#### `get_group_members`
```rust
pub fn get_group_members(
    env: Env,
    group_id: u64,
    offset: u32,
    limit: u32,
) -> Result<Vec<Address>, StellarSaveError>
```
**Paginated member list (join order)**

#### `get_member_count`
```rust
pub fn get_member_count(env: Env, group_id: u64) -> Result<u32, StellarSaveError>
```

#### `is_member`
```rust
pub fn is_member(env: Env, group_id: u64, address: Address) -> Result<bool, StellarSaveError>
```

#### `get_member`
```rust
pub fn get_member(env: Env, group_id: u64, address: Address) -> Result<MemberProfile, StellarSaveError>
```

### Contribution Functions

#### `record_contribution` (Internal)
Core contribution recording with duplicate protection and totals tracking.

#### `get_member_total_contributions`
```rust
pub fn get_member_total_contributions(
    env: Env,
    group_id: u64,
    member: Address,
) -> Result<i128, StellarSaveError>
```

#### `get_member_contribution_history`
```rust
pub fn get_member_contribution_history(
    env: Env,
    group_id: u64,
    member: Address,
    start_cycle: u32,
    limit: u32,
) -> Result<Vec<ContributionRecord>, StellarSaveError>
```

#### `get_cycle_contributions`
```rust
pub fn get_cycle_contributions(
    env: Env,
    group_id: u64,
    cycle_number: u32,
) -> Result<Vec<ContributionRecord>, StellarSaveError>
```

#### `get_missed_contributions`
```rust
pub fn get_missed_contributions(
    env: Env,
    group_id: u64,
    cycle_number: u32,
) -> Result<Vec<Address>, StellarSaveError>
```

#### `is_cycle_complete`
```rust
pub fn is_cycle_complete(
    env: Env,
    group_id: u64,
    cycle_number: u32,
) -> Result<bool, StellarSaveError>
```

#### `validate_contribution_amount`
```rust
pub fn validate_contribution_amount(
    env: &Env,
    group_id: u64,
    amount: i128,
) -> Result<(), StellarSaveError>
```

### Payout Functions

#### `transfer_payout` (Internal)
Core payout transfer with reentrancy protection.

#### `get_payout_history`
```rust
pub fn get_payout_history(
    env: Env,
    group_id: u64,
    offset: u32,
    limit: u32,
) -> Result<Vec<PayoutRecord>, StellarSaveError>
```

#### `get_member_payout`
```rust
pub fn get_member_payout(
    env: Env,
    group_id: u64,
    member_address: Address,
) -> Result<Option<PayoutRecord>, StellarSaveError>
```

#### `get_payout`
```rust
pub fn get_payout(env: Env, group_id: u64, cycle: u32) -> Result<PayoutRecord, StellarSaveError>
```

#### `get_payout_schedule`
```rust
pub fn get_payout_schedule(env: Env, group_id: u64) -> Result<Vec<PayoutScheduleEntry>, StellarSaveError>
```

#### `get_payout_queue`
**Upcoming recipients (sorted by position)**

#### `is_payout_due`
```rust
pub fn is_payout_due(env: Env, group_id: u64) -> Result<bool, StellarSaveError>
```

#### `validate_payout_recipient`
```rust
pub fn validate_payout_recipient(
    env: Env,
    group_id: u64,
    recipient: Address,
) -> Result<bool, StellarSaveError>
```

### Status & Analytics

#### `is_complete`
```rust
pub fn is_complete(env: Env, group_id: u64) -> Result<bool, StellarSaveError>
```

#### `get_group_balance`
```rust
pub fn get_group_balance(env: Env, group_id: u64) -> Result<i128, StellarSaveError>
```

#### `get_total_paid_out`
```rust
pub fn get_total_paid_out(env: Env, group_id: u64) -> Result<i128, StellarSaveError>
```

#### `get_contribution_deadline`
```rust
pub fn get_contribution_deadline(
    env: Env,
    group_id: u64,
    cycle_number: u32,
) -> Result<u64, StellarSaveError>
```

#### `get_next_payout_cycle`
```rust
pub fn get_next_payout_cycle(env: Env, group_id: u64) -> Result<u64, StellarSaveError>
```

#### `get_payout_position`
```rust
pub fn get_payout_position(
    env: Env,
    group_id: u64,
    member_address: Address,
) -> Result<u32, StellarSaveError>
```

#### `has_received_payout`
```rust
pub fn has_received_payout(
    env: Env,
    group_id: u64,
    member_address: Address,
) -> Result<bool, StellarSaveError>
```

### Admin & Contract Functions

#### `update_config`
**Admin-only global config update**

#### `pause_contract` / `unpause_contract`
**Emergency pause (admin only)**

#### `get_contract_balance`
**Contract XLM balance**

### Discovery Functions

#### `get_total_groups`
**Total groups counter**

#### `list_groups`
```rust
pub fn list_groups(
    env: Env,
    cursor: u64,
    limit: u32,
    status_filter: Option<GroupStatus>,
) -> Result<Vec<Group>, StellarSaveError>
```

#### `get_total_groups_created`
**Same as `get_total_groups`**

## Validation Helpers
- `validate_cycle_duration`
- `validate_contribution_amount_range`

## Key Data Structures

**Group** (from `group.rs`):
```rust
pub struct Group {
    id: u64,
    creator: Address,
    contribution_amount: i128,
    cycle_duration: u64,
    max_members: u32,
    min_members: u32,
    member_count: u32,
    current_cycle: u32,
    status: GroupStatus,
    started: bool,
    started_at: u64,
}
```

**MemberProfile**:
```rust
pub struct MemberProfile {
    address: Address,
    group_id: u64,
    payout_position: u32,  // Rotation order
    joined_at: u64,
}
```

**ContributionRecord** / **PayoutRecord**: Similar structure with cycle tracking.

**GroupStatus**: `Pending \| Active \| Completed \| Cancelled`

## Events
All via `EventEmitter`:

| Event | Topics | Data |
|-------|--------|------|
| `GroupCreated` | `(GroupCreated, creator)` | `group_id: u64` |
| `GroupUpdated` | `(GroupUpdated, group_id)` | `creator: Address` |
| `MemberJoined` | N/A | `(group_id, member, count, timestamp)` |
| `PayoutExecuted` | N/A | `(group_id, recipient, amount, cycle, timestamp)` |
| `ContractPaused` | N/A | `(admin, timestamp)` |

## Storage Patterns
All via `StorageKeyBuilder`:
```
GROUP_DATA_{id}
GROUP_MEMBERS_{id}
CONTRIB_INDIVIDUAL_{group}_{cycle}_{address}
CONTRIB_CYCLE_TOTAL_{group}_{cycle}
PAYOUT_RECORD_{group}_{cycle}
MEMBER_PROFILE_{group}_{address}
```

## Usage Example: Complete Flow

```rust
use soroban_sdk::{Env, Address};
use stellar_save::StellarSaveContractClient;

// 1. Create group
let group_id = client.create_group(
    &env, &creator, &10_000_000, &604800, &5
)?;

// 2. Members join
client.join_group(&env, &group_id, &member1)?;
client.join_group(&env, &group_id, &member2)?;

// 3. Contributions
client.contribute(&env, &group_id, &member1, &10_000_000)?;
client.contribute(&env, &group_id, &member2, &10_000_000)?;

// 4. Check payout due
if client.is_payout_due(&env, &group_id)? {
    client.execute_payout(&env, &group_id)?;
}
```

## Client Integration
```
npm install @stellar/stellar-sdk @stellar/contract-bindings
# or Rust: soroban-sdk
```

**Full source**: [contracts/stellar-save/src/lib.rs](contracts/stellar-save/src/lib.rs)

---
*Generated by BLACKBOXAI - Last updated from lib.rs analysis*

