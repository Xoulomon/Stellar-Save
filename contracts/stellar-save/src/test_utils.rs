//! Shared test utilities for all contract tests.
//!
//! This module provides common test helpers to avoid duplication across multiple
//! test files: environment setup, client initialization, token utilities, and
//! common test scenario builders.

#![cfg(test)]

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

use crate::{StellarSaveClient, StellarSaveContract};

// ─── Environment & Client Setup ──────────────────────────────────────────────

/// Initialize a test environment with default settings.
///
/// Sets up a fresh Soroban environment with all authentications mocked.
///
/// # Returns
/// A new `Env` instance ready for testing.
pub fn create_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

/// Initialize the StellarSave contract and return all necessary test components.
///
/// This is the primary setup function for integration tests. It:
/// - Creates a test environment
/// - Registers a mock SEP-41 token (Stellar Asset Contract)
/// - Deploys the StellarSave contract
/// - Returns all components needed for testing
///
/// # Returns
/// A tuple of `(env, client, token_address, token_client)` where:
/// - `env`: The Soroban test environment
/// - `client`: The generated StellarSaveClient for contract interaction
/// - `token_address`: The address of the deployed mock token
/// - `token_client`: StellarAssetClient for token operations
pub fn setup<'a>() -> (Env, StellarSaveClient<'a>, Address, StellarAssetClient<'a>) {
    let env = create_env();

    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();
    let sac_client = StellarAssetClient::new(&env, &token);

    let contract_id = env.register(StellarSaveContract, ());
    let client = StellarSaveClient::new(&env, &contract_id);

    (env, client, token, sac_client)
}

/// Deploy a fresh mock SEP-41 token (Stellar Asset Contract).
///
/// Useful when you need multiple independent token instances or want to
/// test multi-token scenarios.
///
/// # Arguments
/// * `env` - The Soroban environment
///
/// # Returns
/// The address of the newly deployed token contract
pub fn deploy_mock_token(env: &Env) -> Address {
    let admin = Address::generate(env);
    env.register_stellar_asset_contract_v2(admin).address()
}

// ─── Token Utilities ─────────────────────────────────────────────────────────

/// Mint tokens to an address.
///
/// Converts XLM amounts (in whole units) to stroops and mints the specified
/// quantity to the target address.
///
/// # Arguments
/// * `sac` - StellarAssetClient for the token contract
/// * `address` - The address to mint tokens to
/// * `xlm` - Number of XLM to mint (will be converted to stroops)
pub fn mint(sac: &StellarAssetClient, address: &Address, xlm: i128) {
    sac.mint(address, &(xlm * crate::xlm::STROOPS_PER_XLM));
}

/// Get the balance of an address for a token.
///
/// # Arguments
/// * `tc` - TokenClient for the token contract
/// * `address` - The address to check
///
/// # Returns
/// The balance in stroops
pub fn get_balance(tc: &TokenClient, address: &Address) -> i128 {
    tc.balance(address)
}

/// Convert stroops to XLM (whole units).
///
/// # Arguments
/// * `stroops` - Amount in stroops
///
/// # Returns
/// Amount in XLM
pub fn stroops_to_xlm(stroops: i128) -> i128 {
    stroops / crate::xlm::STROOPS_PER_XLM
}

// ─── Group Setup Utilities ───────────────────────────────────────────────────

/// Create a test group with 3 members and return all details.
///
/// This is a convenience builder that:
/// - Creates a group with the specified parameters
/// - Generates three addresses (alice, bob, carol)
/// - Mints tokens to each member
/// - Adds all members to the group
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `client` - The StellarSaveClient
/// * `sac` - StellarAssetClient for minting tokens
/// * `contribution_amount` - Required contribution per cycle (in stroops)
/// * `cycle_duration` - Duration of each cycle (in seconds)
/// * `initial_balance_xlm` - Initial balance to mint to each member (in XLM)
///
/// # Returns
/// A tuple of `(group_id, alice_address, bob_address, carol_address)`
pub fn setup_3_member_group_with_params(
    env: &Env,
    client: &StellarSaveClient,
    sac: &StellarAssetClient,
    contribution_amount: i128,
    cycle_duration: u32,
    initial_balance_xlm: i128,
) -> (u64, Address, Address, Address) {
    let group_id = client.create_group(&contribution_amount, &cycle_duration, &3u32);

    let alice = Address::generate(env);
    let bob = Address::generate(env);
    let carol = Address::generate(env);

    mint(sac, &alice, initial_balance_xlm);
    mint(sac, &bob, initial_balance_xlm);
    mint(sac, &carol, initial_balance_xlm);

    client.join_group(&group_id, &alice);
    client.join_group(&group_id, &bob);
    client.join_group(&group_id, &carol);

    (group_id, alice, bob, carol)
}

/// Create a test group with 3 members using default parameters.
///
/// Uses standard parameters:
/// - Contribution: 10 XLM (100,000,000 stroops)
/// - Cycle duration: 10 seconds
/// - Initial balance: 100 XLM per member
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `client` - The StellarSaveClient
/// * `sac` - StellarAssetClient for minting tokens
///
/// # Returns
/// A tuple of `(group_id, alice_address, bob_address, carol_address)`
pub fn setup_3_member_group(
    env: &Env,
    client: &StellarSaveClient,
    sac: &StellarAssetClient,
) -> (u64, Address, Address, Address) {
    let contribution = 10 * crate::xlm::STROOPS_PER_XLM;
    setup_3_member_group_with_params(env, client, sac, contribution, 10u32, 100)
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

/// Batch-generate multiple test addresses.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `count` - Number of addresses to generate
///
/// # Returns
/// A vector of unique addresses
pub fn generate_addresses(env: &Env, count: usize) -> Vec<Address> {
    let mut addresses = Vec::new();
    for _ in 0..count {
        addresses.push(Address::generate(env));
    }
    addresses
}

// ─── String Utilities ────────────────────────────────────────────────────────

/// Create a test string with the given content.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `content` - The string content
///
/// # Returns
/// A Soroban String instance
pub fn create_string(env: &Env, content: &str) -> String {
    String::from_str(env, content)
}
