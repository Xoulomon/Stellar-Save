//! Governance storage helpers.
//!
//! Thin wrappers around `StorageKeyBuilder` accessors that keep the raw
//! `env.storage()` calls out of the higher-level voting and execution modules.
//! Each function has a single, clearly-named responsibility.

use crate::storage::StorageKeyBuilder;
use soroban_sdk::{Address, Env};

// ─── Dissolution vote helpers ─────────────────────────────────────────────────

/// Returns the current dissolution-vote count for a group (0 if none yet).
pub fn dissolve_vote_count(env: &Env, group_id: u64) -> u32 {
    let key = StorageKeyBuilder::dissolve_vote_count(group_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Persists the updated dissolution-vote count.
pub fn set_dissolve_vote_count(env: &Env, group_id: u64, count: u32) {
    let key = StorageKeyBuilder::dissolve_vote_count(group_id);
    env.storage().persistent().set(&key, &count);
}

/// Returns `true` if `member` has already cast a dissolution vote.
pub fn has_voted_dissolve(env: &Env, group_id: u64, member: &Address) -> bool {
    let key = StorageKeyBuilder::dissolve_vote(group_id, member.clone());
    env.storage().persistent().has(&key)
}

/// Records that `member` has cast a dissolution vote.
pub fn record_dissolve_vote(env: &Env, group_id: u64, member: &Address) {
    let key = StorageKeyBuilder::dissolve_vote(group_id, member.clone());
    env.storage().persistent().set(&key, &true);
}

// ─── Contribution-amount vote helpers ────────────────────────────────────────

/// Returns the pending proposed contribution amount, or `None` if there is no
/// open proposal.
pub fn pending_contribution_amount(env: &Env, group_id: u64) -> Option<i128> {
    let key = StorageKeyBuilder::contribution_pending_amount(group_id);
    env.storage().persistent().get(&key)
}

/// Returns the current contribution-change vote count (0 if none yet).
pub fn contribution_vote_count(env: &Env, group_id: u64) -> u32 {
    let key = StorageKeyBuilder::contribution_amount_vote_count(group_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Persists the updated contribution-change vote count.
pub fn set_contribution_vote_count(env: &Env, group_id: u64, count: u32) {
    let key = StorageKeyBuilder::contribution_amount_vote_count(group_id);
    env.storage().persistent().set(&key, &count);
}

/// Returns `true` if `member` has already voted on the current contribution
/// proposal.
pub fn has_voted_contribution_change(env: &Env, group_id: u64, member: &Address) -> bool {
    let key = StorageKeyBuilder::contribution_member_vote(group_id, member.clone());
    env.storage().persistent().has(&key)
}

/// Records that `member` has voted on the current contribution-change proposal.
pub fn record_contribution_vote(env: &Env, group_id: u64, member: &Address) {
    let key = StorageKeyBuilder::contribution_member_vote(group_id, member.clone());
    env.storage().persistent().set(&key, &true);
}
