extern crate std;

use soroban_sdk::Address;

use crate::contract::ExampleContractClient;
use crate::test_utils::{create_env, create_client, setup_accounts};

#[test]
fn enumerable_transfer_override_works() {
    let e = create_env();
    let (owner, recipient, _spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    client.mint(&owner);
    client.transfer(&owner, &recipient, &0);
    assert_eq!(client.balance(&owner), 0);
    assert_eq!(client.balance(&recipient), 1);
    assert_eq!(client.get_owner_token_id(&recipient, &0), 0);
}

#[test]
fn enumerable_transfer_from_override_works() {
    let e = create_env();
    let (owner, recipient, spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    client.mint(&owner);
    client.approve(&owner, &spender, &0, &1000);
    client.transfer_from(&spender, &owner, &recipient, &0);
    assert_eq!(client.balance(&owner), 0);
    assert_eq!(client.balance(&recipient), 1);
    assert_eq!(client.get_owner_token_id(&recipient, &0), 0);
}

#[test]
fn enumerable_burn_override_works() {
    let e = create_env();
    let (owner, _recipient, _spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);
    client.mint(&owner);
    client.burn(&owner, &0);
    assert_eq!(client.balance(&owner), 0);
    client.mint(&owner);
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.get_owner_token_id(&owner, &0), 1);
}

#[test]
fn enumerable_burn_from_override_works() {
    let e = create_env();
    let (owner, _recipient, spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);
    client.mint(&owner);
    client.approve(&owner, &spender, &0, &1000);
    client.burn_from(&spender, &owner, &0);
    assert_eq!(client.balance(&owner), 0);
    client.mint(&owner);
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.get_owner_token_id(&owner, &0), 1);
}

#[test]
fn enumeration_sequential_minting_invariants() {
    let e = create_env();
    let (owner, recipient, _spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let id0 = client.mint(&owner);
    let id1 = client.mint(&owner);
    let id2 = client.mint(&recipient);

    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);

    assert_eq!(client.balance(&owner), 2);
    assert_eq!(client.balance(&recipient), 1);

    assert_eq!(client.get_owner_token_id(&owner, &0), 0);
    assert_eq!(client.get_owner_token_id(&owner, &1), 1);
    assert_eq!(client.get_owner_token_id(&recipient, &0), 2);
}

#[test]
fn enumeration_transfer_and_burn_invariants() {
    let e = create_env();
    let (owner, recipient, _spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    client.mint(&owner);
    client.mint(&owner);

    // Transfer token 0 to recipient
    client.transfer(&owner, &recipient, &0);
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.balance(&recipient), 1);
    assert_eq!(client.get_owner_token_id(&recipient, &0), 0);
    assert_eq!(client.get_owner_token_id(&owner, &0), 1);

    // Burn token 1 from owner
    client.burn(&owner, &1);
    assert_eq!(client.balance(&owner), 0);
    assert_eq!(client.balance(&recipient), 1);
    assert_eq!(client.get_owner_token_id(&recipient, &0), 0);
}

