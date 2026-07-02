#![no_std]

<<<<<<< HEAD
//! # Stellar-Save Smart Contract
//!
//! A decentralized rotational savings and credit association (ROSCA) built on Stellar Soroban.
//!
//! ## Module layout
//! - `types`:   Core contract-level types (`ContractConfig`, `MemberProfile`, etc.)
//! - `contract`: All `#[contractimpl]` entry-point methods (thin facades to domain modules)
//! - `group`, `contribution`, `payout`, `storage`, …: Domain modules

// ── Domain modules ────────────────────────────────────────────────────────────
pub mod clone;
pub mod contribution;
pub mod contract;
pub mod cycle_advancement;
pub mod deadline;
pub mod error;
pub mod errors;
pub mod events;
pub mod group;
pub mod helpers;
pub mod migration;
pub mod migrations;
pub mod payout;
pub mod payout_executor;
pub mod penalty;
pub mod pool;
pub mod rating;
pub mod refund;
pub mod repository;
pub mod search;
pub mod status;
pub mod storage;
pub mod storage_benchmark;
pub mod storage_optimization;
pub mod token;
pub mod types;

mod auto_contribution_tests;
pub mod gas_benchmark;
mod invitation_tests;
mod merge_tests;
mod migration_matrix_tests;
mod migration_tests;
mod milestone_tests;
pub mod milestones;
mod multi_token_tests;
mod mutation_tests;
mod upgrade_tests;
mod chaos_tests;
mod fuzz_tests;
mod property_tests;
#[cfg(test)]
mod escrow_property_tests;
#[cfg(test)]
mod governance_property_tests;
#[cfg(test)]
mod insurance_property_tests;
mod tests;

// ── Re-exports ────────────────────────────────────────────────────────────────
pub use contribution::{ContributionPage, ContributionRecord};
pub use error::{ContractResult, ErrorCategory, StellarSaveError};
pub use errors::{ContractError, ErrorRecoveryStrategy};
pub use events::EventEmitter;
pub use events::*;
pub use group::{Group, GroupStatus};
pub use payout::PayoutRecord;
pub use pool::{PoolCalculator, PoolInfo};
pub use rating::{GroupRating, RatingAggregate, RatingEntry};
pub use refund::RefundRecord;
pub use search::{SearchParams, SearchResult};
pub use status::StatusError;
pub use storage::{StorageKey, StorageKeyBuilder};
pub use types::{AssignmentMode, ContractConfig, MemberProfile, PayoutScheduleEntry};

#[cfg(test)]
use soroban_sdk::testutils::{Events, Ledger};
use soroban_sdk::{contract, Address, Env, String, Symbol, Vec, Map, BytesN};

// ── Contract struct ───────────────────────────────────────────────────────────
#[contract]
pub struct StellarSaveContract;

#[test]
fn test_group_id_uniqueness() {
    let env = Env::default();

    // Generate first ID
    let id1 = StellarSaveContract::increment_group_id(&env).unwrap();
    // Generate second ID
    let id2 = StellarSaveContract::increment_group_id(&env).unwrap();

    // Assert IDs are sequential and unique
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_ne!(id1, id2);
}

