//! Auto-contribution feature tests.
//!
//! Tests for the auto-contribution feature:
//! - enable_auto_contribute / disable_auto_contribute
//! - is_auto_contribute_enabled
//! - execute_auto_contributions
//! - Edge cases: insufficient balance, insufficient allowance, already contributed,
//!   non-member, inactive group, idempotent enable/disable.
//!
//! These tests call contract functions directly (not via the generated client)
//! to match the pattern used throughout this codebase.

#![cfg(test)]

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env, Vec,
};

use crate::{
    group::{Group, GroupStatus, TokenConfig},
    MemberProfile, StellarSaveContract, StellarSaveError, StorageKeyBuilder,
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const CONTRIBUTION_AMOUNT: i128 = 1_000_000;
const CYCLE_DURATION: u64 = 3600;
const MAX_MEMBERS: u32 = 2;
const GRACE_PERIOD: u64 = 0;

/// Deploy a mock SEP-41 token (Stellar Asset Contract) and return its address.
fn deploy_mock_token(env: &Env) -> Address {
    let admin = Address::generate(env);
    env.register_stellar_asset_contract_v2(admin).address()
}

/// Set up an active group with two members in storage.
/// Returns (group_id, token_address, creator, member).
fn setup_active_group(env: &Env) -> (u64, Address, Address, Address) {
    let creator = Address::generate(env);
    let member = Address::generate(env);
    let token = deploy_mock_token(env);
    let group_id = 1u64;

    // Mint tokens to both participants
    let sac = StellarAssetClient::new(env, &token);
    sac.mint(&creator, &10_000_000i128);
    sac.mint(&member, &10_000_000i128);

    // Store group
    let group = Group::new(
        group_id,
        creator.clone(),
        CONTRIBUTION_AMOUNT,
        CYCLE_DURATION,
        MAX_MEMBERS,
        2,
        env.ledger().timestamp(),
        GRACE_PERIOD,
    );
    let mut active_group = group;
    active_group.status = GroupStatus::Active;
    active_group.started = true;
    active_group.member_count = 2;
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::group_data(group_id), &active_group);
    env.storage().persistent().set(
        &StorageKeyBuilder::group_status(group_id),
        &GroupStatus::Active,
    );

    // Store token config
    let token_config = TokenConfig {
        token_address: token.clone(),
        token_decimals: 7,
    };
    env.storage().persistent().set(
        &StorageKeyBuilder::group_token_config(group_id),
        &token_config,
    );

    // Store member profiles
    let creator_profile = MemberProfile {
        address: creator.clone(),
        group_id,
        payout_position: 0,
        joined_at: env.ledger().timestamp(),
        auto_contribute_enabled: false,
    };
    let member_profile = MemberProfile {
        address: member.clone(),
        group_id,
        payout_position: 1,
        joined_at: env.ledger().timestamp(),
        auto_contribute_enabled: false,
    };
    env.storage().persistent().set(
        &StorageKeyBuilder::member_profile(group_id, creator.clone()),
        &creator_profile,
    );
    env.storage().persistent().set(
        &StorageKeyBuilder::member_profile(group_id, member.clone()),
        &member_profile,
    );
    env.storage().persistent().set(
        &StorageKeyBuilder::member_payout_eligibility(group_id, creator.clone()),
        &0u32,
    );
    env.storage().persistent().set(
        &StorageKeyBuilder::member_payout_eligibility(group_id, member.clone()),
        &1u32,
    );

    // Store member list
    let mut members = Vec::new(env);
    members.push_back(creator.clone());
    members.push_back(member.clone());
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::group_members(group_id), &members);

    (group_id, token, creator, member)
}

/// Approve the contract to spend `amount` tokens on behalf of `owner`.
fn approve(env: &Env, token: &Address, owner: &Address, spender: &Address, amount: i128) {
    let token_client = TokenClient::new(env, token);
    let expiry = env.ledger().sequence() + 10_000;
    token_client.approve(owner, spender, &amount, &expiry);
}

// ---------------------------------------------------------------------------
// enable_auto_contribute tests
// ---------------------------------------------------------------------------

