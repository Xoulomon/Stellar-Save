# Member Contribution History Feature

## Overview
This document describes the `get_member_contribution_history` function that retrieves the contribution history for a member in a savings group with pagination support.

## Function Signature

```rust
pub fn get_member_contribution_history(
    env: Env,
    group_id: u64,
    member: Address,
    start_cycle: u32,
    limit: u32,
) -> Result<Vec<ContributionRecord>, StellarSaveError>
```

## Parameters

- `env`: Soroban environment for accessing storage
- `group_id`: The unique identifier of the savings group
- `member`: The address of the member whose contribution history to retrieve
- `start_cycle`: Starting cycle number for pagination (inclusive, 0-indexed)
- `limit`: Maximum number of records to return (capped at 50 for gas optimization)

## Returns

- `Ok(Vec<ContributionRecord>)`: Vector of contribution records for the member
- `Err(StellarSaveError::GroupNotFound)`: If the specified group doesn't exist

## Behavior

1. **Group Validation**: Verifies that the specified group exists in storage
2. **Pagination Setup**: Caps limit at 50 and calculates end cycle
3. **Range Iteration**: Iterates through cycles from start_cycle to end_cycle
4. **Record Collection**: Collects contribution records that exist for the member
5. **Return Results**: Returns vector of contributions (may be empty if none found)

## Implementation Details

### Storage Keys Used
- `StorageKey::Group(GroupKey::Data(group_id))` - To retrieve group information
- `StorageKey::Contribution(ContributionKey::Individual(group_id, cycle, member))` - To retrieve individual contributions

### Algorithm
```
1. Load group from storage (fail if not found)
2. Initialize empty vector for results
3. Cap limit at 50 for gas optimization
4. Calculate end_cycle = min(start_cycle + limit, group.current_cycle)
5. For each cycle from start_cycle to end_cycle:
   a. Build storage key for member's contribution in this cycle
   b. If contribution exists:
      - Add to results vector
      - Increment count
   c. If count reaches limit, break
6. Return results vector
```

### Pagination Logic
```
Page 1: start_cycle=0,  limit=10 → Returns cycles 0-9
Page 2: start_cycle=10, limit=10 → Returns cycles 10-19
Page 3: start_cycle=20, limit=10 → Returns cycles 20-29
```

### Edge Cases Handled
- **No contributions**: Returns empty vector
- **Partial contributions**: Only returns cycles where member contributed
- **Beyond current cycle**: Stops at group.current_cycle
- **Large limit**: Caps at 50 to prevent excessive gas usage
- **Start beyond current**: Returns empty vector

## Usage Examples

### Example 1: Get All Contributions (Small Group)
```rust
let member = Address::generate(&env);
let group_id = 1;

// Get all contributions (assuming < 50 cycles)
let history = contract.get_member_contribution_history(
    env.clone(),
    group_id,
    member.clone(),
    0,    // Start from cycle 0
    50    // Get up to 50 records
)?;

// Process results
for contrib in history.iter() {
    println!("Cycle {}: {} stroops at timestamp {}", 
        contrib.cycle_number, 
        contrib.amount, 
        contrib.timestamp
    );
}
```

### Example 2: Paginated Retrieval
```rust
let page_size = 10;
let mut start_cycle = 0;
let mut all_contributions = Vec::new();

loop {
    let page = contract.get_member_contribution_history(
        env.clone(),
        group_id,
        member.clone(),
        start_cycle,
        page_size
    )?;
    
    if page.is_empty() {
        break; // No more contributions
    }
    
    all_contributions.extend(page.iter());
    start_cycle += page_size;
}
```

