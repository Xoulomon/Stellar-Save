//! # Migration Framework
//!
//! Version-tracked, admin-gated schema migrations for the Stellar-Save contract.
//!
//! ## Design
//! - `SCHEMA_VERSION` key in persistent storage tracks the current on-chain schema.
//! - Each migration has a `from_version` and `to_version`; only the matching
//!   migration runs, preventing double-application.
//! - `migrate(env, admin)` applies the next pending migration.
//! - `rollback(env, admin)` reverses the last applied migration (if reversible).
//! - Both functions are no-ops when the schema is already at the target version.

use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol};

// ─── Storage key ─────────────────────────────────────────────────────────────

/// Persistent storage key for the on-chain schema version.
pub const SCHEMA_VERSION_KEY: Symbol = symbol_short!("SCH_VER");

// ─── Version constants ────────────────────────────────────────────────────────

/// Schema version shipped with the original contract (no `schema_version` field).
pub const V1: u32 = 1;
/// Schema version after the v1→v2 migration (adds `schema_version` to Group,
/// backfills `TokenConfig` defaults for XLM-only groups).
pub const V2: u32 = 2;

/// Latest schema version understood by this binary.
pub const CURRENT_SCHEMA_VERSION: u32 = V2;

// ─── Types ────────────────────────────────────────────────────────────────────

/// Describes a single schema migration step.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationMeta {
    pub from_version: u32,
    pub to_version: u32,
    /// Human-readable description stored on-chain for auditability.
    pub description: soroban_sdk::String,
}

/// Result written to storage after a migration completes.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationRecord {
    pub from_version: u32,
    pub to_version: u32,
    pub applied_at: u64,
    pub applied_by: Address,
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

/// Returns the current on-chain schema version (defaults to V1 if unset).
pub fn get_schema_version(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get::<Symbol, u32>(&SCHEMA_VERSION_KEY)
        .unwrap_or(V1)
}

/// Persists the schema version.
pub fn set_schema_version(env: &Env, version: u32) {
    env.storage()
        .persistent()
        .set(&SCHEMA_VERSION_KEY, &version);
}

/// Storage key for the last migration record (used by rollback).
pub fn migration_record_key(env: &Env) -> soroban_sdk::Symbol {
    let _ = env; // env needed for Symbol construction in no_std
    symbol_short!("MIG_REC")
}

pub fn save_migration_record(env: &Env, record: &MigrationRecord) {
    env.storage()
        .persistent()
        .set(&migration_record_key(env), record);
}

pub fn load_migration_record(env: &Env) -> Option<MigrationRecord> {
    env.storage()
        .persistent()
        .get::<soroban_sdk::Symbol, MigrationRecord>(&migration_record_key(env))
}

// ─── Admin guard ─────────────────────────────────────────────────────────────

use crate::storage::StorageKeyBuilder;
use crate::ContractConfig;

/// Panics if `caller` is not the contract admin.
pub fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let config: ContractConfig = env
        .storage()
        .persistent()
        .get(&StorageKeyBuilder::contract_config())
        .expect("contract not initialised");
    if config.admin != *caller {
        panic!("migration: caller is not admin");
    }
}
