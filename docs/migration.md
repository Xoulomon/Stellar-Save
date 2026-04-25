# Migration Guide

Schema migrations for the Stellar-Save Soroban contract.

---

## Overview

The migration framework tracks an on-chain `schema_version` (stored under the `SCH_VER` persistent key). Each migration step is a Rust module under `contracts/stellar-save/src/migrations/` that exposes `apply` and `rollback` functions. Migrations are admin-gated and idempotent.

```
schema_version (on-chain)
  V1 (default, no key written)
  │
  └─► v1_to_v2::apply()  ──►  V2
                               │
                               └─► v1_to_v2::rollback()  ──►  V1
```

---

## Version History

| Version | Description |
|---------|-------------|
| V1 | Initial schema. Groups may lack a `TokenConfig` entry. |
| V2 | `schema_version` tracked on-chain. All groups guaranteed to have a `TokenConfig` (XLM default backfilled). |

---

## Running a Migration

### Prerequisites

- Stellar CLI installed (`stellar --version`)
- Contract admin secret key
- XLM SAC (Stellar Asset Contract) address for the target network

### Check current schema version

```bash
bash scripts/migrate.sh status \
  --network testnet \
  --contract C<CONTRACT_ID> \
  --admin S<ADMIN_SECRET>
```

### Apply v1 → v2

```bash
bash scripts/migrate.sh apply \
  --network testnet \
  --contract C<CONTRACT_ID> \
  --admin S<ADMIN_SECRET> \
  --xlm-token C<XLM_SAC_ADDRESS>
```

**Mainnet:**

```bash
bash scripts/migrate.sh apply \
  --network mainnet \
  --rpc-url https://soroban-rpc.mainnet.stellar.gateway.fm \
  --contract C<CONTRACT_ID> \
  --admin S<ADMIN_SECRET> \
  --xlm-token C<XLM_SAC_ADDRESS>
```

### Rollback v2 → v1

```bash
bash scripts/migrate.sh rollback \
  --network testnet \
  --contract C<CONTRACT_ID> \
  --admin S<ADMIN_SECRET>
```

> **Note:** Rollback removes only the `TokenConfig` entries that were backfilled by `apply`. Groups that already had a `TokenConfig` before the migration are untouched.

---

## What v1 → v2 Does

1. Reads `total_groups` from storage.
2. For each group ID `1..=total_groups`, checks if a `TokenConfig` entry exists.
3. If missing, writes a default `TokenConfig` with the provided XLM SAC address and 7 decimal places.
4. Saves the list of backfilled group IDs under `MIG_BFI` (used by rollback).
5. Sets `SCH_VER = 2`.
6. Writes a `MigrationRecord` (from/to version, timestamp, admin address).

**Rollback** reverses step 3 for only the groups in `MIG_BFI`, then sets `SCH_VER = 1`.

---

## XLM SAC Addresses

| Network | XLM SAC Address |
|---------|----------------|
| Testnet | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Mainnet | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |

Verify these against the [Stellar Asset Contract documentation](https://developers.stellar.org/docs/tokens/stellar-asset-contract) before running on mainnet.

---

## Safety Checklist

Before running any migration on mainnet:

- [ ] Migration tested on testnet with production-like data volume
- [ ] `status` command confirms current schema version matches expectation
- [ ] Admin key is stored in a secrets manager (not in shell history)
- [ ] Rollback procedure tested on testnet
- [ ] Deployment record artifact from the current contract version is saved
- [ ] At least one reviewer has approved (use GitHub environment gate)

---

## Adding a New Migration

1. Create `contracts/stellar-save/src/migrations/v2_to_v3.rs` with `apply(env, admin, ...)` and `rollback(env, admin)`.
2. Add `pub mod v2_to_v3;` to `migrations/mod.rs`.
3. Update `CURRENT_SCHEMA_VERSION` in `migration.rs` to `V3 = 3`.
4. Add a test module in `migration_tests.rs`.
5. Update this document's version history table.

---

## Running Tests

```bash
cargo test --manifest-path contracts/stellar-save/Cargo.toml migration_tests -- --test-threads=1
```
