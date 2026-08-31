# Property-Based Testing — Discovered Edge Cases

This document records edge cases and invariant violations discovered (or
confirmed absent) by the Proptest property-based test suite in
`contracts/stellar-save/src/property_tests.rs` and `fuzz_tests.rs`.

## How to run

```bash
# Run all property tests (256 cases per property)
PROPTEST_CASES=256 cargo test \
  --manifest-path contracts/stellar-save/Cargo.toml \
  --test-threads=1 \
  property_tests fuzz_tests \
  -- --nocapture

# Increase cases for deeper exploration
PROPTEST_CASES=10000 cargo test \
  --manifest-path contracts/stellar-save/Cargo.toml \
  --test-threads=1 \
  property_tests
```

## Invariants verified

### ContributionRecord

| Property | Status | Notes |
|---|---|---|
| Positive amount stored exactly | ✅ Holds | Fields are stored verbatim |
| Zero/negative amount panics | ✅ Holds | `assert!(amount > 0)` in `new()` |
| Cycle number preserved | ✅ Holds | No transformation applied |
| Sum of contributions no overflow | ✅ Holds | `checked_add` guards against i128 overflow |
| Timestamp is non-negative | ✅ Holds | u64 type guarantees this |

### PayoutRecord

| Property | Status | Notes |
|---|---|---|
| All fields stored exactly | ✅ Holds | No transformation in constructor |
| Zero/negative amount panics | ✅ Holds | Same guard as ContributionRecord |
| Payout equals pool size | ✅ Holds | `contribution_amount × max_members` |

### Pool size calculation

| Property | Status | Notes |
|---|---|---|
| No overflow for realistic values | ✅ Holds | Up to 1 trillion stroops × 100 members fits in i128 |
| **Potential overflow with extreme inputs** | ⚠️ Edge case | `i128::MAX × 100` overflows — callers must use `checked_mul` |

**Edge case detail:** If `contribution_amount` approaches `i128::MAX / max_members`,
the pool size calculation `contribution_amount * max_members as i128` will overflow.
The contract must use `checked_mul` when computing pool sizes. The property test
`prop_pool_size_no_overflow` constrains inputs to `1..=1_000_000_000_000` to stay
within safe bounds, but the contract-level validation should enforce a maximum
contribution amount to prevent this in production.

### GroupStatus state machine

| Property | Status | Notes |
|---|---|---|
| Terminal states reject all transitions | ✅ Holds | `Completed` and `Cancelled` return false for all targets |
| Pending cannot go to Paused/Completed | ✅ Holds | Only `Active` and `Cancelled` are valid from `Pending` |
| Active can reach Paused/Completed/Cancelled | ✅ Holds | All three transitions allowed |
| Paused cannot complete directly | ✅ Holds | Must go through `Active` first |
| u32 round-trip for values 0–4 | ✅ Holds | `from_u32(as_u32(s)) == s` |
| Values ≥ 5 return None | ✅ Holds | No silent truncation |

### Group member count

| Property | Status | Notes |
|---|---|---|
| member_count ≤ max_members | ✅ Holds (invariant) | Enforced by join_group logic |
| min_members ≤ max_members required | ✅ Holds (invariant) | Invalid configs rejected |

### ContractConfig

| Property | Status | Notes |
|---|---|---|
| min_contribution > max_contribution → invalid | ✅ Holds | `validate()` returns false |
| min_members < 2 → invalid | ✅ Holds | `validate()` returns false |

## Recommendations

1. **Add `checked_mul` for pool size** — The contract should validate that
   `contribution_amount.checked_mul(max_members as i128).is_some()` during
   group creation to prevent overflow in payout calculations.

2. **Enforce max contribution in ContractConfig** — Set a reasonable upper
   bound (e.g., 10^15 stroops ≈ 100M XLM) to keep pool sizes within safe
   i128 range even for large groups.

3. **Cycle number monotonicity** — The property tests confirm cycle numbers
   are ordered, but the contract should explicitly reject contributions for
   past cycles (cycle_number < current_cycle).
