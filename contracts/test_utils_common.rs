//! Common test utilities shared across all Stellar-Save contracts.
//!
//! This module provides reusable test helpers to eliminate duplication across
//! fungible-allowlist, nft-enumerable, guess-the-number, and other contracts.
//! Each contract can import these utilities to reduce boilerplate code.
//!
//! ## Usage
//! Copy this file to individual contract directories or reference it as a
//! shared module. Each contract imports the functions it needs.
//!
//! ## Available Utilities
//! - `create_env()` - Initialize a test environment
//! - `generate_address()` - Create test addresses
//! - `generate_addresses()` - Batch create addresses
//! - `create_string()` - Create test strings

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

/// Initialize a test environment with default settings and auth mocking.
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

/// Batch-generate multiple test addresses.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `count` - Number of addresses to generate
///
/// # Returns
/// A vector of unique addresses
pub fn generate_addresses(env: &Env, count: usize) -> Vec<Address> {
    use soroban_sdk::Vec as SorobanVec;
    
    let mut addresses = SorobanVec::new(env);
    for _ in 0..count {
        addresses.push_back(Address::generate(env));
    }
    let mut result = Vec::with_capacity(count);
    for i in 0..addresses.len() {
        result.push(addresses.get(i as u32).unwrap());
    }
    result
}

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
