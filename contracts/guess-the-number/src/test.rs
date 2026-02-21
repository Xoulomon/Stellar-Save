#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{types::GroupStatus, Error, StellarSave, StellarSaveClient};

fn create_test_env() -> (Env, Address, StellarSaveClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, StellarSave);
    let client = StellarSaveClient::new(&env, &contract_id);

    (env, admin, client)
}

#[test]
fn test_is_group_active_returns_false_for_nonexistent_group() {
    let (_env, _admin, client) = create_test_env();

    let result = client.try_is_group_active(&999);

    assert_eq!(result, Err(Ok(Error::GroupNotFound)));
}

#[test]
fn test_is_group_active_returns_false_for_forming_group() {
    let (env, admin, client) = create_test_env();

    // Create a group (starts in Forming status)
    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Group exists but is in Forming status
    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, false);
}

#[test]
fn test_is_group_active_returns_false_for_completed_group() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Manually set group to Completed status using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.status = GroupStatus::Completed;
        group.member_count = 5;
        crate::storage::save_group(&env, &group);
    });

    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, false);
}

#[test]
fn test_is_group_active_returns_false_for_cancelled_group() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Manually set group to Cancelled status using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.status = GroupStatus::Cancelled;
        group.member_count = 3;
        crate::storage::save_group(&env, &group);
    });

    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, false);
}

#[test]
fn test_is_group_active_returns_false_for_zero_members() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Set group to Active but with 0 members using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.status = GroupStatus::Active;
        group.member_count = 0;
        crate::storage::save_group(&env, &group);
    });

    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, false);
}

#[test]
fn test_is_group_active_returns_false_when_members_exceed_max() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Set member count to exceed max_members using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.status = GroupStatus::Active;
        group.member_count = 11; // Exceeds max of 10
        crate::storage::save_group(&env, &group);
    });

    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, false);
}

#[test]
fn test_is_group_active_returns_true_for_valid_active_group() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Set group to Active with valid member count using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.status = GroupStatus::Active;
        group.member_count = 5;
        crate::storage::save_group(&env, &group);
    });

    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, true);
}

#[test]
fn test_is_group_active_returns_true_at_max_capacity() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Set member count exactly at max using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.status = GroupStatus::Active;
        group.member_count = 10; // Exactly at max
        crate::storage::save_group(&env, &group);
    });

    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, true);
}

#[test]
fn test_is_group_active_returns_true_with_one_member() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Set group to Active with minimum valid member count using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.status = GroupStatus::Active;
        group.member_count = 1;
        crate::storage::save_group(&env, &group);
    });

    let is_active = client.is_group_active(&group_id);

    assert_eq!(is_active, true);
}

#[test]
fn test_activate_group_success() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Add at least one member using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.member_count = 3;
        crate::storage::save_group(&env, &group);
    });

    // Activate the group
    client.activate_group(&group_id);

    // Verify group is now active
    let is_active = client.is_group_active(&group_id);
    assert_eq!(is_active, true);

    // Verify group details
    let group = client.get_group(&group_id);
    assert_eq!(group.status, GroupStatus::Active);
    // In test environment, timestamp is set by the test framework
    assert_eq!(group.start_time, env.ledger().timestamp());
}

#[test]
fn test_activate_group_fails_without_members() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Try to activate without members
    let result = client.try_activate_group(&group_id);

    assert_eq!(result, Err(Ok(Error::GroupNotActive)));
}

#[test]
fn test_activate_group_fails_if_already_active() {
    let (env, admin, client) = create_test_env();

    let group_id = client.create_group(
        &admin,
        &String::from_str(&env, "Test Group"),
        &1000,
        &86400,
        &10,
    );

    // Set up group with members and activate using contract context
    env.as_contract(&client.address, || {
        let mut group = crate::storage::load_group(&env, group_id).unwrap();
        group.member_count = 3;
        crate::storage::save_group(&env, &group);
    });

    client.activate_group(&group_id);

    // Try to activate again
    let result = client.try_activate_group(&group_id);

    assert_eq!(result, Err(Ok(Error::InvalidGroupStatus)));
}

#[test]
fn test_get_group_returns_correct_data() {
    let (env, admin, client) = create_test_env();

    let name = String::from_str(&env, "Savings Circle");
    let contribution = 1000i128;
    let duration = 86400u64;
    let max = 10u32;

    let group_id = client.create_group(&admin, &name, &contribution, &duration, &max);

    let group = client.get_group(&group_id);

    assert_eq!(group.id, group_id);
    assert_eq!(group.name, name);
    assert_eq!(group.admin, admin);
    assert_eq!(group.contribution_amount, contribution);
    assert_eq!(group.cycle_duration, duration);
    assert_eq!(group.max_members, max);
    assert_eq!(group.member_count, 0);
    assert_eq!(group.status, GroupStatus::Forming);
}