### Example 3: Get Recent Contributions
```rust
// Get group to find current cycle
let group = contract.get_group(env.clone(), group_id)?;

// Get last 5 contributions
let recent_start = if group.current_cycle >= 5 {
    group.current_cycle - 5
} else {
    0
};

let recent = contract.get_member_contribution_history(
    env,
    group_id,
    member,
    recent_start,
    5
)?;
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

1. **test_get_member_contribution_history_empty**
   - Verifies function returns empty vector when no contributions

2. **test_get_member_contribution_history_single_contribution**
   - Tests retrieval of a single contribution

3. **test_get_member_contribution_history_multiple_contributions**
   - Tests retrieval of multiple contributions in order

4. **test_get_member_contribution_history_pagination**
   - Tests pagination with multiple pages

5. **test_get_member_contribution_history_partial_contributions**
   - Tests handling of members who skipped some cycles

6. **test_get_member_contribution_history_limit_cap**
   - Verifies limit is capped at 50

7. **test_get_member_contribution_history_group_not_found**
   - Verifies proper error handling for non-existent groups

8. **test_get_member_contribution_history_beyond_current_cycle**
   - Tests that function stops at current_cycle

## Performance Considerations

### Time Complexity
- **Best Case**: O(1) - No contributions found
- **Average Case**: O(n) where n = number of contributions in range
- **Worst Case**: O(50) - Capped at 50 iterations

### Storage Reads
- 1 read for group data
- Up to 50 reads for contribution records (capped by limit)
- Total: 1 + min(limit, 50) reads

### Gas Cost
- Linear with the number of records returned
- Capped at 51 storage reads maximum
- Efficient for typical use cases (10-20 records per page)

### Optimization Strategies

For groups with many cycles:
1. **Use appropriate page size**: 10-20 records per page is optimal
2. **Cache results**: Store frequently accessed histories client-side
3. **Lazy loading**: Load pages as user scrolls
4. **Index by date**: If temporal queries are common

## Integration Points

This function can be used by:

### Frontend Applications
- Display contribution timeline
- Show payment history
- Generate member reports
- Visualize contribution patterns

### Analytics Systems
- Track member participation over time
- Identify contribution gaps
- Calculate contribution consistency
- Generate statistics

### Audit Systems
- Verify contribution records
- Generate audit trails
- Compliance reporting
- Dispute resolution

### Smart Contract Integration
```rust
// Example: Verify member has contributed in recent cycles
let recent_history = get_member_contribution_history(
    env.clone(), 
    group_id, 
    member.clone(), 
    group.current_cycle.saturating_sub(3), 
    3
)?;

if recent_history.len() < 3 {
    // Member has missed recent contributions
    handle_missed_contributions();
}
```

## Pagination Best Practices

### Recommended Page Sizes
- **Mobile apps**: 10-15 records per page
- **Web dashboards**: 20-25 records per page
- **Bulk exports**: 50 records per page (maximum)

### Pagination Pattern
```rust
fn fetch_all_contributions(
    contract: &StellarSaveContractClient,
    env: &Env,
    group_id: u64,
    member: &Address,
) -> Result<Vec<ContributionRecord>, StellarSaveError> {
    let mut all_records = Vec::new();
    let mut start_cycle = 0;
    let page_size = 20;
    
    loop {
        let page = contract.get_member_contribution_history(
            env,
            group_id,
            member,
            start_cycle,
            page_size
        )?;
        
        if page.is_empty() {
            break;
        }
        
        let page_len = page.len();
        all_records.extend(page);
        
        if page_len < page_size {
            break; // Last page
        }
        
        start_cycle += page_size;
    }
    
    Ok(all_records)
}
```

## Comparison with get_member_total_contributions

| Feature | get_member_total_contributions | get_member_contribution_history |
|---------|-------------------------------|--------------------------------|
| Return Type | i128 (total amount) | Vec<ContributionRecord> |
| Pagination | No | Yes |
| Use Case | Quick total calculation | Detailed history view |
| Gas Cost | Lower (no vector allocation) | Higher (vector + records) |
| Data Returned | Single number | Full contribution details |

## Future Enhancements

Potential improvements:

1. **Filtering Options**
   - Filter by date range
   - Filter by amount range
   - Filter by status (pending/confirmed)

2. **Sorting Options**
   - Sort by cycle (ascending/descending)
   - Sort by amount
   - Sort by timestamp

3. **Aggregation**
   - Include subtotals per page
   - Include running totals
   - Include statistics (avg, min, max)

4. **Metadata**
   - Include total count of contributions
   - Include pagination metadata (has_next, has_prev)
   - Include group context

5. **Batch Queries**
   - Get history for multiple members at once
   - Get history for multiple groups at once

## Security Considerations

1. **Access Control**: Read-only operation, no authorization required
2. **Gas Limits**: Limit capped at 50 to prevent DoS
3. **Data Integrity**: Returns only existing contribution records
4. **Privacy**: All contribution data is public on blockchain

## Error Handling

```rust
match contract.get_member_contribution_history(env, group_id, member, 0, 10) {
    Ok(history) => {
        if history.is_empty() {
            println!("No contributions found");
        } else {
            println!("Found {} contributions", history.len());
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

## Conclusion

The `get_member_contribution_history` function provides a robust, paginated way to retrieve member contribution records with:
- Efficient pagination support
- Gas optimization through limit capping
- Comprehensive error handling
- Flexible querying options
- Full test coverage
