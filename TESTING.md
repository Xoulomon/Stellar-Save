# Testing

## Soroban Contract Coverage

Run the `stellar-save` contract coverage gate from the repository root:

```sh
cargo tarpaulin --config tarpaulin.toml
```

The command scopes instrumentation to `contracts/stellar-save` and exits
unsuccessfully when line coverage is below **85%**. The pre-push hook runs this
same command automatically. Install Tarpaulin once with
`cargo install cargo-tarpaulin --locked` if it is not available locally.

The latest coverage recorded in [`contracts/coverage-baseline.json`](contracts/coverage-baseline.json)
is **93.04%** for `stellar-save` (842 of 905 lines). This is the checked-in
baseline, not a fresh measurement from this change.