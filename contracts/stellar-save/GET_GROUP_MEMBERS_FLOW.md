# Get Group Members - Function Flow Diagram

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    get_group_members()                       │
│                                                              │
│  Input: group_id, offset, limit                             │
│  Output: Vec<Address> or Error                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Verify Group Exists                                │
│  ─────────────────────────────────────────────────────────  │
│  • Load group from storage using group_id                   │
│  • Return GroupNotFound error if not exists                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Validate Pagination Parameters                     │
│  ─────────────────────────────────────────────────────────  │
│  • Check offset + limit for overflow                        │
│  • Return Overflow error if invalid                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Load Members from Storage                          │
│  ─────────────────────────────────────────────────────────  │
│  • Get GROUP_MEMBERS_{group_id} key                         │
│  • Load Vec<Address> from persistent storage               │
│  • Return empty Vec if no members                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Verify Sort Order                                  │
│  ─────────────────────────────────────────────────────────  │
│  • Members already sorted by join order in storage          │
│  • No additional sorting needed                             │
│  • First member = index 0 = payout position 0               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Apply Pagination                                   │
│  ─────────────────────────────────────────────────────────  │
│  • Cap limit at 100 (gas optimization)                      │
│  • Check if offset >= total_members                         │
│  • Calculate end_index = min(offset + limit, total)         │
│  • Return empty Vec if offset beyond total                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Extract Paginated Slice                            │
│  ─────────────────────────────────────────────────────────  │
│  • Create new Vec for results                               │
│  • Iterate from offset to end_index                         │
│  • Push each member to result Vec                           │
│  • Return paginated Vec<Address>                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────────────┐
                    │  Return Result │
                    └───────────────┘
```

## Detailed Flow with Examples

### Example 1: Get First Page (offset=0, limit=10)

```
Group has 25 members: [M0, M1, M2, ..., M24]

Input: offset=0, limit=10
       ↓
Load all 25 members from storage
       ↓
Calculate: end_index = min(0 + 10, 25) = 10
       ↓
Extract members[0..10]
       ↓
Return: [M0, M1, M2, M3, M4, M5, M6, M7, M8, M9]
```

### Example 2: Get Second Page (offset=10, limit=10)

```
Group has 25 members: [M0, M1, M2, ..., M24]

Input: offset=10, limit=10
       ↓
Load all 25 members from storage
       ↓
Calculate: end_index = min(10 + 10, 25) = 20
       ↓
Extract members[10..20]
       ↓
Return: [M10, M11, M12, M13, M14, M15, M16, M17, M18, M19]
```

### Example 3: Partial Page (offset=20, limit=10)

```
Group has 25 members: [M0, M1, M2, ..., M24]

Input: offset=20, limit=10
       ↓
Load all 25 members from storage
       ↓
Calculate: end_index = min(20 + 10, 25) = 25
       ↓
Extract members[20..25]
       ↓
Return: [M20, M21, M22, M23, M24]  (only 5 members)
```

### Example 4: Offset Beyond Total (offset=30, limit=10)

```
Group has 25 members: [M0, M1, M2, ..., M24]

Input: offset=30, limit=10
       ↓
Load all 25 members from storage
       ↓
Check: offset (30) >= total_members (25)
       ↓
Return: []  (empty vector)
```

### Example 5: Empty Group (offset=0, limit=10)

```
Group has 0 members: []

Input: offset=0, limit=10
       ↓
Load members from storage → empty Vec
       ↓
Check: offset (0) >= total_members (0)
       ↓
Return: []  (empty vector)
```

## Storage Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Persistent Storage                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GROUP_{group_id}                                           │
│  ├─ Group struct (metadata)                                 │
│  └─ member_count: u32                                       │
│                                                              │
│  GROUP_MEMBERS_{group_id}                                   │
│  ├─ Vec<Address>                                            │
│  ├─ [0] → First member (payout position 0)                  │
│  ├─ [1] → Second member (payout position 1)                 │
│  ├─ [2] → Third member (payout position 2)                  │
│  └─ ...                                                      │
│                                                              │
│  MEMBER_{group_id}_{address}                                │
│  ├─ MemberProfile                                           │
│  ├─ payout_position: u32                                    │
│  └─ joined_at: u64                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Member Join Order Flow

```
Time →

