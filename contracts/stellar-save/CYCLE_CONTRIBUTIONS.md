# Cycle Contributions Feature

## Overview
This document describes the `get_cycle_contributions` function that retrieves all contributions made by members during a specific cycle in a savings group.

## Function Signature

```rust
pub fn get_cycle_contributions(
    env: Env,
    group_id: u64,
    cycle_number: u32,
) -> Result<Vec<ContributionRecord>, StellarSaveError>
```

## Parameters

- `env`: Soroban environment for accessing storage
- `group_id`: The unique identifier of the savings group
- `cycle_number`: The cycle number to query (0-indexed)

## Returns

- `Ok(Vec<ContributionRecord>)`: Vector of contribution records for all members who contributed in the cycle
- `Err(StellarSaveError::GroupNotFound)`: If the specified group doesn't exist

## Behavior

1. **Group Validation**: Verifies that the specified group exists in storage
2. **Member List Retrieval**: Gets the list of all members in the group
3. **Contribution Query**: Queries each member's contribution for the specified cycle
4. **Record Collection**: Collects only contributions that exist (skips members who didn't contribute)
5. **Return Results**: Returns vector of contributions (may be empty if no one contributed)

## Implementation Details

### Storage Keys Used
- `StorageKey::Group(GroupKey::Data(group_id))` - To retrieve group information
- `StorageKey::Group(GroupKey::Members(group_id))` - To retrieve member list
- `StorageKey::Contribution(ContributionKey::Individual(group_id, cycle, member))` - To retrieve individual contributions

### Algorithm
```
1. Load group from storage (fail if not found)
2. Load member list from storage (empty if no members)
3. Initialize empty vector for results
4. For each member in the group:
   a. Build storage key for member's contribution in this cycle
   b. If contribution exists:
      - Add to results vector
5. Return results vector
```

### Key Characteristics
- **Selective**: Only returns members who actually contributed
- **Complete**: Queries all members in the group
- **Efficient**: Direct storage lookups, no iteration over all cycles
- **Flexible**: Works for any cycle number (past, current, or future)

## Usage Examples

### Example 1: Get All Contributions for Current Cycle
```rust
let group = contract.get_group(env.clone(), group_id)?;
let current_cycle = group.current_cycle;

let contributions = contract.get_cycle_contributions(
    env.clone(),
    group_id,
    current_cycle
)?;

println!("Current cycle has {} contributions", contributions.len());
```

### Example 2: Verify Cycle Completion
```rust
let group = contract.get_group(env.clone(), group_id)?;
let contributions = contract.get_cycle_contributions(
    env.clone(),
    group_id,
    group.current_cycle
)?;

// Check if all members contributed
if contributions.len() as u32 == group.max_members {
    println!("Cycle is complete! All members contributed.");
    // Process payout
} else {
    println!("Waiting for {} more contributions", 
        group.max_members - contributions.len() as u32);
}
```

### Example 3: Calculate Cycle Total
```rust
let contributions = contract.get_cycle_contributions(
    env.clone(),
    group_id,
    cycle_number
)?;

let total: i128 = contributions.iter()
    .map(|c| c.amount)
    .fold(0i128, |acc, amt| acc + amt);

println!("Total collected in cycle {}: {} stroops", cycle_number, total);
```

### Example 4: Find Missing Contributors
```rust
let group = contract.get_group(env.clone(), group_id)?;
let members_key = StorageKeyBuilder::group_members(group_id);
let all_members: Vec<Address> = env.storage()
    .persistent()
    .get(&members_key)
    .unwrap_or(Vec::new(&env));

let contributions = contract.get_cycle_contributions(
    env.clone(),
    group_id,
    cycle_number
)?;

let contributed_addresses: Vec<Address> = contributions.iter()
    .map(|c| c.member_address.clone())
    .collect();

for member in all_members.iter() {
    if !contributed_addresses.contains(&member) {
        println!("Member {:?} has not contributed yet", member);
    }
}
```

### Example 5: Audit Cycle History
```rust
// Audit all cycles
let group = contract.get_group(env.clone(), group_id)?;

for cycle in 0..=group.current_cycle {
    let contributions = contract.get_cycle_contributions(
        env.clone(),
        group_id,
        cycle
    )?;
    
    println!("Cycle {}: {} contributions", cycle, contributions.len());
    
    for contrib in contributions.iter() {
        println!("  - Member: {:?}, Amount: {}, Time: {}", 
            contrib.member_address,
            contrib.amount,
            contrib.timestamp
        );
    }
}
```

## ContributionRecord Structure

Each record in the returned vector contains:

```rust
pub struct ContributionRecord {
    pub member_address: Address,  // Member who made the contribution
    pub group_id: u64,             // Group ID
    pub cycle_number: u32,         // Cycle when contributed (0-indexed)
    pub amount: i128,              // Amount in stroops
    pub timestamp: u64,            // Unix timestamp in seconds
}
```

## Test Coverage

The implementation includes comprehensive tests:

1. **test_get_cycle_contributions_empty**
   - Verifies function returns empty vector when no members/contributions

2. **test_get_cycle_contributions_single_member**
   - Tests retrieval with one member contribution

3. **test_get_cycle_contributions_multiple_members**
   - Tests retrieval with all members contributing

4. **test_get_cycle_contributions_partial_members**
   - Tests handling when some members skip the cycle

5. **test_get_cycle_contributions_different_cycles**
   - Tests that different cycles return different results

6. **test_get_cycle_contributions_group_not_found**
   - Verifies proper error handling for non-existent groups

7. **test_get_cycle_contributions_verify_amounts**
   - Tests calculation of total contributions

## Performance Considerations

### Time Complexity
- **Best Case**: O(1) - No members in group
- **Average Case**: O(n) where n = number of members
- **Worst Case**: O(n) where n = number of members

### Storage Reads
- 1 read for group data
- 1 read for member list
- Up to n reads for contribution records (where n = number of members)
- Total: 2 + n reads

### Gas Cost
- Linear with the number of members in the group
- Efficient for typical group sizes (5-20 members)
- May be expensive for very large groups (50+ members)

### Optimization Strategies

For groups with many members:
1. **Cache member list**: Store member list client-side
2. **Batch queries**: If querying multiple cycles, batch the requests
3. **Limit group size**: Enforce reasonable max_members limit
4. **Use cycle totals**: Store pre-calculated totals for quick validation

## Integration Points

This function can be used by:

### Payout Processing
```rust
// Verify all members contributed before payout
let contributions = get_cycle_contributions(env, group_id, cycle)?;
if contributions.len() as u32 == group.max_members {
    process_payout(env, group_id, cycle)?;
}
```

### Cycle Monitoring
```rust
// Monitor cycle progress
let contributions = get_cycle_contributions(env, group_id, current_cycle)?;
let progress = (contributions.len() as f64 / group.max_members as f64) * 100.0;
println!("Cycle {}% complete", progress);
```

### Audit and Compliance
```rust
// Generate cycle report
let contributions = get_cycle_contributions(env, group_id, cycle)?;
generate_cycle_report(cycle, contributions);
```

### Analytics
```rust
// Analyze participation rates
for cycle in 0..=group.current_cycle {
    let contributions = get_cycle_contributions(env, group_id, cycle)?;
    let rate = contributions.len() as f64 / group.max_members as f64;
    println!("Cycle {} participation: {:.1}%", cycle, rate * 100.0);
}
```

## Comparison with Related Functions

| Feature | get_cycle_contributions | get_member_contribution_history |
|---------|------------------------|--------------------------------|
| Query By | Cycle (all members) | Member (all cycles) |
| Return Type | Vec<ContributionRecord> | Vec<ContributionRecord> |
| Pagination | No | Yes |
| Use Case | Cycle completion check | Member history view |
| Gas Cost | O(members) | O(cycles) |

## Use Cases

### 1. Cycle Completion Verification
Check if all members have contributed before processing payout:
```rust
let contributions = get_cycle_contributions(env, group_id, cycle)?;
let is_complete = contributions.len() as u32 == group.max_members;
```

### 2. Missing Contributor Identification
Find which members haven't contributed yet:
```rust
let all_members = get_group_members(env, group_id)?;
let contributions = get_cycle_contributions(env, group_id, cycle)?;
let missing = find_missing_members(all_members, contributions);
```

### 3. Cycle Total Calculation
Calculate total amount collected in a cycle:
```rust
let contributions = get_cycle_contributions(env, group_id, cycle)?;
let total = contributions.iter().map(|c| c.amount).sum();
```

### 4. Participation Rate Tracking
Monitor member participation over time:
```rust
for cycle in 0..=current_cycle {
    let contributions = get_cycle_contributions(env, group_id, cycle)?;
    let rate = contributions.len() as f64 / max_members as f64;
    track_participation(cycle, rate);
}
```

### 5. Audit Trail Generation
Generate complete audit trail for a cycle:
```rust
let contributions = get_cycle_contributions(env, group_id, cycle)?;
for contrib in contributions.iter() {
    log_contribution(contrib);
}
```

## Edge Cases Handled

1. **No Members**: Returns empty vector
2. **No Contributions**: Returns empty vector (not an error)
3. **Partial Contributions**: Returns only members who contributed
4. **Future Cycle**: Returns empty vector (no contributions yet)
5. **Past Cycle**: Returns historical contributions

## Security Considerations

1. **Access Control**: Read-only operation, no authorization required
2. **Data Integrity**: Returns only existing contribution records
3. **Privacy**: All contribution data is public on blockchain
4. **Gas Limits**: Linear complexity with member count is acceptable

## Error Handling

```rust
match contract.get_cycle_contributions(env, group_id, cycle_number) {
    Ok(contributions) => {
        if contributions.is_empty() {
            println!("No contributions found for cycle {}", cycle_number);
        } else {
            println!("Found {} contributions", contributions.len());
            process_contributions(contributions);
        }
    },
    Err(StellarSaveError::GroupNotFound) => {
        println!("Group does not exist");
    },
    Err(e) => {
        println!("Unexpected error: {:?}", e);
    }
}
```

## Future Enhancements

Potential improvements:

1. **Filtering Options**
   - Filter by contribution amount
   - Filter by timestamp range
   - Filter by member status

2. **Aggregation**
   - Include cycle total in response
   - Include participation rate
   - Include statistics (avg, min, max)

3. **Metadata**
   - Include member count
   - Include missing member list
   - Include cycle status

4. **Batch Queries**
   - Get contributions for multiple cycles at once
   - Get contributions for multiple groups at once

5. **Caching**
   - Cache completed cycle contributions
   - Invalidate cache on new contributions
   - Reduce storage reads for historical data

## Best Practices

### When to Use
- ✅ Verifying cycle completion
- ✅ Calculating cycle totals
- ✅ Finding missing contributors
- ✅ Generating cycle reports
- ✅ Audit trail generation

### When NOT to Use
- ❌ Getting one member's history (use get_member_contribution_history)
- ❌ Getting total contributions (use get_member_total_contributions)
- ❌ Real-time monitoring (too expensive, use events instead)

### Performance Tips
1. Cache results for completed cycles
2. Use events for real-time updates
3. Batch queries when possible
4. Limit group size for better performance

## Conclusion

The `get_cycle_contributions` function provides a robust way to retrieve all contributions for a specific cycle with:
- Simple, intuitive API
- Efficient storage access
- Comprehensive error handling
- Flexible querying options
- Full test coverage
- Clear documentation
