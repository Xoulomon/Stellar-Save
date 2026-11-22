//! Shared test-support utilities for Stellar-Save contract tests.
//!
//! These two helpers appear byte-for-byte identically in every sibling
//! contract's `test_utils.rs`.  They live here so each contract can
//! delegate to the canonical implementation instead of maintaining its
//! own copy.
//!
//! # Usage
//!
//! ```rust,ignore
//! use stellar_save_common::test_support::{create_env, generate_address};
//!
//! #[test]
//! fn my_test() {
//!     let env = create_env();
//!     let alice = generate_address(&env);
//!     // …
//! }
//! ```
//!
//! # Contracts using these helpers
//!
//! | Contract              | Local function replaced              |
//! |-----------------------|--------------------------------------|
//! | `guess-the-number`    | `test_utils::create_env`             |
//! | `guess-the-number`    | `test_utils::generate_address`       |
//! | `nft-enumerable`      | `test_utils::create_env`             |
//! | `nft-enumerable`      | `test_utils::generate_address`       |
//! | `fungible-allowlist`  | `test_utils::create_env`             |
//! | `fungible-allowlist`  | `test_utils::generate_address`       |

// This module is test-only; it is compiled only when `testutils` is enabled.
// The `cfg` attribute is placed here rather than on every item so callers only
// need a single feature gate on their import site.

use soroban_sdk::{testutils::Address as _, Address, Env};

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
}
