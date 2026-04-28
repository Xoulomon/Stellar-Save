# Design Document: calculate_current_cycle

## Overview

This feature adds a `calculate_current_cycle` pure helper function to `contracts/stellar-save/src/helpers.rs`. The function determines the current cycle index for a savings group by computing how many full `cycle_duration` windows have elapsed since `started_at`, capping the result at `max_members - 1`.

It is called internally by contribution validation, payout scheduling, and cycle advancement logic to avoid duplicating cycle-calculation arithmetic across the contract.

Key design decisions:
- **Pure helper, no state mutation**: the function only reads from storage and the ledger clock.
- **Placed in `helpers.rs`**: consistent with the existing `is_cycle_deadline_passed` helper that lives there.
- **Returns `Result<u32, StellarSaveError>`**: typed errors let callers handle failures without panicking.
- **`u64` arithmetic throughout**: avoids signed-integer overflow; cast to `u32` only after the cap is applied.

---

## Architecture

The function sits entirely within the existing `helpers` module. No new modules, traits, or storage keys are introduced.

```mermaid
flowchart TD
    Caller["Contract operation\n(contribution / payout / cycle advance)"]
    Helper["helpers::calculate_current_cycle(env, group_id)"]
    Storage["Persistent storage\nStorageKeyBuilder::group_data(group_id)"]
    Ledger["env.ledger().timestamp()"]

    Caller -->|calls| Helper
    Helper -->|reads| Storage
    Helper -->|reads| Ledger
    Helper -->|Ok(cycle) / Err| Caller
```

---

## Components and Interfaces

### Function Signature

```rust
/// Calculates the current cycle number for a savings group.
///
/// # Arguments
/// * `env`      - Soroban environment (storage + ledger access)
/// * `group_id` - ID of the group to query
///
/// # Returns
/// * `Ok(0)`                        - group not yet started, or current_time < started_at
/// * `Ok(n)` where n ≤ max_members-1 - number of complete cycles elapsed, capped
/// * `Err(StellarSaveError::GroupNotFound)` - group_id not in storage
pub fn calculate_current_cycle(env: &Env, group_id: u64) -> Result<u32, StellarSaveError>
```

### Placement

File: `contracts/stellar-save/src/helpers.rs`

The function is a free function (not a method on `StellarSaveContract`) consistent with `format_group_id` and `is_cycle_deadline_passed` already in that file.

### Interaction with Existing Code

| Existing symbol | How it is used |
|---|---|
| `StorageKeyBuilder::group_data(group_id)` | Load the `Group` struct |
| `Group.started` | Early-return `Ok(0)` if group not started |
| `Group.started_at` | Base timestamp for elapsed calculation |
| `Group.cycle_duration` | Divisor for integer division |
| `Group.max_members` | Cap: result ≤ `max_members - 1` |
| `StellarSaveError::GroupNotFound` | Returned when group absent from storage |
| `env.ledger().timestamp()` | Current on-chain time |

---

## Data Models

No new data structures are introduced. The function reads the existing `Group` struct:

```rust
pub struct Group {
    pub started: bool,
    pub started_at: u64,       // Unix timestamp (seconds) of activation
    pub cycle_duration: u64,   // Length of one cycle in seconds
    pub max_members: u32,      // Total number of cycles == total members
    // ... other fields unchanged
}
```

### Computation Model

```
elapsed_seconds  = current_time - started_at          (u64 subtraction, guarded by current_time >= started_at)
cycles_elapsed   = elapsed_seconds / cycle_duration   (u64 integer division, truncates toward zero)
capped_cycles    = min(cycles_elapsed, max_members - 1 as u64)
result           = capped_cycles as u32               (safe: value ≤ max_members - 1 ≤ u32::MAX)
```

Edge cases handled before the computation:
1. Group not in storage → `Err(GroupNotFound)`
2. `group.started == false` → `Ok(0)`
3. `current_time < started_at` → `Ok(0)` (clock skew guard)


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: GroupNotFound for unknown group_id

*For any* `group_id` that has not been stored in persistent storage, `calculate_current_cycle` must return `Err(StellarSaveError::GroupNotFound)`.

