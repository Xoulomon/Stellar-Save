//! Penalty System Module
//!
//! Implements penalty logic for missed contributions in the Stellar-Save ROSCA contract.
//!
//! ## Design
//! - Miss 1 cycle  → 5% penalty on the group's contribution amount
//! - Miss 2 cycles → 10% penalty
//! - Each additional miss adds 5%, capped at 25%
//! - Penalties are deducted from the member's deposited balance (held by the contract)
//! - A member can recover by paying the missed contribution + a recovery fee (10% of contribution)
//! - Penalty history is stored per (group_id, member) for auditability

use soroban_sdk::{contracttype, Address, Env};

use crate::{
    error::StellarSaveError,
    events::EventEmitter,
    storage::StorageKeyBuilder,
};

// ─── Type Aliases ─────────────────────────────────────────────────────────────

/// Convenience alias used in contract function signatures.
pub type PenaltyRecordVec = soroban_sdk::Vec<PenaltyRecord>;

// ─── Constants ────────────────────────────────────────────────────────────────

/// Base penalty percentage per missed cycle (5%).
pub const BASE_PENALTY_BPS: u32 = 500; // basis points: 500 = 5%

/// Penalty increment per additional missed cycle (5%).
pub const PENALTY_INCREMENT_BPS: u32 = 500;

/// Maximum penalty cap (25%).
pub const MAX_PENALTY_BPS: u32 = 2500;

/// Recovery fee percentage on top of the missed contribution (10%).
pub const RECOVERY_FEE_BPS: u32 = 1000;

// ─── Data Structures ─────────────────────────────────────────────────────────

/// Configuration for the penalty system, stored per group.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PenaltyConfig {
    /// Base penalty in basis points (default 500 = 5%).
    pub base_penalty_bps: u32,
    /// Increment per additional missed cycle in basis points (default 500 = 5%).
    pub penalty_increment_bps: u32,
    /// Maximum penalty cap in basis points (default 2500 = 25%).
    pub max_penalty_bps: u32,
    /// Recovery fee in basis points on top of missed contribution (default 1000 = 10%).
    pub recovery_fee_bps: u32,
}

impl PenaltyConfig {
    /// Returns the default penalty configuration.
    pub fn default() -> Self {
        PenaltyConfig {
            base_penalty_bps: BASE_PENALTY_BPS,
            penalty_increment_bps: PENALTY_INCREMENT_BPS,
            max_penalty_bps: MAX_PENALTY_BPS,
            recovery_fee_bps: RECOVERY_FEE_BPS,
        }
    }
}

/// A single penalty history entry for a member.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PenaltyRecord {
    /// The cycle in which the contribution was missed.
    pub cycle_id: u32,
    /// Penalty amount deducted in stroops.
    pub amount: i128,
    /// Ledger timestamp when the penalty was applied.
    pub timestamp: u64,
    /// Whether this penalty has been recovered.
    pub recovered: bool,
}

/// Aggregated penalty state for a member within a group.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberPenaltyState {
    /// Total number of cycles missed (not yet recovered).
    pub missed_cycles: u32,
    /// Total penalty amount accumulated (not yet recovered) in stroops.
    pub total_penalty: i128,
}

// ─── Storage Key Helpers ──────────────────────────────────────────────────────
//
// Symbol-based tuple keys stored directly in persistent storage.
// This avoids modifying the existing StorageKey enum.

// ─── Public API ───────────────────────────────────────────────────────────────

