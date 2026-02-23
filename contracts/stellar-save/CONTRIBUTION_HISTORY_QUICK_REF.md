# Quick Reference: get_member_contribution_history

## Function Call

```rust
pub fn get_member_contribution_history(
    env: Env,
    group_id: u64,
    member: Address,
    start_cycle: u32,
    limit: u32,
) -> Result<Vec<ContributionRecord>, StellarSaveError>
```

## Quick Examples

### Get First Page
```rust
let history = contract.get_member_contribution_history(env, group_id, member, 0, 10)?;
// Returns up to 10 contributions starting from cycle 0
```

### Get Next Page
```rust
let page2 = contract.get_member_contribution_history(env, group_id, member, 10, 10)?;
// Returns up to 10 contributions starting from cycle 10
```

### Get All (Small Group)
```rust
let all = contract.get_member_contribution_history(env, group_id, member, 0, 50)?;
// Returns up to 50 contributions (maximum allowed)
```

### Get Recent Contributions
```rust
let group = contract.get_group(env.clone(), group_id)?;
let start = group.current_cycle.saturating_sub(5);
let recent = contract.get_member_contribution_history(env, group_id, member, start, 5)?;
```

### Process Each Contribution
```rust
let history = contract.get_member_contribution_history(env, group_id, member, 0, 20)?;

for contrib in history.iter() {
    println!("Cycle {}: {} stroops at {}", 
        contrib.cycle_number,
        contrib.amount,
        contrib.timestamp
    );
}
```

### Paginated Loop
```rust
let mut start = 0;
let page_size = 10;

loop {
    let page = contract.get_member_contribution_history(
        env.clone(), group_id, member.clone(), start, page_size
    )?;
    
    if page.is_empty() {
        break;
    }
    
    // Process page
    for contrib in page.iter() {
        process_contribution(contrib);
    }
    
    start += page_size;
}
```

## Return Values

| Scenario | Return Value |
|----------|--------------|
| No contributions | `Ok(Vec::new())` (empty vector) |
| Has contributions | `Ok(Vec<ContributionRecord>)` |
| Group not found | `Err(GroupNotFound)` |

## ContributionRecord Fields

```rust
pub struct ContributionRecord {
    pub member_address: Address,  // Who contributed
    pub group_id: u64,             // Which group
    pub cycle_number: u32,         // Which cycle (0-indexed)
    pub amount: i128,              // Amount in stroops
    pub timestamp: u64,            // When (Unix timestamp)
}
```

## Pagination Parameters

| Parameter | Description | Recommended Values |
|-----------|-------------|-------------------|
| start_cycle | Starting cycle (inclusive) | 0, 10, 20, ... |
| limit | Max records to return | 10-20 (mobile), 20-25 (web), 50 (max) |

## Common Patterns

### Check if Member Has Contributed
```rust
let history = contract.get_member_contribution_history(env, group_id, member, 0, 1)?;
if history.is_empty() {
    // Member has never contributed
}
```

### Count Total Contributions
```rust
let mut total_count = 0;
let mut start = 0;

loop {
    let page = contract.get_member_contribution_history(
        env.clone(), group_id, member.clone(), start, 50
    )?;
    
    if page.is_empty() {
        break;
    }
    
    total_count += page.len();
    start += 50;
}
```

### Find Specific Cycle
```rust
let history = contract.get_member_contribution_history(env, group_id, member, 5, 1)?;
if let Some(contrib) = history.get(0) {
    // Found contribution for cycle 5
}
```

### Calculate Average Contribution
```rust
let history = contract.get_member_contribution_history(env, group_id, member, 0, 50)?;
if !history.is_empty() {
    let total: i128 = history.iter().map(|c| c.amount).sum();
    let avg = total / (history.len() as i128);
}
```

## Test Commands

```bash
# Run all tests
cargo test get_member_contribution_history

# Run specific test
cargo test test_get_member_contribution_history_pagination

# Run with output
cargo test get_member_contribution_history -- --nocapture
```

## Performance Tips

1. **Use appropriate page size**: 10-20 for UI, 50 for bulk operations
2. **Cache results**: Store pages client-side to reduce calls
3. **Lazy load**: Fetch pages as needed, not all at once
4. **Limit queries**: Don't fetch more than you need

## Common Use Cases

1. **Display History Table**: Paginated list of contributions
2. **Timeline View**: Chronological contribution display
3. **Export Data**: Fetch all for CSV/PDF export
4. **Audit Trail**: Verify contribution records
5. **Analytics**: Analyze contribution patterns
6. **Compliance**: Generate reports for regulators

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
        println!("Error: {:?}", e);
    }
}
```

## Notes

- Returns empty vector (not error) when no contributions found
- Limit is capped at 50 for gas optimization
- Automatically stops at group's current_cycle
- Only returns cycles where member actually contributed
- Records are returned in cycle order (ascending)
- Amount is in stroops (1 XLM = 10^7 stroops)