#[test]
fn test_enable_auto_contribute_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, member) = setup_active_group(&env);

    // Initially disabled
    let enabled =
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap();
    assert!(!enabled);

    // Enable
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // Now enabled
    let enabled =
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap();
    assert!(enabled);
}

#[test]
fn test_enable_auto_contribute_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, member) = setup_active_group(&env);

    // Enable twice — should not error
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    let enabled =
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap();
    assert!(enabled);
}

#[test]
fn test_enable_auto_contribute_group_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let member = Address::generate(&env);

    let result = StellarSaveContract::enable_auto_contribute(env.clone(), 999, member.clone());
    assert_eq!(result, Err(StellarSaveError::GroupNotFound));
}

#[test]
fn test_enable_auto_contribute_group_not_active() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let member = Address::generate(&env);
    let token = deploy_mock_token(&env);
    let group_id = 1u64;

    // Create group in Pending state
    let group = Group::new(
        group_id,
        creator.clone(),
        CONTRIBUTION_AMOUNT,
        CYCLE_DURATION,
        MAX_MEMBERS,
        2,
        env.ledger().timestamp(),
        GRACE_PERIOD,
    );
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::group_data(group_id), &group);
    env.storage().persistent().set(
        &StorageKeyBuilder::group_status(group_id),
        &GroupStatus::Pending,
    );
    let token_config = TokenConfig {
        token_address: token,
        token_decimals: 7,
    };
    env.storage().persistent().set(
        &StorageKeyBuilder::group_token_config(group_id),
        &token_config,
    );

    // Store member profile
    let profile = MemberProfile {
        address: member.clone(),
        group_id,
        payout_position: 0,
        joined_at: 0,
        auto_contribute_enabled: false,
    };
    env.storage().persistent().set(
        &StorageKeyBuilder::member_profile(group_id, member.clone()),
        &profile,
    );

    // Should fail: group is Pending, not Active
    let result = StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone());
    assert_eq!(result, Err(StellarSaveError::InvalidState));
}

#[test]
fn test_enable_auto_contribute_not_member() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, _member) = setup_active_group(&env);
    let outsider = Address::generate(&env);

    let result = StellarSaveContract::enable_auto_contribute(env.clone(), group_id, outsider);
    assert_eq!(result, Err(StellarSaveError::NotMember));
}

// ---------------------------------------------------------------------------
// disable_auto_contribute tests
// ---------------------------------------------------------------------------

#[test]
fn test_disable_auto_contribute_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, member) = setup_active_group(&env);

    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    let enabled =
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap();
    assert!(enabled);

    StellarSaveContract::disable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    let enabled =
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap();
    assert!(!enabled);
}

#[test]
fn test_disable_auto_contribute_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, member) = setup_active_group(&env);

    // Disable when already disabled — should not error
    StellarSaveContract::disable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    StellarSaveContract::disable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    let enabled =
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap();
    assert!(!enabled);
}

#[test]
fn test_disable_auto_contribute_group_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let member = Address::generate(&env);

    let result = StellarSaveContract::disable_auto_contribute(env.clone(), 999, member.clone());
    assert_eq!(result, Err(StellarSaveError::GroupNotFound));
}

#[test]
fn test_disable_auto_contribute_not_member() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, _member) = setup_active_group(&env);
    let outsider = Address::generate(&env);

    let result = StellarSaveContract::disable_auto_contribute(env.clone(), group_id, outsider);
    assert_eq!(result, Err(StellarSaveError::NotMember));
}

// ---------------------------------------------------------------------------
// execute_auto_contributions — happy path
// ---------------------------------------------------------------------------

#[test]
fn test_execute_auto_contributions_single_member() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, _creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    // Enable auto-contribute for member
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // Approve contract to spend member's tokens
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT);

    let token_client = TokenClient::new(&env, &token);
    let balance_before = token_client.balance(&member);

    // Execute auto-contributions
    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 1);

    // Verify token was transferred
    let balance_after = token_client.balance(&member);
    assert_eq!(balance_before - balance_after, CONTRIBUTION_AMOUNT);

    // Verify contribution was recorded
    let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
    assert!(env.storage().persistent().has(&contrib_key));
}