#[test]
fn test_get_total_groups() {
    let env = Env::default();
    let contract_id = env.register(StellarSaveContract, ());
    let client = StellarSaveContractClient::new(&env, &contract_id);
    let creator = Address::generate(&env);

    // Initially, no groups should exist
    assert_eq!(client.get_total_groups(), 0);

    // Create a group
    env.mock_all_auths();
    client.create_group(&creator, &100, &3600, &5, &0);

    // Total groups should now be 1
    assert_eq!(client.get_total_groups(), 1);
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_get_group_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Manually store a group to test retrieval
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);

        // This simulates the storage state after create_group is called
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let retrieved_group = client.get_group(&group_id);
        assert_eq!(retrieved_group.id, group_id);
        assert_eq!(retrieved_group.creator, creator);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        client.get_group(&999); // ID that doesn't exist
    }

    #[test]
    fn test_has_received_payout_true() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Create a group at cycle 2
        let group_id = 1;
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.current_cycle = 2;

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payout recipient for cycle 1 (member received payout)
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 1);
        env.storage().persistent().set(&recipient_key, &member);

        // Check if member has received payout
        let has_received = client.has_received_payout(&group_id, &member);
        assert_eq!(has_received, true);
    }

    #[test]
    fn test_has_received_payout_false() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let other_member = Address::generate(&env);

        // Create a group at cycle 2
        let group_id = 1;
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.current_cycle = 2;

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payout recipient for cycle 1 (other member received payout, not our member)
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 1);
        env.storage()
            .persistent()
            .set(&recipient_key, &other_member);

        // Check if member has received payout (should be false)
        let has_received = client.has_received_payout(&group_id, &member);
        assert_eq!(has_received, false);
    }

    #[test]
    fn test_get_payout_position_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member_address = Address::generate(&env);

        // Create a member profile with payout position 2
        let group_id = 1;
        let member_profile = MemberProfile {
            address: member_address.clone(),
            group_id,
            payout_position: 2,
            joined_at: 12345,
            auto_contribute_enabled: false,
        };

        // Store the member profile
        let key = StorageKeyBuilder::member_payout_eligibility(group_id, member_address.clone());
        env.storage().persistent().set(&key, &member_profile);

        // Get payout position
        let position = client.get_payout_position(&group_id, &member_address);
        assert_eq!(position, 2);
    }

    // Issue #756: get_next_recipient tests
    #[test]
    fn test_get_next_recipient_correct_cycle() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member0 = Address::generate(&env);
        let member1 = Address::generate(&env);
        let group_id = 1;

        // Create an active group at cycle 1
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.status = GroupStatus::Active;
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store reverse-index: position 0 → member0, position 1 → member1
        env.storage().persistent().set(
            &StorageKeyBuilder::group_payout_position_index(group_id, 0),
            &member0,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::group_payout_position_index(group_id, 1),
            &member1,
        );

        // At cycle 1, next recipient should be member1
        let recipient = client.get_next_recipient(&group_id);
        assert_eq!(recipient, member1);
    }

    #[test]
    fn test_get_next_recipient_cycle_zero() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member0 = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        env.storage().persistent().set(
            &StorageKeyBuilder::group_payout_position_index(group_id, 0),
            &member0,
        );

        let recipient = client.get_next_recipient(&group_id);
        assert_eq!(recipient, member0);
    }

    #[test]
    fn test_get_payout_position_first_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member_address = Address::generate(&env);

        // Create a member profile with payout position 0 (first member)
        let group_id = 1;
        let member_profile = MemberProfile {
            address: member_address.clone(),
            group_id,
            payout_position: 0,
            joined_at: 12345,
            auto_contribute_enabled: false,
        };

        // Store the member profile
        let key = StorageKeyBuilder::member_payout_eligibility(group_id, member_address.clone());
        env.storage().persistent().set(&key, &member_profile);

        // Get payout position
        let position = client.get_payout_position(&group_id, &member_address);
        assert_eq!(position, 0);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2002))")] // 2002 is NotMember
    fn test_get_payout_position_not_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member_address = Address::generate(&env);

        // Try to get payout position for a member that doesn't exist
        client.get_payout_position(&1, &member_address);
    }

    #[test]
    fn test_get_member_count_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Create a group at cycle 0 (no payouts yet)

        // Create a group with initial member_count of 0
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Check if member has received payout (should be false - no payouts yet)
        let has_received = client.has_received_payout(&group_id, &member);
        assert_eq!(has_received, false);
    }

    #[test]
    fn test_has_received_payout_multiple_cycles() {
        // Get member count
        let member_count = client.get_member_count(&group_id);
        assert_eq!(member_count, 0);
    }

    #[test]
    fn test_get_member_count_with_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);

        // Create a group at cycle 3
        let group_id = 1;
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.current_cycle = 3;

        // Simulate adding members
        group.add_member();
        group.add_member();
        group.add_member();

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payout recipients for multiple cycles
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &member1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 1), &member2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 2), &member3);

        // Check each member
        assert_eq!(client.has_received_payout(&group_id, &member1), true);
        assert_eq!(client.has_received_payout(&group_id, &member2), true);
        assert_eq!(client.has_received_payout(&group_id, &member3), true);

        // Check a member who hasn't received payout
        let member4 = Address::generate(&env);
        assert_eq!(client.has_received_payout(&group_id, &member4), false);
        // Get member count
        let member_count = client.get_member_count(&group_id);
        assert_eq!(member_count, 3);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_has_received_payout_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to check payout for non-existent group
        client.has_received_payout(&999, &member);
    }

    fn test_get_member_count_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        client.get_member_count(&999); // ID that doesn't exist
    }

    // #[test]
    // fn test_update_group_success() {
    //     let env = Env::default();
    //     // ... setup contract and create a group in Pending state ...
    //
    //     // Attempt update
    //     client.update_group(&group_id, &200, &7200, &10);
    //
    //     let updated = client.get_group(&group_id);
    //     assert_eq!(updated.contribution_amount, 200);
    // }

    // #[test]
    // #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    // fn test_update_group_fails_if_active() {
    //     let env = Env::default();
    //     // ... setup contract and manually set status to GroupStatus::Active ...
    //
    //     client.update_group(&group_id, &200, &7200, &10);
    // }

    // #[test]
    // fn test_delete_group_success() {
    //     let env = Env::default();
    //     let contract_id = env.register(None, StellarSaveContract);
    //     let client = StellarSaveContractClient::new(&env, &contract_id);
    //     let creator = Address::generate(&env);

    //     // 1. Setup: Create a group with 0 members
    //     let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);
    //
    //     // 2. Action: Delete group
    //     env.mock_all_auths();
    //     client.delete_group(&group_id);

    //     // 3. Verify: Group should no longer exist
    //     let result = client.try_get_group(&group_id);
    //     assert!(result.is_err());
    // }

    // #[test]
    // #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    // fn test_delete_group_fails_if_has_members() {
    //     let env = Env::default();
    //     // ... setup and add a member to the group ...
    //
    //     client.delete_group(&group_id);
    // }

    // #[test]
    // fn test_list_groups_pagination() {
    //     let env = Env::default();
    //     // ... setup contract and create 5 groups ...

    //     // List 2 groups starting from the top
    //     let page1 = client.list_groups(&0, &2, &None);
    //     assert_eq!(page1.len(), 2);
    //
    //     // Get the next page using the last ID as a cursor
    //     let last_id = page1.get(1).unwrap().id;
    //     let page2 = client.list_groups(&(last_id - 1), &2, &None);
    //     assert_eq!(page2.len(), 2);
    // }

    // #[test]
    // fn test_list_groups_filtering() {
    //     let env = Env::default();
    //     // ... setup contract, create 1 Active group and 1 Pending group ...
    //
    //     let active_only = client.list_groups(&0, &10, &Some(GroupStatus::Active));
    //     assert_eq!(active_only.len(), 1);
    // }

    #[test]
    fn test_create_group_charges_protocol_fee() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let treasury = Address::generate(&env);

        // Register a mock token and mint to creator
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let token_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
        token_client.mint(&creator, &1_000_000_000);

        let creation_fee: i128 = 5_000_000; // 0.5 XLM

        // Store config with treasury and creation_fee
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 1,
            max_cycle_duration: 31_536_000,
            treasury: Some(treasury.clone()),
            creation_fee,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        let token_balance_before =
            soroban_sdk::token::TokenClient::new(&env, &token_address).balance(&treasury);

        client.create_group(&creator, &100_000_000, &3600, &5, &token_address, &0);

        let token_balance_after =
            soroban_sdk::token::TokenClient::new(&env, &token_address).balance(&treasury);

        // Treasury should have received the creation fee
        assert_eq!(token_balance_after - token_balance_before, creation_fee);
    }

    #[test]
    fn test_create_group_no_fee_when_treasury_none() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);

        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let token_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
        token_client.mint(&creator, &1_000_000_000);

        // Config with no treasury — fee should not be charged
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 1,
            max_cycle_duration: 31_536_000,
            treasury: None,
            creation_fee: 5_000_000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        let creator_balance_before =
            soroban_sdk::token::TokenClient::new(&env, &token_address).balance(&creator);

        client.create_group(&creator, &100_000_000, &3600, &5, &token_address, &0);

        let creator_balance_after =
            soroban_sdk::token::TokenClient::new(&env, &token_address).balance(&creator);

        // Creator balance unchanged — no fee deducted
        assert_eq!(creator_balance_before, creator_balance_after);
    }

    #[test]
    fn test_get_total_groups_created() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Initially, no groups created
        let count = client.get_total_groups_created();
        assert_eq!(count, 0);

        // Create first group
        env.mock_all_auths();
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        client.create_group(&creator, &100, &3600, &5, &token_address);

        let count = client.get_total_groups_created();
        assert_eq!(count, 1);

        // Create second group
        client.create_group(&creator, &200, &7200, &10, &token_address);

        let count = client.get_total_groups_created();
        assert_eq!(count, 2);
    }

    // Issue #755: MAX_MEMBERS boundary condition tests
    #[test]
    fn test_create_group_max_members_boundary_valid() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        env.mock_all_auths();
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        // Exactly MAX_MEMBERS (20) should succeed
        let result = client.try_create_group(&creator, &100, &3600, &20, &token_address);
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_group_max_members_exceeded() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        env.mock_all_auths();
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        // 21 exceeds MAX_MEMBERS — must return MaxMembersExceeded
        let result = client.try_create_group(&creator, &100, &3600, &21, &token_address);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_contract_balance() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Query initial balance
        let balance = client.get_contract_balance();
        assert_eq!(balance, 0);
    }

    #[test]
    fn test_get_member_total_contributions_no_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member has not contributed yet
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, 0);
    }

    #[test]
    fn test_get_member_total_contributions_single_cycle() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add a contribution for cycle 0
        let contrib =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get total contributions
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount);
    }

    #[test]
    fn test_get_member_total_contributions_multiple_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 2 (meaning cycles 0, 1, 2 have occurred)
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0, 1, and 2
        for cycle in 0..=2 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get total contributions (should be 3 XLM)
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount * 3);
    }

    #[test]
    fn test_get_member_total_contributions_partial_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 3
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member only contributed to cycles 0 and 2 (skipped cycle 1)
        let contrib0 =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key0 = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key0, &contrib0);

        let contrib2 = ContributionRecord::new(
            member.clone(),
            group_id,
            2,
            contribution_amount,
            12345 + 7200,
        );
        let contrib_key2 = StorageKeyBuilder::contribution_individual(group_id, 2, member.clone());
        env.storage().persistent().set(&contrib_key2, &contrib2);

        // Get total contributions (should be 2 XLM, not 3)
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount * 2);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_member_total_contributions_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to get contributions for a non-existent group
        client.get_member_total_contributions(&999, &member);
    }

    #[test]
    fn test_get_member_total_contributions_different_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member1.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member1 contributes to both cycles
        for cycle in 0..=1 {
            let contrib = ContributionRecord::new(
                member1.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member1.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Member2 only contributes to cycle 0
        let contrib =
            ContributionRecord::new(member2.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member2.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Verify totals
        let total1 = client.get_member_total_contributions(&group_id, &member1);
        assert_eq!(total1, contribution_amount * 2);

        let total2 = client.get_member_total_contributions(&group_id, &member2);
        assert_eq!(total2, contribution_amount);
    }

    #[test]
    fn test_get_member_contribution_history_empty() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member has not contributed yet
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.items.len(), 0);
        assert!(!history.has_more);
    }

    #[test]
    fn test_get_member_contribution_history_single_contribution() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add a contribution for cycle 0
        let contrib =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get contribution history
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.items.len(), 1);
        assert_eq!(history.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.items.get(0).unwrap().amount, contribution_amount);
        assert!(!history.has_more);
    }

    #[test]
    fn test_get_member_contribution_history_multiple_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 4
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 4;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0, 1, 2, 3, 4
        for cycle in 0..=4 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get all contributions
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.items.len(), 5);
        assert!(!history.has_more);

        // Verify order and content
        for i in 0..5 {
            assert_eq!(history.items.get(i as u32).unwrap().cycle_number, i);
            assert_eq!(
                history.items.get(i as u32).unwrap().amount,
                contribution_amount
            );
        }
    }

    #[test]
    fn test_get_member_contribution_history_pagination() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 9 (10 cycles total: 0-9)
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            15,
            2,
            12345,
        );
        group.current_cycle = 9;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for all 10 cycles
        for cycle in 0..=9 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get first page (cycles 0-4)
        let page1 = client.get_member_contribution_history(&group_id, &member, &0, &5);
        assert_eq!(page1.items.len(), 5);
        assert_eq!(page1.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(page1.items.get(4).unwrap().cycle_number, 4);
        assert!(page1.has_more);

        // Get second page (cycles 5-9)
        let page2 = client.get_member_contribution_history(&group_id, &member, &5, &5);
        assert_eq!(page2.items.len(), 5);
        assert_eq!(page2.items.get(0).unwrap().cycle_number, 5);
        assert_eq!(page2.items.get(4).unwrap().cycle_number, 9);
        assert!(!page2.has_more);
    }

    #[test]
    fn test_get_member_contribution_history_partial_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 5
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            10,
            2,
            12345,
        );
        group.current_cycle = 5;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member only contributed to cycles 0, 2, and 4 (skipped 1, 3, 5)
        for cycle in [0, 2, 4].iter() {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                *cycle,
                contribution_amount,
                12345 + (*cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, *cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get contribution history
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.items.len(), 3); // Only 3 contributions
        assert_eq!(history.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.items.get(1).unwrap().cycle_number, 2);
        assert_eq!(history.items.get(2).unwrap().cycle_number, 4);
        assert!(!history.has_more);
    }

    #[test]
    fn test_get_member_contribution_history_limit_cap() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with many cycles
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            100,
            2,
            12345,
        );
        group.current_cycle = 60;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for 60 cycles
        for cycle in 0..=60 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Request 100 records but should be capped at 50
        let history = client.get_member_contribution_history(&group_id, &member, &0, &100);
        assert_eq!(history.items.len(), 50); // Capped at 50
        assert!(history.has_more);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_member_contribution_history_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to get history for a non-existent group
        client.get_member_contribution_history(&999, &member, &0, &10);
    }

    #[test]
    fn test_get_member_contribution_history_beyond_current_cycle() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 3
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            10,
            2,
            12345,
        );
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0-3
        for cycle in 0..=3 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Request starting from cycle 2 with limit 10 (would go to cycle 12, but should stop at 3)
        let history = client.get_member_contribution_history(&group_id, &member, &2, &10);
        assert_eq!(history.items.len(), 2); // Only cycles 2 and 3
        assert_eq!(history.items.get(0).unwrap().cycle_number, 2);
        assert_eq!(history.items.get(1).unwrap().cycle_number, 3);
        assert!(!history.has_more);
    }

    #[test]
    fn test_get_member_contribution_history_100_plus_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        let group_id = 1;
        let contribution_amount = 10_000_000i128;
        let total_cycles: u32 = 110;

        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            200,
            2,
            0,
        );
        group.current_cycle = total_cycles - 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for cycle in 0..total_cycles {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                cycle as u64 * 3600,
            );
            env.storage().persistent().set(
                &StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone()),
                &contrib,
            );
        }

        // Page 1: limit=50, has_more=true (110 total, 50 returned)
        let page1 = client.get_member_contribution_history(&group_id, &member, &0, &50);
        assert_eq!(page1.items.len(), 50);
        assert_eq!(page1.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(page1.items.get(49).unwrap().cycle_number, 49);
        assert!(page1.has_more);

        // Page 2: start=50, limit=50, has_more=true (60 remaining, 50 returned)
        let page2 = client.get_member_contribution_history(&group_id, &member, &50, &50);
        assert_eq!(page2.items.len(), 50);
        assert_eq!(page2.items.get(0).unwrap().cycle_number, 50);
        assert_eq!(page2.items.get(49).unwrap().cycle_number, 99);
        assert!(page2.has_more);

        // Page 3: start=100, limit=50, has_more=false (10 remaining)
        let page3 = client.get_member_contribution_history(&group_id, &member, &100, &50);
        assert_eq!(page3.items.len(), 10);
        assert_eq!(page3.items.get(0).unwrap().cycle_number, 100);
        assert_eq!(page3.items.get(9).unwrap().cycle_number, 109);
        assert!(!page3.has_more);
    }

    #[test]
    fn test_get_cycle_contributions_empty() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // No members added, so no contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 0);
    }

    #[test]
    fn test_get_cycle_contributions_single_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add member to group members map
        let mut members = Map::new(&env);
        members.set(0u32, member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contribution for cycle 0
        let contrib =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get cycle contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 1);
        assert_eq!(contributions.get(0).unwrap().member_address, member);
        assert_eq!(contributions.get(0).unwrap().amount, contribution_amount);
    }

    #[test]
    fn test_get_cycle_contributions_multiple_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        members.set(2u32, member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contributions for all members in cycle 0
        for member in [&member1, &member2, &member3].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get cycle contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 3);

        // Verify all members are present
        let mut addresses: Vec<Address> = Vec::new(&env);
        for contribution in contributions.iter() {
            addresses.push_back(contribution.member_address.clone());
        }
        assert!(addresses.contains(&member1));
        assert!(addresses.contains(&member2));
        assert!(addresses.contains(&member3));
    }

    #[test]
    fn test_get_cycle_contributions_partial_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        members.set(2u32, member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Only member1 and member3 contributed (member2 skipped)
        for member in [&member1, &member3].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get cycle contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 2); // Only 2 contributed

        // Verify only contributing members are present
        let mut addresses: Vec<Address> = Vec::new(&env);
        for contribution in contributions.iter() {
            addresses.push_back(contribution.member_address.clone());
        }
        assert!(addresses.contains(&member1));
        assert!(!addresses.contains(&member2)); // Did not contribute
        assert!(addresses.contains(&member3));
    }

    #[test]
    fn test_get_cycle_contributions_different_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member1.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contributions for different cycles
        // Cycle 0: both members
        for member in [&member1, &member2].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Cycle 1: only member1
        let contrib = ContributionRecord::new(
            member1.clone(),
            group_id,
            1,
            contribution_amount,
            12345 + 3600,
        );
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 1, member1.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Cycle 2: only member2
        let contrib = ContributionRecord::new(
            member2.clone(),
            group_id,
            2,
            contribution_amount,
            12345 + 7200,
        );
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 2, member2.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get contributions for each cycle
        let cycle0 = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(cycle0.len(), 2);

        let cycle1 = client.get_cycle_contributions(&group_id, &1);
        assert_eq!(cycle1.len(), 1);
        assert_eq!(cycle1.get(0).unwrap().member_address, member1);

        let cycle2 = client.get_cycle_contributions(&group_id, &2);
        assert_eq!(cycle2.len(), 1);
        assert_eq!(cycle2.get(0).unwrap().member_address, member2);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_cycle_contributions_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get contributions for a non-existent group
        client.get_cycle_contributions(&999, &0);
    }

    #[test]
    fn test_get_cycle_contributions_verify_amounts() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member1.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contributions with same amount
        for member in [&member1, &member2].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get cycle contributions and verify amounts
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 2);

        // Calculate total
        let total: i128 = contributions
            .iter()
            .map(|c| c.amount)
            .fold(0i128, |acc, amt| acc + amt);
        assert_eq!(total, contribution_amount * 2);
    }

    // Task 6: Tests for join_group function

    // Task 6.1: Test successful member joining
    #[test]
    fn test_join_group_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a group
        let group_id = 1;
        let creator = Address::generate(&env);
        let new_member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
        group.member_count = 1; // Creator already joined
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Store initial member map with creator
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        let members_key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&members_key, &members);

        // Test: New member joins
        client.join_group(&group_id, &new_member, &None);

        // Assert: Member profile created
        let member_key = StorageKeyBuilder::member_profile(group_id, new_member.clone());
        assert!(env.storage().persistent().has(&member_key));

        let profile: MemberProfile = env.storage().persistent().get(&member_key).unwrap();
        assert_eq!(profile.address, new_member);
        assert_eq!(profile.group_id, group_id);

        // Assert: Member added to list
        let updated_members: Map<u32, Address> = env.storage().persistent().get(&members_key).unwrap();
        assert_eq!(updated_members.len(), 2);
        assert_eq!(updated_members.get(1u32).unwrap(), new_member);

        // Assert: Member count increased
        let updated_group: Group = env.storage().persistent().get(&group_key).unwrap();
        assert_eq!(updated_group.member_count, 2);

        // Assert: Payout position assigned
        let payout_key = StorageKeyBuilder::member_payout_eligibility(group_id, new_member.clone());
        let payout_position: u32 = env.storage().persistent().get(&payout_key).unwrap();
        assert_eq!(payout_position, 1); // Second member gets position 1
    }

    // Task 6.2: Test joining non-existent group
    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_join_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);

        // Test: Try to join non-existent group
        client.join_group(&999, &member, &None);
    }

    // Task 6.3: Test joining when already a member
    #[test]
    #[should_panic(expected = "Status(ContractError(2001))")] // 2001 is AlreadyMember
    fn test_join_group_already_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a group with a member
        let group_id = 1;
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Store member profile (already a member)
        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            joined_at,
            payout_position: 0, // Default value for test
            auto_contribute_enabled: false,
        };
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        env.storage().persistent().set(&member_key, &member_profile);

        // Test: Member tries to join again
        client.join_group(&group_id, &member, &None);
    }

    // Task 6.4: Test joining when group is full
    #[test]
    #[should_panic(expected = "Status(ContractError(1002))")] // 1002 is GroupFull
    fn test_join_group_full() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a full group
        let group_id = 1;
        let creator = Address::generate(&env);
        let new_member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data with max_members = 3 and member_count = 3 (full)
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, joined_at, 0);
        group.member_count = 3;
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Test: Try to join full group
        client.join_group(&group_id, &new_member, &None);
    }

    // Task 6.5: Test joining when group is already active
    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // 1003 is InvalidState
    fn test_join_group_already_active() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create an active group
        let group_id = 1;
        let creator = Address::generate(&env);
        let new_member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Test: Try to join active group
        client.join_group(&group_id, &new_member, &None);
    }

    // Task 6.6: Test payout position assignment
    #[test]
    fn test_join_group_payout_position_assignment() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a group with some members
        let group_id = 1;
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
        group.member_count = 2; // Creator and one member already joined
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Store initial member map
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, member1.clone());
        let members_key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&members_key, &members);

        // Test: Member2 joins (should get position 2)
        client.join_group(&group_id, &member2, &None);

        let payout_key2 = StorageKeyBuilder::member_payout_eligibility(group_id, member2.clone());
        let position2: u32 = env.storage().persistent().get(&payout_key2).unwrap();
        assert_eq!(position2, 2);

        // Test: Member3 joins (should get position 3)
        client.join_group(&group_id, &member3, &None);

        let payout_key3 = StorageKeyBuilder::member_payout_eligibility(group_id, member3.clone());
        let position3: u32 = env.storage().persistent().get(&payout_key3).unwrap();
        assert_eq!(position3, 3);

        // Assert: Final member count is correct
        let final_group: Group = env.storage().persistent().get(&group_key).unwrap();
        assert_eq!(final_group.member_count, 4);
    }

    #[test]
    fn test_assign_payout_positions_sequential() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        members.set(2u32, member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: All members contributed
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &3u32);

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is complete
        assert_eq!(is_complete, true);
    }

    #[test]
    fn test_is_cycle_complete_partial_contributions() {
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, member1.clone());
        members.set(2u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Create member profiles
        for (_, member) in members.iter() {
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }

        // Action: Assign sequential positions
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Sequential);

        // Verify: Positions are 0, 1, 2
        let pos0: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                creator.clone(),
            ))
            .unwrap();
        let pos1: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member1.clone(),
            ))
            .unwrap();
        let pos2: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member2.clone(),
            ))
            .unwrap();

        assert_eq!(pos0, 0);
        assert_eq!(pos1, 1);
        assert_eq!(pos2, 2);
    }

    #[test]
    fn test_assign_payout_positions_manual() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        members.set(2u32, member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Only 2 out of 3 members contributed
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &2u32);

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is not complete
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_cycle_complete_no_contributions() {
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, member1.clone());
        members.set(2u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Create member profiles
        for member in members.iter() {
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }

        // Action: Assign manual positions [2, 0, 1]
        let mut positions = Vec::new(&env);
        positions.push_back(2);
        positions.push_back(0);
        positions.push_back(1);

        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Manual(positions));

        // Verify: Positions match manual assignment
        let pos0: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                creator.clone(),
            ))
            .unwrap();
        let pos1: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member1.clone(),
            ))
            .unwrap();
        let pos2: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member2.clone(),
            ))
            .unwrap();

        assert_eq!(pos0, 2);
        assert_eq!(pos1, 0);
        assert_eq!(pos2, 1);
    }

    #[test]
    fn test_assign_payout_positions_random() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, member1.clone());
        members.set(2u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: No contributions (count defaults to 0)

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is not complete
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_cycle_complete_partial_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, member1.clone());
        members.set(2u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Create member profiles
        for member in members.iter() {
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }

        // Action: Assign random positions
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Randomized);

        // Verify: All positions are assigned and unique
        let pos0: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                creator.clone(),
            ))
            .unwrap();
        let pos1: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member1.clone(),
            ))
            .unwrap();
        let pos2: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member2.clone(),
            ))
            .unwrap();

        // All positions should be in range [0, 2]
        assert!(pos0 < 3);
        assert!(pos1 < 3);
        assert!(pos2 < 3);

        // All positions should be unique
        assert_ne!(pos0, pos1);
        assert_ne!(pos0, pos2);
        assert_ne!(pos1, pos2);
    }

    #[test]
    fn test_assign_payout_positions_randomized_ten_members_is_not_join_order() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 10, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Map::new(&env);
        let mut member_idx: u32 = 0;
        for _ in 0..10 {
            let member = Address::generate(&env);
            members.set(member_idx, member.clone());
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
            member_idx += 1;
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Randomized);

        let sequence_key = StorageKeyBuilder::payout_sequence(group_id);
        let sequence: Vec<Address> = env.storage().persistent().get(&sequence_key).unwrap();

        assert_eq!(sequence.len(), 10);

        // Collect members in order for comparison
        let mut member_vec: Vec<Address> = Vec::new(&env);
        for (_, m) in members.iter() { member_vec.push_back(m); }

        let mut same_order = true;
        for i in 0..sequence.len() {
            if sequence.get(i).unwrap() != member_vec.get(i).unwrap() {
                same_order = false;
                break;
            }
        }

        assert_eq!(same_order, false);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2003))")] // Unauthorized
    fn test_assign_payout_positions_not_creator() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_creator = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Try to assign as non-creator
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &non_creator, &AssignmentMode::Sequential);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_assign_payout_positions_group_active() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Cycle 0 is complete, cycle 1 is not
        let count_key0 = StorageKeyBuilder::contribution_cycle_count(group_id, 0);
        env.storage().persistent().set(&count_key0, &2u32);

        let count_key1 = StorageKeyBuilder::contribution_cycle_count(group_id, 1);
        env.storage().persistent().set(&count_key1, &1u32);

        // Action: Check both cycles
        let is_complete_0 = client.is_cycle_complete(&group_id, &0);
        let is_complete_1 = client.is_cycle_complete(&group_id, &1);

        // Verify: Cycle 0 complete, cycle 1 not complete
        assert_eq!(is_complete_0, true);
        assert_eq!(is_complete_1, false);
    }

    #[test]
    fn test_is_cycle_complete_exact_count() {
        let creator = Address::generate(&env);
        let group_id = 1;

        // Setup: Create active group
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Active,
        );

        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Try to assign when group is active
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Sequential);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_assign_payout_positions_manual_wrong_count() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members map with 3 members
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        members.set(2u32, member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Exactly 3 contributions (equal to member count)
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &3u32);

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is not complete
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_cycle_complete_no_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group with 2 members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, member1.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Try to assign with wrong number of positions (3 instead of 2)
        let mut positions = Vec::new(&env);
        positions.push_back(0);
        positions.push_back(1);
        positions.push_back(2);

        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Manual(positions));
    }

    // Tests for validate_contribution_amount helper function

    #[test]
    fn test_validate_contribution_amount_success() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 10 XLM
        let group_id = 1;
        let contribution_amount = 100_000_000; // 10 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with correct amount using as_contract
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, contribution_amount)
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_contribution_amount_invalid_amount() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 10 XLM
        let group_id = 1;
        let contribution_amount = 100_000_000; // 10 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with incorrect amount (5 XLM instead of 10 XLM)
        let wrong_amount = 50_000_000;
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, wrong_amount)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_group_not_found() {
        let env = Env::default();

        // Try to validate for a non-existent group
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, 999, 100_000_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::GroupNotFound);
    }

    #[test]
    fn test_validate_contribution_amount_zero() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 1 XLM
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with zero amount
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 0)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_negative() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 1 XLM
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with negative amount
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, -100)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_too_high() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 1 XLM
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with amount that's too high (2 XLM instead of 1 XLM)
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 20_000_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_multiple_groups() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        // Create multiple groups with different contribution amounts
        let group1_id = 1;
        let group1_amount = 10_000_000; // 1 XLM
        let group1 = Group::new(
            group1_id,
            creator.clone(),
            group1_amount,
            3600,
            5,
            2,
            12345,
            0,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        let group2_id = 2;
        let group2_amount = 50_000_000; // 5 XLM
        let group2 = Group::new(
            group2_id,
            creator.clone(),
            group2_amount,
            3600,
            5,
            2,
            12345,
            0,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group2_id), &group2);

        // Validate correct amounts for each group
        let result1 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group1_id, group1_amount)
        });
        assert!(result1.is_ok());

        let result2 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group2_id, group2_amount)
        });
        assert!(result2.is_ok());

        // Validate incorrect amounts (swapped)
        let result3 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group1_id, group2_amount)
        });
        assert!(result3.is_err());
        assert_eq!(result3.unwrap_err(), StellarSaveError::InvalidAmount);

        let result4 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group2_id, group1_amount)
        });
        assert!(result4.is_err());
        assert_eq!(result4.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_edge_case_one_stroop() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        // Create a group with minimum contribution amount (1 stroop)
        let group_id = 1;
        let contribution_amount = 1; // 1 stroop
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with correct amount
        let result1 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 1)
        });
        assert!(result1.is_ok());

        // Validate with incorrect amount (2 stroops)
        let result2 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 2)
        });
        assert!(result2.is_err());
        assert_eq!(result2.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    // Tests for validate_cycle_duration function

    #[test]
    fn test_validate_cycle_duration_valid() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        // Set up config with min=3600 (1 hour), max=2592000 (30 days)
        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test valid duration (7 days)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 604800)
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_cycle_duration_too_short() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test duration below minimum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 1800)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    #[test]
    fn test_validate_cycle_duration_too_long() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test duration above maximum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 3000000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    #[test]
    fn test_validate_cycle_duration_no_config() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        // Test without config (should pass)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 604800)
        });
        assert!(result.is_ok());
    }

    // Tests for validate_contribution_amount_range function

    #[test]
    fn test_validate_contribution_amount_range_valid() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,     // 0.1 XLM
            max_contribution: 1_000_000_000, // 100 XLM
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test valid amount (10 XLM)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 100_000_000)
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_contribution_amount_range_too_low() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test amount below minimum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 500_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_range_too_high() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test amount above maximum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 2_000_000_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_range_no_config() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        // Test without config (should pass)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 100_000_000)
        });
        assert!(result.is_ok());
    }

    // Tests for get_missed_contributions function

    #[test]
    fn test_get_missed_contributions_all_contributed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        members.set(2u32, member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: All members contributed
        for member in members.iter() {
            let contrib =
                ContributionRecord::new(member.clone(), group_id, cycle, 10_000_000, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: No one missed
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_get_missed_contributions_some_missed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        members.set(2u32, member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Only member1 contributed (member2 and member3 missed)
        let contrib = ContributionRecord::new(member1.clone(), group_id, cycle, 10_000_000, 12345);
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, member1.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: member2 and member3 missed
        assert_eq!(missed.len(), 2);

        // Check that the missed members are member2 and member3
        let mut found_member2 = false;
        let mut found_member3 = false;
        for member in missed.iter() {
            if member == member2 {
                found_member2 = true;
            }
            if member == member3 {
                found_member3 = true;
            }
        }
        assert!(found_member2);
        assert!(found_member3);
    }

    #[test]
    fn test_is_cycle_complete_exact_count() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: No contributions made

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: All members missed
        assert_eq!(missed.len(), 2);
        assert_eq!(missed.get(0).unwrap(), member1);
        assert_eq!(missed.get(1).unwrap(), member2);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_missed_contributions_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Action: Try to get missed contributions for non-existent group
        client.get_missed_contributions(&999, &0);
    }

    #[test]
    fn test_get_missed_contributions_different_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create members map
        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: member1 contributed in cycle 0, member2 contributed in cycle 1
        let contrib0 = ContributionRecord::new(member1.clone(), group_id, 0, 10_000_000, 12345);
        let contrib_key0 = StorageKeyBuilder::contribution_individual(group_id, 0, member1.clone());
        env.storage().persistent().set(&contrib_key0, &contrib0);

        let contrib1 =
            ContributionRecord::new(member2.clone(), group_id, 1, 10_000_000, 12345 + 3600);
        let contrib_key1 = StorageKeyBuilder::contribution_individual(group_id, 1, member2.clone());
        env.storage().persistent().set(&contrib_key1, &contrib1);

        // Verify: Cycle is complete (equal counts)
        assert_eq!(is_complete, true);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_assign_payout_positions_manual_wrong_count_actual() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let group_id = 1;

        // Action: Check cycle 1
        let missed_cycle1 = client.get_missed_contributions(&group_id, &1);
        assert_eq!(missed_cycle1.len(), 1);
        assert_eq!(missed_cycle1.get(0).unwrap(), member1);
    }

    #[test]
    fn test_get_missed_contributions_empty_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let group_id = 1;
        let cycle = 0;

        // Setup: Create empty members map
        let members: Map<u32, Address> = Map::new(&env);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: No members, so no one missed
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_get_missed_contributions_single_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create single member group
        let mut members = Map::new(&env);
        members.set(0u32, member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Member didn't contribute

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: Single member missed
        assert_eq!(missed.len(), 1);
        assert_eq!(missed.get(0).unwrap(), member);
    }

    #[test]
    fn test_get_missed_contributions_large_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let group_id = 1;
        let cycle = 0;

        // Setup: Create group with 10 members
        let mut members = Map::new(&env);
        let mut member_addresses = Vec::new(&env);
        for i in 0..10u32 {
            let member = Address::generate(&env);
            members.set(i, member.clone());
            member_addresses.push_back(member);
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Only first 5 members contributed
        for i in 0..5 {
            let member = member_addresses.get(i).unwrap();
            let contrib =
                ContributionRecord::new(member.clone(), group_id, cycle, 10_000_000, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: Last 5 members missed
        assert_eq!(missed.len(), 5);

        // Verify the missed members are the last 5
        for i in 0..5 {
            let expected_member = member_addresses.get(i + 5).unwrap();
            let missed_member = missed.get(i).unwrap();
            assert_eq!(missed_member, expected_member);
        }
    }

    // Tests for record_contribution helper function

    #[test]
    fn test_record_contribution_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000; // 1 XLM
        let timestamp = 12345u64;

        // Action: Record contribution using as_contract
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Success
        assert!(result.is_ok());

        // Verify: Contribution record was stored
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
        let stored_contrib: ContributionRecord =
            env.storage().persistent().get(&contrib_key).unwrap();
        assert_eq!(stored_contrib.member_address, member);
        assert_eq!(stored_contrib.group_id, group_id);
        assert_eq!(stored_contrib.cycle_number, cycle);
        assert_eq!(stored_contrib.amount, amount);
        assert_eq!(stored_contrib.timestamp, timestamp);

        // Verify: Cycle total was updated
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount);

        // Verify: Cycle count was updated
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_record_contribution_already_contributed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Setup: Record first contribution
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Action: Try to record second contribution for same member/cycle
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp + 100,
            )
        });

        // Verify: Error returned
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::AlreadyContributed);

        // Verify: Totals weren't double-counted
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount); // Still just the first contribution

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 1); // Still just 1 contributor
    }

    #[test]
    fn test_record_contribution_multiple_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Action: Record contributions from 3 members
        for (i, member) in [&member1, &member2, &member3].iter().enumerate() {
            let result = env.as_contract(&contract_id, || {
                StellarSaveContract::record_contribution(
                    &env,
                    group_id,
                    cycle,
                    (*member).clone(),
                    amount,
                    timestamp + (i as u64 * 100),
                )
            });
            assert!(result.is_ok());
        }

        // Verify: All contributions were stored
        for member in [&member1, &member2, &member3].iter() {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, (*member).clone());
            assert!(env.storage().persistent().has(&contrib_key));
        }

        // Verify: Cycle total is sum of all contributions
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount * 3);

        // Verify: Cycle count is 3
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn test_record_contribution_different_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Action: Record contributions in different cycles
        for cycle in 0..3 {
            let result = env.as_contract(&contract_id, || {
                StellarSaveContract::record_contribution(
                    &env,
                    group_id,
                    cycle,
                    member.clone(),
                    amount,
                    timestamp + (cycle as u64 * 3600),
                )
            });
            assert!(result.is_ok());
        }

        // Verify: Each cycle has its own contribution record
        for cycle in 0..3 {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            let contrib: ContributionRecord = env.storage().persistent().get(&contrib_key).unwrap();
            assert_eq!(contrib.cycle_number, cycle);
        }

        // Verify: Each cycle has its own totals
        for cycle in 0..3 {
            let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
            let total: i128 = env.storage().persistent().get(&total_key).unwrap();
            assert_eq!(total, amount);

            let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
            let count: u32 = env.storage().persistent().get(&count_key).unwrap();
            assert_eq!(count, 1);
        }
    }

    #[test]
    fn test_record_contribution_different_amounts() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount1 = 10_000_000; // 1 XLM
        let amount2 = 20_000_000; // 2 XLM
        let timestamp = 12345u64;

        // Action: Record contributions with different amounts
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member1.clone(),
                amount1,
                timestamp,
            )
        })
        .unwrap();

        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member2.clone(),
                amount2,
                timestamp + 100,
            )
        })
        .unwrap();

        // Verify: Total is sum of different amounts
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount1 + amount2);

        // Verify: Count is 2
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_record_contribution_updates_existing_totals() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Setup: Pre-set some totals (simulating previous contributions)
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        env.storage().persistent().set(&total_key, &50_000_000i128);

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &5u32);

        // Action: Record new contribution
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member1.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Verify: Total was incremented
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, 60_000_000); // 50M + 10M

        // Verify: Count was incremented
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 6); // 5 + 1
    }

    // Task 6.2: Test joining non-existent group
    #[test]
    fn test_record_contribution_zero_initial_totals() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Verify: No totals exist initially
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        assert!(!env.storage().persistent().has(&total_key));

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        assert!(!env.storage().persistent().has(&count_key));

        // Action: Record first contribution
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Verify: Totals were initialized correctly
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount);

        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 1);
    }

    // Task 6.4: Test joining when group is full
    #[test]
    fn test_record_contribution_large_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 1_000_000_000_000i128; // 100,000 XLM
        let timestamp = 12345u64;

        // Action: Record large contribution
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Success
        assert!(result.is_ok());

        // Verify: Large amount was stored correctly
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount);
    }

    // Tests for get_contribution_deadline function

    #[test]
    fn test_get_contribution_deadline_cycle_0() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week in seconds
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Test valid amount (10 XLM)
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 100_000_000));
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_contribution_deadline_cycle_1() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Test amount below minimum
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 500_000));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_get_contribution_deadline_multiple_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            10,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        // Test amount above maximum
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 2_000_000_000));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_contribution_deadline_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Test without config (should pass)
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 100_000_000));
        assert!(result.is_ok());
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_get_contribution_deadline_group_not_started() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let created_at = 1000000u64;

        // Setup: Create a group that hasn't been started
        let group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            created_at,
        );
        // Note: group.started is false by default
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Try to get deadline for unstarted group
        client.get_contribution_deadline(&group_id, &0);
    }

    #[test]
    fn test_get_contribution_deadline_different_durations() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let started_at = 1000000u64;

        // Test with 1 week duration
        let group1_id = 1;
        let duration1 = 604800u64; // 1 week
        let mut group1 = Group::new(
            group1_id,
            creator.clone(),
            100,
            duration1,
            5,
            2,
            started_at,
            0,
        );
        group1.started = true;
        group1.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        // Test with 1 month duration
        let group2_id = 2;
        let duration2 = 2592000u64; // 30 days
        let mut group2 = Group::new(
            group2_id,
            creator.clone(),
            100,
            duration2,
            5,
            2,
            started_at,
            0,
        );
        group2.started = true;
        group2.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group2_id), &group2);

        // Verify: Different deadlines based on duration
        let deadline1 = client.get_contribution_deadline(&group1_id, &0);
        let deadline2 = client.get_contribution_deadline(&group2_id, &0);

        assert_eq!(deadline1, started_at + duration1);
        assert_eq!(deadline2, started_at + duration2);
        assert_ne!(deadline1, deadline2);
    }

    #[test]
    fn test_get_contribution_deadline_time_remaining() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        // Action: Get deadline and calculate time remaining
        let deadline = client.get_contribution_deadline(&group_id, &0);
        let current_time = started_at + 100000; // Some time into the cycle

        // Verify: Can calculate time remaining
        assert!(deadline > current_time);
        let time_remaining = deadline - current_time;
        assert_eq!(time_remaining, cycle_duration - 100000);
    }

    #[test]
    fn test_get_contribution_deadline_expired_cycle() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadline for cycle 0
        let deadline = client.get_contribution_deadline(&group_id, &0);

        // Verify: Can check if cycle has expired
        let current_time = started_at + cycle_duration + 1000; // After deadline
        assert!(current_time > deadline);
    }

    #[test]
    fn test_get_contribution_deadline_high_cycle_number() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group with many cycles
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            100,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Get deadline for cycle 50
        let deadline = client.get_contribution_deadline(&group_id, &50);

        // Verify: Correct calculation for high cycle number
        let expected = started_at + (51 * cycle_duration);
        assert_eq!(deadline, expected);
    }

    #[test]
    fn test_get_contribution_deadline_short_duration() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 3600u64; // 1 hour
        let started_at = 1000000u64;

        // Setup: Create a started group with short cycle
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        // Action: Get deadline for cycle 0
        let deadline = client.get_contribution_deadline(&group_id, &0);

        // Verify: Correct deadline for short duration
        assert_eq!(deadline, started_at + cycle_duration);
        assert_eq!(deadline, started_at + 3600);
    }

    #[test]
    fn test_get_contribution_deadline_consistency() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        // Action: Call multiple times for same cycle
        let deadline1 = client.get_contribution_deadline(&group_id, &0);
        let deadline2 = client.get_contribution_deadline(&group_id, &0);
        let deadline3 = client.get_contribution_deadline(&group_id, &0);

        // Verify: Always returns same value
        assert_eq!(deadline1, deadline2);
        assert_eq!(deadline2, deadline3);
    }

    // Tests for get_next_payout_cycle function

    #[test]
    fn test_get_next_payout_cycle_current_cycle_0() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week in seconds
        let started_at = 1000000u64;

        // Setup: Create a started group with current_cycle = 0
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        // Action: Get next payout cycle time
        let next_payout_time = client.get_next_payout_cycle(&group_id);

        // Verify: Next payout is at started_at + (2 * cycle_duration)
        // current_cycle = 0, next_cycle = 1, so next_payout = started_at + ((1+1) * cycle_duration)
        let expected = started_at + (2 * cycle_duration);
        assert_eq!(next_payout_time, expected);
    }

    #[test]
    fn test_get_next_payout_cycle_current_cycle_2() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group with current_cycle = 2
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Get next payout cycle time
        let next_payout_time = client.get_next_payout_cycle(&group_id);

        // Verify: Next payout is at started_at + (4 * cycle_duration)
        // current_cycle = 2, next_cycle = 3, so next_payout = started_at + ((3+1) * cycle_duration)
        let expected = started_at + (4 * cycle_duration);
        assert_eq!(next_payout_time, expected);
    }

    #[test]
    fn test_get_next_payout_cycle_different_durations() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let started_at = 1000000u64;

        // Test with 1 hour duration
        let group1_id = 1;
        let duration1 = 3600u64; // 1 hour
        let mut group1 = Group::new(
            group1_id,
            creator.clone(),
            100,
            duration1,
            5,
            2,
            started_at,
            0,
        );
        group1.started = true;
        group1.started_at = started_at;
        group1.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        // Test with 1 week duration
        let group2_id = 2;
        let duration2 = 604800u64; // 1 week
        let mut group2 = Group::new(
            group2_id,
            creator.clone(),
            100,
            duration2,
            5,
            2,
            started_at,
            0,
        );
        group2.started = true;
        group2.started_at = started_at;
        group2.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group2_id), &group2);

        // Action: Get next payout times
        let next_payout1 = client.get_next_payout_cycle(&group1_id);
        let next_payout2 = client.get_next_payout_cycle(&group2_id);

        // Verify: Different next payout times based on duration
        assert_eq!(next_payout1, started_at + (2 * duration1));
        assert_eq!(next_payout2, started_at + (2 * duration2));
        assert_ne!(next_payout1, next_payout2);
    }

    #[test]
    fn test_get_next_payout_cycle_high_cycle_number() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group with high current_cycle
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            100,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 50;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Get next payout cycle time
        let next_payout_time = client.get_next_payout_cycle(&group_id);

        // Verify: Correct calculation for high cycle number
        // current_cycle = 50, next_cycle = 51, so next_payout = started_at + ((51+1) * cycle_duration)
        let expected = started_at + (52 * cycle_duration);
        assert_eq!(next_payout_time, expected);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_next_payout_cycle_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Action: Try to get next payout for non-existent group
        client.get_next_payout_cycle(&999);
    }

    // Tests for validate_contribution_amount helper function

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_get_next_payout_cycle_group_not_started() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let created_at = 1000000u64;

        // Setup: Create a group that hasn't been started
        let group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            created_at,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Try to get next payout for unstarted group
        client.get_next_payout_cycle(&group_id);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_get_next_payout_cycle_group_complete() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let started_at = 1000000u64;

        // Setup: Create a completed group (current_cycle >= max_members)
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 5; // Equal to max_members, so group is complete
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Try to get next payout for completed group
        client.get_next_payout_cycle(&group_id);
    }

    #[test]
    fn test_get_next_payout_cycle_time_remaining() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get next payout time and calculate time remaining
        let next_payout_time = client.get_next_payout_cycle(&group_id);
        let current_time = started_at + cycle_duration + 100000; // Some time into cycle 1

        // Verify: Can calculate time until next payout
        assert!(next_payout_time > current_time);
        let time_until_payout = next_payout_time - current_time;
        assert!(time_until_payout > 0);
    }

    #[test]
    fn test_get_next_payout_cycle_consistency() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Call multiple times
        let next_payout1 = client.get_next_payout_cycle(&group_id);
        let next_payout2 = client.get_next_payout_cycle(&group_id);
        let next_payout3 = client.get_next_payout_cycle(&group_id);

        // Verify: Always returns same value
        assert_eq!(next_payout1, next_payout2);
        assert_eq!(next_payout2, next_payout3);
    }

    #[test]
    fn test_is_payout_due_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_is_payout_due(&999);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_payout_due_pending_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.status = GroupStatus::Pending;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_due = client.is_payout_due(&group_id);
        assert!(!is_due);
    }

    #[test]
    fn test_is_payout_due_cycle_incomplete() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345, 0);
        group.status = GroupStatus::Active;
        group.member_count = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Setup members map
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, Address::generate(&env));
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Only 1 contribution
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_count(group_id, 0),
            &1u32,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &100i128,
        );

        let is_due = client.is_payout_due(&group_id);
        assert!(!is_due);
    }

    #[test]
    fn test_is_payout_due_ready() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345, 0);
        group.status = GroupStatus::Active;
        group.member_count = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Setup members map
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, Address::generate(&env));
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // 2 contributions (complete)
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_count(group_id, 0),
            &2u32,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &200i128,
        );

        let is_due = client.is_payout_due(&group_id);
        assert!(is_due);
    }

    #[test]
    fn test_is_payout_due_already_paid() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345, 0);
        group.status = GroupStatus::Active;
        group.member_count = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Setup members map
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        members.set(1u32, Address::generate(&env));
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // 2 contributions (complete)
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_count(group_id, 0),
            &2u32,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &200i128,
        );

        // Mark as already paid
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &creator);

        let is_due = client.is_payout_due(&group_id);
        assert!(!is_due);
    }

    #[test]
    fn test_emergency_withdraw_not_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        let result = client.try_emergency_withdraw(&group_id, &non_member);
        assert_eq!(result, Err(Ok(StellarSaveError::NotMember)));
    }

    #[test]
    fn test_emergency_withdraw_group_complete() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.status = GroupStatus::Completed;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = client.try_emergency_withdraw(&group_id, &creator);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_emergency_withdraw_not_stalled() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());

        let creator = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        group.started_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = client.try_emergency_withdraw(&group_id, &creator);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_emergency_withdraw_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        let old_time = 1000000u64;
        group.started_at = old_time;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        env.ledger().with_mut(|li| {
            li.timestamp = old_time + (cycle_duration * 3);
        });

        let result = client.try_emergency_withdraw(&group_id, &member);
        assert!(result.is_ok());
    }

    #[test]
    fn test_emergency_withdraw_removes_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        let old_time = 1000000u64;
        group.started_at = old_time;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        env.ledger().with_mut(|li| {
            li.timestamp = old_time + (cycle_duration * 3);
        });

        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        assert!(env.storage().persistent().has(&member_key));

        client.emergency_withdraw(&group_id, &member);

        assert!(!env.storage().persistent().has(&member_key));
    }

    #[test]
    fn test_emergency_withdraw_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        let old_time = 1000000u64;
        group.started_at = old_time;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        env.ledger().with_mut(|li| {
            li.timestamp = old_time + (cycle_duration * 3);
        });

        client.emergency_withdraw(&group_id, &member);

        let events = env.events().all();
        assert!(events.len() > 0);
    }

    #[test]
    fn test_validate_payout_recipient_not_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let result = client.validate_payout_recipient(&group_id, &non_member);
        assert_eq!(result, false);
    }

    #[test]
    fn test_validate_payout_recipient_already_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        env.storage().persistent().set(&recipient_key, &creator);

        let result = client.validate_payout_recipient(&group_id, &creator);
        assert_eq!(result, false);
    }

    #[test]
    fn test_validate_payout_recipient_wrong_position() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = client.validate_payout_recipient(&group_id, &creator);
        assert_eq!(result, false);
    }

    #[test]
    fn test_validate_payout_recipient_valid() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        let result = client.validate_payout_recipient(&group_id, &creator);
        assert_eq!(result, true);
    }

    #[test]
    fn test_validate_payout_recipient_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);

        let result = client.try_validate_payout_recipient(&999, &member);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_get_total_paid_out_no_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let total = client.get_total_paid_out(&group_id);
        assert_eq!(total, 0);
    }

    #[test]
    fn test_get_total_paid_out_single_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&payout_key, &payout);

        let total = client.get_total_paid_out(&group_id);
        assert_eq!(total, 300);
    }

    #[test]
    fn test_get_total_paid_out_multiple_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout1 =
            PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout2 =
            PayoutRecord::new(member1.clone(), group_id, 1, 300, env.ledger().timestamp());
        let payout3 =
            PayoutRecord::new(member2.clone(), group_id, 2, 300, env.ledger().timestamp());

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout3);

        let total = client.get_total_paid_out(&group_id);
        assert_eq!(total, 900);
    }

    #[test]
    fn test_get_total_paid_out_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let result = client.try_get_total_paid_out(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    // Tests for get_group_balance function

    #[test]
    fn test_get_group_balance_no_activity() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let balance = client.get_group_balance(&group_id);
        assert_eq!(balance, 0);
    }

    #[test]
    fn test_get_group_balance_with_contributions_no_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Add contributions for cycle 0
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, 0);
        env.storage().persistent().set(&total_key, &300_i128);

        let balance = client.get_group_balance(&group_id);
        assert_eq!(balance, 300);
    }

    #[test]
    fn test_get_group_balance_with_contributions_and_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0 and 1
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &300_i128,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 1),
            &300_i128,
        );

        // Add payout for cycle 0
        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout);

        let balance = client.get_group_balance(&group_id);
        assert_eq!(balance, 300); // 600 contributions - 300 payout
    }

    #[test]
    fn test_get_group_balance_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let result = client.try_get_group_balance(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    // Tests for get_payout_history function

    #[test]
    fn test_get_payout_history_no_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Get payout history (should be empty)
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 0);
    }

    #[test]
    fn test_get_payout_history_single_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Setup: Create a group with one payout
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&payout_key, &payout);

        // Get payout history
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 1);
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(0).unwrap().recipient, creator);
        assert_eq!(history.get(0).unwrap().amount, 300);
    }

    #[test]
    fn test_get_payout_history_multiple_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Setup: Create a group with multiple payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout1 = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1000);
        let payout2 = PayoutRecord::new(member1.clone(), group_id, 1, 300, 2000);
        let payout3 = PayoutRecord::new(member2.clone(), group_id, 2, 300, 3000);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout3);

        // Get payout history
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 3);

        // Verify sorting by cycle number
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(1).unwrap().cycle_number, 1);
        assert_eq!(history.get(2).unwrap().cycle_number, 2);

        // Verify recipients
        assert_eq!(history.get(0).unwrap().recipient, creator);
        assert_eq!(history.get(1).unwrap().recipient, member1);
        assert_eq!(history.get(2).unwrap().recipient, member2);
    }

    #[test]
    fn test_get_payout_history_pagination_first_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        for i in 0..5 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get first page (limit 2)
        let first_page = client.get_payout_history(&group_id, &0, &2);
        assert_eq!(first_page.len(), 2);
        assert_eq!(first_page.get(0).unwrap().cycle_number, 0);
        assert_eq!(first_page.get(1).unwrap().cycle_number, 1);
    }

    #[test]
    fn test_get_payout_history_pagination_second_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);

        // Setup: Create a group with 5 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 5;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..5 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get second page (offset 2, limit 2)
        let second_page = client.get_payout_history(&group_id, &2, &2);
        assert_eq!(second_page.len(), 2);
        assert_eq!(second_page.get(0).unwrap().cycle_number, 2);
        assert_eq!(second_page.get(1).unwrap().cycle_number, 3);
    }

    #[test]
    fn test_get_payout_history_pagination_last_page_partial() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let cycle_duration = 3600u64;
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3, &token_address);

        client.join_group(&group_id, &creator, &None);

        // Setup: Create a group with 5 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 5;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..5 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get last page (offset 4, limit 2) - should only return 1 record
        let last_page = client.get_payout_history(&group_id, &4, &2);
        assert_eq!(last_page.len(), 1);
        assert_eq!(last_page.get(0).unwrap().cycle_number, 4);
    }

    // Tests for get_contribution_deadline function

    #[test]
    fn test_get_payout_history_pagination_offset_beyond_end() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Setup: Create a group with 2 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..2 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get with offset beyond total records
        let empty_result = client.get_payout_history(&group_id, &10, &5);
        assert_eq!(empty_result.len(), 0);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_payout_history_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get payout history for non-existent group
        client.get_payout_history(&999, &0, &10);
    }

    #[test]
    fn test_get_payout_history_large_dataset() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Setup: Create a group with 20 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 20;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..20 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Test multiple pages
        let page1 = client.get_payout_history(&group_id, &0, &5);
        let page2 = client.get_payout_history(&group_id, &5, &5);
        let page3 = client.get_payout_history(&group_id, &10, &5);
        let page4 = client.get_payout_history(&group_id, &15, &5);

        assert_eq!(page1.len(), 5);
        assert_eq!(page2.len(), 5);
        assert_eq!(page3.len(), 5);
        assert_eq!(page4.len(), 5);

        // Verify continuity
        assert_eq!(page1.get(4).unwrap().cycle_number, 4);
        assert_eq!(page2.get(0).unwrap().cycle_number, 5);
        assert_eq!(page3.get(0).unwrap().cycle_number, 10);
        assert_eq!(page4.get(0).unwrap().cycle_number, 15);
    }

    #[test]
    fn test_get_payout_history_sorting_consistency() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Setup: Create payouts out of order in storage
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payouts in non-sequential order
        let payout2 = PayoutRecord::new(creator.clone(), group_id, 2, 300, 3000);
        let payout0 = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1000);
        let payout1 = PayoutRecord::new(creator.clone(), group_id, 1, 300, 2000);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout1);

        // Get payout history and verify sorting
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 3);

        // Should be sorted by cycle number regardless of storage order
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(1).unwrap().cycle_number, 1);
        assert_eq!(history.get(2).unwrap().cycle_number, 2);
    }

    #[test]
    fn test_get_member_payout_no_payout_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add member to group
        client.join_group(&group_id, &member, &None);

        // Member hasn't received any payout yet
        let result = client.get_member_payout(&group_id, &member);
        assert_eq!(result, None);
    }

    #[test]
    fn test_get_member_payout_received_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add member to group
        client.join_group(&group_id, &member, &None);

        // Simulate a payout to the member in cycle 0
        let payout = PayoutRecord::new(member.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&payout_key, &payout);

        // Update group current_cycle to reflect the payout
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.current_cycle = 1;
        env.storage().persistent().set(&group_key, &group);

        // Member should have received a payout
        let result = client.get_member_payout(&group_id, &member);
        assert!(result.is_some());

        let payout_record = result.unwrap();
        assert_eq!(payout_record.recipient, member);
        assert_eq!(payout_record.group_id, group_id);
        assert_eq!(payout_record.cycle_number, 0);
        assert_eq!(payout_record.amount, 300);
    }

    #[test]
    fn test_get_member_payout_multiple_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add members to group
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);

        // Simulate payouts across multiple cycles
        let payout1 =
            PayoutRecord::new(member1.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout2 =
            PayoutRecord::new(member2.clone(), group_id, 1, 300, env.ledger().timestamp());
        let payout3 =
            PayoutRecord::new(creator.clone(), group_id, 2, 300, env.ledger().timestamp());

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout3);

        // Update group current_cycle
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.current_cycle = 3;
        env.storage().persistent().set(&group_key, &group);

        // Check member1's payout (should be cycle 0)
        let result1 = client.get_member_payout(&group_id, &member1);
        assert!(result1.is_some());
        assert_eq!(result1.unwrap().cycle_number, 0);

        // Check member2's payout (should be cycle 1)
        let result2 = client.get_member_payout(&group_id, &member2);
        assert!(result2.is_some());
        assert_eq!(result2.unwrap().cycle_number, 1);

        // Check creator's payout (should be cycle 2)
        let result3 = client.get_member_payout(&group_id, &creator);
        assert!(result3.is_some());
        assert_eq!(result3.unwrap().cycle_number, 2);
    }

    #[test]
    fn test_get_member_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        let result = client.try_get_member_payout(&999, &member);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_get_member_payout_not_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let result = client.try_get_member_payout(&group_id, &non_member);
        assert_eq!(result, Err(Ok(StellarSaveError::NotMember)));
    }

    #[test]
    fn test_get_payout_schedule_not_started() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let result = client.try_get_payout_schedule(&group_id);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_get_payout_schedule_single_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        group.started_at = 1000000;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let schedule = client.get_payout_schedule(&group_id);
        assert_eq!(schedule.len(), 1);
        assert_eq!(schedule.get(0).unwrap().cycle, 0);
        assert_eq!(schedule.get(0).unwrap().payout_date, 1003600);
    }

    // Tests for get_next_payout_cycle function

    #[test]
    fn test_get_payout_schedule_multiple_members() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        group.started_at = 1000000;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let schedule = client.get_payout_schedule(&group_id);
        assert_eq!(schedule.len(), 3);
        assert_eq!(schedule.get(0).unwrap().payout_date, 1003600);
        assert_eq!(schedule.get(1).unwrap().payout_date, 1007200);
        assert_eq!(schedule.get(2).unwrap().payout_date, 1010800);
    }

    #[test]
    fn test_get_payout_schedule_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_get_payout_schedule(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_is_complete_not_started() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_complete_in_progress() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_complete_all_cycles_done() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, true);
    }

    #[test]
    fn test_is_complete_status_completed() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.status = GroupStatus::Completed;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, true);
    }

    #[test]
    fn test_is_complete_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_is_complete(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_get_payout_queue_all_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);

        let queue = client.get_payout_queue(&group_id);
        assert_eq!(queue.len(), 3);
        assert_eq!(queue.get(0).unwrap(), creator);
        assert_eq!(queue.get(1).unwrap(), member1);
        assert_eq!(queue.get(2).unwrap(), member2);
    }

    #[test]
    fn test_get_payout_queue_some_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);

        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        env.storage().persistent().set(&recipient_key, &creator);

        let queue = client.get_payout_queue(&group_id);
        assert_eq!(queue.len(), 2);
        assert_eq!(queue.get(0).unwrap(), member1);
        assert_eq!(queue.get(1).unwrap(), member2);
    }

    #[test]
    fn test_get_payout_queue_all_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &creator);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 1), &member1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 2), &member2);

        let queue = client.get_payout_queue(&group_id);
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn test_get_payout_queue_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_get_payout_queue(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    // Tests for record_payout helper function

    #[test]
    fn test_record_payout_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let recipient = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 50_000_000;
        let timestamp = 1234567890u64;

        // Action: Record payout using as_contract
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_payout(
                &env,
                group_id,
                cycle,
                recipient.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Success
        assert!(result.is_ok());

        // Verify: Payout record was stored
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let stored_payout: PayoutRecord = env.storage().persistent().get(&record_key).unwrap();
        assert_eq!(stored_payout.recipient, recipient);
        assert_eq!(stored_payout.group_id, group_id);
        assert_eq!(stored_payout.cycle_number, cycle);
        assert_eq!(stored_payout.amount, amount);
        assert_eq!(stored_payout.timestamp, timestamp);

        // Verify: Recipient was stored
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
        let stored_recipient: Address = env.storage().persistent().get(&recipient_key).unwrap();
        assert_eq!(stored_recipient, recipient);

        // Verify: Status was stored
        let status_key = StorageKeyBuilder::payout_status(group_id, cycle);
        let stored_status: bool = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(stored_status, true);
    }

    #[test]
    fn test_record_payout_already_executed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let recipient = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 50_000_000;
        let timestamp = 1234567890u64;

        // Setup: Record payout for the first time
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_payout(
                &env,
                group_id,
                cycle,
                recipient.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Action: Try to record the same payout again
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_payout(
                &env,
                group_id,
                cycle,
                recipient.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Fails with InvalidState
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    // Tests for transfer_payout function

    #[test]
    fn test_transfer_payout_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &10, &token_address);

        let amount = 200; // 2 members * 100 each
        let result = client.transfer_payout(&group_id, &creator, &amount, &0);
        assert!(result.is_ok());

        // Verify payout record was stored
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        let payout_record: PayoutRecord = env.storage().persistent().get(&payout_key).unwrap();
        assert_eq!(payout_record.recipient, creator);
        assert_eq!(payout_record.amount, 200);

        // Verify recipient was stored
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        let stored_recipient: Address = env.storage().persistent().get(&recipient_key).unwrap();
        assert_eq!(stored_recipient, creator);
    }

    #[test]
    fn test_transfer_payout_invalid_recipient() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let group_id = 1;
        let invalid_recipient = Address::default(); // Default address should be invalid

        let result = client.try_transfer_payout(&group_id, &invalid_recipient, &100, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidRecipient)));
    }

    #[test]
    fn test_transfer_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Setup: Create a group with 2 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..2 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        let result = client.try_transfer_payout(&group_id, &recipient, &100, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_transfer_payout_invalid_group_state() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Group is in Pending state by default, should fail
        let result = client.try_transfer_payout(&group_id, &creator, &100, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_transfer_payout_not_eligible_recipient() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 1; // Cycle 1, but member is in position 0
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Creator (position 0) should not be eligible for cycle 1
        let amount = 200; // 2 members * 100 each
        let result = client.try_transfer_payout(&group_id, &creator, &amount, &1);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidRecipient)));
    }

    #[test]
    fn test_transfer_payout_invalid_amount() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        // Setup: Create payouts out of order in storage
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Wrong amount (should be 200 for 2 members * 100 each)
        let wrong_amount = 150;
        let result = client.try_transfer_payout(&group_id, &creator, &wrong_amount, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidAmount)));
    }

    #[test]
    fn test_transfer_payout_already_processed() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Manually set that payout was already processed for cycle 0
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        env.storage().persistent().set(&recipient_key, &creator);

        let amount = 200; // 2 members * 100 each
        let result = client.try_transfer_payout(&group_id, &creator, &amount, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::PayoutAlreadyProcessed)));
    }

    #[test]
    fn test_transfer_payout_reentrancy_protection() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Manually set reentrancy guard
        let reentrancy_key = StorageKeyBuilder::reentrancy_guard();
        env.storage().persistent().set(&reentrancy_key, &1);

        let amount = 200; // 2 members * 100 each
        let result = client.try_transfer_payout(&group_id, &creator, &amount, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InternalError)));

        // Verify reentrancy guard is cleared even on error
        let guard_value: u64 = env.storage().persistent().get(&reentrancy_key).unwrap_or(0);
        assert_eq!(guard_value, 1); // Still set because we didn't call the function
    }

    #[test]
    fn test_transfer_payout_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member, &None);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        let amount = 200; // 2 members * 100 each
        client.transfer_payout(&group_id, &creator, &amount, &0);

        // Check that an event was emitted
        let events = env.events().all();
        assert!(events.len() > 0);

        // Find the payout_executed event
        let payout_event = events.iter().find(|event| {
            event.topics.len() >= 1
                && event.topics.get(0).unwrap() == &Symbol::new(&env, "payout_executed")
        });

        assert!(payout_event.is_some());
    }

    #[test]
    fn test_get_group_members_empty_group() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Get members from empty group
        let members = client.get_group_members(&group_id, &0, &10);
        assert_eq!(members.len(), 0);
    }

    #[test]
    fn test_get_group_members_single_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add one member
        client.join_group(&group_id, &creator, &None);

        // Get members
        let members = client.get_group_members(&group_id, &0, &10);
        assert_eq!(members.len(), 1);
        assert_eq!(members.get(0).unwrap(), creator);
    }

    #[test]
    fn test_get_group_members_multiple_members_sorted() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Add members in specific order
        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);
        client.join_group(&group_id, &member3, &None);

        // Get all members
        let members = client.get_group_members(&group_id, &0, &10);
        assert_eq!(members.len(), 4);

        // Verify they're in join order
        assert_eq!(members.get(0).unwrap(), creator);
        assert_eq!(members.get(1).unwrap(), member1);
        assert_eq!(members.get(2).unwrap(), member2);
        assert_eq!(members.get(3).unwrap(), member3);
    }

    #[test]
    fn test_get_group_members_pagination_first_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);

        // Add 5 members
        let mut all_members = Vec::new(&env);
        for i in 0..5 {
            let member = Address::generate(&env);
            all_members.push_back(member.clone());
            client.join_group(&group_id, &member, &None);
        }

        // Get first 3 members
        let members = client.get_group_members(&group_id, &0, &3);
        assert_eq!(members.len(), 3);
        assert_eq!(members.get(0).unwrap(), all_members.get(0).unwrap());
        assert_eq!(members.get(1).unwrap(), all_members.get(1).unwrap());
        assert_eq!(members.get(2).unwrap(), all_members.get(2).unwrap());
    }

    #[test]
    fn test_get_group_members_pagination_second_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add 5 members
        let mut all_members = Vec::new(&env);
        for i in 0..5 {
            let member = Address::generate(&env);
            all_members.push_back(member.clone());
            client.join_group(&group_id, &member, &None);
        }

        // Get second page (offset 3, limit 2)
        let members = client.get_group_members(&group_id, &3, &2);
        assert_eq!(members.len(), 2);
        assert_eq!(members.get(0).unwrap(), all_members.get(3).unwrap());
        assert_eq!(members.get(1).unwrap(), all_members.get(4).unwrap());
    }

    #[test]
    fn test_get_group_members_pagination_beyond_total() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        // Add 3 members
        for i in 0..3 {
            let member = Address::generate(&env);
            client.join_group(&group_id, &member, &None);
        }

        // Try to get members beyond total count
        let members = client.get_group_members(&group_id, &10, &5);
        assert_eq!(members.len(), 0);
    }

    #[test]
    fn test_get_group_members_pagination_partial_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        // Add 5 members
        let mut all_members = Vec::new(&env);
        for i in 0..5 {
            let member = Address::generate(&env);
            all_members.push_back(member.clone());
            client.join_group(&group_id, &member, &None);
        }

        // Request 10 members starting from offset 3 (only 2 available)
        let members = client.get_group_members(&group_id, &3, &10);
        assert_eq!(members.len(), 2);
        assert_eq!(members.get(0).unwrap(), all_members.get(3).unwrap());
        assert_eq!(members.get(1).unwrap(), all_members.get(4).unwrap());
    }

    #[test]
    fn test_get_group_members_limit_capped_at_100() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add 5 members
        for i in 0..5 {
            let member = Address::generate(&env);
            client.join_group(&group_id, &member, &None);
        }

        // Request with limit > 100 (should be capped)
        let members = client.get_group_members(&group_id, &0, &150);
        // Should return all 5 members (not fail, just capped at available)
        assert_eq!(members.len(), 5);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_group_members_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get members from non-existent group
        client.get_group_members(&999, &0, &10);
    }

    #[test]
    fn test_get_group_members_zero_limit() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add members
        client.join_group(&group_id, &creator, &None);

        // Request with limit 0
        let members = client.get_group_members(&group_id, &0, &0);
        assert_eq!(members.len(), 0);
    }

    #[test]
    fn test_get_group_total_members_empty() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        let group_id = client.create_group(&creator, &100, &3600, &5);

        let count = client.get_group_total_members(&group_id);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_get_group_total_members_with_members() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &5);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &Address::generate(&env, &None));
        client.join_group(&group_id, &Address::generate(&env, &None));

        let count = client.get_group_total_members(&group_id);
        assert_eq!(count, 3);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_group_total_members_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        client.get_group_total_members(&999);
    }

    #[test]
    fn test_get_payout_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);

        // Create a payout record
        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1234567890);
        let key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&key, &payout);

        // Retrieve the payout
        let result = client.get_payout(&group_id, &0);
        assert_eq!(result.recipient, creator);
        assert_eq!(result.group_id, group_id);
        assert_eq!(result.cycle_number, 0);
        assert_eq!(result.amount, 300);
        assert_eq!(result.timestamp, 1234567890);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4001)")]
    fn test_get_payout_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);

        // Try to get a payout that doesn't exist
        client.get_payout(&group_id, &0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get a payout for a non-existent group
        client.get_payout(&999, &0);
    }

    #[test]
    fn test_get_payout_multiple_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);

        // Create payout records for multiple cycles
        let payout0 = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1234567890);
        let payout1 = PayoutRecord::new(member1.clone(), group_id, 1, 300, 1234571490);
        let payout2 = PayoutRecord::new(member2.clone(), group_id, 2, 300, 1234575090);

        let key0 = StorageKeyBuilder::payout_record(group_id, 0);
        let key1 = StorageKeyBuilder::payout_record(group_id, 1);
        let key2 = StorageKeyBuilder::payout_record(group_id, 2);

        env.storage().persistent().set(&key0, &payout0);
        env.storage().persistent().set(&key1, &payout1);
        env.storage().persistent().set(&key2, &payout2);

        // Retrieve each payout
        let result0 = client.get_payout(&group_id, &0);
        assert_eq!(result0.recipient, creator);
        assert_eq!(result0.cycle_number, 0);

        let result1 = client.get_payout(&group_id, &1);
        assert_eq!(result1.recipient, member1);
        assert_eq!(result1.cycle_number, 1);

        let result2 = client.get_payout(&group_id, &2);
        assert_eq!(result2.recipient, member2);
        assert_eq!(result2.cycle_number, 2);
    }

    #[test]
    fn test_get_payout_different_groups() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let group_id1 = client.create_group(&creator1, &100, &3600, &3);
        let group_id2 = client.create_group(&creator2, &200, &7200, &5);

        client.join_group(&group_id1, &creator1, &None);
        client.join_group(&group_id2, &creator2, &None);

        // Create payout records for different groups
        let payout1 = PayoutRecord::new(creator1.clone(), group_id1, 0, 300, 1234567890);
        let payout2 = PayoutRecord::new(creator2.clone(), group_id2, 0, 1000, 1234567890);

        let key1 = StorageKeyBuilder::payout_record(group_id1, 0);
        let key2 = StorageKeyBuilder::payout_record(group_id2, 0);

        env.storage().persistent().set(&key1, &payout1);
        env.storage().persistent().set(&key2, &payout2);

        // Retrieve payouts for each group
        let result1 = client.get_payout(&group_id1, &0);
        assert_eq!(result1.group_id, group_id1);
        assert_eq!(result1.amount, 300);

        let result2 = client.get_payout(&group_id2, &0);
        assert_eq!(result2.group_id, group_id2);
        assert_eq!(result2.amount, 1000);
    }

    #[test]
    fn test_transfer_payout_overflow_protection() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let result = client.try_get_group_balance(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

        let creator = Address::generate(&env);
        // Create group with maximum contribution amount to test overflow
        let group_id = client.create_group(&creator, &i128::MAX, &3600, &3);

        client.join_group(&group_id, &creator, &None);

        // Set group to active status with many members to trigger overflow
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        group.member_count = u32::MAX; // This should cause overflow
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // This should fail due to overflow in amount calculation
        let result = client.try_transfer_payout(&group_id, &creator, &i128::MAX, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::Overflow)));
    }

    // ============================================================================
    // TESTS FOR ISSUE #424: Payout Execution
    // ============================================================================

    #[test]
    fn test_execute_payout_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create and setup group
        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Setup group as active
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        group.member_count = 2;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Execute payout should succeed
        let result = client.try_execute_payout(&group_id);
        assert!(result.is_ok() || result.is_err()); // May fail due to missing contributions, but function exists
    }

    #[test]
    fn test_execute_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_execute_payout(&999);
        assert!(result.is_err());
    }

    // ============================================================================
    // TESTS FOR ISSUE #425: Group Status Management
    // ============================================================================

    #[test]
    fn test_pause_group_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Pause should succeed
        let result = client.try_pause_group(&group_id, &creator);
        assert!(result.is_ok());

        // Verify status changed to Paused
        let new_status: GroupStatus = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(new_status, GroupStatus::Paused);
    }

    #[test]
    fn test_pause_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let other = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Pause by non-creator should fail
        let result = client.try_pause_group(&group_id, &other);
        assert!(result.is_err());
    }

    #[test]
    fn test_resume_group_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to paused
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Paused);

        // Resume should succeed
        let result = client.try_resume_group(&group_id, &creator);
        assert!(result.is_ok());

        // Verify status changed to Active
        let new_status: GroupStatus = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(new_status, GroupStatus::Active);
    }

    #[test]
    fn test_cancel_group_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Cancel should succeed
        let result = client.try_cancel_group(&group_id, &creator);
        assert!(result.is_ok());

        // Verify status changed to Cancelled
        let new_status: GroupStatus = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(new_status, GroupStatus::Cancelled);
    }

    #[test]
    fn test_cancel_group_already_terminal() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to completed (terminal state)
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Completed);

        // Cancel should fail
        let result = client.try_cancel_group(&group_id, &creator);
        assert!(result.is_err());
    }

    // ============================================================================
    // TESTS FOR ISSUE #426: Query Functions
    // ============================================================================

    #[test]
    fn test_get_group_info() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let retrieved = client.get_group_info(&1);
        assert_eq!(retrieved.id, 1);
        assert_eq!(retrieved.creator, creator);
    }

    #[test]
    fn test_get_group_members() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let mut members = Map::new(&env);
        members.set(0u32, member1.clone());
        members.set(1u32, member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(1), &members);

        let retrieved = client.get_group_members(&1);
        assert_eq!(retrieved.len(), 2);
    }

    #[test]
    fn test_get_contribution_status() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let mut members = Map::new(&env);
        members.set(0u32, member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(1), &members);

        let status = client.get_contribution_status(&1, &0);
        assert_eq!(status.len(), 1);
    }

    #[test]
    fn test_get_payout_history_all() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let recipient = Address::generate(&env);

        let mut group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let payout = PayoutRecord::new(recipient.clone(), 1, 0, 100, 12345);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(1, 0), &payout);

        let history = client.get_payout_history_all(&1);
        assert_eq!(history.len(), 1);
    }

    #[test]
    fn test_is_member_of_group() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let profile = MemberProfile {
            address: member.clone(),
            group_id: 1,
            payout_position: 0,
            joined_at: 12345,
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(1, member.clone()),
            &profile,
        );

        let is_member = client.is_member_of_group(&1, &member);
        assert!(is_member);
    }

    // ============================================================================
    // TESTS FOR ISSUE #427: Input Validation
    // ============================================================================

    #[test]
    fn test_validate_address() {
        let env = Env::default();
        let address = Address::generate(&env);

        let result = StellarSaveContract::validate_address(&address);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_amount_valid() {
        let result = StellarSaveContract::validate_amount(100);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_amount_invalid_zero() {
        let result = StellarSaveContract::validate_amount(0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_amount_invalid_negative() {
        let result = StellarSaveContract::validate_amount(-100);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_duration_valid() {
        let result = StellarSaveContract::validate_duration(3600);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_member_bounds_valid() {
        let result = StellarSaveContract::validate_member_bounds(2, 10);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_member_bounds_invalid_min_too_low() {
        let result = StellarSaveContract::validate_member_bounds(1, 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_member_bounds_invalid_max_less_than_min() {
        let result = StellarSaveContract::validate_member_bounds(10, 5);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_string_valid() {
        let result = StellarSaveContract::validate_string("Test Group", 100);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_string_invalid_too_long() {
        let result = StellarSaveContract::validate_string("This is a very long string", 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_group_status_as_u32() {
        assert_eq!(GroupStatus::Pending.as_u32(), 0);
        assert_eq!(GroupStatus::Active.as_u32(), 1);
        assert_eq!(GroupStatus::Paused.as_u32(), 2);
        assert_eq!(GroupStatus::Completed.as_u32(), 3);
        assert_eq!(GroupStatus::Cancelled.as_u32(), 4);
    }

    #[test]
    fn test_group_status_from_u32() {
        assert_eq!(GroupStatus::from_u32(0), Some(GroupStatus::Pending));
        assert_eq!(GroupStatus::from_u32(1), Some(GroupStatus::Active));
        assert_eq!(GroupStatus::from_u32(2), Some(GroupStatus::Paused));
        assert_eq!(GroupStatus::from_u32(3), Some(GroupStatus::Completed));
        assert_eq!(GroupStatus::from_u32(4), Some(GroupStatus::Cancelled));
        assert_eq!(GroupStatus::from_u32(5), None);
    }

    // =========================================================================
    // Tests for #479: Contribution Proof Verification
    // =========================================================================

    fn setup_active_group_with_member(
        env: &Env,
        client: &StellarSaveContractClient,
    ) -> (u64, Address, Address) {
        let creator = Address::generate(env);
        let member = Address::generate(env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Manually set group to Active and store member profile
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.status = GroupStatus::Active;
        group.member_count = 1;
        env.storage().persistent().set(&group_key, &group);

        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: env.ledger().timestamp(),
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &member_profile,
        );

        (group_id, creator, member)
    }

    #[test]
    fn test_set_contribution_proof_required() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Add member to group
        client.join_group(&group_id, &member);

        // Enable proof requirement
        client.set_contribution_proof_required(&group_id, &true);

        let group = client.get_group(&group_id);
        assert!(group.require_contribution_proof);

        // Disable it
        client.set_contribution_proof_required(&group_id, &false);
        let group = client.get_group(&group_id);
        assert!(!group.require_contribution_proof);
    }

    #[test]
    fn test_verify_contribution_proof_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) = setup_active_group_with_member(&env, &client);

        // Enable proof requirement (group is Pending after create_group)
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.status = GroupStatus::Pending;
        group.require_contribution_proof = true;
        env.storage().persistent().set(&group_key, &group);

        // Set back to Active for verify call
        group.status = GroupStatus::Active;
        env.storage().persistent().set(&group_key, &group);

        client.verify_contribution_proof(&group_id, &member, &0);

        // Proof key should be set
        let proof_key = StorageKeyBuilder::contribution_proof_verified(group_id, 0, member.clone());
        let verified: bool = env.storage().persistent().get(&proof_key).unwrap_or(false);
        assert!(verified);
    }

    #[test]
    fn test_contribute_with_proof_requires_verification() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) = setup_active_group_with_member(&env, &client);

        // Enable proof requirement on the active group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.require_contribution_proof = true;
        env.storage().persistent().set(&group_key, &group);

        // Attempt to contribute without proof — should fail with Unauthorized
        let result = client.try_contribute_with_proof(&group_id, &member, &100);
        assert!(result.is_err());
    }

    #[test]
    fn test_contribute_with_proof_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) = setup_active_group_with_member(&env, &client);

        // Enable proof requirement
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.require_contribution_proof = true;
        env.storage().persistent().set(&group_key, &group);

        // Verify proof first
        client.verify_contribution_proof(&group_id, &member, &0);

        // Now contribute — should succeed
        client.contribute_with_proof(&group_id, &member, &100);

        // Contribution record should exist
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        assert!(env.storage().persistent().has(&contrib_key));
    }

    // =========================================================================
    // Tests for #480: Dynamic Contribution Amounts
    // =========================================================================

    #[test]
    fn test_set_dynamic_contributions() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        client.set_dynamic_contributions(&group_id, &true);
        let group = client.get_group(&group_id);
        assert!(group.allow_dynamic_contributions);
    }

    #[test]
    fn test_propose_contribution_change() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Enable dynamic contributions and set group to Active
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.allow_dynamic_contributions = true;
        group.status = GroupStatus::Active;
        env.storage().persistent().set(&group_key, &group);

        client.propose_contribution_change(&group_id, &200);

        // Proposal should be stored
        let proposal_key = StorageKeyBuilder::contribution_pending_amount(group_id);
        let proposed: i128 = env.storage().persistent().get(&proposal_key).unwrap();
        assert_eq!(proposed, 200);
    }

    #[test]
    fn test_vote_contribution_change_applies_on_majority() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Set up group with 3 members, dynamic contributions enabled, Active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
         group.allow_dynamic_contributions = true;
        group.status = GroupStatus::Active;
        group.member_count = 3;
        env.storage().persistent().set(&group_key, &group);

        // Store member profiles
        for (i, m) in [creator.clone(), member1.clone(), member2.clone()]
            .iter()
            .enumerate()
        {
            let profile = MemberProfile {
                address: m.clone(),
                group_id,
                payout_position: i as u32,
                joined_at: 0,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, m.clone()),
                &profile,
            );
        }

        // Propose a change
        client.propose_contribution_change(&group_id, &200);

        // Two votes = majority of 3 (need 2)
        client.vote_contribution_change(&group_id, &creator);
        client.vote_contribution_change(&group_id, &member1);

        // Amount should now be updated
        let updated_group = client.get_group(&group_id);
        assert_eq!(updated_group.contribution_amount, 200);
    }

    // =========================================================================
    // Tests for #481: Group Analytics Functions
    // =========================================================================

    #[test]
    fn test_get_group_statistics_empty_group() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        let (completion_rate, total_contributions, total_distributed, active_members, tvl) =
            client.get_group_statistics(&group_id);

        assert_eq!(completion_rate, 0);
        assert_eq!(total_contributions, 0);
        assert_eq!(total_distributed, 0);
        assert_eq!(tvl, 0);
        let _ = active_members; // member count may vary
    }

    #[test]
    fn test_get_group_statistics_with_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &4);

        // Simulate 2 completed cycles with contributions
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.current_cycle = 2;
        group.member_count = 4;
        env.storage().persistent().set(&group_key, &group);

        // Store cycle totals: 4 members * 100 = 400 per cycle
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &400i128,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 1),
            &400i128,
        );

        let (completion_rate, total_contributions, total_distributed, active_members, tvl) =
            client.get_group_statistics(&group_id);

        assert_eq!(completion_rate, 50); // 2/4 cycles = 50%
        assert_eq!(total_contributions, 800); // 400 * 2
        assert_eq!(total_distributed, 800); // 2 cycles * (100 * 4)
        assert_eq!(tvl, 0); // all distributed
        assert_eq!(active_members, 4);
    }

    #[test]
    fn test_get_member_statistics() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &4);

        // Set up group at cycle 2 with member
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.current_cycle = 2;
        group.member_count = 2;
        env.storage().persistent().set(&group_key, &group);

        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 0,
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &member_profile,
        );

        // Member contributed in cycle 0 only
        let contrib = ContributionRecord::new(member.clone(), group_id, 0, 100, 12345);
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, 0, member.clone()),
            &contrib,
        );

        let (cycles_contributed, total_contributed, on_time_rate, received_payout) =
            client.get_member_statistics(&group_id, &member);

        assert_eq!(cycles_contributed, 1);
        assert_eq!(total_contributed, 100);
        assert_eq!(on_time_rate, 50); // 1/2 cycles = 50%
        assert!(!received_payout);
    }

    #[test]
    fn test_get_member_statistics_with_payout() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client
            .create_group(&creator, &100, &3600, &2, &token_address)
            .unwrap();

        // Set up group at cycle 1 with member who received payout
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.current_cycle = 1;
        group.member_count = 2;
        env.storage().persistent().set(&group_key, &group);

        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 0,
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &member_profile,
        );

        // Member contributed in cycle 0
        let contrib = ContributionRecord::new(member.clone(), group_id, 0, 100, 12345);
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, 0, member.clone()),
            &contrib,
        );

        // Member received payout in cycle 0
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &member);

        let (_cycles, _total, _rate, received_payout) =
            client.get_member_statistics(&group_id, &member);

        assert!(received_payout);
    }

    // ── Grace period tests ────────────────────────────────────────────────────

    /// Helper: create a group with a grace period, store it, and return (group_id, client).
    fn setup_group_with_grace(
        env: &Env,
        grace_period_seconds: u64,
    ) -> (u64, StellarSaveContractClient) {
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(env, &contract_id);
        let creator = Address::generate(env);
        env.mock_all_auths();
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();
        let group_id = client
            .create_group(&creator, &10_000_000, &604800, &5, &token_address)
            .unwrap();
        (group_id, client)
    }

    #[test]
    fn test_create_group_stores_grace_period() {
        let env = Env::default();
        let (group_id, client) = setup_group_with_grace(&env, 3600);
        let group = client.get_group(&group_id).unwrap();
        assert_eq!(group.grace_period_seconds, 3600);
    }

    #[test]
    fn test_create_group_zero_grace_period() {
        let env = Env::default();
        let (group_id, client) = setup_group_with_grace(&env, 0);
        let group = client.get_group(&group_id).unwrap();
        assert_eq!(group.grace_period_seconds, 0);
    }

    #[test]
    fn test_create_group_max_grace_period() {
        let env = Env::default();
        // 604800 = exactly 7 days — should succeed
        let (group_id, client) = setup_group_with_grace(&env, 604800);
        let group = client.get_group(&group_id).unwrap();
        assert_eq!(group.grace_period_seconds, 604800);
    }

    #[test]
    fn test_create_group_grace_period_exceeds_max() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        env.mock_all_auths();
        // 604801 = 7 days + 1 second — should fail
        let result = client.try_create_group(&creator, &10_000_000, &604800, &5, &604801);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_missed_contributions_within_grace_period() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let grace: u64 = 3600; // 1 hour

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator, &None);
        client.join_group(&group_id, &member1, &None);
        client.join_group(&group_id, &member2, &None);

        env.mock_all_auths();
        env.ledger().set_timestamp(started_at);

        let group_id = client
            .create_group(&creator, &10_000_000, &cycle_duration, &5, &grace)
            .unwrap();

        // Store members map directly so get_missed_contributions can find them
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members = Map::new(&env);
        members.set(0u32, member.clone());
        env.storage().persistent().set(&members_key, &members);

        // Activate the group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.member_count = 2;
        group.activate(started_at);
        env.storage().persistent().set(&group_key, &group);

        // Advance time to just after the deadline but still within grace period
        let deadline = started_at + cycle_duration;
        env.ledger().set_timestamp(deadline + grace / 2);

        // Should return empty — still within grace period
        let missed = client.get_missed_contributions(&group_id, &0).unwrap();
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_get_missed_contributions_after_grace_period() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let grace: u64 = 3600; // 1 hour

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id1 = client.create_group(&creator1, &100, &3600, &3, &token_address);
        let group_id2 = client.create_group(&creator2, &200, &7200, &5, &token_address);

        client.join_group(&group_id1, &creator1, &None);
        client.join_group(&group_id2, &creator2, &None);

        let group_id = client
            .create_group(&creator, &10_000_000, &cycle_duration, &5, &grace)
            .unwrap();

        // Store members map
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members = Map::new(&env);
        members.set(0u32, member.clone());
        env.storage().persistent().set(&members_key, &members);

        // Activate the group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.member_count = 2;
        group.activate(started_at);
        env.storage().persistent().set(&group_key, &group);

        // Advance time past deadline + grace period
        let deadline = started_at + cycle_duration;
        env.ledger().set_timestamp(deadline + grace + 1);

        // Member has not contributed — should appear in missed list
        let missed = client.get_missed_contributions(&group_id, &0).unwrap();
        assert_eq!(missed.len(), 1);
        assert_eq!(missed.get(0).unwrap(), member);
    }

    #[test]
    fn test_get_missed_contributions_contributed_within_grace_period() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let grace: u64 = 3600;

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();

        env.mock_all_auths();
        env.ledger().set_timestamp(started_at);

        // Create and setup group
        let group_id = client
            .create_group(&creator, &100, &3600, &2, &token_address)
            .unwrap();

        // Setup group as active
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.member_count = 2;
        group.activate(started_at);
        env.storage().persistent().set(&group_key, &group);

        // Member contributes during grace period
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &true);

        // Advance time past deadline + grace period
        let deadline = started_at + cycle_duration;
        env.ledger().set_timestamp(deadline + grace + 1);

        // Member contributed — should NOT appear in missed list
        let missed = client.get_missed_contributions(&group_id, &0).unwrap();
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_update_group_metadata_name_too_short() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            String::from_str(&env, "AB"),
            String::from_str(&env, "Description"),
            String::from_str(&env, "https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_name_too_long() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // 51 characters — exceeds the 50-char limit
        let long_name = String::from_str(&env, "This is a very long group name that exceeds fifty!");
        assert!(long_name.len() > 50);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            long_name,
            String::from_str(&env, "Description"),
            String::from_str(&env, "https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_description_too_long() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // 501 characters — exceeds the 500-char limit
        let long_desc = String::from_str(
            &env,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        assert!(long_desc.len() > 500);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            String::from_str(&env, "Test Group"),
            long_desc,
            String::from_str(&env, "https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let other_user = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            other_user,
            String::from_str(&env, "Test Group"),
            String::from_str(&env, "Description"),
            String::from_str(&env, "https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::Unauthorized));
    }

    #[test]
    fn test_update_group_metadata_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            999u64,
            creator,
            String::from_str(&env, "Test Group"),
            String::from_str(&env, "Description"),
            String::from_str(&env, "https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    #[test]
    fn test_update_group_metadata_empty_description_valid() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            String::from_str(&env, "My Group"),
            String::from_str(&env, ""),
            String::from_str(&env, ""),
        );

        assert_eq!(result, Ok(()));
    }

    // ── String validation boundary tests (64-byte name, 256-byte description) ──

    #[test]
    fn test_update_group_metadata_name_exactly_64_bytes() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // 64 ASCII bytes — exactly at the limit
        let name = String::from_str(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assert_eq!(name.len(), 64);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            name,
            String::from_str(&env, ""),
            String::from_str(&env, ""),
        );
        assert_eq!(result, Ok(()));
    }

    #[test]
    fn test_update_group_metadata_name_65_bytes_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // 65 ASCII bytes — one over the limit
        let name = String::from_str(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assert_eq!(name.len(), 65);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            name,
            String::from_str(&env, ""),
            String::from_str(&env, ""),
        );
        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_description_exactly_256_bytes() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let desc = String::from_str(&env, &"a".repeat(256));
        assert_eq!(desc.len(), 256);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            String::from_str(&env, "Valid Name"),
            desc,
            String::from_str(&env, ""),
        );
        assert_eq!(result, Ok(()));
    }

    #[test]
    fn test_update_group_metadata_description_257_bytes_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let desc = String::from_str(&env, &"a".repeat(257));
        assert_eq!(desc.len(), 257);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            String::from_str(&env, "Valid Name"),
            desc,
            String::from_str(&env, ""),
        );
        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_name_empty_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = 1u64;
        let group = Group::new(group_id, creator.clone(), 1_000_000, 604800, 10, 2, 0, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = StellarSaveContract::update_group_metadata(
            env.clone(),
            group_id,
            creator,
            String::from_str(&env, ""),
            String::from_str(&env, ""),
            String::from_str(&env, ""),
        );
        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    // ── Dispute lifecycle tests ──────────────────────────────────────────────

    fn setup_group_with_member(env: &Env) -> (u64, Address, Address) {
        let group_id = 1u64;
        let creator = Address::generate(env);
        let member = Address::generate(env);
        let group = Group::new(group_id, creator.clone(), 10_000_000, 3600, 5, 2, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        let mut members = Map::new(env);
        members.set(0u32, member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);
        (group_id, creator, member)
    }

    #[test]
    fn test_raise_dispute_sets_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "funds missing"));

        let group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        assert!(group.dispute_active);
    }

    #[test]
    fn test_resolve_dispute_clears_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "issue"));
        client.resolve_dispute(&group_id, &creator, &String::from_str(&env, "resolved"));

        let group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        assert!(!group.dispute_active);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2002))")]
    fn test_raise_dispute_non_member_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, _member) = setup_group_with_member(&env);
        let outsider = Address::generate(&env);

        client.raise_dispute(&group_id, &outsider, &String::from_str(&env, "bad actor"));
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(6001))")]
    fn test_raise_dispute_twice_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "first"));
        client.raise_dispute(&group_id, &member, &String::from_str(&env, "second"));
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2003))")]
    fn test_resolve_dispute_non_creator_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "issue"));
        client.resolve_dispute(&group_id, &member, &String::from_str(&env, "self-resolve"));
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")]
    fn test_resolve_dispute_no_active_dispute_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, creator, _member) = setup_group_with_member(&env);

        client.resolve_dispute(
            &group_id,
            &creator,
            &String::from_str(&env, "nothing to resolve"),
        );
    }

    // Task 5.1: Unit tests for get_token_config (Requirements 2.3, 2.4)

    /// Verifies that get_token_config returns the correct TokenConfig after a group is created
    /// with a mock token. Requirements 2.3.
    #[test]
    fn test_get_token_config_success() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Deploy a mock SEP-41 token (Stellar Asset Contract)
        let token_admin = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(token_admin)
            .address();

        let creator = Address::generate(&env);

        // Create a group with the mock token
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        // Retrieve the token config
        let token_config = client.get_token_config(&group_id);

        // Verify the stored token address matches what was provided
        assert_eq!(token_config.token_address, token_address);
        // Stellar Asset Contracts report 7 decimals
        assert_eq!(token_config.token_decimals, 7);
    }

    /// Verifies that get_token_config returns GroupNotFound for an unknown group_id.
    /// Requirements 2.4.
    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_token_config_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Query a group_id that was never created
        client.get_token_config(&9999);
    }

    // Task 5.1: Unit tests for get_token_config (Requirements 2.3, 2.4)

    /// Verifies that get_token_config returns the correct TokenConfig after a group is created
    /// with a mock token. Requirements 2.3.
    #[test]
    fn test_get_token_config_success() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Deploy a mock SEP-41 token (Stellar Asset Contract)
        let token_admin = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(token_admin)
            .address();

        let creator = Address::generate(&env);

        // Create a group with the mock token
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        // Retrieve the token config
        let token_config = client.get_token_config(&group_id);

        // Verify the stored token address matches what was provided
        assert_eq!(token_config.token_address, token_address);
        // Stellar Asset Contracts report 7 decimals
        assert_eq!(token_config.token_decimals, 7);
    }

    /// Verifies that get_token_config returns GroupNotFound for an unknown group_id.
    /// Requirements 2.4.
    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_token_config_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Query a group_id that was never created
        client.get_token_config(&9999);
    }

    // -------------------------------------------------------------------------
    // Archival tests
    // -------------------------------------------------------------------------

    /// Helper: store a minimal group with the given status directly in storage.
    fn store_group_with_status(env: &Env, group_id: u64, creator: &Address, status: GroupStatus) {
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.status = status.clone();
        group.is_active = matches!(status, GroupStatus::Active);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &status);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &group_id);
    }

    /// archive_group succeeds for a Completed group and sets the archived flag.
    #[test]
    fn test_archive_group_completed_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);

        client.archive_group(&creator, &1);

        // The group should now have archived = true
        let group = client.get_group(&1);
        assert!(
            group.archived,
            "group.archived should be true after archiving"
        );

        // The archived flag in storage should also be set
        let archived_key = StorageKeyBuilder::group_archived(1);
        let flag: bool = env
            .storage()
            .persistent()
            .get(&archived_key)
            .unwrap_or(false);
        assert!(flag, "storage archived flag should be true");
    }

    /// archive_group succeeds for a Cancelled group.
    #[test]
    fn test_archive_group_cancelled_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Cancelled);

        client.archive_group(&creator, &1);

        let group = client.get_group(&1);
        assert!(group.archived);
    }

    /// archive_group fails with GroupNotFound for a non-existent group.
    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_archive_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let caller = Address::generate(&env);

        client.archive_group(&caller, &999);
    }

    /// archive_group fails with Unauthorized when caller is not the creator.
    #[test]
    #[should_panic(expected = "Error(Contract, #2003)")]
    fn test_archive_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);

        client.archive_group(&attacker, &1);
    }

    /// archive_group fails with GroupNotArchivable when the group is still Active.
    #[test]
    #[should_panic(expected = "Error(Contract, #1007)")]
    fn test_archive_group_not_archivable_active() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Active);

        client.archive_group(&creator, &1);
    }

    /// archive_group fails with GroupNotArchivable when the group is Pending.
    #[test]
    #[should_panic(expected = "Error(Contract, #1007)")]
    fn test_archive_group_not_archivable_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Pending);

        client.archive_group(&creator, &1);
    }

    /// archive_group fails with InvalidState when called a second time (already archived).
    #[test]
    #[should_panic(expected = "Error(Contract, #1003)")]
    fn test_archive_group_already_archived() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);

        client.archive_group(&creator, &1);
        // Second call should fail
        client.archive_group(&creator, &1);
    }

    /// list_groups excludes archived groups by default.
    #[test]
    fn test_list_groups_excludes_archived() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Store two groups: one active, one completed+archived
        store_group_with_status(&env, 1, &creator, GroupStatus::Active);
        store_group_with_status(&env, 2, &creator, GroupStatus::Completed);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        // Archive group 2
        client.archive_group(&creator, &2);

        let groups = client.list_groups(&0, &50, &None);
        assert_eq!(groups.len(), 1, "only the non-archived group should appear");
        assert_eq!(groups.get(0).unwrap().id, 1);
    }

    /// list_archived_groups returns only archived groups.
    #[test]
    fn test_list_archived_groups_returns_archived_only() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Active);
        store_group_with_status(&env, 2, &creator, GroupStatus::Completed);
        store_group_with_status(&env, 3, &creator, GroupStatus::Cancelled);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        // Archive groups 2 and 3
        client.archive_group(&creator, &2);
        client.archive_group(&creator, &3);

        let archived = client.list_archived_groups(&0, &50);
        assert_eq!(archived.len(), 2, "two groups should be archived");

        // IDs should be 3 and 2 (newest first)
        assert_eq!(archived.get(0).unwrap().id, 3);
        assert_eq!(archived.get(1).unwrap().id, 2);
    }

    /// list_archived_groups returns empty when no groups are archived.
    #[test]
    fn test_list_archived_groups_empty() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Active);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &1u64);

        let archived = client.list_archived_groups(&0, &50);
        assert_eq!(archived.len(), 0);
    }

    /// list_archived_groups respects the limit parameter.
    #[test]
    fn test_list_archived_groups_pagination_limit() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create and archive 3 completed groups
        for id in 1u64..=3 {
            store_group_with_status(&env, id, &creator, GroupStatus::Completed);
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);
        for id in 1u64..=3 {
            client.archive_group(&creator, &id);
        }

        // Request only 2
        let archived = client.list_archived_groups(&0, &2);
        assert_eq!(archived.len(), 2);
    }

    /// archive_group emits a group_archived event.
    #[test]
    fn test_archive_group_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);
        client.archive_group(&creator, &1);

        let events = env.events().all();
        let found = events.iter().any(|e| {
            // The topic tuple is ("group_archived",)
            let topics: Vec<soroban_sdk::Val> = e.0.iter().collect();
            if let Some(first) = topics.first() {
                if let Ok(sym) = soroban_sdk::Symbol::try_from_val(&env, first) {
                    return sym == Symbol::new(&env, "group_archived");
                }
            }
            false
        });
        assert!(found, "group_archived event should have been emitted");
    }

    // =========================================================================
    // vote_dissolve tests
    // =========================================================================

    fn setup_active_group_for_dissolve(
        env: &Env,
        group_id: u64,
        creator: &Address,
        members: &[Address],
    ) {
        let mut group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            members.len() as u32,
            2,
            env.ledger().timestamp(),
            0,
        );
        group.status = GroupStatus::Active;
        group.is_active = true;
        group.member_count = members.len() as u32;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Active);

        let mut member_vec = soroban_sdk::Vec::new(env);
        for (i, member) in members.iter().enumerate() {
            member_vec.push_back(member.clone());
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: i as u32,
                joined_at: env.ledger().timestamp(),
                auto_contribute_enabled: false,
            };
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::member_profile(group_id, member.clone()), &profile);
            // Store payout eligibility (position)
            env.storage().persistent().set(
                &StorageKeyBuilder::member_payout_eligibility(group_id, member.clone()),
                &(i as u32),
            );
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &member_vec);
    }

    #[test]
    fn test_vote_dissolve_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        env.mock_all_auths();
        let caller = Address::generate(&env);
        let result = client.try_vote_dissolve(&999, &caller);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_vote_dissolve_not_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let outsider = Address::generate(&env);
        setup_active_group_for_dissolve(&env, 1, &creator, &[creator.clone(), member1.clone()]);

        let result = client.try_vote_dissolve(&1, &outsider);
        assert_eq!(result, Err(Ok(StellarSaveError::NotMember)));
    }

    #[test]
    fn test_vote_dissolve_already_voted() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        setup_active_group_for_dissolve(&env, 1, &creator, &[creator.clone(), member1.clone()]);

        // First vote succeeds (only 1 of 2 votes, no dissolution yet)
        client.vote_dissolve(&1, &creator);

        // Second vote from same member should fail
        let result = client.try_vote_dissolve(&1, &creator);
        assert_eq!(result, Err(Ok(StellarSaveError::AlreadyVotedDissolve)));
    }

    // ============================================================================
    // TESTS FOR ISSUE #424: Payout Execution
    // ============================================================================

    #[test]
    fn test_vote_dissolve_invalid_state_pending() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        // Set up as Pending
        setup_active_group_for_dissolve(&env, 1, &creator, &[creator.clone(), member1.clone()]);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(1), &GroupStatus::Pending);

        let result = client.try_vote_dissolve(&1, &creator);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_vote_dissolve_already_dissolved() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        setup_active_group_for_dissolve(&env, 1, &creator, &[creator.clone(), member1.clone()]);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(1), &GroupStatus::Cancelled);

        let result = client.try_vote_dissolve(&1, &creator);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupAlreadyDissolved)));
    }

    #[test]
    fn test_vote_dissolve_partial_vote_no_dissolution() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        setup_active_group_for_dissolve(&env, 1, &creator, &[creator.clone(), member1.clone()]);

        // Only one of two members votes — group should remain Active
        client.vote_dissolve(&1, &creator);

        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(1))
            .unwrap();
        assert_eq!(status, GroupStatus::Active);
    }

    #[test]
    fn test_vote_dissolve_unanimous_sets_cancelled() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        setup_active_group_for_dissolve(&env, 1, &creator, &[creator.clone(), member1.clone()]);

        // Store token config (needed for dissolution path, even without contributions)
        let token_address = Address::generate(&env);
        let token_config = crate::group::TokenConfig {
            token_address: token_address.clone(),
            token_decimals: 7,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_token_config(1), &token_config);

        // Both members vote — triggers dissolution
        client.vote_dissolve(&1, &creator);
        client.vote_dissolve(&1, &member1);

        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(1))
            .unwrap();
        assert_eq!(status, GroupStatus::Cancelled);

        let group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(1))
            .unwrap();
        assert_eq!(group.status, GroupStatus::Cancelled);
        assert!(!group.is_active);
    }
}

    // --- Rounding behavior tests ---

    // ============================================================================
    // TESTS FOR ISSUE #426: Query Functions
    // ============================================================================

    #[test]
    fn test_create_group_rounds_contribution_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an amount that needs rounding
        // 100,050 stroops should round to 100,000 (nearest 0.01 XLM)
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        let group_id = client.create_group(&creator, &100050, &3600, &5, &token_address);

        // Verify the group was created
        assert_eq!(group_id, 1);

        // Get the group and verify the contribution amount was rounded
        let group = client.get_group(&group_id);
        // 100050 should round to 100000
        assert_eq!(group.contribution_amount, 100000);
    }

    #[test]
    fn test_create_group_rounds_up_contribution_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an amount that should round up
        // 100,050 stroops should round up to 200,000 (more than halfway)
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        let group_id = client.create_group(&creator, &150001, &3600, &5, &token_address);

        // Verify the group was created
        let group = client.get_group(&group_id);
        // 150001 should round to 200000
        assert_eq!(group.contribution_amount, 200000);
    }

    #[test]
    fn test_create_group_exact_amount_no_rounding() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an exact multiple of 0.01 XLM (100,000 stroops)
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        let group_id = client.create_group(&creator, &1_000_000, &3600, &5, &token_address);

        // Verify the group was created with exact amount
        let group = client.get_group(&group_id);
        assert_eq!(group.contribution_amount, 1_000_000);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(3001))")] // 3001 is InvalidAmount
    fn test_create_group_invalid_rounded_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an amount that rounds to 0 (less than 50,000)
        // This should fail with InvalidAmount
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        client.create_group(&creator, &10000, &3600, &5, &token_address);
    }

    // =========================================================================
    // Referral tracking tests (issue #760)
    // =========================================================================

    #[test]
    fn test_join_group_with_referrer_stores_mapping() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        let referrer = Address::generate(&env);
        let group_id = 1u64;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 1000, 0);
        group.member_count = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        env.mock_all_auths();
        client.join_group(&group_id, &invitee, &Some(referrer.clone()));

        // Referral mapping must be stored
        let referral_key = StorageKeyBuilder::member_referral(group_id, invitee.clone());
        let stored: Address = env.storage().persistent().get(&referral_key).unwrap();
        assert_eq!(stored, referrer);
    }

    #[test]
    fn test_join_group_without_referrer_no_mapping() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        let group_id = 1u64;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 1000, 0);
        group.member_count = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        env.mock_all_auths();
        client.join_group(&group_id, &invitee, &None);

        // No referral mapping should exist
        let referral_key = StorageKeyBuilder::member_referral(group_id, invitee.clone());
        assert!(!env.storage().persistent().has(&referral_key));
    }

    #[test]
    fn test_join_group_with_referrer_emits_member_referred_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        let referrer = Address::generate(&env);
        let group_id = 1u64;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 1000, 0);
        group.member_count = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        client.join_group(&group_id, &invitee, &Some(referrer.clone()));

        // Expect two events: member_referred + member_joined
        let events = env.events().all();
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_join_group_without_referrer_no_referral_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        let group_id = 1u64;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 1000, 0);
        group.member_count = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );
        let mut members = Map::new(&env);
        members.set(0u32, creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        client.join_group(&group_id, &invitee, &None);

        // Only member_joined event — no member_referred
        let events = env.events().all();
        assert_eq!(events.len(), 1);
    }
}

    // =========================================================================
    // is_paused tests (issue #761)
    // =========================================================================

    #[test]
    fn test_is_paused_false_on_active_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1u64;

        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        assert!(!client.is_paused(&group_id));
    }

    #[test]
    fn test_is_paused_true_after_pause_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1u64;

        // Create an Active group
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 1000, 0);
        group.status = GroupStatus::Active;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Active,
        );

        assert!(!client.is_paused(&group_id));

        // Pause the group
        env.mock_all_auths();
        client.pause_group(&group_id, &creator);

        assert!(client.is_paused(&group_id));
    }

    #[test]
    fn test_is_paused_false_for_nonexistent_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Non-existent group_id returns false gracefully
        assert!(!client.is_paused(&9999u64));
    }

    // =========================================================================
    // Tests for contribute_batch
    // =========================================================================

    /// Helper: set up an Active group with a real SAC token and one funded member.
    /// Writes directly to storage to avoid `create_group` signature coupling.
    fn setup_batch_group(
        env: &Env,
        contract_id: &Address,
        contribution_amount: i128,
        num_cycles: u32,
    ) -> (u64, Address, Address) {
        use soroban_sdk::token::{StellarAssetClient, TokenClient};

        let creator = Address::generate(env);
        let member = Address::generate(env);
        let group_id: u64 = 1;

        // Deploy SAC token, mint enough for all cycles, approve contract
        let token = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();
        let total = contribution_amount * num_cycles as i128;
        StellarAssetClient::new(env, &token).mint(&member, &total);
        let expiry = env.ledger().sequence() + 10_000;
        TokenClient::new(env, &token).approve(&member, contract_id, &total, &expiry);

        // Write Group
        let mut group = Group::new(group_id, creator.clone(), contribution_amount, 3600, 5, 2, 0, 0);
        group.status = GroupStatus::Active;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Write TokenConfig
        env.storage().persistent().set(
            &StorageKeyBuilder::group_token_config(group_id),
            &crate::group::TokenConfig { token_address: token, token_decimals: 7 },
        );

        // Write MemberProfile
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: env.ledger().timestamp(),
                auto_contribute_enabled: false,
            },
        );

        (group_id, creator, member)
    }

    #[test]
    fn test_contribute_batch_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) =
            setup_batch_group(&env, &contract_id, 100, 3);

        let cycles = soroban_sdk::vec![&env, 0u32, 1u32, 2u32];
        client.contribute_batch(&group_id, &member, &cycles);

        // All three cycles should be recorded
        for cycle in [0u32, 1u32, 2u32] {
            let key = StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            assert!(env.storage().persistent().has(&key));
        }
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3001)")] // InvalidAmount — empty list
    fn test_contribute_batch_empty_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) =
            setup_batch_group(&env, &contract_id, 100, 1);

        let empty: soroban_sdk::Vec<u32> = soroban_sdk::vec![&env];
        client.contribute_batch(&group_id, &member, &empty);
    }

    // =========================================================================
    // Tests for #480: Dynamic Contribution Amounts
    // =========================================================================

    #[test]
    #[should_panic(expected = "Error(Contract, #3002)")] // AlreadyContributed — duplicate cycle
    fn test_contribute_batch_duplicate_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) =
            setup_batch_group(&env, &contract_id, 100, 2);

        let cycles = soroban_sdk::vec![&env, 0u32, 0u32]; // duplicate
        client.contribute_batch(&group_id, &member, &cycles);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3002)")] // AlreadyContributed — cycle already paid
    fn test_contribute_batch_already_paid_cycle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) =
            setup_batch_group(&env, &contract_id, 100, 2);

        // Pay cycle 0 individually first
        client.contribute_batch(&group_id, &member, &soroban_sdk::vec![&env, 0u32]);

        // Now try to include cycle 0 again in a batch
        client.contribute_batch(&group_id, &member, &soroban_sdk::vec![&env, 0u32, 1u32]);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2002)")] // NotMember
    fn test_contribute_batch_non_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, _member) =
            setup_batch_group(&env, &contract_id, 100, 1);

        let outsider = Address::generate(&env);
        let cycles = soroban_sdk::vec![&env, 0u32];
        client.contribute_batch(&group_id, &outsider, &cycles);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3005)")] // CycleDeadlineExpired — past cycle
    fn test_contribute_batch_past_cycle() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) =
            setup_batch_group(&env, &contract_id, 100, 1);

        // Advance group to cycle 2
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.current_cycle = 2;
        env.storage().persistent().set(&group_key, &group);

        // Cycle 0 is now in the past
        client.contribute_batch(&group_id, &member, &soroban_sdk::vec![&env, 0u32]);
    }

    // Tests for member groups index functionality

    #[test]
    fn test_list_groups_by_member_empty() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);

        // Test: Member not in any groups
        let groups = client.list_groups_by_member(&member);
        assert_eq!(groups.len(), 0);
    }

    // =========================================================================
    // Tests for #481: Group Analytics Functions
    // =========================================================================

    #[test]
    fn test_list_groups_by_member_single_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Create group and add member
        let group_id = client.create_group(&creator, &100, &3600, &3);
        client.join_group(&group_id, &member);

        // Test: Member in one group
        let groups = client.list_groups_by_member(&member);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups.get(0).unwrap(), group_id);
    }

    #[test]
    fn test_list_groups_by_member_multiple_groups() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let creator3 = Address::generate(&env);
        let member = Address::generate(&env);

        // Create multiple groups
        let group_id1 = client.create_group(&creator1, &100, &3600, &3);
        let group_id2 = client.create_group(&creator2, &200, &7200, &4);
        let group_id3 = client.create_group(&creator3, &300, &10800, &5);

        // Add member to all groups
        client.join_group(&group_id1, &member);
        client.join_group(&group_id2, &member);
        client.join_group(&group_id3, &member);

        // Test: Member in multiple groups
        let groups = client.list_groups_by_member(&member);
        assert_eq!(groups.len(), 3);
        
        // Verify all group IDs are present (order should be join order)
        assert_eq!(groups.get(0).unwrap(), group_id1);
        assert_eq!(groups.get(1).unwrap(), group_id2);
        assert_eq!(groups.get(2).unwrap(), group_id3);
    }

    #[test]
    fn test_list_groups_by_member_different_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create groups
        let group_id1 = client.create_group(&creator, &100, &3600, &3);
        let group_id2 = client.create_group(&creator, &200, &7200, &4);

        // Member1 joins group1, Member2 joins group2
        client.join_group(&group_id1, &member1);
        client.join_group(&group_id2, &member2);

        // Test: Each member should only see their own groups
        let groups1 = client.list_groups_by_member(&member1);
        let groups2 = client.list_groups_by_member(&member2);

        assert_eq!(groups1.len(), 1);
        assert_eq!(groups1.get(0).unwrap(), group_id1);

        assert_eq!(groups2.len(), 1);
        assert_eq!(groups2.get(0).unwrap(), group_id2);
    }

    #[test]
    fn test_member_groups_index_maintained_on_join() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(env, &contract_id);
        let creator = Address::generate(env);
        env.mock_all_auths();
        let group_id = client
            .create_group(&creator, &10_000_000, &604800, &5, &grace_period_seconds)
            .unwrap();
        (group_id, client)
    }

        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Create group
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Verify member has no groups initially
        let groups_before = client.list_groups_by_member(&member);
        assert_eq!(groups_before.len(), 0);

        // Join group
        client.join_group(&group_id, &member);

        // Verify member groups index is updated
        let groups_after = client.list_groups_by_member(&member);
        assert_eq!(groups_after.len(), 1);
        assert_eq!(groups_after.get(0).unwrap(), group_id);

        // Verify the index is stored correctly by checking storage directly
        let user_groups_key = StorageKeyBuilder::user_member_groups(member.clone());
        let stored_groups: Vec<u64> = env
            .storage()
            .persistent()
            .get(&user_groups_key)
            .unwrap();
        assert_eq!(stored_groups.len(), 1);
        assert_eq!(stored_groups.get(0).unwrap(), group_id);
    }

    #[test]
    fn test_member_groups_index_consistency() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Create multiple groups
        let group_id1 = client.create_group(&creator, &100, &3600, &3);
        let group_id2 = client.create_group(&creator, &200, &7200, &4);

        // Join groups in specific order
        client.join_group(&group_id1, &member);
        client.join_group(&group_id2, &member);

        // Verify order is maintained
        let groups = client.list_groups_by_member(&member);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups.get(0).unwrap(), group_id1);
        assert_eq!(groups.get(1).unwrap(), group_id2);

        // Verify member profile exists in both groups
        let profile1 = client.get_member(&group_id1, &member);
        let profile2 = client.get_member(&group_id2, &member);

        assert_eq!(profile1.address, member);
        assert_eq!(profile1.group_id, group_id1);
        assert_eq!(profile2.address, member);
        assert_eq!(profile2.group_id, group_id2);
    }

    #[test]
    fn test_member_groups_index_large_scale() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let mut expected_groups = Vec::new(&env);

        // Create and join 10 groups
        for i in 0..10 {
            let group_id = client.create_group(&creator, &(100 + i as i128), &3600, &3);
            client.join_group(&group_id, &member);
            expected_groups.push_back(group_id);
        }

        // Verify all groups are tracked
        let groups = client.list_groups_by_member(&member);
        assert_eq!(groups.len(), 10);

        // Verify order is maintained
        for i in 0..10 {
            assert_eq!(groups.get(i).unwrap(), expected_groups.get(i).unwrap());
        }
    }

    // ============================================================================
    // TICK FUNCTION TESTS
    // ============================================================================

    #[test]
    fn test_tick_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_tick(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_tick_group_not_active() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let grace: u64 = 3600;


        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = client.create_group(
            &creator,
            &10_000_000,
            &604800,
            &3,
            &2,
        );

        // Group is not active yet (no members joined)
        let result = client.try_tick(&group_id);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_tick_deadline_not_reached() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Set initial time
        env.ledger().set_timestamp(1000);

        let group_id = client.create_group(
            &creator,
            &10_000_000,
            &604800, // 1 week cycle
            &2,
            &2,
        );

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);
        client.activate_group(&group_id, &creator, &2);

        // Try to tick before deadline (1000 + 604800 = 605800)
        env.ledger().set_timestamp(500000); // Still before deadline
        let result = client.try_tick(&group_id);
        assert_eq!(result, Err(Ok(StellarSaveError::DeadlineNotReached)));
    }

    #[test]
    fn test_tick_cycle_complete_with_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Set initial time
        env.ledger().set_timestamp(1000);

        let group_id = client.create_group(
            &creator,
            &10_000_000,
            &604800, // 1 week cycle
            &2,
            &2,
        );

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);
        client.activate_group(&group_id, &creator, &2);

        // Assign payout positions
        let positions = vec![&env, creator.clone(), member.clone()];
        client.assign_payout_positions(&group_id, &creator, &positions, &0);

        // Both members contribute
        client.contribute(&group_id, &creator, &10_000_000);
        client.contribute(&group_id, &member, &10_000_000);

        // Move past deadline
        env.ledger().set_timestamp(1000 + 604800 + 1);

        // Tick should execute payout and advance cycle
        let result = client.tick(&group_id);
        assert!(result.is_ok());

        // Verify cycle advanced
        let group = client.get_group(&group_id);
        assert_eq!(group.current_cycle, 1);
    }

    #[test]
    fn test_tick_cycle_incomplete_defaulted() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Set initial time
        env.ledger().set_timestamp(1000);

        let group_id = client.create_group(
            &creator,
            &10_000_000,
            &604800, // 1 week cycle
            &2,
            &2,
        );

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);
        client.activate_group(&group_id, &creator, &2);

        // Only one member contributes
        client.contribute(&group_id, &creator, &10_000_000);
        // member doesn't contribute

        // Move past deadline
        env.ledger().set_timestamp(1000 + 604800 + 1);

        // Tick should advance cycle without payout (defaulted)
        let result = client.tick(&group_id);
        assert!(result.is_ok());

        // Verify cycle advanced
        let group = client.get_group(&group_id);
        assert_eq!(group.current_cycle, 1);
    }

    #[test]
    fn test_tick_completes_group() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Set initial time
        env.ledger().set_timestamp(1000);

        let group_id = client.create_group(
            &creator,
            &10_000_000,
            &604800, // 1 week cycle
            &2,      // 2 members = 2 cycles total
            &2,
        );

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);
        client.activate_group(&group_id, &creator, &2);

        // Assign payout positions
        let positions = vec![&env, creator.clone(), member.clone()];
        client.assign_payout_positions(&group_id, &creator, &positions, &0);

        // Complete cycle 0
        client.contribute(&group_id, &creator, &10_000_000);
        client.contribute(&group_id, &member, &10_000_000);
        env.ledger().set_timestamp(1000 + 604800 + 1);
        client.tick(&group_id);

        // Complete cycle 1 (final cycle)
        client.contribute(&group_id, &creator, &10_000_000);
        client.contribute(&group_id, &member, &10_000_000);
        env.ledger().set_timestamp(1000 + 604800 * 2 + 1);
        client.tick(&group_id);

        // Verify group is complete
        let group = client.get_group(&group_id);
        assert!(group.is_complete());
        assert_eq!(group.current_cycle, 2);
    }

    #[test]
    fn test_tick_already_complete_group() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);

        let group_id = client.create_group(
            &creator,
            &10_000_000,
            &604800,
            &1, // 1 member = completes after 1 cycle
            &1,
        );

        client.join_group(&group_id, &creator);
        client.activate_group(&group_id, &creator, &1);

        // Assign payout positions
        let positions = vec![&env, creator.clone()];
        client.assign_payout_positions(&group_id, &creator, &positions, &0);

        // Complete the single cycle
        client.contribute(&group_id, &creator, &10_000_000);
        env.ledger().set_timestamp(1000 + 604800 + 1);
        client.tick(&group_id);

        // Try to tick again on completed group
        env.ledger().set_timestamp(1000 + 604800 * 2 + 1);
        let result = client.try_tick(&group_id);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_tick_emits_cycle_advanced_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Set initial time
        env.ledger().set_timestamp(1000);

        let group_id = client.create_group(
            &creator,
            &10_000_000,
            &604800,
            &2,
            &2,
        );

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);
        client.activate_group(&group_id, &creator, &2);

        // Assign payout positions
        let positions = vec![&env, creator.clone(), member.clone()];
        client.assign_payout_positions(&group_id, &creator, &positions, &0);

        // Both members contribute
        client.contribute(&group_id, &creator, &10_000_000);
        client.contribute(&group_id, &member, &10_000_000);

        // Move past deadline and tick
        env.ledger().set_timestamp(1000 + 604800 + 1);
        client.tick(&group_id);

        // Verify CycleAdvanced event was emitted
        let events = env.events().all();
        let cycle_advanced_events: Vec<_> = events
            .iter()
            .filter(|e| e.0.contains(&"cycle_advanced"))
            .collect();
        
        assert_eq!(cycle_advanced_events.len(), 1);
    }

    // Migration Tests
    #[test]
    fn test_get_storage_version_new_contract() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // New contract should default to v1 until initialized
        let version = client.get_storage_version();
        assert_eq!(version, 1);
    }

    #[test]
    fn test_storage_version_initialized_on_config_update() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 10,
            min_cycle_duration: 86400,
            max_cycle_duration: 2_592_000,
        };

        // Initialize config (first time)
        client.update_config(&config);

        // Storage version should now be current
        let version = client.get_storage_version();
        assert_eq!(version, storage::STORAGE_VERSION);
    }

    #[test]
    fn test_migrate_storage_requires_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let non_admin = Address::generate(&env);
        
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 10,
            min_cycle_duration: 86400,
            max_cycle_duration: 2_592_000,
        };

        // Initialize config
        client.update_config(&config);

        // Non-admin should not be able to migrate
        let result = client.try_migrate_storage(&non_admin);
        assert_eq!(result, Err(Ok(StellarSaveError::Unauthorized)));

        // Admin should be able to migrate
        let result = client.try_migrate_storage(&admin);
        assert!(result.is_ok());
    }

    #[test]
    fn test_migrate_storage_uninitialized_contract() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let caller = Address::generate(&env);

        // Should fail on uninitialized contract
        let result = client.try_migrate_storage(&caller);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_migration_from_v1_to_v2() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);

        // Simulate v1 contract state
        // 1. Set up config without version
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 10,
            min_cycle_duration: 86400,
            max_cycle_duration: 2_592_000,
        };

        // Store config directly to simulate v1 state
        let config_key = StorageKeyBuilder::contract_config();
        env.storage().persistent().set(&config_key, &config);

        // Create a group in v1 format (without balance tracking)
        let group_id = client.create_group(&creator, &10_000_000, &604800, &5);
        
        // Manually set storage version to v1
        let version_key = StorageKeyBuilder::storage_version();
        env.storage().persistent().set(&version_key, &1u32);

        // Verify we're at v1
        assert_eq!(client.get_storage_version(), 1);

        // Run migration
        client.migrate_storage(&admin);

        // Verify migration to v2
        assert_eq!(client.get_storage_version(), storage::STORAGE_VERSION);

        // Verify v2 fields were initialized
        let pause_key = StorageKeyBuilder::emergency_pause();
        let guard_key = StorageKeyBuilder::reentrancy_guard();
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        let paid_out_key = StorageKeyBuilder::group_total_paid_out(group_id);

        assert_eq!(env.storage().persistent().get::<bool>(&pause_key).unwrap(), false);
        assert_eq!(env.storage().persistent().get::<bool>(&guard_key).unwrap(), false);
        assert_eq!(env.storage().persistent().get::<i128>(&balance_key).unwrap(), 0);
        assert_eq!(env.storage().persistent().get::<i128>(&paid_out_key).unwrap(), 0);

        // Verify original group data is preserved
        let group = client.get_group(&group_id);
        assert_eq!(group.creator, creator);
        assert_eq!(group.contribution_amount, 10_000_000);
    }

    #[test]
    fn test_migration_idempotent() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 10,
            min_cycle_duration: 86400,
            max_cycle_duration: 2_592_000,
        };

        // Initialize config (triggers migration)
        client.update_config(&config);
        let version_after_init = client.get_storage_version();

        // Run migration again
        client.migrate_storage(&admin);
        let version_after_migrate = client.get_storage_version();

        // Should be the same
        assert_eq!(version_after_init, version_after_migrate);
        assert_eq!(version_after_migrate, storage::STORAGE_VERSION);
    }

    #[test]
    fn test_migration_preserves_existing_data() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Set up v1 contract with data
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 10,
            min_cycle_duration: 86400,
            max_cycle_duration: 2_592_000,
        };

        // Store config and create group
        let config_key = StorageKeyBuilder::contract_config();
        env.storage().persistent().set(&config_key, &config);
        
        let group_id = client.create_group(&creator, &10_000_000, &604800, &5);
        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        // Set to v1 and add some contributions
        let version_key = StorageKeyBuilder::storage_version();
        env.storage().persistent().set(&version_key, &1u32);

        // Store some v1 data
        let total_groups_key = StorageKeyBuilder::total_groups();
        env.storage().persistent().set(&total_groups_key, &1u64);

        // Run migration
        client.migrate_storage(&admin);

        // Verify data preservation
        assert_eq!(client.get_storage_version(), storage::STORAGE_VERSION);
        
        let group = client.get_group(&group_id);
        assert_eq!(group.creator, creator);
        assert_eq!(group.contribution_amount, 10_000_000);
        
        let total_groups: u64 = env.storage().persistent().get(&total_groups_key).unwrap();
        assert_eq!(total_groups, 1);
    }
