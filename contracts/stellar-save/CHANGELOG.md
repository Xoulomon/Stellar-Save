# Changelog — contracts/stellar-save

All notable changes to the `stellar-save` Soroban smart contract are documented
here. This file follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format. Versions align with the workspace `Cargo.toml` version and correspond to
Git tags prefixed with `contracts/`.

> **Auto-generation note:** Starting with v0.2.0 this file will be updated
> automatically on every tagged release by `.github/workflows/changelog.yml`.
> Until then, entries are backfilled manually from commit history and related
> issue work.

---

## [Unreleased]

### Added
- `get_current_timestamp` — canonical, auditable time source exposed as a
  public contract entry point.

---

## [0.1.0] — 2026-08-28

Initial release of the `stellar-save` Soroban contract on testnet and mainnet.

### Added

#### Core ROSCA functionality
- `create_group(contribution_amount, cycle_duration, max_members)` — creates a
  new savings group and returns its `u64` group ID.
- `join_group(group_id)` — allows any wallet to join an open group up to
  `max_members`.
- `contribute(group_id, member, amount)` — records a member's XLM contribution
  for the current cycle; triggers automatic payout when all members have
  contributed.
- `execute_payout(group_id)` — distributes the full cycle pool to the next
  recipient in rotation order.
- `is_complete(group_id) → bool` — returns `true` once every member has
  received a payout.
- `get_group(group_id) → Group` — reads group configuration and state.
- `list_members(group_id) → Vec<Address>` — returns the ordered member list.
- `is_member(group_id, address) → bool` — membership check.
- `get_contribution_status(group_id, cycle_number) → Vec<(Address, bool)>` —
  per-member contribution status for a cycle.
- `get_group_balance(group_id) → i128` — current escrow balance.

#### Emergency controls (closes #4)
- `pause_group(group_id, caller)` — creator-only halt of contributions and
  payouts.
- `unpause_group(group_id, caller)` — creator-only resumption.

#### Storage schema v2 migration (closes #4)
- `STORAGE_VERSION` constant set to `2`; tracked on-chain under `SCH_VER`.
- `migrate_storage()` (admin-only) and automatic trigger via `update_config()`.
- **v1 → v2 changes:**
  - Initialises emergency-pause flag (`false` by default for all groups).
  - Initialises reentrancy guard (`false` by default).
  - Backfills missing `TokenConfig` entries on existing groups with the XLM SAC
    address and 7 decimal places (XLM default). Backfilled group IDs are stored
    under `MIG_BFI` so the rollback can undo only those entries.
  - Writes a `MigrationRecord` (from/to version, timestamp, admin address).
  - Rollback supported: `rollback_migration()` removes backfilled `TokenConfig`
    entries and resets `SCH_VER` to `1`.
- Migration is idempotent and incremental (safe to re-run on a partially
  migrated instance).
- XLM SAC addresses: testnet
  `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`, mainnet
  `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`.

#### Additional modules shipped in v0.1.0
- **`governance`** — on-chain proposal, voting, and execution engine.
- **`milestones`** — track and enforce group savings milestones.
- **`penalty`** — configurable missed-contribution penalty logic.
- **`search`** — `SearchParams`/`SearchResult` API for group discovery.
- **`clone`** — clone an existing group configuration to a new group.
- **`rating`** — `GroupRating`, `RatingAggregate`, `RatingEntry` reputation
  system.
- **`refund`** — `RefundRecord` and refund disbursement logic.
- **`pool`** — `PoolCalculator` and `PoolInfo` for cycle pool accounting.
- **`zk`** — ZK membership-proof circuit integration (Circom + snarkjs).
- **`events`** — structured on-chain event emission for all state transitions.
- **`repository`** — `GroupRepository` storage abstraction layer.
- **`storage_optimization`** — TTL management and storage-size reduction
  utilities.
- **`payout_executor`** — extended payout scheduling and `AssignmentMode`
  (join-order vs. random vs. voted).

#### Developer tooling
- `cargo tarpaulin` coverage gate: 85 % lines (enforced in CI).
- Property-based tests (`proptest`) for contribution, escrow, governance, and
  insurance modules.
- Fuzz targets under `contracts/stellar-save/fuzz/`.
- Upgrade test suite (`upgrade_tests.rs`) covering data-migration, API
  compatibility, and performance regression categories.
- Mutation testing config (`mutants.toml`, Stryker runner).
- Gas benchmark suite (`gas_benchmark.rs`, `gas_benchmark_tests.rs`).
- Reproducible WASM build verification (`scripts/build_reproducible.sh`,
  `scripts/verify_reproducible_build.sh`).
- Contract size CI gate (`scripts/check_contract_size.sh`).

### Changed
- N/A (initial release).

### Deprecated

#### `contribute()` two-argument overload (relates to #37, #56)
The historical `contribute(group_id, amount)` two-argument form is deprecated
and **will be removed in v0.2.0**. All callers must use the three-argument form:

```rust
// ✅ Current API
contribute(group_id: u64, member: Address, amount: i128)

// ❌ Deprecated — removed in v0.2.0
contribute(group_id: u64, amount: i128)
```

Update call sites before upgrading. The removal commit message will be:

```
feat!: remove deprecated contribute() overload

BREAKING CHANGE: the two-argument form of contribute() is removed.
```

### Removed
- N/A (initial release).

### Fixed
- N/A (initial release).

### Security
- Reentrancy guard added in storage schema v2 prevents re-entrant calls to
  `contribute` and `execute_payout`.
- `require_admin` / `require_creator` / `require_member` auth guards on all
  privileged entry points.
- Storage key enum (`StorageKey`) is exhaustive; no wildcard or string-keyed
  lookups.

---

## Upgrade Notes

### v1 → v2 storage migration
Run the migration script **before** invoking any write functions on a deployed
v1 instance:

```bash
bash scripts/migrate.sh apply \
  --network testnet \
  --contract C<CONTRACT_ID> \
  --admin S<ADMIN_SECRET> \
  --xlm-token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

See [`docs/migration.md`](../../docs/migration.md) and
[`docs/upgrade-guide.md`](../../docs/upgrade-guide.md) for the full runbook,
safety checklist, and rollback procedure.

---

[Unreleased]: https://github.com/Xoulomon/Stellar-Save/compare/contracts/v0.1.0...HEAD
[0.1.0]: https://github.com/Xoulomon/Stellar-Save/releases/tag/contracts/v0.1.0
