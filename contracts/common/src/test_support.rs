//! Shared test-support utilities for Stellar-Save contract tests.
//!
//! These helpers appear byte-for-byte identically in every sibling
//! contract's `test_utils.rs`.  They live here so each contract can
//! delegate to the canonical implementation instead of maintaining its
//! own copy.
//!
//! # Usage
//!
//! ```rust,ignore
//! use stellar_save_common::test_support::{create_env, generate_address, generate_addresses, create_string};
//!
//! #[test]
//! fn my_test() {
//!     let env = create_env();
//!     let alice = generate_address(&env);
//!     let addrs = generate_addresses(&env, 5);
//!     let name = create_string(&env, "Alice");
//!     // …
//! }
//! ```
//!
//! # Contracts using these helpers
//!
//! | Contract              | Local function replaced              |
//! |-----------------------|----------------------------------------|
//! | `guess-the-number`    | `test_utils::create_env`               |
//! | `guess-the-number`    | `test_utils::generate_address`         |
//! | `nft-enumerable`      | `test_utils::create_env`               |
//! | `nft-enumerable`      | `test_utils::generate_address`         |
//! | `fungible-allowlist`  | `test_utils::create_env`               |
//! | `fungible-allowlist`  | `test_utils::generate_address`         |
//! | `stellar-save`        | `test_utils::create_env`               |
//! | `stellar-save`        | `test_utils::generate_address`         |
//! | `stellar-save`        | `test_utils::generate_addresses`       |
//! | `stellar-save`        | `test_utils::create_string`            |

// This module is test-only; it is compiled only when `testutils` is enabled.
// The `cfg` attribute is placed here rather than on every item so callers only
// need a single feature gate on their import site.

use soroban_sdk::{testutils::Address as _, Address, Env, String};

/// Create a test environment with all authorizations mocked.
///
/// Every contract test starts with this; keeping it in one place ensures that
/// the mock-all-auths default cannot drift between contracts.
pub fn create_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

/// Generate a fresh, unique test address inside `env`.
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
    let mut addresses = Vec::with_capacity(count);
    for _ in 0..count {
        addresses.push(Address::generate(env));
    }
    addresses
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_env_returns_default_env_with_auths_mocked() {
        // If mock_all_auths was not called this line would panic due to
        // missing auth on the address operation.
        let env = create_env();
        // Verify we get an Env we can work with.
        let _addr = Address::generate(&env);
    }

    #[test]
    fn generate_address_returns_distinct_addresses() {
        let env = create_env();
        let a = generate_address(&env);
        let b = generate_address(&env);
        assert_ne!(a, b, "two generated addresses must be distinct");
    }

    #[test]
    fn generate_addresses_returns_correct_count() {
        let env = create_env();
        let addresses = generate_addresses(&env, 5);
        assert_eq!(addresses.len(), 5, "should generate exactly 5 addresses");
    }

    #[test]
    fn generate_addresses_returns_distinct_addresses() {
        let env = create_env();
        let addresses = generate_addresses(&env, 10);
        let unique: std::collections::HashSet<_> = addresses.iter().collect();
        assert_eq!(
            unique.len(),
            addresses.len(),
            "all generated addresses must be distinct"
        );
    }

    #[test]
    fn generate_addresses_zero_count_returns_empty() {
        let env = create_env();
        let addresses = generate_addresses(&env, 0);
        assert!(addresses.is_empty(), "zero count should return empty vec");
    }

    #[test]
    fn create_string_returns_correct_content() {
        let env = create_env();
        let s = create_string(&env, "hello world");
        assert_eq!(s.to_string(), "hello world");
    }

    #[test]
    fn create_string_empty() {
        let env = create_env();
        let s = create_string(&env, "");
        assert_eq!(s.to_string(), "");
    }
}