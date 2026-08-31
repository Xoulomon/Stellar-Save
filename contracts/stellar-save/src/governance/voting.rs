use crate::error::StellarSaveError;
use crate::governance::execution;
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
/// - `GroupNotFound` - Group doesn't exist
/// - `InvalidState` - Group is not Active or Paused
/// - `NotMember` - Caller is not a member of the group
/// - `AlreadyVotedDissolve` - Caller has already voted
/// - `GroupAlreadyDissolved` - Group is already in a terminal state
pub fn vote_dissolve(env: Env, group_id: u64, caller: Address) -> Result<(), StellarSaveError> {
    caller.require_auth();

    let group_key = StorageKeyBuilder::group_data(group_id);
    let mut group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

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

    let member_key = StorageKeyBuilder::member_profile(group_id, caller.clone());
    if !env.storage().persistent().has(&member_key) {
        return Err(StellarSaveError::NotMember);
    }

    let vote_key = StorageKeyBuilder::dissolve_vote(group_id, caller.clone());
    if env.storage().persistent().has(&vote_key) {
        return Err(StellarSaveError::AlreadyVotedDissolve);
    }
    env.storage().persistent().set(&vote_key, &true);

    let count_key = StorageKeyBuilder::dissolve_vote_count(group_id);
    let vote_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
    let new_count = vote_count
        .checked_add(1)
        .ok_or(StellarSaveError::Overflow)?;
    env.storage().persistent().set(&count_key, &new_count);

    // Not unanimous yet — nothing more to do
    if new_count < group.member_count {
        return Ok(());
    }

    execution::execute_dissolution(&env, group_id, &mut group)
}

/// Casts a member's vote to approve the pending contribution amount change.
/// When a majority (> 50%) of members approve, the change is applied immediately.
pub fn vote_contribution_change(
    env: Env,
    group_id: u64,
    member: Address,
) -> Result<(), StellarSaveError> {
    member.require_auth();

    let group_key = StorageKeyBuilder::group_data(group_id);
    let mut group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    if !group.allow_dynamic_contributions {
        return Err(StellarSaveError::InvalidState);
    }

    // Verify member belongs to the group
    let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
    if !env.storage().persistent().has(&member_key) {
        return Err(StellarSaveError::NotMember);
    }

    // Check there is a pending proposal
    let proposal_key = StorageKeyBuilder::contribution_pending_amount(group_id);
    let new_amount: i128 = env
        .storage()
        .persistent()
        .get(&proposal_key)
        .ok_or(StellarSaveError::InvalidState)?;

    // Prevent double voting
    let member_vote_key = StorageKeyBuilder::contribution_member_vote(group_id, member.clone());
    if env.storage().persistent().has(&member_vote_key) {
        return Err(StellarSaveError::AlreadyContributed);
    }
    env.storage().persistent().set(&member_vote_key, &true);

    // Increment vote count
    let vote_key = StorageKeyBuilder::contribution_amount_vote_count(group_id);
    let vote_count: u32 = env.storage().persistent().get(&vote_key).unwrap_or(0);
    let new_vote_count = vote_count
        .checked_add(1)
        .ok_or(StellarSaveError::Overflow)?;
    env.storage().persistent().set(&vote_key, &new_vote_count);

    // Apply change if majority reached (> 50% of members)
    let majority = group.member_count / 2 + 1;
    if new_vote_count >= majority {
        execution::execute_contribution_change(&env, group_id, &mut group, new_amount)?;
    }

    Ok(())
}