#[test]
fn test_execute_auto_contributions_multiple_members() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    // Enable auto-contribute for both members
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, creator.clone()).unwrap();
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // Approve contract for both
    approve(&env, &token, &creator, &contract_id, CONTRIBUTION_AMOUNT);
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT);

    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 2);

    // Both contributions recorded
    let contrib_key_creator =
        StorageKeyBuilder::contribution_individual(group_id, 0, creator.clone());
    let contrib_key_member =
        StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
    assert!(env.storage().persistent().has(&contrib_key_creator));
    assert!(env.storage().persistent().has(&contrib_key_member));
}

#[test]
fn test_execute_auto_contributions_skips_non_opted_in() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    // Only member opts in (creator does not)
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT);

    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 1);

    // Creator's contribution NOT recorded
    let contrib_key_creator =
        StorageKeyBuilder::contribution_individual(group_id, 0, creator.clone());
    assert!(!env.storage().persistent().has(&contrib_key_creator));
}

#[test]
fn test_execute_auto_contributions_skips_already_contributed() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, _creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    // Enable auto-contribute and approve
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT * 2);

    // Manually record a contribution for cycle 0 (simulating prior manual contribution)
    let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
    let record =
        crate::ContributionRecord::new(member.clone(), group_id, 0, CONTRIBUTION_AMOUNT, 0);
    env.storage().persistent().set(&contrib_key, &record);

    // execute_auto_contributions should skip member (already contributed)
    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 0);
}

#[test]
fn test_execute_auto_contributions_returns_zero_when_none_opted_in() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, _member) = setup_active_group(&env);

    // No one opted in
    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 0);
}

// ---------------------------------------------------------------------------
// execute_auto_contributions — insufficient balance / allowance (soft failures)
// ---------------------------------------------------------------------------

#[test]
fn test_execute_auto_contributions_insufficient_balance_soft_fail() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    // Enable auto-contribute
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // Approve a large allowance but drain the member's balance to 0
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT);
    let token_client = TokenClient::new(&env, &token);
    let balance = token_client.balance(&member);
    token_client.transfer(&member, &creator, &balance);
    assert_eq!(token_client.balance(&member), 0);

    // execute_auto_contributions should soft-fail for this member
    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 0);

    // Contribution NOT recorded
    let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
    assert!(!env.storage().persistent().has(&contrib_key));
}

#[test]
fn test_execute_auto_contributions_insufficient_allowance_soft_fail() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, member) = setup_active_group(&env);

    // Enable auto-contribute but do NOT approve any allowance
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // execute_auto_contributions should soft-fail (no allowance)
    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 0);

    // Contribution NOT recorded
    let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
    assert!(!env.storage().persistent().has(&contrib_key));
}

#[test]
fn test_execute_auto_contributions_partial_success() {
    // creator has balance + allowance → succeeds
    // member has no allowance → soft-fails
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, creator.clone()).unwrap();
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // Only approve for creator
    approve(&env, &token, &creator, &contract_id, CONTRIBUTION_AMOUNT);
    // member has no allowance

    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 1);

    // Creator's contribution recorded
    let contrib_key_creator =
        StorageKeyBuilder::contribution_individual(group_id, 0, creator.clone());
    assert!(env.storage().persistent().has(&contrib_key_creator));

    // Member's contribution NOT recorded
    let contrib_key_member =
        StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
    assert!(!env.storage().persistent().has(&contrib_key_member));
}

// ---------------------------------------------------------------------------
// execute_auto_contributions — error cases
// ---------------------------------------------------------------------------

#[test]
fn test_execute_auto_contributions_group_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let result = StellarSaveContract::execute_auto_contributions(env.clone(), 999);
    assert_eq!(result, Err(StellarSaveError::GroupNotFound));
}

