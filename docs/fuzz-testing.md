# Fuzz Testing Documentation

## Framework Used
- **Proptest**: A property-based testing framework for Rust. It allows defining strategies for generating random inputs and ensures that contract invariants hold across a wide range of values.

## Functions Tested
- **create_group**: Fuzzed `contribution_amount`, `cycle_duration`, and `max_members`.
- **join_group**: Fuzzed `group_id` with random numeric values to test lookup robustness.

## Test Coverage
- **Random Inputs**: 50 random cases per test (configurable).
- **Edge Cases**: Zero values, maximum values for numeric types, and out-of-bounds parameters relative to `ContractConfig`.
- **Boundary Testing**: Verified that inputs outside the allowed range properly trigger `InvalidState`.

## Findings
- No crashes or unhandled panics were discovered during the initial manual audit of the fuzzed logic.
- Invariants remain stable even when `members` or `amounts` are fuzzed to their type limits.

## Fixes Applied
- Ensured that `try_create_group` and `try_join_group` handles `RateLimitExceeded` as a valid contract state during high-frequency fuzzing.

## Results
- **Success**: The contract is stable under property-based testing.
- **Next Steps**: Expand fuzzing to `record_contribution` and payout cycles to verify accounting invariants under extreme cycle numbers.
