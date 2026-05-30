# Contract Upgrade Testing

This document describes the comprehensive upgrade testing infrastructure for the Stellar-Save contract.

## Overview

The upgrade tests verify that contract upgrades preserve state, maintain API compatibility, and allow safe rollback. Tests are organized into 9 categories covering all aspects of upgrade safety.

## Test Organization

| Category | What it covers | Test Count |
|----------|---------------|------------|
| `state_preservation` | All storage entries survive a simulated upgrade | 4 tests |
| `api_compatibility` | Every public function callable with v1 argument shapes | 5 tests |
| `rollback` | State is consistent after v1→v2→v1 round-trip | 6 tests |
| `backward_compat` | Error codes, enum discriminants, and key shapes are stable | 5 tests |
| `schema_version_guard` | Migration is a no-op when already at target version | 3 tests |
| `config_preservation` | ContractConfig and admin survive upgrade | 4 tests |
| `token_allowlist_preservation` | Token allowlist survives upgrade | 3 tests |
| `full_lifecycle` | Group with members + contributions + payout survives upgrade | 3 tests |
| `performance_regression` | Key operations stay within instruction budgets | 3 tests |

**Total: 36 upgrade tests**

## Running Tests

### Locally

```bash
# Run all upgrade tests
cargo test --manifest-path contracts/stellar-save/Cargo.toml upgrade_tests -- --test-threads=1

# Run specific test category
cargo test --manifest-path contracts/stellar-save/Cargo.toml upgrade_tests::upgrade_tests::test_rollback -- --test-threads=1

# Run with verbose output
cargo test --manifest-path contracts/stellar-save/Cargo.toml upgrade_tests -- --test-threads=1 --nocapture
```

### CI/CD

Upgrade tests run automatically on every push and pull request via `.github/workflows/upgrade-tests.yml`:

- Data migration tests
- API compatibility tests  
- Performance regression tests
- Full upgrade test suite
- Contract build verification after tests

## Test Categories Explained

### 1. State Preservation Tests

Verify that all storage entries written before an upgrade remain readable after the upgrade:

- `test_migration_group_data_survives_upgrade` - Group structs
- `test_migration_member_profile_survives_upgrade` - Member profiles
- `test_migration_contribution_record_survives_upgrade` - Contribution records
- `test_migration_group_status_enum_compatibility` - GroupStatus enum discriminants

### 2. API Compatibility Tests

Verify that all public contract functions work correctly with pre-upgrade data:

- `test_api_get_group_missing_returns_error` - Error handling
- `test_api_get_member_count_empty_group` - Member counting
- `test_api_is_member_non_member_returns_false` - Membership checks
- `test_api_get_group_balance_zero_initially` - Balance queries
- `test_api_get_total_groups_reflects_counter` - Counter reads

### 3. Rollback Tests

Verify that rolling back from v2 to v1 leaves the contract in a consistent state:

- `test_rollback_schema_version_returns_to_v1` - Schema version tracking
- `test_rollback_group_data_survives_round_trip` - Group data integrity
- `test_rollback_member_profile_survives_round_trip` - Member data integrity
- `test_rollback_contribution_record_survives_round_trip` - Contribution data integrity
- `test_rollback_removes_only_backfilled_token_configs` - Selective cleanup
- `test_rollback_migration_record_direction` - Audit trail

### 4. Backward Compatibility Tests

Verify that on-chain data formats remain stable across versions:

- `test_backward_compat_error_codes_are_stable` - All 30 error codes
- `test_backward_compat_group_status_discriminants_are_stable` - Enum discriminants
- `test_backward_compat_group_status_round_trip` - Enum serialization
- `test_backward_compat_group_status_storage_encoding_stable` - XDR encoding
- `test_backward_compat_schema_version_constants` - Version constants

### 5. Schema Version Guard Tests

Verify that migrations are idempotent and safe to run multiple times:

