//! Shared Access-Control (Auth) Module for StellarSave.
//!
//! Provides centralized authorization guard functions for:
//! - `require_admin`: Validates caller authority against global admin config
//! - `require_creator`: Validates caller is the group creator
//! - `require_member`: Validates caller is an active group member

use soroban_sdk::{Address, Env};
use crate::error::StellarSaveError;
use crate::group::Group;
use crate::storage::StorageKeyBuilder;
use crate::types::ContractConfig;

/// Require caller authentication and verify caller is a registered admin.
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), StellarSaveError> {
    caller.require_auth();
    let config: ContractConfig = env
        .storage()
        .persistent()
        .get(&StorageKeyBuilder::contract_config())
        .ok_or(StellarSaveError::Unauthorized)?;
    if &config.admin != caller {
        return Err(StellarSaveError::Unauthorized);
    }
    Ok(())
}

/// Require caller authentication and verify caller is the group creator.
pub fn require_creator(caller: &Address, group: &Group) -> Result<(), StellarSaveError> {
    caller.require_auth();
    if caller != &group.creator {
        return Err(StellarSaveError::Unauthorized);
    }
    Ok(())
}

/// Require caller authentication and verify caller is a member of the group.
pub fn require_member(env: &Env, group_id: u64, caller: &Address) -> Result<(), StellarSaveError> {
    caller.require_auth();
    if !is_active_member(env, group_id, caller) {
        return Err(StellarSaveError::NotMember);
    }
    Ok(())
}

/// Checks whether `address` holds a member profile for `group_id`.
///
/// This is the single, canonical membership check used by all call sites
/// across the contract. It performs a constant-time storage `has()` without
/// deserialising the full `MemberProfile`, keeping gas costs minimal.
///
/// # Arguments
/// * `env`      - Soroban environment
/// * `group_id` - Group to check membership in
/// * `address`  - Address to test
///
/// # Returns
/// `true` if a `MemberProfile` exists for `(group_id, address)`, `false`
/// otherwise (including non-existent groups or zero `group_id`).
///
/// # Note
/// This function does **not** require caller authentication — it is a pure
/// read-only query. For guarded write operations, use `require_member`.
pub fn is_active_member(env: &Env, group_id: u64, address: &Address) -> bool {
    let member_key = StorageKeyBuilder::member_profile(group_id, address.clone());
    env.storage().persistent().has(&member_key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_auth_creator_guard() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let non_creator = Address::generate(&env);

        let group = Group::new(
            &env,
            1,
            creator.clone(),
            100,
            3600,
            5,
            2,
            1000,
            0,
        );

        env.mock_all_auths();

        // Positive case
        assert!(require_creator(&creator, &group).is_ok());

        // Negative case
        assert_eq!(
            require_creator(&non_creator, &group),
            Err(StellarSaveError::Unauthorized)
        );
    }

    /// Build a minimal valid MemberProfile for test setup.
    fn make_profile(env: &Env, address: Address, group_id: u64) -> crate::types::MemberProfile {
        crate::types::MemberProfile {
            address,
            group_id,
            payout_position: 0,
            joined_at: 1000,
            auto_contribute_enabled: false,
        }
    }

    #[test]
    fn test_auth_member_guard() {
        let env = Env::default();
        let member = Address::generate(&env);
        let non_member = Address::generate(&env);
        let group_id = 1u64;

        env.mock_all_auths();

        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        let profile = make_profile(&env, member.clone(), group_id);
        env.storage().persistent().set(&member_key, &profile);

        // Positive case
        assert!(require_member(&env, group_id, &member).is_ok());

        // Negative case
        assert_eq!(
            require_member(&env, group_id, &non_member),
            Err(StellarSaveError::NotMember)
        );
    }

    // ── is_active_member edge-case tests ─────────────────────────────────────

    #[test]
    fn test_is_active_member_returns_true_for_stored_profile() {
        let env = Env::default();
        let address = Address::generate(&env);
        let group_id = 42u64;

        let key = StorageKeyBuilder::member_profile(group_id, address.clone());
        env.storage().persistent().set(&key, &make_profile(&env, address.clone(), group_id));

        assert!(is_active_member(&env, group_id, &address));
    }

    #[test]
    fn test_is_active_member_returns_false_for_non_member() {
        let env = Env::default();
        let address = Address::generate(&env);
        let group_id = 42u64;

        // No profile stored
        assert!(!is_active_member(&env, group_id, &address));
    }

    #[test]
    fn test_is_active_member_non_existent_group_returns_false() {
        let env = Env::default();
        let address = Address::generate(&env);
        // group_id 9999 was never created
        assert!(!is_active_member(&env, 9999, &address));
    }

    #[test]
    fn test_is_active_member_zero_group_id_returns_false() {
        let env = Env::default();
        let address = Address::generate(&env);
        // group_id 0 is invalid — no member profile can be stored there
        assert!(!is_active_member(&env, 0, &address));
    }

    #[test]
    fn test_is_active_member_no_auth_required() {
        // Calling is_active_member without mock_all_auths must not panic.
        let env = Env::default();
        let address = Address::generate(&env);
        // Should succeed (returns false) without any authentication setup
        assert!(!is_active_member(&env, 1, &address));
    }

    #[test]
    fn test_is_active_member_different_group_same_address_isolated() {
        let env = Env::default();
        let address = Address::generate(&env);

        // Store profile only for group 1
        let key = StorageKeyBuilder::member_profile(1, address.clone());
        env.storage().persistent().set(&key, &make_profile(&env, address.clone(), 1));

        assert!(is_active_member(&env, 1, &address));
        // Group 2 should return false even though address is in group 1
        assert!(!is_active_member(&env, 2, &address));
    }

    #[test]
    fn test_auth_admin_guard() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let non_admin = Address::generate(&env);

        env.mock_all_auths();

        let config = ContractConfig {
            admin: admin.clone(),
            treasury: admin.clone(),
            creation_fee: 0,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Positive case
        assert!(require_admin(&env, &admin).is_ok());

        // Negative case
        assert_eq!(
            require_admin(&env, &non_admin),
            Err(StellarSaveError::Unauthorized)
        );
    }
}
