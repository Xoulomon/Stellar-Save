//! Shared admin / owner authorization helpers.
//!
//! Contracts that store a single privileged address under an instance-storage
//! key (the "owner" or "admin" pattern) can use [`require_owner`] instead of
//! duplicating the same three-line check in every contract.
//!
//! # Pattern
//!
//! ```ignore
//! use stellar_save_common::admin::require_owner;
//! use soroban_sdk::symbol_short;
//!
//! fn my_privileged_fn(env: &Env) {
//!     let owner = require_owner(env, &symbol_short!("ADMIN"));
//!     // … proceed with privileged work …
//! }
//! ```
//!
//! # Contracts using this helper
//!
//! | Contract             | Storage key              |
//! |----------------------|--------------------------|
//! | `guess-the-number`   | `symbol_short!("ADMIN")` |
//! | `nft-enumerable`     | `DataKey::Owner`         |

use soroban_sdk::{Address, Env, IntoVal, Val};

/// Loads the privileged address stored at `key` in instance storage,
/// calls `require_auth()` on it, and returns the address.
///
/// Panics with `"admin not set"` if no address is found at `key`.
///
/// # Arguments
/// * `env` - Soroban environment
/// * `key` - Instance-storage key under which the owner/admin address is stored
///
/// # Returns
/// The authenticated owner address.
///
/// # Panics
/// Panics if no address is stored at `key`.
pub fn require_owner<K>(env: &Env, key: &K) -> Address
where
    K: IntoVal<Env, Val>,
{
    let owner: Address = env
        .storage()
        .instance()
        .get(key)
        .expect("admin not set");
    owner.require_auth();
    owner
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{symbol_short, testutils::Address as _, Env};

    const ADMIN_KEY: &soroban_sdk::Symbol = &symbol_short!("ADMIN");

    #[test]
    fn require_owner_returns_the_stored_address() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        env.storage().instance().set(ADMIN_KEY, &admin);

        let returned = require_owner(&env, ADMIN_KEY);
        assert_eq!(returned, admin);
    }

    #[test]
    #[should_panic(expected = "admin not set")]
    fn require_owner_panics_when_key_absent() {
        let env = Env::default();
        env.mock_all_auths();
        require_owner::<soroban_sdk::Symbol>(&env, ADMIN_KEY);
    }
}
