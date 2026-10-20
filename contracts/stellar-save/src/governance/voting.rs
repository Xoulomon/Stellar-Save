//! Governance voting logic.
//!
//! This module is responsible for **validating and recording member votes**.
//! It deliberately does not contain raw `env.storage()` calls — those live in
//! [`super::storage`].  Actual group-state mutations triggered when a vote
//! threshold is met are delegated to [`super::execution`].

use crate::auth;
use crate::error::StellarSaveError;
use crate::governance::{execution, storage as gov_storage};
use crate::group::{Group, GroupStatus};
use crate::storage::StorageKeyBuilder;
use soroban_sdk::{Address, Env};

/// Casts a member's vote to dissolve the group.
///
/// When all members have voted, the group is dissolved: its status is set to
/// `Cancelled` and every member who has **not yet received a payout** is
/// refunded their contributions for the current cycle.
///
/// # Errors
/// - `GroupNotFound`          - Group doesn't exist
/// - `InvalidState`           - Group is not Active or Paused
/// - `NotMember`              - Caller is not a member of the group
/// - `AlreadyVotedDissolve`   - Caller has already voted
/// - `GroupAlreadyDissolved`  - Group is already in a terminal state
/// - `Overflow`               - Vote count overflow (should not occur in practice)
pub fn vote_dissolve(env: Env, group_id: u64, caller: Address) -> Result<(), StellarSaveError> {
    // ── Load group ────────────────────────────────────────────────────────────
    let group_key = StorageKeyBuilder::group_data(group_id);
    let mut group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // ── Validate group status ─────────────────────────────────────────────────
    let status_key = StorageKeyBuilder::group_status(group_id);
    let status: GroupStatus = env
        .storage()
        .persistent()
        .get(&status_key)
        .unwrap_or(GroupStatus::Pending);

    match status {
        GroupStatus::Cancelled | GroupStatus::Completed => {
            return Err(StellarSaveError::GroupAlreadyDissolved);
        }
        GroupStatus::Active | GroupStatus::Paused => {}
        GroupStatus::Pending => return Err(StellarSaveError::InvalidState),
    }

    // Authorization + membership check
    auth::require_member(&env, group_id, &caller)?;

    // ── Check and record vote (idempotency guard) ─────────────────────────────
    if gov_storage::has_voted_dissolve(&env, group_id, &caller) {
        return Err(StellarSaveError::AlreadyVotedDissolve);
    }
    gov_storage::record_dissolve_vote(&env, group_id, &caller);

    // ── Tally ─────────────────────────────────────────────────────────────────
    let vote_count = gov_storage::dissolve_vote_count(&env, group_id);
    let new_count = vote_count
        .checked_add(1)
        .ok_or(StellarSaveError::Overflow)?;
    gov_storage::set_dissolve_vote_count(&env, group_id, new_count);

    // Not unanimous yet — nothing more to do.
    if new_count < group.member_count {
        return Ok(());
    }

    // ── Threshold reached: delegate to execution ──────────────────────────────
    execution::execute_dissolution(&env, group_id, &mut group)
}

/// Casts a member's vote to approve the pending contribution-amount change.
///
/// When a majority (> 50 %) of members approve, the change is applied
/// immediately by [`execution::execute_contribution_change`].
///
/// # Errors
/// - `GroupNotFound`       - Group doesn't exist
/// - `InvalidState`        - Dynamic contributions are disabled or no proposal is open
/// - `NotMember`           - Caller is not a member of the group
/// - `AlreadyContributed`  - Caller has already voted on this proposal
/// - `Overflow`            - Vote count overflow
pub fn vote_contribution_change(
    env: Env,
    group_id: u64,
    member: Address,
) -> Result<(), StellarSaveError> {
    // Authorization checked via auth::require_member below

    // ── Load group ────────────────────────────────────────────────────────────
    let group_key = StorageKeyBuilder::group_data(group_id);
    let mut group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    if !group.allow_dynamic_contributions {
        return Err(StellarSaveError::InvalidState);
    }

    // Authorization + membership check
    auth::require_member(&env, group_id, &member)?;

    // ── Require an open proposal ──────────────────────────────────────────────
    let new_amount = gov_storage::pending_contribution_amount(&env, group_id)
        .ok_or(StellarSaveError::InvalidState)?;

    // ── Check and record vote (idempotency guard) ─────────────────────────────
    if gov_storage::has_voted_contribution_change(&env, group_id, &member) {
        return Err(StellarSaveError::AlreadyContributed);
    }
    gov_storage::record_contribution_vote(&env, group_id, &member);

    // ── Tally ─────────────────────────────────────────────────────────────────
    let vote_count = gov_storage::contribution_vote_count(&env, group_id);
    let new_vote_count = vote_count
        .checked_add(1)
        .ok_or(StellarSaveError::Overflow)?;
    gov_storage::set_contribution_vote_count(&env, group_id, new_vote_count);

    // ── Apply if majority reached (> 50 % of members) ────────────────────────
    let majority = group.member_count / 2 + 1;
    if new_vote_count >= majority {
        execution::execute_contribution_change(&env, group_id, &mut group, new_amount)?;
    }

    Ok(())
}
