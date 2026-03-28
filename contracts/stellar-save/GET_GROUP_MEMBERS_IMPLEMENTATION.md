# Get Group Members Implementation

## Overview
Implementation of the `get_group_members` function that lists all members of a group with pagination support.

## Function Signature
```rust
pub fn get_group_members(
    env: Env,
    group_id: u64,
    offset: u32,
    limit: u32,
) -> Result<Vec<Address>, StellarSaveError>
```

## Implementation Details

### 1. Member Storage
Members are stored in a `Vec<Address>` at the storage key `GROUP_MEMBERS_{group_id}`. The vector maintains members in the order they joined the group, which corresponds to their payout position in the ROSCA rotation.

### 2. Sorting
Members are already sorted by join order in storage, so no additional sorting is required. The join order is preserved because:
- Members are added to the vector using `push_back()` in the `join_group` function
- The payout position is assigned based on `member_count` at join time
- This ensures first-joined members have position 0, second-joined have position 1, etc.

### 3. Pagination
The function implements efficient pagination with the following features:
- **offset**: Number of members to skip (0-indexed)
- **limit**: Maximum number of members to return (capped at 100 for gas optimization)
- Returns empty vector if offset is beyond total member count
- Handles partial pages correctly when remaining members < limit

### 4. Gas Optimization
- Limit is capped at 100 to prevent excessive gas consumption
- Uses efficient vector slicing instead of loading all data
- Early return for empty groups or invalid offsets

### 5. Error Handling
- Returns `StellarSaveError::GroupNotFound` if group doesn't exist
- Returns `StellarSaveError::Overflow` if pagination parameters cause arithmetic overflow
- Validates pagination parameters before processing

## Usage Examples

### Get First Page of Members
```rust
// Get first 10 members
let members = contract.get_group_members(env, group_id, 0, 10)?;
```

### Get Second Page of Members
```rust
// Get next 10 members (offset by 10)
let members = contract.get_group_members(env, group_id, 10, 10)?;
```

### Get All Members (Small Group)
```rust
// Get up to 100 members
let members = contract.get_group_members(env, group_id, 0, 100)?;
```

### Iterate Through All Members
```rust
let page_size = 20;
let mut offset = 0;
let mut all_members = Vec::new(&env);

loop {
    let page = contract.get_group_members(env.clone(), group_id, offset, page_size)?;
    if page.len() == 0 {
        break;
    }
    
    for member in page.iter() {
        all_members.push_back(member);
    }
    
    offset += page_size;
}
```

## Test Coverage

### Test Cases Implemented

1. **test_get_group_members_empty_group**
   - Verifies empty vector is returned for groups with no members

2. **test_get_group_members_single_member**
   - Tests retrieval of a single member

3. **test_get_group_members_multiple_members_sorted**
   - Verifies members are returned in join order
   - Tests with 4 members

4. **test_get_group_members_pagination_first_page**
   - Tests first page retrieval with offset=0
   - Verifies correct subset is returned

5. **test_get_group_members_pagination_second_page**
   - Tests second page retrieval with offset > 0
   - Verifies pagination continuity

6. **test_get_group_members_pagination_beyond_total**
   - Tests offset beyond total member count
   - Verifies empty vector is returned

7. **test_get_group_members_pagination_partial_page**
   - Tests when remaining members < requested limit
   - Verifies partial page is returned correctly

8. **test_get_group_members_limit_capped_at_100**
   - Tests that limit > 100 is capped
   - Verifies gas optimization works

9. **test_get_group_members_group_not_found**
   - Tests error handling for non-existent group
   - Expects `StellarSaveError::GroupNotFound`

10. **test_get_group_members_zero_limit**
    - Tests edge case with limit=0
    - Verifies empty vector is returned

## Integration with Existing Code

### Storage Keys Used
- `StorageKeyBuilder::group_data(group_id)` - To verify group exists
- `StorageKeyBuilder::group_members(group_id)` - To retrieve member list

### Related Functions
- `join_group()` - Adds members to the list
- `get_member_count()` - Returns total member count
- `get_payout_position()` - Uses member join order for payout scheduling

### Member Profile Structure
Each member has a `MemberProfile` stored separately:
```rust
pub struct MemberProfile {
    pub address: Address,
    pub group_id: u64,
    pub payout_position: u32,  // Based on join order
    pub joined_at: u64,
}
```

## Performance Considerations

### Time Complexity
- **Best Case**: O(1) for empty groups or invalid offsets
- **Average Case**: O(n) where n = limit (capped at 100)
- **Worst Case**: O(100) due to limit cap

### Space Complexity
- O(n) where n = number of members returned (max 100)

### Gas Optimization
- Limit capped at 100 to prevent excessive gas consumption
- Early returns for edge cases
- Efficient vector operations using Soroban SDK

## Future Enhancements

### Potential Improvements
1. **Filtering**: Add optional status filter (active, inactive, etc.)
2. **Sorting Options**: Allow sorting by contribution amount, join date, etc.
3. **Member Details**: Option to include full MemberProfile data
4. **Search**: Add member address search/lookup
5. **Batch Operations**: Support for bulk member operations

### API Extensions
```rust
// Future: Get members with full profile data
pub fn get_group_members_detailed(
    env: Env,
    group_id: u64,
    offset: u32,
    limit: u32,
) -> Result<Vec<MemberProfile>, StellarSaveError>

// Future: Search for specific member
pub fn find_member(
    env: Env,
    group_id: u64,
    member_address: Address,
) -> Result<Option<MemberProfile>, StellarSaveError>
```

## Security Considerations

### Access Control
- Function is read-only (no authentication required)
- No sensitive data exposed (addresses are public)
- No state modifications

### Input Validation
- Group existence verified before processing
- Pagination parameters validated for overflow
- Limit capped to prevent DoS attacks

### Data Integrity
- Members list is immutable during read
- Consistent ordering guaranteed by storage implementation
- No race conditions (read-only operation)

## Deployment Notes

### Prerequisites
- Soroban SDK version compatible with Vec operations
- Storage keys properly initialized in `join_group`
- Group creation properly initializes member list

### Migration
If upgrading from a version without member lists:
1. Run migration script to populate `GROUP_MEMBERS_{id}` keys
2. Iterate through all `MemberProfile` entries
3. Reconstruct member lists sorted by `payout_position`

### Testing Checklist
- [ ] All unit tests pass
- [ ] Integration tests with real storage
- [ ] Gas consumption within limits
- [ ] Edge cases handled correctly
- [ ] Error messages are clear

## Conclusion

The `get_group_members` function provides a robust, efficient way to retrieve group members with pagination support. It integrates seamlessly with the existing ROSCA contract architecture and follows best practices for Soroban smart contract development.

### Key Features
✅ Efficient pagination with gas optimization  
✅ Members sorted by join order  
✅ Comprehensive error handling  
✅ Extensive test coverage  
✅ Clear documentation  
✅ Future-proof design  

### Status
**Implementation Complete** - Ready for deployment and testing on Stellar testnet.
