#![cfg(test)]
// This lets use reference types in the std library for testing
extern crate std;

use super::*;
use soroban_sdk::{testutils::MockAuth, Address, Env, IntoVal, MockAuthInvoke, Val, Vec};

use crate::test_utils::{create_env, generate_address, generate_client, init_test};

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

// ── Negative-path tests for invalid guesses (issue #1530) ────────────────────

/// Out-of-bounds guess: value 0.
///
/// The contract does NOT perform explicit range validation on the guess input.
/// A value of 0 can never equal the random number (which is always in 1..=10),
/// so it is treated as an ordinary wrong guess: 1 XLM is deducted from the
/// guesser and `false` is returned.  This test documents that behaviour so
/// that any future change to add explicit bounds checking will require a
/// deliberate update here.
#[test]
fn test_out_of_bounds_guess_low() {
    let env = &Env::default();
    let (_, sac, client) = init_test(env);
    env.mock_all_auths();

    let alice = Address::generate(env);
    sac.mint(&alice, &xlm::to_stroops(2));

    // Guess of 0 is out of the valid 1..=10 range.
    // No range validation exists; it is treated as a wrong guess.
    let result = client.guess(&0, &alice);
    assert!(
        !result,
        "guess(0) should return false (wrong guess, not a panic)"
    );

    // The user should have been charged 1 XLM for the wrong guess.
    assert_eq!(
        sac.balance(&alice),
        xlm::to_stroops(1),
        "user should be charged 1 XLM for an out-of-bounds guess of 0"
    );
}

/// Out-of-bounds guess: value 11.
///
/// Same reasoning as `test_out_of_bounds_guess_low`: 11 is outside the 1..=10
/// range but the contract currently has no bounds check.  It is treated as a
/// wrong guess and costs the user 1 XLM.
#[test]
fn test_out_of_bounds_guess_high() {
    let env = &Env::default();
    let (_, sac, client) = init_test(env);
    env.mock_all_auths();

    let alice = Address::generate(env);
    sac.mint(&alice, &xlm::to_stroops(2));

    // Guess of 11 is out of the valid 1..=10 range.
    let result = client.guess(&11, &alice);
    assert!(
        !result,
        "guess(11) should return false (wrong guess, not a panic)"
    );

    // The user should have been charged 1 XLM for the wrong guess.
    assert_eq!(
        sac.balance(&alice),
        xlm::to_stroops(1),
        "user should be charged 1 XLM for an out-of-bounds guess of 11"
    );
}

/// Post-game-end: attempting a correct guess after the contract balance is 0
/// must return `Error::InsufficientBalance`.
///
/// Sequence:
/// 1. Alice wins the game (correct guess = 4), draining the contract to 0.
/// 2. Bob then makes the same correct guess; since the pot is empty the
///    contract must return `InsufficientBalance` rather than trying to pay out.
#[test]
fn test_guess_after_balance_drained() {
    let env = &Env::default();
    let (_, sac, client) = init_test(env);
    env.mock_all_auths();

    // Fund Alice and Bob.
    let alice = Address::generate(env);
    let bob = Address::generate(env);
    sac.mint(&alice, &xlm::to_stroops(5));
    sac.mint(&bob, &xlm::to_stroops(5));

    // Alice wins: the correct answer is 4 in the default seeded environment.
    assert!(
        client.guess(&4, &alice),
        "alice should win with the correct guess"
    );
    assert_eq!(
        sac.balance(&client.address),
        0,
        "contract balance should be 0 after alice wins"
    );

    // Bob now attempts the same correct guess with an empty contract pot.
    assert_eq!(
        client.try_guess(&4, &bob).unwrap_err(),
        Ok(Error::InsufficientBalance),
        "a correct guess against an empty contract should return InsufficientBalance"
    );
}

/// Repeated wrong guesses drain the user's balance one XLM at a time.
///
/// This verifies that there is no deduplication or "you already guessed that"
/// protection: each wrong guess always costs 1 XLM regardless of whether the
/// same value was tried before.
#[test]
fn test_repeated_wrong_guesses_drain_user() {
    let env = &Env::default();
    let (_, sac, client) = init_test(env);
    env.mock_all_auths();

    let alice = Address::generate(env);
    // Give Alice exactly 3 XLM so we can make three wrong guesses.
    sac.mint(&alice, &xlm::to_stroops(3));

    // All three guesses are wrong (correct answer is 4).
    assert!(!client.guess(&1, &alice));
    assert_eq!(
        sac.balance(&alice),
        xlm::to_stroops(2),
        "after 1st wrong guess"
    );

    // Duplicate guess: same wrong value guessed again — still costs 1 XLM.
    assert!(!client.guess(&1, &alice));
    assert_eq!(
        sac.balance(&alice),
        xlm::to_stroops(1),
        "after 2nd wrong guess (duplicate)"
    );

    // Another different wrong guess.
    assert!(!client.guess(&2, &alice));
    assert_eq!(
        sac.balance(&alice),
        xlm::to_stroops(0),
        "after 3rd wrong guess"
    );

    // Alice is now out of funds; the next wrong guess must fail with TransferFailed.
    assert_eq!(
        client.try_guess(&1, &alice).unwrap_err(),
        Ok(Error::TransferFailed),
        "user with zero balance should receive TransferFailed on a wrong guess"
    );
}
