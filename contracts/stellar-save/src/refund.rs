use crate::contribution::ContributionRecord;
use crate::error::StellarSaveError;
use crate::events::EventEmitter;
use crate::group::{Group, GroupStatus};
use crate::storage::StorageKeyBuilder;
use soroban_sdk::{contracttype, Address, Env};

/// Record of a processed refund.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefundRecord {
    pub group_id: u64,
    pub member: Address,
    pub cycle: u32,
    pub amount: i128,
    pub refunded_at: u64,
}

/// Request a refund for a contribution.
///
/// Refund is allowed when:
/// - Group is `Pending` or `Cancelled` (never fully activated), OR
/// - Group is `Active`/`Paused` but no payout has been processed for this cycle yet.
///
/// The `caller` must be the contributor themselves or the group creator.
/// The XLM token address must be stored under the `ContractConfig` key.
pub fn request_refund(
    env: &Env,
    group_id: u64,
    cycle: u32,
    caller: Address,
) -> Result<RefundRecord, StellarSaveError> {
    caller.require_auth();

    // Load group
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group: Group = env
        .storage()
        .persistent()
        .get(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Load group status (default Pending if not set)
    let status_key = StorageKeyBuilder::group_status(group_id);
    let status: GroupStatus = env
        .storage()
        .persistent()
        .get(&status_key)
        .unwrap_or(GroupStatus::Pending);

    // Look up the contribution for the caller
    let contrib_key =
        StorageKeyBuilder::contribution_individual(group_id, cycle, caller.clone());
    let contribution: ContributionRecord = env
        .storage()
        .persistent()
        .get(&contrib_key)
        .ok_or(StellarSaveError::ContributionNotFound)?;

    // Verify caller is authorized: must be the contributor or the group creator
    if caller != contribution.member_address && caller != group.creator {
        return Err(StellarSaveError::Unauthorized);
    }

    // Check not already refunded
    let refund_key =
        StorageKeyBuilder::refund_record(group_id, cycle, contribution.member_address.clone());
    if env.storage().persistent().has(&refund_key) {
        return Err(StellarSaveError::AlreadyRefunded);
    }

    // Check refund eligibility based on group status and payout state
    let payout_status_key = StorageKeyBuilder::payout_status(group_id, cycle);
    let payout_processed: bool = env
        .storage()
        .persistent()
        .get(&payout_status_key)
        .unwrap_or(false);

    let eligible = match status {
        GroupStatus::Pending | GroupStatus::Cancelled => true,
        GroupStatus::Active | GroupStatus::Paused => !payout_processed,
        GroupStatus::Completed => false,
    };

    if !eligible {
        return Err(StellarSaveError::RefundNotEligible);
    }

    let amount = contribution.amount;
    let now = env.ledger().timestamp();

    // Transfer funds back to the contributor via the group's token contract
    let token_config_key = StorageKeyBuilder::group_token_config(group_id);
    let token_config: crate::group::TokenConfig = env
        .storage()
        .persistent()
        .get(&token_config_key)
        .ok_or(StellarSaveError::GroupNotFound)?;
    let token_client =
        soroban_sdk::token::TokenClient::new(env, &token_config.token_address);
    token_client.transfer(
        &env.current_contract_address(),
        &contribution.member_address,
        &amount,
    );

    // Persist the refund record
    let record = RefundRecord {
        group_id,
        member: contribution.member_address.clone(),
        cycle,
        amount,
        refunded_at: now,
    };
    env.storage().persistent().set(&refund_key, &record);

    // Emit RefundIssued event
    EventEmitter::emit_refund_issued(
        env,
        group_id,
        contribution.member_address,
        amount,
        cycle,
        now,
    );

    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::group::GroupStatus;
    use crate::storage::StorageKeyBuilder;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn setup_group(env: &Env, group_id: u64, creator: &Address) {
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            3,
            env.ledger().timestamp(),
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
    }

    fn set_status(env: &Env, group_id: u64, status: GroupStatus) {
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &status);
    }

    fn store_contribution(env: &Env, group_id: u64, cycle: u32, member: &Address, amount: i128) {
        let record = ContributionRecord::new(
            member.clone(),
            group_id,
            cycle,
            amount,
            env.ledger().timestamp(),
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone()),
            &record,
        );
    }

    #[test]
    fn test_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        assert_eq!(
            request_refund(&env, 999, 0, member),
            Err(StellarSaveError::GroupNotFound)
        );
    }

    #[test]
    fn test_contribution_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        setup_group(&env, 1, &creator);
        set_status(&env, 1, GroupStatus::Pending);
        assert_eq!(
            request_refund(&env, 1, 0, member),
            Err(StellarSaveError::ContributionNotFound)
        );
    }

    #[test]
    fn test_already_refunded() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        setup_group(&env, 1, &creator);
        set_status(&env, 1, GroupStatus::Pending);
        store_contribution(&env, 1, 0, &member, 10_000_000);

        // Pre-store refund record
        let existing = RefundRecord {
            group_id: 1,
            member: member.clone(),
            cycle: 0,
            amount: 10_000_000,
            refunded_at: 0,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::refund_record(1, 0, member.clone()),
            &existing,
        );

        assert_eq!(
            request_refund(&env, 1, 0, member),
            Err(StellarSaveError::AlreadyRefunded)
        );
    }

    #[test]
    fn test_completed_group_not_eligible() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        setup_group(&env, 1, &creator);
        set_status(&env, 1, GroupStatus::Completed);
        store_contribution(&env, 1, 0, &member, 10_000_000);
        assert_eq!(
            request_refund(&env, 1, 0, member),
            Err(StellarSaveError::RefundNotEligible)
        );
    }

    #[test]
    fn test_active_group_with_payout_not_eligible() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        setup_group(&env, 1, &creator);
        set_status(&env, 1, GroupStatus::Active);
        store_contribution(&env, 1, 0, &member, 10_000_000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_status(1, 0), &true);
        assert_eq!(
            request_refund(&env, 1, 0, member),
            Err(StellarSaveError::RefundNotEligible)
        );
    }

    #[test]
    fn test_cancelled_group_eligible_before_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        setup_group(&env, 1, &creator);
        set_status(&env, 1, GroupStatus::Cancelled);
        store_contribution(&env, 1, 0, &member, 10_000_000);

        // Without a token contract registered, the call panics at the transfer step.
        // We verify eligibility by checking that the error is NOT RefundNotEligible,
        // AlreadyRefunded, or ContributionNotFound — those checks happen before transfer.
        // We use a missing XLM config to trigger a controlled panic path.
        // This test documents that eligibility passes for Cancelled groups.
        // Full integration tests with a mock token contract cover the happy path.
        let result = request_refund(&env, 1, 0, member.clone());
        match result {
            Err(StellarSaveError::RefundNotEligible) => {
                panic!("Cancelled group should be eligible for refund")
            }
            Err(StellarSaveError::AlreadyRefunded) => panic!("Should not be already refunded"),
            Err(StellarSaveError::ContributionNotFound) => {
                panic!("Contribution should exist")
            }
            _ => {} // Ok or panic at token transfer — both acceptable here
        }
    }
}
