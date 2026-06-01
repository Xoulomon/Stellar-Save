# Quick Reference: get_member_total_contributions

## Function Call

```rust
pub fn get_member_total_contributions(
    env: Env,
    group_id: u64,
    member: Address,
) -> Result<i128, StellarSaveError>
```

## Quick Examples

### Basic Usage
```rust
let total = contract.get_member_total_contributions(env, 1, member_address)?;
// Returns total in stroops
```

### Convert to XLM
```rust
let total_stroops = contract.get_member_total_contributions(env, group_id, member)?;
let total_xlm = total_stroops / 10_000_000;
```

### Check Participation
```rust
let total = contract.get_member_total_contributions(env, group_id, member)?;
if total == 0 {
    // Member has never contributed
} else {
    // Member has contributed
}
```

### Calculate Missing Contributions
```rust
let group = contract.get_group(env.clone(), group_id)?;
let total = contract.get_member_total_contributions(env, group_id, member)?;
let expected = group.contribution_amount * (group.current_cycle as i128);
let missing = expected - total;
```

## Return Values

| Scenario | Return Value |
|----------|--------------|
| No contributions | `Ok(0)` |
| Has contributions | `Ok(total_amount)` |
| Group not found | `Err(GroupNotFound)` |
| Overflow | `Err(Overflow)` |

## Test Commands

```bash
# Run all tests
cargo test get_member_total_contributions

# Run specific test
cargo test test_get_member_total_contributions_multiple_cycles

# Run with output
cargo test get_member_total_contributions -- --nocapture
```

## Common Use Cases

1. **Dashboard Display**: Show member's total contributions
2. **Eligibility Check**: Verify member has contributed enough
3. **Reporting**: Generate contribution reports
4. **Audit**: Verify contribution records
5. **Analytics**: Track member participation

## Notes

- Returns amount in stroops (1 XLM = 10^7 stroops)
- Includes all cycles from 0 to current_cycle
- Returns 0 if member never contributed
- Handles skipped cycles correctly
- Protected against overflow
