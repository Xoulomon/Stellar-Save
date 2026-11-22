//! Shared test utilities for nft-enumerable contract tests.
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
