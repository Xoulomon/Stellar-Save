//! Shared Access-Control (Auth) Module for StellarSave.
//!
//! Provides centralized authorization guard functions for:
//! - `require_admin`: Validates caller authority against global admin config
//! - `require_creator`: Validates caller is the group creator
//! - `require_group_creator`: Alias for `require_creator` — validates caller is the group creator
//! - `require_member`: Validates caller is an active group member
//! - `require_not_member`: Validates caller is NOT a member of the group

use crate::error::StellarSaveError;
use crate::group::Group;
use crate::storage::StorageKeyBuilder;
use crate::types::ContractConfig;
use soroban_sdk::{Address, Env};

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

/// Require caller authentication and verify caller is the group creator.
///
/// Alias for [`require_creator`] that accepts a `group_id` and loads the
/// group from storage, making it convenient for entry-points that already
/// have the group ID but not the loaded `Group` struct.
pub fn require_group_creator(
    env: &Env,
    group_id: u64,
    caller: &Address,
) -> Result<(), StellarSaveError> {
    caller.require_auth();
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group: Group = env
        .storage()
        .persistent()
        .get(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;
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

/// Require caller authentication and verify caller is NOT a member of the group.
///
/// Useful for operations that must be performed by non-members (e.g. inviting
/// a new member who has not yet joined).
pub fn require_not_member(env: &Env, group_id: u64, caller: &Address) -> Result<(), StellarSaveError> {
    caller.require_auth();
    if is_active_member(env, group_id, caller) {
        return Err(StellarSaveError::AlreadyMember);
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

    // ── Helper: build a minimal valid MemberProfile ──────────────────
    fn make_profile(env: &Env, address: Address, group_id: u64) -> crate::types::MemberProfile {
        crate::types::MemberProfile {
            address,
            group_id,
            payout_position: 0,
            joined_at: 1000,
            auto_contribute_enabled: false,
        }
    }

    // ── Helper: build a minimal valid Group ──────────────────────────
    fn make_group(env: &Env, creator: Address, group_id: u64) -> Group {
        Group::new(&env, group_id, creator, 100, 3600, 5, 2, 1000, 0)
    }

    // ════════════════════════════════════════════════════════════════
    // require_admin
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_require_admin_allowed() {
        let env = Env::default();
        let admin = Address::generate(&env);

        env.mock_all_auths();

        let config = ContractConfig {
            admin: admin.clone(),
            treasury: admin.clone(),
            creation_fee: 0,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        assert!(require_admin(&env, &admin).is_ok());
    }

    #[test]
    fn test_require_admin_denied() {
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

        assert_eq!(
            require_admin(&env, &non_admin),
            Err(StellarSaveError::Unauthorized)
        );
    }

    #[test]
    fn test_require_admin_no_config() {
        let env = Env::default();
        let caller = Address::generate(&env);

        env.mock_all_auths();

        // No config stored → Unauthorized
        assert_eq!(
            require_admin(&env, &caller),
            Err(StellarSaveError::Unauthorized)
        );
    }

    // ════════════════════════════════════════════════════════════════
    // require_creator
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_require_creator_allowed() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let non_creator = Address::generate(&env);

        env.mock_all_auths();

        let group = make_group(&env, creator.clone(), 1);

        // Positive case
        assert!(require_creator(&creator, &group).is_ok());

        // Negative case
        assert_eq!(
            require_creator(&non_creator, &group),
            Err(StellarSaveError::Unauthorized)
        );
    }

    #[test]
    fn test_require_creator_no_auth() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // No mock_all_auths → require_auth will fail
        let group = make_group(&env, creator.clone(), 1);

        // Without authentication, require_creator should return an auth error
        // (soroban-sdk's require_auth fails when no auth is set up)
        let result = require_creator(&creator, &group);
        // The result should be an error — either Unauthorized or an auth failure
        assert!(result.is_err());
    }

    // ════════════════════════════════════════════════════════════════
    // require_group_creator
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_require_group_creator_allowed() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let non_creator = Address::generate(&env);
        let group_id = 1u64;

        env.mock_all_auths();

        let group = make_group(&env, creator.clone(), group_id);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Positive case
        assert!(require_group_creator(&env, group_id, &creator).is_ok());

        // Negative case
        assert_eq!(
            require_group_creator(&env, group_id, &non_creator),
            Err(StellarSaveError::Unauthorized)
        );
    }

    #[test]
    fn test_require_group_creator_group_not_found() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let group_id = 9999u64;

        env.mock_all_auths();

        // No group stored → GroupNotFound
        assert_eq!(
            require_group_creator(&env, group_id, &caller),
            Err(StellarSaveError::GroupNotFound)
        );
    }

    // ════════════════════════════════════════════════════════════════
    // require_member
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_require_member_allowed() {
        let env = Env::default();
        let member = Address::generate(&env);
        let non_member = Address::generate(&env);
        let group_id = 1u64;

        env.mock_all_auths();

        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        env.storage()
            .persistent()
            .set(&member_key, &make_profile(&env, member.clone(), group_id));

        // Positive case
        assert!(require_member(&env, group_id, &member).is_ok());

        // Negative case
        assert_eq!(
            require_member(&env, group_id, &non_member),
            Err(StellarSaveError::NotMember)
        );
    }

    #[test]
    fn test_require_member_no_auth() {
        let env = Env::default();
        let member = Address::generate(&env);
        let group_id = 1u64;

        // No mock_all_auths → require_auth will fail
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        env.storage()
            .persistent()
            .set(&member_key, &make_profile(&env, member.clone(), group_id));

        let result = require_member(&env, group_id, &member);
        // Without authentication, require_member should return an auth error
        assert!(result.is_err());
    }

    // ════════════════════════════════════════════════════════════════
    // require_not_member
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_require_not_member_allowed() {
        let env = Env::default();
        let non_member = Address::generate(&env);
        let group_id = 1u64;

        env.mock_all_auths();

        // Positive case: non-member is allowed
        assert!(require_not_member(&env, group_id, &non_member).is_ok());
    }

    #[test]
    fn test_require_not_member_denied() {
        let env = Env::default();
        let member = Address::generate(&env);
        let group_id = 1u64;

        env.mock_all_auths();

        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        env.storage()
            .persistent()
            .set(&member_key, &make_profile(&env, member.clone(), group_id));

        // Negative case: member is denied
        assert_eq!(
            require_not_member(&env, group_id, &member),
            Err(StellarSaveError::AlreadyMember)
        );
    }

    #[test]
    fn test_require_not_member_no_auth() {
        let env = Env::default();
        let non_member = Address::generate(&env);
        let group_id = 1u64;

        // No mock_all_auths → require_auth will fail
        let result = require_not_member(&env, group_id, &non_member);
        assert!(result.is_err());
    }

    // ════════════════════════════════════════════════════════════════
    // is_active_member
    // ════════════════════════════════════════════════════════════════

    #[test]
    fn test_is_active_member_returns_true_for_stored_profile() {
        let env = Env::default();
        let address = Address::generate(&env);
        let group_id = 42u64;

        let key = StorageKeyBuilder::member_profile(group_id, address.clone());
        env.storage()
            .persistent()
            .set(&key, &make_profile(&env, address.clone(), group_id));

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
        env.storage()
            .persistent()
            .set(&key, &make_profile(&env, address.clone(), 1));

        assert!(is_active_member(&env, 1, &address));
        // Group 2 should return false even though address is in group 1
        assert!(!is_active_member(&env, 2, &address));
    }
}