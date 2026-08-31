# Member Total Contributions Feature

## Overview
This document describes the `get_member_total_contributions` function that calculates the total amount contributed by a member across all cycles in a savings group.

## Function Signature

```rust
pub fn get_member_total_contributions(
    env: Env,
    group_id: u64,
    member: Address,
) -> Result<i128, StellarSaveError>
```

## Parameters

- `env`: Soroban environment for accessing storage
- `group_id`: The unique identifier of the savings group
- `member`: The address of the member whose contributions to calculate

## Returns

- `Ok(i128)`: The total amount contributed by the member across all cycles (in stroops)
- `Err(StellarSaveError::GroupNotFound)`: If the specified group doesn't exist
- `Err(StellarSaveError::Overflow)`: If the sum of contributions exceeds i128 maximum

## Behavior

1. **Group Validation**: Verifies that the specified group exists in storage
2. **Cycle Iteration**: Iterates through all cycles from 0 to the current cycle (inclusive)
3. **Contribution Lookup**: For each cycle, checks if the member has a contribution record
4. **Sum Calculation**: Adds up all contribution amounts with overflow protection
5. **Return Total**: Returns the total amount, or 0 if no contributions found

## Implementation Details

### Storage Keys Used
- `StorageKey::Group(GroupKey::Data(group_id))` - To retrieve group information
- `StorageKey::Contribution(ContributionKey::Individual(group_id, cycle, member))` - To retrieve individual contributions

### Algorithm
```
1. Load group from storage (fail if not found)
2. Initialize total = 0
3. For each cycle from 0 to group.current_cycle:
   a. Build storage key for member's contribution in this cycle
   b. If contribution exists:
      - Add contribution.amount to total (with overflow check)
4. Return total
```

### Edge Cases Handled
- **No contributions**: Returns 0 if member has never contributed
- **Partial contributions**: Correctly handles members who skipped some cycles
- **Multiple cycles**: Accurately sums contributions across all cycles
- **Overflow protection**: Uses `checked_add` to prevent arithmetic overflow

## Usage Examples

### Example 1: Check Total Contributions
```rust
let member = Address::generate(&env);
let group_id = 1;

// Get total contributions
let total = contract.get_member_total_contributions(
    env.clone(),
    group_id,
    member.clone()
)?;

// total will be the sum of all contributions in stroops
```

### Example 2: Verify Member Participation
```rust
let total = contract.get_member_total_contributions(env, group_id, member)?;
let expected = group.contribution_amount * group.current_cycle as i128;

if total < expected {
    // Member has missed some contributions
    let missed = expected - total;
    // Handle missed contributions
}
```

## Test Coverage

The implementation includes comprehensive tests:

1. **test_get_member_total_contributions_no_contributions**
   - Verifies function returns 0 when member has no contributions

2. **test_get_member_total_contributions_single_cycle**
   - Tests calculation with one contribution

3. **test_get_member_total_contributions_multiple_cycles**
   - Tests summing contributions across multiple cycles

4. **test_get_member_total_contributions_partial_cycles**
   - Tests handling of members who skipped some cycles

5. **test_get_member_total_contributions_group_not_found**
   - Verifies proper error handling for non-existent groups

6. **test_get_member_total_contributions_different_members**
   - Tests that different members have independent totals

## Performance Considerations

- **Time Complexity**: O(n) where n is the current cycle number
- **Storage Reads**: n+1 reads (1 for group data, n for contribution records)
- **Gas Cost**: Proportional to the number of cycles in the group

For groups with many cycles, consider:
- Caching results if called frequently
- Implementing pagination for very large cycle counts
- Using events to track running totals

## Integration Points

This function can be used by:
- Frontend dashboards to display member statistics
- Payout eligibility checks
- Member performance tracking
- Group completion verification
- Audit and reporting features

## Future Enhancements

Potential improvements:
1. Add caching mechanism to reduce storage reads
2. Implement batch queries for multiple members
3. Add filtering by date range
4. Include contribution timestamps in response
5. Add average contribution calculation