/// Calculates the penalty amount for a member given their missed cycle count.
///
/// Pure function — does not read or write storage.
///
/// # Arguments
/// * `contribution_amount` - The group's fixed contribution amount in stroops.
/// * `missed_cycles` - Number of cycles the member has missed (not yet recovered).
/// * `config` - Penalty configuration for the group.
///
/// # Returns
/// Penalty amount in stroops (never exceeds `max_penalty_bps` of `contribution_amount`).
pub fn calculate_penalty(
    contribution_amount: i128,
    missed_cycles: u32,
    config: &PenaltyConfig,
) -> i128 {
    if missed_cycles == 0 || contribution_amount <= 0 {
        return 0;
    }

    // total_bps = base + increment * (missed_cycles - 1), capped at max
    let increments = missed_cycles.saturating_sub(1);
    let raw_bps = config
        .base_penalty_bps
        .saturating_add(config.penalty_increment_bps.saturating_mul(increments));
    let capped_bps = raw_bps.min(config.max_penalty_bps);

    // penalty = contribution_amount * capped_bps / 10_000
    (contribution_amount * capped_bps as i128) / 10_000
}

/// Applies a penalty to a member for missing a contribution in `cycle_id`.
///
/// Steps:
/// 1. Load (or default) penalty config for the group.
/// 2. Load current `MemberPenaltyState`.
/// 3. Calculate penalty amount.
/// 4. Deduct from the group balance counter (the member's share held by contract).
/// 5. Persist updated state and append a `PenaltyRecord`.
/// 6. Emit `PenaltyApplied` event.
///
/// # Errors
/// - `GroupNotFound` if the group doesn't exist.
/// - `NotMember` if the address is not a member of the group.
/// - `Overflow` on arithmetic overflow.
pub fn apply_penalty(
    env: &Env,
    group_id: u64,
    member: Address,
    cycle_id: u32,
) -> Result<i128, StellarSaveError> {
    // 1. Verify group exists and get contribution amount
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group = env
        .storage()
        .persistent()
        .get::<_, crate::group::Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // 2. Verify member belongs to the group
    let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
    if !env.storage().persistent().has(&member_key) {
        return Err(StellarSaveError::NotMember);
    }

    // 3. Load penalty config (use default if not set)
    let config = load_penalty_config(env, group_id);

    // 4. Load current penalty state
    let mut state = load_penalty_state(env, group_id, member.clone());

    // 5. Increment missed cycles
    state.missed_cycles = state.missed_cycles.saturating_add(1);

    // 6. Calculate penalty
    let penalty_amount = calculate_penalty(group.contribution_amount, state.missed_cycles, &config);

    // 7. Deduct from group balance (safe: saturating to avoid underflow)
    if penalty_amount > 0 {
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);
        let new_balance = current_balance.saturating_sub(penalty_amount);
        env.storage().persistent().set(&balance_key, &new_balance);

        // Accumulate total penalty for this member
        state.total_penalty = state
            .total_penalty
            .checked_add(penalty_amount)
            .ok_or(StellarSaveError::Overflow)?;
    }

    // 8. Persist updated state
    save_penalty_state(env, group_id, member.clone(), &state);

    // 9. Append penalty record to history
    append_penalty_record(
        env,
        group_id,
        member.clone(),
        PenaltyRecord {
            cycle_id,
            amount: penalty_amount,
            timestamp: env.ledger().timestamp(),
            recovered: false,
        },
    );

    // 10. Emit event
    EventEmitter::emit_penalty_applied(env, group_id, member, penalty_amount, cycle_id);

    Ok(penalty_amount)
}

