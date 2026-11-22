# stellar-save

A Soroban smart contract for group savings (ROSCA-style) pools on the Stellar network.

## Overview

`stellar-save` lets members create savings pools, join them, and make periodic
contributions. Pool state and per-member contribution records are persisted in
contract storage.

## Upgrade & Migration Path

**This contract is not upgradeable.** There is no upgrade entrypoint in
`contract.rs` — no `upgrade`, `migrate`, or `__constructor`-based replacement
function, and no admin-gated code path that can swap the deployed WASM.

### Rationale

- Soroban contracts are immutable once deployed unless they explicitly expose an
  upgrade mechanism (e.g. `env.deployer().update_current_contract_wasm(...)`).
  `stellar-save` deliberately does not expose one.
- Because there is no upgrade path, there is also no migration path for existing
  pool or contribution storage data. Storage written by one deployment cannot be
  reinterpreted by a different contract version.
- Immutability removes the risk of an admin silently changing pool/contribution
  semantics or draining funds via a malicious upgrade, which is important for a
  contract that custodies member contributions.

### Consequences

- Any change to storage layout or pool/contribution logic requires deploying a
  **new** contract instance. Existing pools remain on the old instance and are
  not migrated automatically.
- Users must be informed to withdraw from the old instance and re-join the new
  one if a breaking change is released.
- If an upgrade path is ever required, it must be added explicitly (with an
  admin-gated `update_current_contract_wasm` call and a documented migration
  routine) and covered by a migration test that seeds pre-existing pool and
  contribution data and asserts data integrity after the upgrade.

## WASM Size Budget

Soroban enforces a **100 KB hard limit** on uploaded contract WASM.  A contract
that exceeds this limit cannot be deployed to any Stellar network (testnet or
mainnet).

| | |
|---|---|
| **Hard limit** | 100 KB (`WASM_SIZE_BUDGET_KB`) |
| **Warn threshold** | 80 KB (80% of limit, `WASM_WARN_THRESHOLD_PCT`) |
| **Current release size** | 96 KB (97,926 bytes) |
| **Headroom** | 4 KB |

The single source of truth for these values is
[`scripts/wasm_size_budget.sh`](../../scripts/wasm_size_budget.sh).
All size-checking scripts source that file:

- [`scripts/check_contract_size.sh`](../../scripts/check_contract_size.sh) —
  measures the built WASM, enforces the limit, tracks trends, and emits
  optimization suggestions.  Exits 1 if the limit is exceeded.
- [`tests/size_check_test.sh`](../../tests/size_check_test.sh) — unit tests for
  the check logic using synthetic WASM files (no real build needed).

CI may override the budget per-pipeline by setting `WASM_SIZE_LIMIT_KB` or
`WARN_THRESHOLD_PCT` environment variables; these take precedence over the
constants in `wasm_size_budget.sh`.

### Release profile

The workspace `[profile.release]` in the root `Cargo.toml` is tuned for minimal
WAM size:

```toml
opt-level = "z"       # optimise for binary size
lto = true            # whole-program link-time optimisation
codegen-units = 1     # single codegen unit for better dead-code elimination
strip = "symbols"     # strip debug symbols
panic = "abort"       # smaller panic handling
```

### Changing the budget

1. Update `WASM_SIZE_BUDGET_KB` and/or `WASM_WARN_THRESHOLD_PCT` in
   `scripts/wasm_size_budget.sh`.
2. Update the table above with the new values.
3. The scripts that source the file pick up the new value automatically.

## Testing

Run the contract test suite with:

```sh
cargo test -p stellar-save
```

Tests cover pool creation, joining, contributions, and payout logic. Since the
contract is not upgradeable, there is no upgrade-simulation test; the constraint
above is the enforced contract behavior.

## Cargo Feature Flags

| Feature | Default | Description |
|---------|---------|-------------|
| `zk` | **off** | Ed25519-based contribution-proof verification (Phase 1 ZK scheme) |
| `clone-group` | off | Group-clone helpers (not yet wired to a contract entry-point) |
| `group-templates` | off | Group-template helpers (not yet wired to a contract entry-point) |
| `coverage` | off | Coverage instrumentation for `cargo-tarpaulin` / `cargo-llvm-cov` |

### `zk` feature

The `zk` feature gates the entire ZK subsystem:

- `src/zk_proof.rs` — Ed25519-based `verify_contribution_proof` implementation
- `src/zk_tests.rs` — unit tests covering valid/invalid/malformed proof paths
- `src/zk_integration_tests.rs` — integration tests through the contract client
- The `verify_contribution_proof` entrypoint in `contract.rs` calls the real
  verifier only when `zk` is enabled; without it the entrypoint returns
  `InvalidState` immediately.

**Why off by default?**  The ZK subsystem corresponds to the `zk/` workspace at
the repository root, which is classified as *Experimental* (see `README.md`).
There are open HIGH-priority audit items in [`zk/CIRCUIT_AUDIT.md`](../../zk/CIRCUIT_AUDIT.md)
tracked by issue #1327. Shipping experimental cryptography in the default build
would increase the audit scope and the production WASM size unnecessarily.

**To run the ZK test suite:**

```sh
cargo test -p stellar-save --features zk
```

**To build a WASM with ZK enabled** (not for production until audit closes):

```sh
cargo build -p stellar-save --release --features zk --target wasm32-unknown-unknown
```
