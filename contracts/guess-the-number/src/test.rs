#![cfg(test)]
// This lets use reference types in the std library for testing
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::MockAuth,
    MockAuthInvoke,
    Address, Env, IntoVal, Val, Vec,
};

use crate::test_utils::{init_test, generate_address, generate_client, create_env};

#[test]
fn constructed_correctly() {
    let env = &Env::default();
    let (admin, sac, client) = init_test(env);
    // Check that the admin is set correctly
    assert_eq!(client.admin(), Some(admin.clone()));
    // Check that the contract has a balance of 1 XLM
    assert_eq!(sac.balance(&client.address), xlm::to_stroops(1));
    // Need to use `as_contract` to call a function in the context of the contract
    // Since the method `number` is not in the client, but is visibile in the crate
    let number = env.as_contract(&client.address, || GuessTheNumber::number(env));
    assert_eq!(number, 4);
}

#[test]
fn only_admin_can_reset() {
    let env = &create_env();
    let (admin, _, client) = init_test(env);
    let user = generate_address(env);

    set_caller(&client, "reset", &user, ());
    assert!(client.try_reset().is_err());

    set_caller(&client, "reset", &admin, ());
    assert!(client.try_reset().is_ok());
}

#[test]
fn guess() {
    let env = &Env::default();
    let (_, sac, client) = init_test(env);
    // This lets you mock all auth when they become complicated when making cross contract calls.
    env.mock_all_auths();

    // Create a user to guess
    let alice = Address::generate(env);
    // Mint tokens to the user. On testnet you use friendbot to fund the account.
    sac.mint(&alice, &xlm::to_stroops(2));
    // Check that alice has the tokens
    assert_eq!(sac.balance(&alice), xlm::to_stroops(2));

    // Create another user with no funds
    let bob = Address::generate(env);

    // In the testing enviroment the random seed is always the same initially.
    // This tests a wrong guess so the balance should go down one XLM
    assert!(!client.guess(&3, &alice));
    assert_eq!(sac.balance(&alice), xlm::to_stroops(1));

    // Now we test a wrong guess but the user has no funds so  we get an error
    assert_eq!(
        client.try_guess(&3, &bob).unwrap_err(),
        Ok(Error::TransferFailed)
    );

    // Now we test a correct guess, the balance should go up by the initial 1 XLM + the 1 XLM from the contract
    assert!(client.guess(&4, &alice));
    assert_eq!(sac.balance(&alice), xlm::to_stroops(3));

    assert_eq!(
        client.try_guess(&4, &alice).unwrap_err(),
        Ok(Error::InsufficientBalance)
    );
}

#[test]
fn add_funds() {
    let env = &Env::default();
    let (_, sac, client) = init_test(env);
    // This lets you mock all auth when they become complicated when making cross contract calls.
    env.mock_all_auths();

    // Create a user to guess
    let alice = Address::generate(env);
    // Mint tokens to the user. On testnet you use friendbot to fund the account.
    sac.mint(&alice, &xlm::to_stroops(2));
    // Now we test a correct guess, the balance should go up by the initial 1 XLM + the 1 XLM from the contract
    assert!(client.guess(&4, &alice));
    assert_eq!(sac.balance(&alice), xlm::to_stroops(3));
    assert_eq!(sac.balance(&client.address), 0);

    client.add_funds(&xlm::to_stroops(5));
    assert_eq!(sac.balance(&client.address), xlm::to_stroops(5));

    // Since we didn't reset the number, the guess should still be correct
    assert!(client.guess(&4, &alice));
    assert_eq!(sac.balance(&alice), xlm::to_stroops(8));
    assert_eq!(sac.balance(&client.address), 0);
}

#[test]
fn reset_and_guess() {
    let env = &Env::default();
    let (_, sac, client) = init_test(env);
    // This lets you mock all auth when they become complicated when making cross contract calls.
    env.mock_all_auths();

    // Create a user to guess
    let alice = Address::generate(env);
    // Mint tokens to the user. On testnet you use friendbot to fund the account.
    sac.mint(&alice, &xlm::to_stroops(2));

    // Reset the number
    client.reset();

    // Guess again, this should be correct now
    assert!(client.guess(&10, &alice));
}

#[test]
fn test_optimized_storage_and_funds_flow() {
    let env = &Env::default();
    let (admin, sac, client) = init_test(env);
    env.mock_all_auths();

    // Add funds using optimized single-read require_admin path
    client.add_funds(&xlm::to_stroops(3));
    assert_eq!(sac.balance(&client.address), xlm::to_stroops(4));

    // Verify admin query is consistent
    assert_eq!(client.admin(), Some(admin.clone()));
}


fn set_caller<T>(client: &GuessTheNumberClient, fn_name: &str, caller: &Address, args: T)
where
    T: IntoVal<Env, Vec<Val>>,
{
    // clear previous auth mocks
    client.env.set_auths(&[]);

    let invoke = &MockAuthInvoke {
        contract: &client.address,
        fn_name,
        args: args.into_val(&client.env),
        sub_invokes: &[],
    };

    // mock auth as passed-in address
    client.env.mock_auths(&[MockAuth {
        address: caller,
        invoke,
    }]);
}
