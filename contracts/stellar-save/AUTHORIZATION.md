# Access Control Documentation

## Overview

The Stellar-Save smart contract implements role-based access control (RBAC) for a ROSCA (Rotational Savings and Credit Association) system. This document describes the authorization model and which functions require specific permissions.

## Roles

### 1. Admin
- Can update global contract configuration
- Set via `update_config` function

### 2. Group Creator
- Can create groups
- Can update group parameters (while Pending)
- Can delete groups (while no members)
- Can assign payout positions
- Can activate groups

### 3. Group Member
- Can join groups
- Can make contributions (via record_contribution)
- Can withdraw in emergency situations
- Can view group data

### 4. Public/Anyone
- Can read group data
- Can list groups
- Can trigger payout execution (once preconditions are met)

## Function Access Matrix

### Admin-Only Functions

| Function | Required Role | Authorization Method |
|----------|--------------|---------------------|
| `update_config` | Admin | `require_auth()` on admin address |

### Creator-Only Functions

| Function | Required Role | Authorization Method |
|----------|--------------|---------------------|
| `create_group` | None (open) | `require_auth()` on creator |
| `update_group` | Creator | `require_auth()` + creator check |
| `delete_group` | Creator | `require_auth()` + creator check |
| `assign_payout_positions` | Creator | `require_auth()` + creator check |
| `activate_group` | Creator | Creator parameter check |

### Member-Only Functions

| Function | Required Role | Authorization Method |
|----------|--------------|---------------------|
| `join_group` | None (open join) | `require_auth()` on member |
| `emergency_withdraw` | Member | `require_auth()` + member check |

### Permissionless Functions (Anyone can call)

| Function | Access | Notes |
|----------|--------|-------|
| `execute_payout` | Public | Preconditions must be met (cycle complete) |
| `transfer_payout` | Public | Internal function, validates eligibility |
| `get_group` | Public | Read-only |
| `get_member_count` | Public | Read-only |
| `list_groups` | Public | Read-only |
| `has_received_payout` | Public | Read-only |
| `is_payout_due` | Public | Read-only |
| `get_payout_position` | Public | Read-only |
| `get_total_paid_out` | Public | Read-only |
| `get_group_balance` | Public | Read-only |
| `get_payout_history` | Public | Read-only |
| `get_member_payout` | Public | Read-only |
| `get_payout` | Public | Read-only |
| `get_payout_schedule` | Public | Read-only |
| `is_complete` | Public | Read-only |
| `get_payout_queue` | Public | Read-only |
| `get_total_groups` | Public | Read-only |
| `get_total_groups_created` | Public | Read-only |
| `get_contract_balance` | Public | Read-only |
| `get_member_total_contributions` | Public | Read-only |
| `get_member_contribution_history` | Public | Read-only |
| `get_cycle_contributions` | Public | Read-only |
| `is_cycle_complete` | Public | Read-only |
| `get_missed_contributions` | Public | Read-only |
| `get_contribution_deadline` | Public | Read-only |
| `get_next_payout_cycle` | Public | Read-only |
| `get_group_members` | Public | Read-only |

## Authorization Error Codes

| Error Code | Description |
|------------|-------------|
| 2003 | Unauthorized - Caller does not have permission to perform this operation |

## Implementation Details

### Using require_auth()

The Soroban SDK provides `require_auth()` on Address objects. This function:

1. Verifies the caller has authorized the transaction
2. Reverts the transaction if authorization fails
3. Should be called at the beginning of sensitive functions

Example:
```rust
caller.require_auth();
```

### Creator Verification Pattern

For functions that should only be called by the group creator:

```rust
// Load the group
let group_key = StorageKeyBuilder::group_data(group_id);
let group = env.storage().persistent().get::<_, Group>(&group_key)
    .ok_or(StellarSaveError::GroupNotFound)?;

// Verify caller is creator
group.creator.require_auth();

// Additional check (optional for extra security)
if caller != group.creator {
    return Err(StellarSaveError::Unauthorized);
}
```

### Member Verification Pattern

For functions that should only be called by group members:

```rust
// Verify caller is a member
let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
if !env.storage().persistent().has(&member_key) {
    return Err(StellarSaveError::NotMember);
}

// Require auth
member.require_auth();
```

## Security Considerations

1. **Always authenticate before state-changing operations**: Use `require_auth()` for all functions that modify contract state.

2. **Verify roles in storage**: Don't rely solely on function parameters; verify against stored data.

3. **Check group status**: Many operations require specific group statuses (Pending, Active, etc.).

4. **Reentrancy protection**: Use storage flags to prevent reentrant calls in sensitive operations.

5. **Overflow protection**: Use checked arithmetic to prevent overflow attacks.

## Current Implementation Status

The following functions have authorization checks implemented:

- `update_config` - Admin authorization via require_auth()
- `create_group` - Creator authorization via require_auth()
- `update_group` - Creator verification via require_auth()
- `delete_group` - Creator authorization via require_auth()
- `assign_payout_positions` - Creator authorization via require_auth()
- `join_group` - Member authorization via require_auth()
- `emergency_withdraw` - Member authorization via require_auth()

## Testing Authorization

Tests should verify:
- Unauthorized callers are rejected
- Creators can perform creator-only operations
- Members can perform member-only operations  
- Public read functions work without authentication
