# Fuzz Testing for Stellar-Save Contract

This directory contains `cargo-fuzz` targets for fuzzing the Stellar-Save smart contract's input validation and pure logic functions.

## Prerequisites

```bash
cargo install cargo-fuzz
```

## Running Fuzz Tests

### Run all targets for 10 minutes (as specified in issue #881)

```bash
# From contracts/stellar-save directory
cargo fuzz run fuzz_create_group -- -max_total_time=600
cargo fuzz run fuzz_contribute -- -max_total_time=600
cargo fuzz run fuzz_join_group -- -max_total_time=600
```

### Run individual targets

```bash
cargo fuzz run fuzz_create_group
cargo fuzz run fuzz_contribute
cargo fuzz run fuzz_join_group
```

### CI Integration

Add to `.github/workflows/contract-ci.yml`:

```yaml
- name: Run fuzz tests
  run: |
    cargo install cargo-fuzz
    cd contracts/stellar-save
    cargo fuzz run fuzz_create_group -- -max_total_time=600 -seed=1
    cargo fuzz run fuzz_contribute -- -max_total_time=600 -seed=1
    cargo fuzz run fuzz_join_group -- -max_total_time=600 -seed=1
  continue-on-error: false
```

## Fuzz Targets

### `fuzz_create_group`
Tests create_group input validation:
- Contribution amount rounding logic
- Max members protocol limit (20)
- Cycle duration validation
- Grace period validation

### `fuzz_contribute`
Tests contribute input validation:
- Contribution amount must be positive
- Amount must match group's expected contribution
- Deadline + grace period logic
- Cycle number bounds

### `fuzz_join_group`
Tests join_group validation:
- Member capacity limits
- Group status validation (only Pending groups accept joins)
- Payout position assignment (0-indexed, < max_members)
- Member profile invariants

## Edge Cases Discovered

Document any edge cases or bugs found during fuzzing here:

- [ ] None yet - run the fuzzer!

## Corpus

Interesting inputs discovered by the fuzzer are stored in `corpus/<target>/`.
These are regression tests automatically run on subsequent fuzzing sessions.

## Artifacts

If the fuzzer finds a crash or panic, the input is saved to `artifacts/<target>/`.
These should be turned into unit tests in `src/tests/` after investigation.
