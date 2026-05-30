# Pool Calculation Module - Technical Documentation

## Overview

The Pool Calculation module (`pool.rs`) is a core component of the Stellar-Save smart contract that handles all pool-related calculations for rotational savings groups (ROSCA). It provides robust, tested functions for calculating total pool amounts, managing cycle state, and validating pool readiness for payouts.

## Core Concepts

### Pool Amount
The pool represents the total funds available for distribution in a cycle:
```
Pool Amount = Contribution Amount × Member Count
```

For example:
- 10 members × 1 XLM per member = 10 XLM total pool
- Each cycle, one member receives the entire pool

### Cycle Completion
A cycle is complete when all members have contributed their required amount. The module tracks:
- Number of members who have contributed
- Total contributions received
- Whether the cycle is ready for payout

## Data Structures

### PoolInfo
Comprehensive pool information for a specific group and cycle.

```rust
pub struct PoolInfo {
    pub group_id: u64,                    // Group identifier
    pub cycle: u32,                       // Current cycle number (0-indexed)
    pub member_count: u32,                // Total members in group
    pub contribution_amount: i128,        // Fixed contribution per member (stroops)
    pub total_pool_amount: i128,          // Total pool (contribution × members)
    pub current_contributions: i128,      // Total contributed so far
    pub contributors_count: u32,          // Number of members who contributed
    pub is_cycle_complete: bool,          // Whether all members have contributed
}
```

**Methods:**
- `return_amount()` - Returns the payout amount (equals total_pool_amount)
- `is_complete()` - Checks if cycle is complete
- `remaining_contributions_needed()` - Calculates missing contributions
- `completion_percentage()` - Returns 0-100 completion percentage

## API Reference

### PoolCalculator

#### calculate_total_pool
Calculates the total pool amount for a group.

```rust
pub fn calculate_total_pool(
    contribution_amount: i128,
    member_count: u32,
) -> Result<i128, StellarSaveError>
```

**Parameters:**
- `contribution_amount`: Fixed contribution per member in stroops (must be > 0)
- `member_count`: Total members in group (must be > 0)

**Returns:**
- `Ok(total_pool)` - The calculated pool amount
- `Err(InvalidAmount)` - If contribution_amount ≤ 0
- `Err(InvalidState)` - If member_count = 0
- `Err(InternalError)` - If multiplication overflows

**Example:**
```rust
let pool = PoolCalculator::calculate_total_pool(1_000_000, 10)?;
// pool = 10_000_000 stroops (1 XLM)
```

#### get_member_count
Retrieves the member count for a group from storage.

```rust
pub fn get_member_count(env: &Env, group_id: u64) -> Result<u32, StellarSaveError>
```

**Returns:**
- `Ok(count)` - Number of members
- `Err(GroupNotFound)` - If group doesn't exist

#### get_contribution_amount
Retrieves the fixed contribution amount for a group.

```rust
pub fn get_contribution_amount(env: &Env, group_id: u64) -> Result<i128, StellarSaveError>
```

**Returns:**
- `Ok(amount)` - Contribution amount in stroops
- `Err(GroupNotFound)` - If group doesn't exist

#### get_cycle_contributions_total
Retrieves total contributions for a specific cycle.

```rust
pub fn get_cycle_contributions_total(
    env: &Env,
    group_id: u64,
    cycle: u32,
) -> Result<i128, StellarSaveError>
```

**Returns:**
- `Ok(total)` - Total contributions (0 if not set)

#### get_cycle_contributor_count
Retrieves the number of contributors for a cycle.

```rust
pub fn get_cycle_contributor_count(
    env: &Env,
    group_id: u64,
    cycle: u32,
) -> Result<u32, StellarSaveError>
```

**Returns:**
- `Ok(count)` - Number of contributors (0 if not set)

#### get_pool_info
**Primary function** - Builds complete pool information for a group and cycle.

```rust
pub fn get_pool_info(
    env: &Env,
    group_id: u64,
    cycle: u32,
) -> Result<PoolInfo, StellarSaveError>
```

**Returns:**
- `Ok(PoolInfo)` - Complete pool information
- `Err(...)` - If any required data is missing

