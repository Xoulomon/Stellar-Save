//! Shared test utilities for fungible-allowlist contract tests.
//!
//! Provides common setup and helper functions to reduce duplication
//! across test files.

#![cfg(test)]

use crate::contract::{ExampleContract, ExampleContractClient};
use soroban_sdk::{Address, Env, String};

// create_env and generate_address are identical across all sibling contracts.
// Delegate to the canonical implementations in stellar-save-common rather than
// maintaining per-contract copies.
pub use stellar_save_common::test_support::{create_env, generate_address};

/// Create a client for the AllowList token contract.
///
/// Registers the contract with the given parameters and returns a ready-to-use client.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `admin` - Admin account for the token
/// * `manager` - Manager account for allow/disallow operations
/// * `initial_supply` - Initial token supply
///
/// # Returns
/// An initialized ExampleContractClient
pub fn create_client<'a>(
    env: &Env,
    admin: &Address,
    manager: &Address,
    initial_supply: &i128,
) -> ExampleContractClient<'a> {
    let name = String::from_str(env, "AllowList Token");
    let symbol = String::from_str(env, "ALT");
    let address = env.register(
        ExampleContract,
        (name, symbol, admin, manager, initial_supply),
    );
    ExampleContractClient::new(env, &address)
}

/// Create test scenario with admin, manager, and users.
///
/// # Arguments
/// * `env` - The Soroban environment
///
/// # Returns
/// A tuple of (admin, manager, user1, user2)
pub fn setup_accounts(env: &Env) -> (Address, Address, Address, Address) {
    (
        generate_address(env),
        generate_address(env),
        generate_address(env),
        generate_address(env),
    )
}
