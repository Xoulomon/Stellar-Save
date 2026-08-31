use crate::error::StellarSaveError;
use crate::events::EventEmitter;
use crate::group::{Group, GroupStatus};
use crate::storage::StorageKeyBuilder;
use soroban_sdk::Env;

/// Proposes a new contribution amount for the next cycle.
/// Only the group creator can propose; the group must allow dynamic contributions.
pub fn propose_contribution_change(
    env: Env,
    group_id: u64,
    new_amount: i128,
) -> Result<(), StellarSaveError> {
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    group.creator.require_auth();

    if !group.allow_dynamic_contributions {
        return Err(StellarSaveError::InvalidState);
    }

    if group.status != GroupStatus::Active {
        return Err(StellarSaveError::InvalidState);
    }

    if new_amount <= 0 {
        return Err(StellarSaveError::InvalidAmount);
    }

    // Store the proposal and reset votes
    let proposal_key = StorageKeyBuilder::contribution_pending_amount(group_id);
    env.storage().persistent().set(&proposal_key, &new_amount);

    let vote_key = StorageKeyBuilder::contribution_amount_vote_count(group_id);
    env.storage().persistent().set(&vote_key, &0u32);

    // Emit event
    let timestamp = env.ledger().timestamp();
    EventEmitter::emit_contribution_amount_proposed(
        &env,
        group_id,
        group.creator.clone(),
        group.contribution_amount,
        new_amount,
        timestamp,
    );

    Ok(())
}