**Validates: Requirements 1.2, 5.1**

---

### Property 2: Unstarted group always returns cycle 0

*For any* `Group` whose `started` field is `false` (regardless of other fields), `calculate_current_cycle` must return `Ok(0)`.

**Validates: Requirements 1.3**

---

### Property 3: Cycle count correctness formula

*For any* started group with `current_time >= started_at`, the returned cycle number must equal `min(floor((current_time - started_at) / cycle_duration), max_members - 1)` cast to `u32`. This subsumes the cap requirement and the integer-truncation requirement.

**Validates: Requirements 2.2, 3.1, 3.3, 4.2, 6.3**

---

### Property 4: Result is always a valid cycle index

*For any* started group and any `current_time >= started_at`, the returned value `n` must satisfy `0 <= n <= max_members - 1`. This invariant holds independently of the exact formula and can be checked without recomputing the formula.

**Validates: Requirements 4.4**

---

### Property 5: Determinism — same inputs produce same result

*For any* group and ledger timestamp, calling `calculate_current_cycle` twice with identical inputs must return identical results. The function has no side effects that could cause divergence.

**Validates: Requirements 6.6**

---

## Error Handling

| Condition | Return value | Notes |
|---|---|---|
| `group_id` not in storage | `Err(StellarSaveError::GroupNotFound)` | Propagated from `.ok_or(...)` on storage get |
| `group.started == false` | `Ok(0)` | Early return before any arithmetic |
| `current_time < started_at` | `Ok(0)` | Clock-skew guard; no panic |
| Normal operation | `Ok(n)` where `0 <= n <= max_members - 1` | Integer division + cap |

The function never panics. All arithmetic is on `u64` values (no overflow possible for realistic timestamps and durations), and the cast to `u32` is safe because the value is capped at `max_members - 1` which fits in `u32`.

---

## Testing Strategy

### Unit Tests (in `helpers.rs` `#[cfg(test)]` block)

Unit tests cover specific examples and edge cases:

1. Non-existent `group_id` → `Err(GroupNotFound)`
2. Group with `started = false` → `Ok(0)`
3. Query at exactly `started_at` (zero elapsed) → `Ok(0)`
4. Query at `started_at + cycle_duration * N` for N = 1, 2, 3 → `Ok(N)`
5. Query at `started_at + cycle_duration * N - 1` (one second before boundary) → `Ok(N-1)` (no partial cycle)
6. Query far in the future (elapsed >> max_members cycles) → `Ok(max_members - 1)` (cap)

### Property-Based Tests

Property-based testing library: **`proptest`** (already available in the Rust ecosystem; add to `[dev-dependencies]` in `contracts/stellar-save/Cargo.toml`).

Each property test runs a minimum of **100 iterations**.

| Property | Test description | Tag |
|---|---|---|
| P1: GroupNotFound | Generate random `u64` group_ids, verify `Err(GroupNotFound)` | `Feature: calculate-current-cycle, Property 1: GroupNotFound for unknown group_id` |
| P2: Unstarted returns 0 | Generate random `Group` with `started=false`, verify `Ok(0)` | `Feature: calculate-current-cycle, Property 2: Unstarted group always returns cycle 0` |
| P3: Correctness formula | Generate random started groups + timestamps ≥ `started_at`, verify formula | `Feature: calculate-current-cycle, Property 3: Cycle count correctness formula` |
| P4: Bounds invariant | Generate random started groups + timestamps ≥ `started_at`, verify `0 <= n <= max_members-1` | `Feature: calculate-current-cycle, Property 4: Result is always a valid cycle index` |
| P5: Determinism | Call twice with same inputs, verify identical results | `Feature: calculate-current-cycle, Property 5: Determinism — same inputs produce same result` |

Each property test must include a comment referencing its design property using the tag format above.

### Dual Testing Rationale

Unit tests catch concrete bugs at known boundary values (e.g., off-by-one at cycle boundaries). Property tests verify the general formula holds across the full input space, including large timestamps, large `cycle_duration` values, and `max_members` at its extremes. Together they provide comprehensive coverage without redundancy.
