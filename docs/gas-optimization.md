# Stellar-Save Gas Optimization Report

This document outlines the recent gas optimizations implemented in the Stellar-Save Soroban smart contracts. By focusing on static analysis of storage operations, we successfully identified and eliminated O(N) loops and redundant storage reads.

## 1. Eliminated Sub-optimal Vector Storage Reads
**Location**: `src/pool.rs` - `get_member_count()`

**Before**: The function retrieved the `Vec<Address>` of all group members from storage, only to check its `.len()`. As groups grew, the storage cost to load this vector grew linearly (O(N)), acting as a severe gas hotspot.
```rust
let members: soroban_sdk::Vec<soroban_sdk::Address> = env
    .storage()
    .persistent()
    .get(&members_key)
    .ok_or(StellarSaveError::GroupNotFound)?;

Ok(members.len())
```

**After**: Modified to retrieve the `Group` struct and return the already-calculated `group.member_count`, turning an O(N) vector load into an O(1) single storage lookup.
```rust
let group: crate::group::Group = env
    .storage()
    .persistent()
    .get(&group_key)
    .ok_or(StellarSaveError::GroupNotFound)?;

Ok(group.member_count)
```

## 2. Combined Redundant Group Reads
**Location**: `src/pool.rs` - `get_pool_info()`

**Before**: `get_pool_info` called `get_member_count` (which read from storage) and then subsequently called `get_contribution_amount` (which requested the `Group` struct again from storage).
**After**: Reduced these two discrete storage loads into one. The `Group` struct is loaded once at the beginning of `get_pool_info`, and both properties are read from it directly.

## 3. Eliminated O(N) Payout Checks
**Location**: `src/lib.rs` - `has_received_payout()`

**Before**: The algorithm looped over every cycle from `0..=group.current_cycle` and performed a persistent storage read for the `payout_recipient` key each time to check if a member had been paid out.
```rust
for cycle in 0..=group.current_cycle {
    let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
    if let Some(recipient) = env.storage().persistent().get::<_, Address>(&recipient_key) {
        if recipient == member_address { return Ok(true); }
    }
}
```

**After**: Optimized by recognizing that payouts are structurally bound to `member_profile.payout_position`. By loading the `MemberProfile` once, we can instantly jump to only their designated cycle and check `payout_recipient`, avoiding the loop entirely and replacing it with O(1) reads.

## 4. O(N) Loops Replaced With Incremental Keys
**Location**: `src/lib.rs` - `get_group_balance()`, `get_total_paid_out()`, `get_member_total_contributions()`

**Before**: All balance and historic contribution trackers relied on extensive O(N) loops aggregating individual records from cycle 0 to `current_cycle`. As cycles elapsed, the gas penalty increased exponentially.
**After**: We introduced three new aggregate trackers inside `storage.rs`:
- `CounterKey::GroupBalance`
- `CounterKey::GroupTotalPaidOut`
- `MemberKey::TotalContributions`

We then updated both `record_contribution` and `transfer_payout` to increment these values on-the-fly when transactions occur. The getter functions now retrieve these pre-calculated values by checking single storage keys in strictly O(1) time.
