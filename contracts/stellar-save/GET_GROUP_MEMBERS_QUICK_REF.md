# Get Group Members - Quick Reference

## Function
```rust
pub fn get_group_members(
    env: Env,
    group_id: u64,
    offset: u32,
    limit: u32,
) -> Result<Vec<Address>, StellarSaveError>
```

## Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `env` | `Env` | Soroban environment |
| `group_id` | `u64` | Unique identifier of the group |
| `offset` | `u32` | Number of members to skip (0-indexed) |
| `limit` | `u32` | Maximum members to return (capped at 100) |

## Returns
- **Success**: `Vec<Address>` - List of member addresses sorted by join order
- **Error**: `StellarSaveError::GroupNotFound` - Group doesn't exist
- **Error**: `StellarSaveError::Overflow` - Pagination overflow

## Quick Examples

### Get First 10 Members
```rust
let members = contract.get_group_members(env, 1, 0, 10)?;
```

### Get Next 10 Members
```rust
let members = contract.get_group_members(env, 1, 10, 10)?;
```

### Get All Members (up to 100)
```rust
let members = contract.get_group_members(env, 1, 0, 100)?;
```

## Key Features
- ✅ Members sorted by join order (payout position)
- ✅ Pagination support for large groups
- ✅ Gas optimized (limit capped at 100)
- ✅ Returns empty vector for invalid offsets
- ✅ No authentication required (read-only)

## Common Use Cases

### Display Member List in UI
```rust
// Get first page
let page1 = contract.get_group_members(env, group_id, 0, 20)?;

// Display in UI with pagination controls
for member in page1.iter() {
    display_member(member);
}
```

### Check if Address is Member
```rust
let members = contract.get_group_members(env, group_id, 0, 100)?;
let is_member = members.iter().any(|m| m == &user_address);
```

### Get Total Member Count
```rust
// Use existing function
let count = contract.get_member_count(env, group_id)?;
```

## Edge Cases
| Case | Behavior |
|------|----------|
| Empty group | Returns empty vector |
| Offset > total | Returns empty vector |
| Limit = 0 | Returns empty vector |
| Limit > 100 | Capped at 100 |
| Partial page | Returns available members |

## Storage
- **Key**: `GROUP_MEMBERS_{group_id}`
- **Type**: `Vec<Address>`
- **Order**: Join order (first joined = index 0)

## Related Functions
- `join_group()` - Adds member to list
- `get_member_count()` - Returns total count
- `get_payout_position()` - Gets member's position
- `get_payout_schedule()` - Uses member order

## Testing
Run tests with:
```bash
cargo test get_group_members
```

10 comprehensive tests covering:
- Empty groups
- Single/multiple members
- Pagination (first page, second page, beyond total)
- Edge cases (zero limit, large limit)
- Error cases (group not found)

## Performance
- **Time**: O(n) where n = limit (max 100)
- **Space**: O(n) where n = returned members
- **Gas**: Optimized with 100-member cap

## Status
✅ **Implemented and Tested** - Ready for use