/// Allows a member to recover from a penalty by paying the missed contribution
/// plus a recovery fee.
///
/// The caller must have already transferred `missed_contribution + recovery_fee`
/// to the contract (token transfer is handled by the caller / outer function).
/// This function only updates the on-chain state.
///
/// # Arguments
/// * `env` - Soroban environment.
/// * `group_id` - Group ID.
/// * `member` - Member recovering.
/// * `cycle_id` - The cycle being recovered.
/// * `amount_paid` - Total amount paid by the member (contribution + fee).
///
/// # Errors
/// - `GroupNotFound` if the group doesn't exist.
/// - `NotMember` if the address is not a member.
/// - `InvalidAmount` if `amount_paid` is less than the required recovery amount.
/// - `InvalidState` if there is nothing to recover (no missed cycles).
pub fn recover_penalty(
    env: &Env,
    group_id: u64,
    member: Address,
    cycle_id: u32,
    amount_paid: i128,
) -> Result<(), StellarSaveError> {
    // 1. Verify group exists
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group = env
        .storage()
        .persistent()
        .get::<_, crate::group::Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // 2. Verify member
    let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
    if !env.storage().persistent().has(&member_key) {
        return Err(StellarSaveError::NotMember);
    }

    // 3. Load state — must have missed cycles
    let mut state = load_penalty_state(env, group_id, member.clone());
    if state.missed_cycles == 0 {
        return Err(StellarSaveError::InvalidState);
    }

    // 4. Load config and calculate required recovery amount
    let config = load_penalty_config(env, group_id);
    let recovery_fee = (group.contribution_amount * config.recovery_fee_bps as i128) / 10_000;
    let required = group
        .contribution_amount
        .checked_add(recovery_fee)
        .ok_or(StellarSaveError::Overflow)?;

    if amount_paid < required {
        return Err(StellarSaveError::InvalidAmount);
    }

    // 5. Credit the group balance with the recovery payment
    let balance_key = StorageKeyBuilder::group_balance(group_id);
    let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
    let new_balance = current_balance
        .checked_add(amount_paid)
        .ok_or(StellarSaveError::Overflow)?;
    env.storage().persistent().set(&balance_key, &new_balance);

    // 6. Decrement missed cycles and reset accumulated penalty
    state.missed_cycles = state.missed_cycles.saturating_sub(1);
    if state.missed_cycles == 0 {
        state.total_penalty = 0;
    }
    save_penalty_state(env, group_id, member.clone(), &state);

    // 7. Mark the matching history record as recovered
    mark_record_recovered(env, group_id, member.clone(), cycle_id);

    // 8. Emit event
    EventEmitter::emit_penalty_recovered(env, group_id, member, cycle_id);

    Ok(())
}

/// Returns the penalty history for a member in a group.
pub fn get_penalty_history(
    env: &Env,
    group_id: u64,
    member: Address,
) -> soroban_sdk::Vec<PenaltyRecord> {
    let key = penalty_history_key(group_id, member);
    env.storage()
        .persistent()
        .get::<_, soroban_sdk::Vec<PenaltyRecord>>(&key)
        .unwrap_or_else(|| soroban_sdk::Vec::new(env))
}

/// Returns the current penalty state for a member.
pub fn get_penalty_state(
    env: &Env,
    group_id: u64,
    member: Address,
) -> MemberPenaltyState {
    load_penalty_state(env, group_id, member)
}

