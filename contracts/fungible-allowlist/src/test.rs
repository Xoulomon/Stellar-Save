extern crate std;

use soroban_sdk::{Address};

use crate::contract::ExampleContractClient;
use crate::test_utils::{create_env, create_client, setup_accounts};

#[test]
#[should_panic(expected = "Error(Contract, #113)")]
fn cannot_transfer_before_allow() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);
    let transfer_amount = 1000;

    // Verify initial state - admin is allowed, others are not
    assert!(client.allowed(&admin));
    assert!(!client.allowed(&user1));
    assert!(!client.allowed(&user2));

    // Admin can't transfer to user1 initially (user1 not allowed)
    client.transfer(&admin, &user1, &transfer_amount);
}

#[test]
fn transfer_to_allowed_account_works() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);
    let transfer_amount = 1000;

    // Verify initial state - admin is allowed, others are not
    assert!(client.allowed(&admin));
    assert!(!client.allowed(&user1));
    assert!(!client.allowed(&user2));

    // Allow user1
    client.allow_user(&user1, &manager);
    assert!(client.allowed(&user1));

    // Now admin can transfer to user1
    client.transfer(&admin, &user1, &transfer_amount);
    assert_eq!(client.balance(&user1), transfer_amount);
}

#[test]
#[should_panic(expected = "Error(Contract, #113)")]
fn cannot_transfer_after_disallow() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);
    let transfer_amount = 1000;

    // Verify initial state - admin is allowed, others are not
    assert!(client.allowed(&admin));
    assert!(!client.allowed(&user1));
    assert!(!client.allowed(&user2));

    // Allow user1
    client.allow_user(&user1, &manager);
    assert!(client.allowed(&user1));

    // Now admin can transfer to user1
    client.transfer(&admin, &user1, &transfer_amount);
    assert_eq!(client.balance(&user1), transfer_amount);

    // Disallow user1
    client.disallow_user(&user1, &manager);
    assert!(!client.allowed(&user1));

    // Admin can't transfer to user1 after disallowing
    client.transfer(&admin, &user1, &100);
}

#[test]
fn allowlist_transfer_from_override_works() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);
    let transfer_amount = 1000;

    // Verify initial state - admin is allowed, others are not
    assert!(client.allowed(&admin));
    assert!(!client.allowed(&user1));
    assert!(!client.allowed(&user2));

    // Allow user2
    client.allow_user(&user2, &manager);
    assert!(client.allowed(&user2));

    // Now admin can transfer to user1
    client.approve(&admin, &user1, &transfer_amount, &1000);
    client.transfer_from(&user1, &admin, &user2, &transfer_amount);
    assert_eq!(client.balance(&user2), transfer_amount);
}

#[test]
fn allowlist_approve_override_works() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);
    let transfer_amount = 1000;

    // Verify initial state - admin is allowed, others are not
    assert!(client.allowed(&admin));
    assert!(!client.allowed(&user1));
    assert!(!client.allowed(&user2));

    // Allow user1
    client.allow_user(&user1, &manager);
    assert!(client.allowed(&user1));

    // Approve user2 to transfer from user1
    client.approve(&user1, &user2, &transfer_amount, &1000);
    assert_eq!(client.allowance(&user1, &user2), transfer_amount);
}

#[test]
#[should_panic]
fn unauthorized_caller_cannot_allow_user() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);

    // user1 (not admin/manager) attempts to allow user2
    client.allow_user(&user2, &user1);
}

#[test]
#[should_panic]
fn unauthorized_caller_cannot_disallow_user() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);

    // First allow user2
    client.allow_user(&user2, &manager);
    assert!(client.allowed(&user2));

    // user1 (not admin/manager) attempts to disallow user2
    client.disallow_user(&user2, &user1);
}

#[test]
fn centralized_access_control_guards_work() {
    let e = create_env();
    let (admin, manager, user1, _user2) = setup_accounts(&e);
    let initial_supply = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);

    e.as_contract(&client.address, || {
        // Admin and manager should pass require_admin check
        crate::require_admin(&e, &admin);
        crate::require_admin(&e, &manager);

        // Admin is allowlisted in constructor
        crate::require_allowlisted(&e, &admin);
    });
}

