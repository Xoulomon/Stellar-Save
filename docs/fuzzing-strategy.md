# Contract Fuzzing Strategy

## Tool choice

**proptest** (property-based testing) — already a dev-dependency in `contracts/stellar-save/Cargo.toml`. Runs under stable Rust with `cargo test`, no nightly or external toolchain required.

Echidna and Foundry are EVM-specific and do not apply to Soroban/Rust contracts. `cargo-fuzz` (libFuzzer) requires nightly and a separate build target; proptest provides equivalent coverage for invariant testing with simpler CI integration.

## Test file

`contracts/stellar-save/src/fuzz_tests.rs` — registered as a `#[cfg(test)]` module in `lib.rs`.

## Properties tested

### ContributionRecord
- Positive amounts are stored exactly (no mutation)
- Zero or negative amounts always panic (enforced by `assert!`)
- Summing valid amounts never overflows `i128`

### GroupStatus state machine
- Terminal states (`Completed`, `Cancelled`) reject all transitions
- `Pending` cannot skip to `Paused` or `Completed`
- `Active` can reach `Paused`, `Completed`, and `Cancelled`
- `Paused` cannot jump directly to `Completed`

### ContractConfig validation
- `min_contribution > max_contribution` → invalid
- `min_members < 2` → invalid
- `min_contribution == 0` → invalid
- Well-formed config always passes `validate()`

### Payout rotation
- Payout position bounds invariant
- Pool arithmetic: `payout_per_cycle == contribution_amount × member_count`
- Cycle number lifecycle invariant

## Running locally

```bash
# Default (256 cases per test)
cargo test --manifest-path contracts/stellar-save/Cargo.toml --lib fuzz_tests

# Extended run (10 000 cases)
PROPTEST_CASES=10000 cargo test --manifest-path contracts/stellar-save/Cargo.toml --lib fuzz_tests
```

## CI integration

`.github/workflows/fuzzing.yml` runs on:
- Every push/PR touching `contracts/`
- Nightly schedule at 02:00 UTC (10 000 cases)
- Manual `workflow_dispatch` with configurable case count

| Trigger | Cases | Timeout |
|---------|-------|---------|
| Push / PR | 256 | 30 min |
| Nightly | 10 000 | 30 min |
| Manual | configurable | 30 min |

## Regression corpus

When proptest finds a failing input it writes a minimal reproduction to `contracts/stellar-save/.proptest-regressions/`. This directory is uploaded as a CI artifact and should be committed to the repo so failures are always replayed on future runs.

## Extending the suite

Add new property tests to `fuzz_tests.rs` following the pattern:

```rust
proptest! {
    #[test]
    fn prop_my_invariant(input in my_strategy()) {
        // arrange + act
        prop_assert!(invariant_holds);
    }
}
```

Focus on:
- Arithmetic overflow/underflow in payout calculations
- State transition edge cases
- Boundary values for `max_members`, `max_cycle_duration`
- Multi-member contribution ordering independence