/// Sets a custom penalty configuration for a group (admin/creator only — caller
/// must enforce authorization before calling this).
pub fn set_penalty_config(env: &Env, group_id: u64, config: PenaltyConfig) {
    let key = penalty_config_storage_key(group_id);
    env.storage().persistent().set(&key, &config);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

fn load_penalty_config(env: &Env, group_id: u64) -> PenaltyConfig {
    let key = penalty_config_storage_key(group_id);
    env.storage()
        .persistent()
        .get::<_, PenaltyConfig>(&key)
        .unwrap_or_else(PenaltyConfig::default)
}

fn load_penalty_state(env: &Env, group_id: u64, member: Address) -> MemberPenaltyState {
    let key = penalty_state_key(group_id, member);
    env.storage()
        .persistent()
        .get::<_, MemberPenaltyState>(&key)
        .unwrap_or(MemberPenaltyState {
            missed_cycles: 0,
            total_penalty: 0,
        })
}

fn save_penalty_state(env: &Env, group_id: u64, member: Address, state: &MemberPenaltyState) {
    let key = penalty_state_key(group_id, member);
    env.storage().persistent().set(&key, state);
}

fn append_penalty_record(env: &Env, group_id: u64, member: Address, record: PenaltyRecord) {
    let key = penalty_history_key(group_id, member);
    let mut history: soroban_sdk::Vec<PenaltyRecord> = env
        .storage()
        .persistent()
        .get::<_, soroban_sdk::Vec<PenaltyRecord>>(&key)
        .unwrap_or_else(|| soroban_sdk::Vec::new(env));
    history.push_back(record);
    env.storage().persistent().set(&key, &history);
}

fn mark_record_recovered(env: &Env, group_id: u64, member: Address, cycle_id: u32) {
    let key = penalty_history_key(group_id, member);
    let mut history: soroban_sdk::Vec<PenaltyRecord> = env
        .storage()
        .persistent()
        .get::<_, soroban_sdk::Vec<PenaltyRecord>>(&key)
        .unwrap_or_else(|| soroban_sdk::Vec::new(env));

    // Find the first unrecovered record for this cycle and mark it recovered
    let len = history.len();
    for i in 0..len {
        let mut rec = history.get(i).unwrap();
        if rec.cycle_id == cycle_id && !rec.recovered {
            rec.recovered = true;
            history.set(i, rec);
            break;
        }
    }
    env.storage().persistent().set(&key, &history);
}

// ─── Storage Key Constructors ─────────────────────────────────────────────────
//
// We use Symbol-based tuple keys stored directly in persistent storage.
// This avoids modifying the existing StorageKey enum.

use soroban_sdk::Symbol;

fn penalty_config_storage_key(group_id: u64) -> (Symbol, u64) {
    (soroban_sdk::symbol_short!("pen_cfg"), group_id)
}

fn penalty_state_key(group_id: u64, member: Address) -> (Symbol, u64, Address) {
    (soroban_sdk::symbol_short!("pen_st"), group_id, member)
}

fn penalty_history_key(group_id: u64, member: Address) -> (Symbol, u64, Address) {
    (soroban_sdk::symbol_short!("pen_hi"), group_id, member)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn default_config() -> PenaltyConfig {
        PenaltyConfig::default()
    }

    #[test]
    fn test_calculate_penalty_zero_missed() {
        let cfg = default_config();
        assert_eq!(calculate_penalty(100_000_000, 0, &cfg), 0);
    }

    #[test]
    fn test_calculate_penalty_one_miss() {
        let cfg = default_config();
        // 5% of 100_000_000 = 5_000_000
        assert_eq!(calculate_penalty(100_000_000, 1, &cfg), 5_000_000);
    }

    #[test]
    fn test_calculate_penalty_two_misses() {
        let cfg = default_config();
        // 10% of 100_000_000 = 10_000_000
        assert_eq!(calculate_penalty(100_000_000, 2, &cfg), 10_000_000);
    }

    #[test]
    fn test_calculate_penalty_three_misses() {
        let cfg = default_config();
        // 15% of 100_000_000 = 15_000_000
        assert_eq!(calculate_penalty(100_000_000, 3, &cfg), 15_000_000);
    }

    #[test]
    fn test_calculate_penalty_cap() {
        let cfg = default_config();
        // 6 misses would be 30% but cap is 25%
        assert_eq!(calculate_penalty(100_000_000, 6, &cfg), 25_000_000);
        // 10 misses — still capped at 25%
        assert_eq!(calculate_penalty(100_000_000, 10, &cfg), 25_000_000);
    }

    #[test]
    fn test_calculate_penalty_zero_amount() {
        let cfg = default_config();
        assert_eq!(calculate_penalty(0, 3, &cfg), 0);
    }

    #[test]
    fn test_penalty_config_default() {
        let cfg = PenaltyConfig::default();
        assert_eq!(cfg.base_penalty_bps, 500);
        assert_eq!(cfg.penalty_increment_bps, 500);
        assert_eq!(cfg.max_penalty_bps, 2500);
        assert_eq!(cfg.recovery_fee_bps, 1000);
    }
}
