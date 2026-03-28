# Implementation: is_cycle_deadline_passed Helper Function

## Overview
A helper function to check if the current cycle deadline has passed for a group.

## Function Signature
```rust
pub fn is_cycle_deadline_passed(group: &Group, current_time: u64) -> bool
```

## Parameters
- `group`: Reference to the Group to check
- `current_time`: Current timestamp in seconds (typically from `env.ledger().timestamp()`)

## Returns
- `true` if the cycle deadline has passed
- `false` if the deadline has not passed or group hasn't started

## Logic
1. Returns `false` if group hasn't started yet
2. Calculates cycle deadline: `started_at + (cycle_duration * (current_cycle + 1))`
3. Returns `true` if `current_time > cycle_deadline`

## Usage Example

```rust
use stellar_save::is_cycle_deadline_passed;

// In your contract function
pub fn check_deadline(env: Env, group_id: u64) -> bool {
    let group = get_group(&env, group_id);
    let current_time = env.ledger().timestamp();
    is_cycle_deadline_passed(&group, current_time)
}
```

## Tests Included

1. **test_is_cycle_deadline_passed_not_started**
   - Group that hasn't been activated
   - Should return `false`

2. **test_is_cycle_deadline_passed_before_deadline**
   - Current time exactly at deadline
   - Should return `false` (not yet passed)

3. **test_is_cycle_deadline_passed_after_deadline**
   - Current time 1 second after deadline
   - Should return `true`

4. **test_is_cycle_deadline_passed_second_cycle**
   - Tests deadline calculation for cycle 1 (second cycle)
   - Verifies deadline is `started_at + (cycle_duration * 2)`

## Files Modified

1. **contracts/stellar-save/src/helpers.rs**
   - Added `is_cycle_deadline_passed` function
   - Added 4 comprehensive unit tests
   - Added `use crate::Group;` import

2. **contracts/stellar-save/src/lib.rs**
   - Updated export: `pub use helpers::{format_group_id, is_cycle_deadline_passed};`

## Implementation Details

The function calculates the deadline for the current cycle by:
- Taking the group's start time (`started_at`)
- Adding the duration for all cycles up to and including the current one
- Formula: `started_at + (cycle_duration * (current_cycle + 1))`

This accounts for:
- Cycle 0 (first cycle): deadline at `started_at + cycle_duration`
- Cycle 1 (second cycle): deadline at `started_at + (cycle_duration * 2)`
- And so on...

## Use Cases

- Check if contributions are late
- Trigger automatic cycle advancement
- Display deadline status in UI
- Enforce time-based rules
- Calculate penalties for late contributions