#[test]
fn test_execute_auto_contributions_group_not_active() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token = deploy_mock_token(&env);
    let group_id = 1u64;

    // Create group in Pending state
    let group = Group::new(
        group_id,
        creator.clone(),
        CONTRIBUTION_AMOUNT,
        CYCLE_DURATION,
        MAX_MEMBERS,
        2,
        env.ledger().timestamp(),
        GRACE_PERIOD,
    );
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::group_data(group_id), &group);
    env.storage().persistent().set(
        &StorageKeyBuilder::group_status(group_id),
        &GroupStatus::Pending,
    );
    let token_config = TokenConfig {
        token_address: token,
        token_decimals: 7,
    };
    env.storage().persistent().set(
        &StorageKeyBuilder::group_token_config(group_id),
        &token_config,
    );

    let result = StellarSaveContract::execute_auto_contributions(env.clone(), group_id);
    assert_eq!(result, Err(StellarSaveError::InvalidState));
}

// ---------------------------------------------------------------------------
// enable → disable → re-enable cycle
// ---------------------------------------------------------------------------

#[test]
fn test_enable_disable_reenable_cycle() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, _creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    // Enable
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    assert!(
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap()
    );

    // Disable
    StellarSaveContract::disable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    assert!(!StellarSaveContract::is_auto_contribute_enabled(
        env.clone(),
        group_id,
        member.clone()
    )
    .unwrap());

    // Re-enable
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    assert!(
        StellarSaveContract::is_auto_contribute_enabled(env.clone(), group_id, member.clone())
            .unwrap()
    );

    // Approve and execute — should work after re-enable
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT);
    let count = StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();
    assert_eq!(count, 1);
}

// ---------------------------------------------------------------------------
// MemberProfile field persistence
// ---------------------------------------------------------------------------

#[test]
fn test_member_profile_auto_contribute_field_persisted() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, _token, _creator, member) = setup_active_group(&env);

    // Initially false in profile
    let profile: MemberProfile = env
        .storage()
        .persistent()
        .get(&StorageKeyBuilder::member_profile(group_id, member.clone()))
        .unwrap();
    assert!(!profile.auto_contribute_enabled);

    // Enable
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // Profile now reflects true
    let profile: MemberProfile = env
        .storage()
        .persistent()
        .get(&StorageKeyBuilder::member_profile(group_id, member.clone()))
        .unwrap();
    assert!(profile.auto_contribute_enabled);

    // Disable
    StellarSaveContract::disable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();

    // Profile now reflects false
    let profile: MemberProfile = env
        .storage()
        .persistent()
        .get(&StorageKeyBuilder::member_profile(group_id, member.clone()))
        .unwrap();
    assert!(!profile.auto_contribute_enabled);
}

// ---------------------------------------------------------------------------
// Contribution recorded correctly after auto-execution
// ---------------------------------------------------------------------------

#[test]
fn test_auto_contribution_recorded_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, _creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT);

    StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();

    // Verify contribution record exists in storage
    let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
    let record: Option<crate::ContributionRecord> = env.storage().persistent().get(&contrib_key);
    assert!(record.is_some());
    let record = record.unwrap();
    assert_eq!(record.amount, CONTRIBUTION_AMOUNT);
    assert_eq!(record.group_id, group_id);
    assert_eq!(record.cycle_number, 0);
    assert_eq!(record.member_address, member);
}

// ---------------------------------------------------------------------------
// Cycle total updated after auto-execution
// ---------------------------------------------------------------------------

#[test]
fn test_auto_contribution_updates_cycle_total() {
    let env = Env::default();
    env.mock_all_auths();
    let (group_id, token, creator, member) = setup_active_group(&env);
    let contract_id = env.current_contract_address();

    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, creator.clone()).unwrap();
    StellarSaveContract::enable_auto_contribute(env.clone(), group_id, member.clone()).unwrap();
    approve(&env, &token, &creator, &contract_id, CONTRIBUTION_AMOUNT);
    approve(&env, &token, &member, &contract_id, CONTRIBUTION_AMOUNT);

    StellarSaveContract::execute_auto_contributions(env.clone(), group_id).unwrap();

    // Cycle total should be 2 × CONTRIBUTION_AMOUNT
    let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, 0);
    let total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
    assert_eq!(total, CONTRIBUTION_AMOUNT * 2);

    // Contributor count should be 2
    let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, 0);
    let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
    assert_eq!(count, 2);
}
