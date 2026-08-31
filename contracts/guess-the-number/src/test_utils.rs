//! Shared test utilities for guess-the-number contract tests.
//!
//! Provides common setup and helper functions to reduce duplication
//! across test files.

#![cfg(test)]

use soroban_sdk::{
    testutils::Address as _,
    token::StellarAssetClient,
    Address, Env, IntoVal, Val, Vec,
};

use crate::contract::{GuessTheNumber, GuessTheNumberClient};

/// Initialize a test environment with auth mocking.
///
/// # Returns
/// A new `Env` instance ready for testing
pub fn create_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

/// Generate a new test address.
///
/// # Arguments
/// * `env` - The Soroban environment
///
/// # Returns
/// A new unique address
pub fn generate_address(env: &Env) -> Address {
    Address::generate(env)
}

/// Create and initialize the GuessTheNumber contract.
///
/// Registers the contract with a given admin address and returns a ready-to-use client.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `admin` - Admin account for the contract
///
/// # Returns
/// An initialized GuessTheNumberClient
pub fn generate_client<'a>(env: &Env, admin: &Address) -> GuessTheNumberClient<'a> {
    let contract_id = Address::generate(env);
    env.mock_all_auths();
    let contract_id = env.register_at(&contract_id, GuessTheNumber, (admin,));
    env.set_auths(&[]); // clear auths
    GuessTheNumberClient::new(env, &contract_id)
}

/// Set up a basic test scenario with admin and guest addresses.
///
/// # Arguments
/// * `env` - The Soroban environment
///
/// # Returns
/// A tuple of (admin, user)
pub fn setup_accounts(env: &Env) -> (Address, Address) {
    (generate_address(env), generate_address(env))
}

/// Initialize a complete test context with environment, token, and contract.
///
/// # Arguments
/// * `env` - The Soroban environment
///
/// # Returns
/// A tuple of (admin, sac, client)
pub fn init_test<'a>(env: &'a Env) -> (Address, StellarAssetClient<'a>, GuessTheNumberClient<'a>) {
    let admin = generate_address(env);
    let client = generate_client(env, &admin);
    // This is needed because we want to call a function from within the context of the contract
    // In this case we want to get the address of the XLM contract registered by the constructor
    let sac_address = env.as_contract(&client.address, || crate::xlm::contract_id(env));
    (admin, StellarAssetClient::new(env, &sac_address), client)
}


/// Mock the auth context for a function call.
///
/// # Arguments
/// * `client` - The contract client
/// * `fn_name` - Name of the function being called
/// * `caller` - Address that is calling the function
/// * `args` - Arguments to the function
pub fn set_caller<T>(client: &GuessTheNumberClient, fn_name: &str, caller: &Address, args: T)
where
    T: IntoVal<Env, Vec<Val>>,
{
    use soroban_sdk::testutils::MockAuth;

    // clear previous auth mocks
    client.env.set_auths(&[]);

    let invoke = &soroban_sdk::testutils::MockAuthInvoke {
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
