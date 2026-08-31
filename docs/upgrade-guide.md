# Upgrade Guide

This document describes how to safely upgrade the Stellar-Save Soroban contract, verify backward compatibility, and run the automated upgrade test suite.

## Overview

Soroban contracts are upgraded via `update_current_contract_wasm`, which replaces the WASM bytecode in-place while leaving all persistent storage intact. Because storage is preserved, every upgrade must maintain backward compatibility with existing data.

## Pre-upgrade checklist

1. All existing tests pass on the current branch.
2. The upgrade test suite passes (see [Running the tests](#running-the-tests)).
3. The new WASM builds cleanly for `wasm32-unknown-unknown`.
4. Any new storage keys use additive variants — never reuse or rename existing `StorageKey` enum variants.
5. Any new `#[contracttype]` structs are additive; existing structs keep the same field order and types.

## Storage compatibility rules

| Rule | Reason |
|------|--------|
| Never remove a `StorageKey` variant | Existing entries become unreadable |
| Never reorder fields in a `#[contracttype]` struct | XDR encoding is positional |
| Never change a field's type | Deserialisation will panic at runtime |
| Add new fields only at the end of a struct | Preserves XDR compatibility |
| New enum variants must be appended | Existing discriminants must not shift |

## Storage schema versioning

Storage compatibility (above) governs what changes are safe to ship; the storage version mechanism tracks which schema shape is actually in storage so the contract can migrate old data forward automatically.

- **`STORAGE_VERSION`** (`storage.rs`) is a `u32` constant bumped whenever a released version changes the storage shape (adds a tracked field, introduces a new keyed value, etc.). It is currently `2`.
- **`StorageVersion`** is a dedicated `CounterKey` variant holding the schema version that is actually persisted on-chain for a given contract instance.
- **`migration.rs`** implements `migrate()`, which compares the stored version against `STORAGE_VERSION` and applies each incremental step (v1→v2, v2→v3, …) in order. Migrations only add fields or initialize new keys — they never modify or remove existing data.
- **Triggers**: migration runs automatically the first time `update_config()` is called after an upgrade, and can also be run explicitly via `migrate_storage()` (admin-only). The current version is readable via `get_storage_version()`.
- **Guarantees**: migrations are idempotent (safe to run more than once) and incremental (each step is applied and verified independently), so a partially-migrated instance can always resume from its stored version.

Adding a new schema version:

```rust
// in migration.rs
if current_version < 3 {
    migrate_v2_to_v3(env)?;
}
```

1. Bump `STORAGE_VERSION`.
2. Add the incremental `migrate_vN_to_vN+1` step — additive only, per the storage compatibility rules above.
3. Add a migration test seeding the old shape and asserting the new shape after `migrate()` (see `test_migrate_v1_to_v2_with_existing_groups` for the pattern).
4. Document the new version in this section.

## Running the tests

### All upgrade tests

```bash
cargo test \
  --manifest-path contracts/stellar-save/Cargo.toml \
  upgrade_tests \
  -- --test-threads=1
```

### By category

```bash
# Data migration
cargo test --manifest-path contracts/stellar-save/Cargo.toml \
  upgrade_tests::upgrade_tests::test_migration -- --test-threads=1

# API compatibility
cargo test --manifest-path contracts/stellar-save/Cargo.toml \
  upgrade_tests::upgrade_tests::test_api -- --test-threads=1

# Performance regression
cargo test --manifest-path contracts/stellar-save/Cargo.toml \
  upgrade_tests::upgrade_tests::test_perf -- --test-threads=1
```

### CI

The `.github/workflows/upgrade-tests.yml` workflow runs automatically on every push or pull request that touches `contracts/`. It runs each category as a separate step so failures are easy to identify.

## Test categories

### Data migration tests

These tests write storage entries directly (bypassing the contract client) to simulate data that was written by a previous version of the contract. They then read the data back through the current contract API to confirm nothing was broken.

Covered scenarios:
- Group structs survive an upgrade (`test_migration_group_data_survives_upgrade`)
- Member profiles survive an upgrade (`test_migration_member_profile_survives_upgrade`)
- Contribution records survive an upgrade (`test_migration_contribution_record_survives_upgrade`)
- `GroupStatus` discriminants are stable (`test_migration_group_status_enum_compatibility`)

### API compatibility tests

These tests call every public function that existed in v1 and assert that the function signature and return type are unchanged.

Covered functions:
- `get_group` — returns `GroupNotFound` for missing IDs
- `get_member_count` — returns 0 for empty groups
- `is_member` — returns false for non-members
- `get_group_balance` — returns 0 when no contributions exist
- `get_total_groups` — reflects the group-id counter

### Performance regression tests

These tests call key read operations and assert they complete without error, using `env.cost_estimate().resources()` to capture the `InvocationResources` after each call. When running against native (non-WASM) test contracts the instruction count is 0; against a WASM build it reflects actual VM execution cost.

To get meaningful instruction counts in CI, build the contract as WASM and run tests with `--features testutils` against the WASM binary. The current tests assert `instructions >= 0` as a sanity check; tighten the upper bound as you establish baselines.

Covered operations:
- `get_group`
- `is_member`
- `get_group_balance`

## Upgrade procedure

### Testnet

```bash
# 1. Build the new WASM
cargo build \
  --manifest-path contracts/stellar-save/Cargo.toml \
  --target wasm32-unknown-unknown \
  --release

# 2. Upload the new WASM and get the hash
stellar contract upload \
  --network testnet \
  --source deployer \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm

# 3. Upgrade the deployed contract
stellar contract invoke \
  --network testnet \
  --source deployer \
  --id <CONTRACT_ID> \
  -- upgrade \
  --new_wasm_hash <WASM_HASH>

# 4. Smoke-test the upgraded contract
./scripts/smoke_test.sh
```

### Mainnet

Follow the same steps as testnet, substituting `--network mainnet` and using the mainnet deployer identity. Mainnet upgrades require the `production` GitHub environment approval gate defined in `ci.yml`.

## Rolling back

Soroban does not support automatic rollback, and rolling back WASM does not roll back storage — if the new version's `migrate()` already ran, storage stays at the new `STORAGE_VERSION` even after the old code is reinstated. Plan accordingly:

1. **Check the stored version first**: call `get_storage_version()` before rolling back. If it's still at the pre-upgrade version (migration hasn't run yet, e.g. `update_config()`/`migrate_storage()` was never invoked post-upgrade), a straight WASM rollback is safe.
2. **If migration has already run**, the reverted (older) contract code must still be able to read the newer storage shape, since migrations are additive-only — this is exactly what the storage compatibility rules above guarantee. Confirm this holds by running the upgrade test suite's data-migration tests against the old WASM before rolling back in production.
3. Re-upload the previous WASM and obtain its hash.
4. Call `upgrade` with the old hash from the admin account.
5. Re-run `get_storage_version()` and the upgrade test suite against the reverted contract to confirm storage is intact and readable.
6. If the rollback needs to undo a schema change entirely (not just a code change), that requires a forward-fixing migration (e.g. v3→v4 that removes/ignores the v3 fields) rather than a storage rollback — Soroban has no mechanism to migrate a schema version backward.

## Adding new tests

When you add a new storage key or public function:

1. Add a migration test that seeds the old data shape and reads it back.
2. Add an API compatibility test that calls the function with v1 arguments.
3. Add a performance test if the function is on a hot path.
4. Update this document with the new scenarios.