- `test_schema_version_guard_apply_noop_when_at_v2` - Apply idempotency
- `test_schema_version_guard_rollback_noop_when_at_v1` - Rollback idempotency
- `test_schema_version_guard_defaults_to_v1_on_fresh_contract` - Default version

### 6. ContractConfig Preservation Tests

Verify that admin configuration survives upgrades:

- `test_config_preservation_contract_config_survives_upgrade` - Config struct
- `test_config_preservation_contract_config_survives_rollback` - Round-trip
- `test_config_preservation_admin_address_unchanged_after_upgrade` - Admin address
- `test_config_preservation_contribution_limits_unchanged_after_upgrade` - Limits

### 7. Token Allowlist Preservation Tests

Verify that token allowlist configuration survives upgrades:

- `test_token_allowlist_survives_upgrade` - Allowlist forward migration
- `test_token_allowlist_survives_rollback` - Allowlist round-trip
- `test_token_allowlist_absent_allowlist_stays_absent_after_upgrade` - Open mode

### 8. Full Lifecycle Tests

Verify that complex multi-entity state survives upgrades:

- `test_full_lifecycle_group_with_members_and_contributions_survives_upgrade` - Complete group
- `test_full_lifecycle_multiple_groups_survive_upgrade` - Multiple groups
- `test_full_lifecycle_mixed_token_configs_after_upgrade` - Mixed configs

### 9. Performance Regression Tests

Verify that key operations complete within instruction budgets:

- `test_perf_get_group_within_budget` - Group reads
- `test_perf_is_member_within_budget` - Membership checks
- `test_perf_get_group_balance_within_budget` - Balance queries

## Migration Framework

The contract uses a version-tracked migration framework (`migration.rs`):

- `SCHEMA_VERSION_KEY` - Persistent storage key for on-chain schema version
- `V1` = 1 - Original contract schema
- `V2` = 2 - Current schema (adds TokenConfig backfill)
- `get_schema_version()` - Returns current on-chain version (defaults to V1)
- `set_schema_version()` - Updates schema version
- `require_admin()` - Admin-gated migration guard
- `save_migration_record()` / `load_migration_record()` - Audit trail

## v1→v2 Migration

The v1→v2 migration (`migrations/v1_to_v2.rs`) performs the following:

**Forward (apply):**
1. Iterates all groups (1..=total_groups)
2. Backfills default XLM TokenConfig for groups without one
3. Stores backfill index for rollback
4. Sets schema version to V2
5. Saves migration record

**Reverse (rollback):**
1. Loads backfill index
2. Removes only backfilled TokenConfig entries
3. Preserves pre-existing TokenConfig entries
4. Sets schema version to V1
5. Saves migration record

Both operations are idempotent and safe to run multiple times.

## Adding New Tests

When adding new upgrade tests:

1. Add test to appropriate category in `src/upgrade_tests.rs`
2. Use helper functions: `seed_group()`, `seed_member()`, `seed_contribution()`, `setup_contract()`
3. Follow naming convention: `test_<category>_<what_is_tested>`
4. Add documentation comment explaining what the test verifies
5. Run locally to verify: `cargo test upgrade_tests`
6. CI will automatically run on PR

## Troubleshooting

### Tests fail with "GroupNotFound"

Ensure you seed the `next_group_id` counter:
```rust
env.storage().persistent().set(&StorageKeyBuilder::next_group_id(), &1u64);
```

### Tests fail with "migration: caller is not admin"

Ensure you call `setup_contract()` to initialize ContractConfig:
```rust
let admin = setup_contract(&env);
```

### Tests fail with "schema version mismatch"

Check that you're calling `v1_to_v2::apply()` or `v1_to_v2::rollback()` correctly and verifying the schema version afterward.

## References

- `src/upgrade_tests.rs` - All upgrade test implementations
- `src/migration.rs` - Migration framework
- `src/migrations/v1_to_v2.rs` - v1→v2 migration implementation
- `src/migration_tests.rs` - Migration framework unit tests
- `.github/workflows/upgrade-tests.yml` - CI workflow