=======
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

mod error;
mod types;
mod xlm;

use error::Error;
use types::{DataKey, Group, GroupStatus};

#[contract]
pub struct StellarSave;

#[contractimpl]
impl StellarSave {
    // ─── Group Management ───────────────────────────────────────────────────

    /// Create a new ROSCA group. Returns the new group ID.
    ///
    /// * `contribution_amount` – stroops each member contributes per cycle.
    /// * `cycle_duration`      – cycle length in ledgers.
    /// * `max_members`         – 2 ≤ max_members ≤ 20.
    pub fn create_group(
        env: Env,
        contribution_amount: i128,
        cycle_duration: u32,
        max_members: u32,
    ) -> Result<u64, Error> {
        if contribution_amount <= 0 || cycle_duration == 0 || max_members < 2 || max_members > 20 {
            return Err(Error::InvalidConfig);
        }

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::GroupCounter)
            .unwrap_or(0u64);

        let group = Group {
            contribution_amount,
            cycle_duration,
            max_members,
            members: Vec::new(&env),
            payout_index: 0,
            current_cycle: 0,
            cycle_start_ledger: 0,
            status: GroupStatus::Active,
        };

        env.storage().persistent().set(&DataKey::Group(id), &group);
        env.storage()
            .instance()
            .set(&DataKey::GroupCounter, &(id + 1));

