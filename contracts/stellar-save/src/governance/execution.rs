use crate::error::StellarSaveError;
use crate::events::EventEmitter;
use crate::group::{Group, GroupStatus};
use crate::storage::StorageKeyBuilder;
use soroban_sdk::{Address, Env, Map};

/// Dissolves a group once every member has voted to dissolve: marks the group
/// `Cancelled` and refunds current-cycle contributions to members who have not
/// yet received a payout.
pub fn execute_dissolution(
    env: &Env,
    group_id: u64,
    group: &mut Group,
) -> Result<(), StellarSaveError> {
    let group_key = StorageKeyBuilder::group_data(group_id);
    let status_key = StorageKeyBuilder::group_status(group_id);

    group.status = GroupStatus::Cancelled;
    group.is_active = false;
    env.storage().persistent().set(&group_key, group);
    env.storage()
        .persistent()
        .set(&status_key, &GroupStatus::Cancelled);

    let token_config_key = StorageKeyBuilder::group_token_config(group_id);
    let token_config: crate::group::TokenConfig = env
        .storage()
        .persistent()
        .get(&token_config_key)
        .ok_or(StellarSaveError::GroupNotFound)?;
    let token_client = soroban_sdk::token::TokenClient::new(env, &token_config.token_address);

    let current_cycle = group.current_cycle;
    let now = env.ledger().timestamp();
    let mut total_refunded: i128 = 0;

    let members_key = StorageKeyBuilder::group_members(group_id);
    let members: Map<u32, Address> = env
        .storage()
        .persistent()
        .get(&members_key)
        .unwrap_or(Map::new(env));

    for (_, member) in members.iter() {
        // Skip members who already received their payout
        let payout_pos_key =
            StorageKeyBuilder::member_payout_eligibility(group_id, member.clone());
        let payout_position: u32 = match env.storage().persistent().get::<_, u32>(&payout_pos_key)
        {
            Some(pos) => pos,
            None => continue,
        };

        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, payout_position);
        let already_paid = env
            .storage()
            .persistent()
            .get::<_, Address>(&recipient_key)
            .map(|r| r == member)
            .unwrap_or(false);

        if already_paid {
            continue;
        }

        // Refund current-cycle contribution if it exists and hasn't been refunded
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, current_cycle, member.clone());
        let refund_amount: i128 = match env
            .storage()
            .persistent()
            .get::<_, crate::contribution::ContributionRecord>(&contrib_key)
        {
            Some(record) => record.amount,
            None => continue,
        };

        let refund_key =
            StorageKeyBuilder::refund_record(group_id, current_cycle, member.clone());
        if env.storage().persistent().has(&refund_key) {
            continue;
        }

        token_client.transfer(&env.current_contract_address(), &member, &refund_amount);

        let refund_record = crate::refund::RefundRecord {
            group_id,
            member: member.clone(),
            cycle: current_cycle,
            amount: refund_amount,
            refunded_at: now,
        };
        env.storage().persistent().set(&refund_key, &refund_record);

        EventEmitter::emit_refund_issued(env, group_id, member, refund_amount, current_cycle, now);

        total_refunded = total_refunded.saturating_add(refund_amount);
    }

    EventEmitter::emit_group_dissolved(env, group_id, now, total_refunded);

    Ok(())
}

/// Applies an approved contribution-amount change: updates the group's
/// contribution amount, clears the pending proposal/vote state, and emits
/// the change event.
pub fn execute_contribution_change(
    env: &Env,
    group_id: u64,
    group: &mut Group,
    new_amount: i128,
) -> Result<(), StellarSaveError> {
    let group_key = StorageKeyBuilder::group_data(group_id);
    let proposal_key = StorageKeyBuilder::contribution_pending_amount(group_id);
    let vote_key = StorageKeyBuilder::contribution_amount_vote_count(group_id);

    let old_amount = group.contribution_amount;
    group.contribution_amount = new_amount;
    env.storage().persistent().set(&group_key, group);

    // Clear proposal and votes
    env.storage().persistent().remove(&proposal_key);
    env.storage().persistent().remove(&vote_key);

    let timestamp = env.ledger().timestamp();
    EventEmitter::emit_contribution_amount_changed(
        env,
        group_id,
        old_amount,
        new_amount,
        group.current_cycle + 1,
        timestamp,
    );

    Ok(())
}