Join Event 1:
  Member A joins
  ├─ member_count = 0
  ├─ payout_position = 0
  ├─ Add to members[0]
  └─ member_count = 1

Join Event 2:
  Member B joins
  ├─ member_count = 1
  ├─ payout_position = 1
  ├─ Add to members[1]
  └─ member_count = 2

Join Event 3:
  Member C joins
  ├─ member_count = 2
  ├─ payout_position = 2
  ├─ Add to members[2]
  └─ member_count = 3

Result:
  members = [A, B, C]
  Sorted by join order ✓
  Payout order: A → B → C
```

## Pagination Logic

```
Total Members: 25
Page Size: 10

┌─────────────────────────────────────────────────────────────┐
│                      All Members                             │
│  [M0, M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, ..., M24]   │
└─────────────────────────────────────────────────────────────┘
   ↓         ↓                    ↓
   
Page 1      Page 2               Page 3
offset=0    offset=10            offset=20
limit=10    limit=10             limit=10
   ↓         ↓                    ↓
[M0..M9]    [M10..M19]           [M20..M24]
10 items    10 items             5 items
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Scenarios                           │
└─────────────────────────────────────────────────────────────┘

Scenario 1: Group Not Found
  Input: group_id = 999 (doesn't exist)
         ↓
  Load group from storage → None
         ↓
  Return: Err(StellarSaveError::GroupNotFound)

Scenario 2: Overflow
  Input: offset = u32::MAX, limit = 100
         ↓
  Check: offset.checked_add(limit) → None
         ↓
  Return: Err(StellarSaveError::Overflow)

Scenario 3: Valid but Empty Result
  Input: offset = 100, limit = 10
  Group has: 50 members
         ↓
  Check: offset (100) >= total (50)
         ↓
  Return: Ok(Vec::new())  (not an error!)
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│                    Time Complexity                           │
├─────────────────────────────────────────────────────────────┤
│  Step 1: Verify group exists        → O(1)                  │
│  Step 2: Validate parameters        → O(1)                  │
│  Step 3: Load members from storage  → O(n) where n = total  │
│  Step 4: No sorting needed          → O(1)                  │
│  Step 5: Calculate pagination       → O(1)                  │
│  Step 6: Extract slice              → O(m) where m = limit  │
│                                                              │
│  Overall: O(n + m) ≈ O(n) where n = total members           │
│  Practical: O(100) max due to limit cap                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Space Complexity                          │
├─────────────────────────────────────────────────────────────┤
│  Input parameters                   → O(1)                  │
│  Loaded members vector              → O(n) where n = total  │
│  Result vector                      → O(m) where m = limit  │
│                                                              │
│  Overall: O(n + m)                                          │
│  Practical: O(n + 100) due to limit cap                     │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                  Related Functions                           │
└─────────────────────────────────────────────────────────────┘

join_group()
  ├─ Adds member to GROUP_MEMBERS_{group_id}
  ├─ Increments member_count
  └─ Assigns payout_position
         ↓
get_group_members()  ← Current function
  ├─ Reads GROUP_MEMBERS_{group_id}
  └─ Returns paginated list
         ↓
get_payout_position()
  ├─ Uses member's payout_position
  └─ Based on join order

get_payout_schedule()
  ├─ Uses get_group_members() internally
  └─ Calculates payout dates for all members
```

## Summary

The `get_group_members` function provides efficient, paginated access to group members while maintaining join order. The implementation is optimized for gas consumption and handles all edge cases gracefully.

**Key Points:**
- ✅ Members stored in join order
- ✅ No sorting overhead
- ✅ Efficient pagination
- ✅ Gas optimized (100-member cap)
- ✅ Comprehensive error handling
- ✅ Edge cases covered
