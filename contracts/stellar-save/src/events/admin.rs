use soroban_sdk::{contracttype, Address, Env, String};

pub const ADMIN_SCHEMA_VERSION: u32 = 1;

/// Event emitted when contract is paused.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractPaused {
    pub schema_version: u32,
    pub admin: Address,
    pub timestamp: u64,
}

/// Event emitted when contract is unpaused.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractUnpaused {
    pub schema_version: u32,
    pub admin: Address,
    pub timestamp: u64,
}

/// Event emitted when the contract binary is upgraded to a new version.
///
/// Centralising this type in the admin domain ensures all upgrade callers
/// emit a consistent shape (Issue #73).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractUpgraded {
    pub schema_version: u32,
    pub upgraded_by: Address,
    pub old_version: u32,
    pub new_version: u32,
    pub upgraded_at: u64,
}

// ── Emitters ──────────────────────────────────────────────────────────────────

pub fn emit_contract_paused(env: &Env, admin: Address, timestamp: u64) {
    env.events().publish(
        ("contract_paused",),
        ContractPaused {
            schema_version: ADMIN_SCHEMA_VERSION,
            admin,
            timestamp,
        },
    );
}

pub fn emit_contract_unpaused(env: &Env, admin: Address, timestamp: u64) {
    env.events().publish(
        ("contract_unpaused",),
        ContractUnpaused {
            schema_version: ADMIN_SCHEMA_VERSION,
            admin,
            timestamp,
        },
    );
}

pub fn emit_contract_upgraded(
    env: &Env,
    upgraded_by: Address,
    old_version: u32,
    new_version: u32,
    upgraded_at: u64,
) {
    env.events().publish(
        ("contract_upgraded",),
        ContractUpgraded {
            schema_version: ADMIN_SCHEMA_VERSION,
            upgraded_by,
            old_version,
            new_version,
            upgraded_at,
        },
    );
}

pub fn emit_dispute_raised(
    env: &Env,
    group_id: u64,
    raised_by: Address,
    reason: String,
    vote_count: u32,
    threshold: u32,
    auto_paused: bool,
    raised_at: u64,
) {
    env.events().publish(
        ("dispute_raised",),
        (
            group_id,
            raised_by,
            reason,
            vote_count,
            threshold,
            auto_paused,
            raised_at,
        ),
    );
}

pub fn emit_dispute_resolved(
    env: &Env,
    group_id: u64,
    resolved_by: Address,
    resolution: String,
    resolved_at: u64,
) {
    env.events().publish(
        ("dispute_resolved",),
        (group_id, resolved_by, resolution, resolved_at),
    );
}