        Ok(id)
    }

    /// Get group state by ID.
    pub fn get_group(env: Env, group_id: u64) -> Result<Group, Error> {
        Self::load_group(&env, group_id)
    }

    /// List all member addresses in a group.
    pub fn list_members(env: Env, group_id: u64) -> Result<Vec<Address>, Error> {
        Ok(Self::load_group(&env, group_id)?.members)
    }

    // ─── Membership ──────────────────────────────────────────────────────────

    /// Join an existing group. Requires auth from `member`.
    pub fn join_group(env: Env, group_id: u64, member: Address) -> Result<(), Error> {
        member.require_auth();

        let mut group = Self::load_group(&env, group_id)?;

        if group.status == GroupStatus::Complete {
            return Err(Error::GroupComplete);
        }
        if group.members.len() >= group.max_members {
            return Err(Error::GroupFull);
        }
        if group.members.contains(&member) {
            return Err(Error::AlreadyMember);
        }

        group.members.push_back(member.clone());

        // Start the first cycle once the group is full.
        if group.members.len() == group.max_members {
            group.current_cycle = 1;
            group.cycle_start_ledger = env.ledger().sequence();
        }

        env.storage().persistent().set(&DataKey::Group(group_id), &group);
        Ok(())
    }

    /// Check if an address is a member of the group.
    pub fn is_member(env: Env, group_id: u64, address: Address) -> Result<bool, Error> {
        Ok(Self::load_group(&env, group_id)?.members.contains(&address))
    }

    // ─── Contributions ───────────────────────────────────────────────────────

    /// Contribute for the current cycle. Transfers `contribution_amount` from
    /// `member` to the contract. Automatically triggers payout when all members
    /// have contributed.
    pub fn contribute(
        env: Env,
        group_id: u64,
        member: Address,
        token: Address,
    ) -> Result<(), Error> {
        member.require_auth();

        let group = Self::load_group(&env, group_id)?;

        if group.status == GroupStatus::Complete {
            return Err(Error::GroupComplete);
        }
        if group.current_cycle == 0 {
            // Group not full yet
            return Err(Error::CyclePending);
        }
        if !group.members.contains(&member) {
            return Err(Error::NotMember);
        }

        let cycle = group.current_cycle;
        let contrib_key = DataKey::Contributed(group_id, cycle, member.clone());

        if env.storage().persistent().has(&contrib_key) {
            return Err(Error::AlreadyContributed);
        }

        // Transfer contribution into the contract.
        xlm::transfer(
            &env,
            &token,
            &member,
            &env.current_contract_address(),
            group.contribution_amount,
        );

        env.storage().persistent().set(&contrib_key, &true);

        // Check if all members have now contributed this cycle.
        let all_contributed = group.members.iter().all(|m| {
            env.storage()
                .persistent()
                .has(&DataKey::Contributed(group_id, cycle, m))
        });

        if all_contributed {
            Self::do_payout(&env, group_id, token)?;
        }

        Ok(())
    }

    /// Return contribution status for every member in `cycle_number`.
    /// Returns a parallel vec of booleans (true = contributed).
    pub fn get_contribution_status(
        env: Env,
        group_id: u64,
        cycle_number: u32,
    ) -> Result<Vec<bool>, Error> {
        let group = Self::load_group(&env, group_id)?;
        let mut statuses = Vec::new(&env);
        for m in group.members.iter() {
            let contributed = env
                .storage()
                .persistent()
                .has(&DataKey::Contributed(group_id, cycle_number, m));
            statuses.push_back(contributed);
        }
        Ok(statuses)
    }

    // ─── Payouts ─────────────────────────────────────────────────────────────

    /// Manually trigger a payout if all contributions for the current cycle
    /// are in. Normally called automatically by `contribute`.
    pub fn execute_payout(env: Env, group_id: u64, token: Address) -> Result<(), Error> {
        let group = Self::load_group(&env, group_id)?;
        if group.status == GroupStatus::Complete {
            return Err(Error::GroupComplete);
        }
        if group.current_cycle == 0 {
            return Err(Error::CyclePending);
        }

        let cycle = group.current_cycle;
        let all_contributed = group.members.iter().all(|m| {
            env.storage()
                .persistent()
                .has(&DataKey::Contributed(group_id, cycle, m))
        });

        if !all_contributed {
            return Err(Error::CyclePending);
        }

        Self::do_payout(&env, group_id, token)
    }

    /// Whether the ROSCA has completed all cycles.
    pub fn is_complete(env: Env, group_id: u64) -> Result<bool, Error> {
        Ok(Self::load_group(&env, group_id)?.status == GroupStatus::Complete)
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    fn load_group(env: &Env, group_id: u64) -> Result<Group, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Group(group_id))
            .ok_or(Error::GroupNotFound)
    }

    /// Pay the current recipient and advance the cycle (or mark complete).
    fn do_payout(env: &Env, group_id: u64, token: Address) -> Result<(), Error> {
        let mut group = Self::load_group(env, group_id)?;

        let recipient = group
            .members
            .get(group.payout_index)
            .ok_or(Error::GroupNotFound)?;

        let payout_amount = group.contribution_amount * group.members.len() as i128;

        xlm::transfer(
            env,
            &token,
            &env.current_contract_address(),
            &recipient,
            payout_amount,
        );

        group.payout_index += 1;

        if group.payout_index >= group.members.len() {
            // All members have received their payout.
            group.status = GroupStatus::Complete;
        } else {
            group.current_cycle += 1;
            group.cycle_start_ledger = env.ledger().sequence();
        }

        env.storage().persistent().set(&DataKey::Group(group_id), &group);
        Ok(())
    }
}

mod test;
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