**Example:**
```rust
let pool_info = PoolCalculator::get_pool_info(&env, group_id, current_cycle)?;
println!("Pool: {} stroops", pool_info.total_pool_amount);
println!("Completion: {}%", pool_info.completion_percentage());
```

#### validate_pool_ready_for_payout
Validates that a pool is ready for payout distribution.

```rust
pub fn validate_pool_ready_for_payout(pool_info: &PoolInfo) -> Result<(), StellarSaveError>
```

**Validation Checks:**
1. All members have contributed (contributors_count ≥ member_count)
2. Total contributions match expected pool amount

**Returns:**
- `Ok(())` - Pool is ready for payout
- `Err(CycleNotComplete)` - Not all members have contributed
- `Err(InvalidAmount)` - Total contributions don't match pool amount

**Example:**
```rust
let pool_info = PoolCalculator::get_pool_info(&env, group_id, cycle)?;
PoolCalculator::validate_pool_ready_for_payout(&pool_info)?;
// Safe to proceed with payout
```

## Usage Patterns

### Pattern 1: Check Cycle Status
```rust
let pool_info = PoolCalculator::get_pool_info(&env, group_id, cycle)?;

if pool_info.is_complete() {
    println!("Cycle complete! Ready for payout.");
} else {
    let remaining = pool_info.remaining_contributions_needed();
    println!("Waiting for {} more contributions", remaining);
}
```

### Pattern 2: Validate Before Payout
```rust
let pool_info = PoolCalculator::get_pool_info(&env, group_id, cycle)?;

// This will fail if cycle is incomplete or amounts don't match
PoolCalculator::validate_pool_ready_for_payout(&pool_info)?;

// Proceed with payout
let payout_amount = pool_info.return_amount();
```

### Pattern 3: Monitor Progress
```rust
let pool_info = PoolCalculator::get_pool_info(&env, group_id, cycle)?;

println!("Progress: {}/{} members contributed", 
    pool_info.contributors_count, 
    pool_info.member_count);
println!("Completion: {}%", pool_info.completion_percentage());
println!("Amount collected: {} stroops", pool_info.current_contributions);
println!("Pool size: {} stroops", pool_info.total_pool_amount);
```

## Error Handling

The module uses the `StellarSaveError` enum for error reporting:

| Error | Code | Meaning |
|-------|------|---------|
| `InvalidAmount` | 3001 | Contribution amount is invalid (≤ 0) |
| `InvalidState` | 1003 | Member count is 0 or invalid state |
| `GroupNotFound` | 1001 | Group doesn't exist in storage |
| `CycleNotComplete` | 3003 | Not all members have contributed |
| `InternalError` | 9001 | Arithmetic overflow or internal error |

## Testing

The module includes 24 comprehensive unit tests covering:

### Calculation Tests
- Valid pool calculations
- Single member groups
- Large numbers
- Overflow protection
- Zero/negative validation

### PoolInfo Tests
- Return amount calculation
- Completion status
- Remaining contributions
- Completion percentage
- Equality and cloning

### Validation Tests
- Ready for payout (success case)
- Incomplete cycle detection
- Mismatched total detection

**Run tests:**
```bash
cargo test --lib pool
```

**Expected output:**
```
running 24 tests
test result: ok. 24 passed; 0 failed
```

## Security Considerations

1. **Overflow Protection**: All arithmetic uses `checked_mul` to prevent overflow
2. **Validation**: All inputs are validated before use
3. **Storage Access**: Proper error handling for missing data
4. **Amount Verification**: Cycle completion requires exact amount matching

## Performance

- **Calculation**: O(1) - Simple arithmetic
- **Storage Retrieval**: O(1) - Direct key lookups
- **Memory**: Minimal - PoolInfo is a small struct

## Integration Points

The pool module integrates with:
- **Storage Module**: For retrieving group and contribution data
- **Error Module**: For error reporting
- **Group Module**: For group configuration
- **Contribution Module**: For tracking contributions

## Future Enhancements

Potential improvements:
1. Pool history tracking
2. Partial contribution handling
3. Pool statistics aggregation
4. Advanced completion predictions
