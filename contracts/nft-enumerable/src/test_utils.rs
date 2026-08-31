//! Shared test utilities for nft-enumerable contract tests.
//!
//! Provides common setup and helper functions to reduce duplication
//! across test files.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use crate::contract::{ExampleContract, ExampleContractClient};

/// Initialize a test environment with auth mocking.
///
/// # Returns
/// A new `Env` instance ready for testing
pub fn create_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

/// Create a client for the NFT contract.
///
/// Registers the contract with the given parameters and returns a ready-to-use client.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `owner` - Owner account for the NFT collection
///
/// # Returns
/// An initialized ExampleContractClient
pub fn create_client<'a>(env: &Env, owner: &Address) -> ExampleContractClient<'a> {
    let uri = String::from_str(env, "www.mytoken.com");
    let name = String::from_str(env, "My Token");
    let symbol = String::from_str(env, "TKN");
    let address = env.register(ExampleContract, (uri, name, symbol, owner));
    ExampleContractClient::new(env, &address)
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

/// Create test scenario with owner, recipient, and spender.
///
/// # Arguments
/// * `env` - The Soroban environment
///
/// # Returns
/// A tuple of (owner, recipient, spender)
pub fn setup_accounts(env: &Env) -> (Address, Address, Address) {
    (
        generate_address(env),
        generate_address(env),
        generate_address(env),
    )
}
