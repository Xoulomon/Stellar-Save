//! Migration v1 → v2
//!
//! **What changed in v2:**
//! - The `schema_version` field is now tracked in persistent storage via
//!   `SCHEMA_VERSION_KEY` (this migration sets it to `V2`).
//! - Every group that has no `TokenConfig` entry gets a default XLM-native
//!   `TokenConfig` backfilled so downstream code can always assume the key exists.
//!   The XLM token contract address is passed in by the caller (network-specific).
//!
//! **Rollback:**
//! - Removes the `TokenConfig` entries that were backfilled (identified by a
//!   separate backfill-index stored during apply).
//! - Resets `SCHEMA_VERSION_KEY` to `V1`.
//!
//! **Idempotency:**
//! - `apply` is a no-op when `schema_version == V2`.
//! - `rollback` is a no-op when `schema_version == V1`.

use soroban_sdk::{symbol_short, Address, Env, Symbol, Vec};

use crate::{
    group::TokenConfig,
    migration::{
        save_migration_record, set_schema_version, MigrationRecord, V1, V2,
    },
    storage::{GroupKey, StorageKey, StorageKeyBuilder},
};

/// Key that stores the `Vec<u64>` of group IDs that had `TokenConfig` backfilled.
/// Used by rollback to undo only what apply wrote.
const BACKFILL_INDEX_KEY: Symbol = symbol_short!("MIG_BFI");

// ─── Apply ────────────────────────────────────────────────────────────────────

/// Forward migration: v1 → v2.
///
/// # Parameters
/// - `xlm_token_address`: The SEP-41 XLM token contract address for this network.
///   Pass the Stellar Asset Contract (SAC) address for XLM on the target network.
///
/// Iterates all groups (1..=total_groups) and writes a default XLM `TokenConfig`
/// for any group that does not already have one.
pub fn apply(env: &Env, admin: &Address, xlm_token_address: Address) {
    let total: u64 = env
        .storage()
        .persistent()
        .get(&StorageKeyBuilder::total_groups())
        .unwrap_or(0u64);

    let mut backfilled: Vec<u64> = Vec::new(env);

    for group_id in 1..=total {
        let token_key = StorageKey::Group(GroupKey::TokenConfig(group_id));
        if !env.storage().persistent().has(&token_key) {
            let default_config = TokenConfig {
                token_address: xlm_token_address.clone(),
                token_decimals: 7,
            };
            env.storage().persistent().set(&token_key, &default_config);
            backfilled.push_back(group_id);
        }
    }

    // Persist the backfill index so rollback knows what to clean up.
    env.storage()
        .persistent()
        .set(&BACKFILL_INDEX_KEY, &backfilled);

    set_schema_version(env, V2);

    save_migration_record(
        env,
        &MigrationRecord {
            from_version: V1,
            to_version: V2,
            applied_at: env.ledger().timestamp(),
            applied_by: admin.clone(),
        },
    );
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

/// Reverse migration: v2 → v1.
///
/// Removes only the `TokenConfig` entries that were written by `apply`.
/// Groups that already had a `TokenConfig` before the migration are untouched.
pub fn rollback(env: &Env, admin: &Address) {
    let backfilled: Vec<u64> = env
        .storage()
        .persistent()
        .get(&BACKFILL_INDEX_KEY)
        .unwrap_or_else(|| Vec::new(env));

    for group_id in backfilled.iter() {
        let token_key = StorageKey::Group(GroupKey::TokenConfig(group_id));
        env.storage().persistent().remove(&token_key);
    }

    env.storage().persistent().remove(&BACKFILL_INDEX_KEY);

    set_schema_version(env, V1);

    save_migration_record(
        env,
        &MigrationRecord {
            from_version: V2,
            to_version: V1,
            applied_at: env.ledger().timestamp(),
            applied_by: admin.clone(),
        },
    );
}
