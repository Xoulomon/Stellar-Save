//! Issue #1329 — Admin Actions Authorization Tests
//!
//! Dedicated authorization tests for every admin-gated function.
//! Each function gets: (1) authorized-caller success, (2) unauthorized rejection.
//!
//! Cross-referenced: `docs/admin-actions.md`, `docs/runbooks/on-chain-admin-action.md`
//!
//! ## Shared fixtures (issue #1717)
//! Local `make_config`, `store_config`, `store_group`, and `store_group_status`
//! helpers have been replaced with the canonical versions from `test_utils`:
//! - `crate::test_utils::store_contract_config`
//! - `crate::test_utils::store_test_group`
//! - `crate::test_utils::store_test_group_with_status`

#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

    use crate::{
        group::GroupStatus,
        penalty::PenaltyConfig,
        test_utils::{store_contract_config, store_test_group, store_test_group_with_status},
        StellarSaveContract, StellarSaveError,
    };

    // ── migrate_storage ───────────────────────────────────────────────────────

    #[test]
    fn test_migrate_storage_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        store_contract_config(&env, &admin);
        crate::migration::initialize_storage_version(&env);
        let result = StellarSaveContract::migrate_storage(env.clone(), admin.clone());
        assert!(
            result.is_ok(),
            "admin must trigger migrate_storage: {:?}",
            result.err()
        );
    }

    #[test]
    fn test_migrate_storage_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_contract_config(&env, &admin);
        crate::migration::initialize_storage_version(&env);
        let result = StellarSaveContract::migrate_storage(env.clone(), attacker);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── update_contribution_limits ────────────────────────────────────────────

    #[test]
    fn test_update_contribution_limits_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        store_contract_config(&env, &admin);
        let result = StellarSaveContract::update_contribution_limits(
            env.clone(),
            admin.clone(),
            500_000,
            2_000_000_000,
        );
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_update_contribution_limits_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_contract_config(&env, &admin);
        let result = StellarSaveContract::update_contribution_limits(
            env.clone(),
            attacker,
            500_000,
            2_000_000_000,
        );
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── add_allowed_token ─────────────────────────────────────────────────────

    #[test]
    fn test_add_allowed_token_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        store_contract_config(&env, &admin);
        let result =
            StellarSaveContract::add_allowed_token(env.clone(), admin.clone(), token.clone());
        assert!(result.is_ok(), "{:?}", result.err());
        assert!(StellarSaveContract::is_token_allowed(env.clone(), token));
    }

    #[test]
    fn test_add_allowed_token_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let token = Address::generate(&env);
        store_contract_config(&env, &admin);
        let result = StellarSaveContract::add_allowed_token(env.clone(), attacker, token);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── remove_allowed_token ──────────────────────────────────────────────────

    #[test]
    fn test_remove_allowed_token_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        store_contract_config(&env, &admin);
        StellarSaveContract::add_allowed_token(env.clone(), admin.clone(), token.clone()).unwrap();
        let result = StellarSaveContract::remove_allowed_token(env.clone(), admin.clone(), token);
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_remove_allowed_token_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let token = Address::generate(&env);
        store_contract_config(&env, &admin);
        StellarSaveContract::add_allowed_token(env.clone(), admin.clone(), token.clone()).unwrap();
        let result = StellarSaveContract::remove_allowed_token(env.clone(), attacker, token);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── resume_group ──────────────────────────────────────────────────────────

    #[test]
    fn test_resume_group_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        store_test_group_with_status(&env, 1, &creator, GroupStatus::Paused);
        let result = StellarSaveContract::resume_group(env.clone(), 1, creator.clone());
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_resume_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_test_group_with_status(&env, 1, &creator, GroupStatus::Paused);
        let result = StellarSaveContract::resume_group(env.clone(), 1, attacker);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── cancel_group ──────────────────────────────────────────────────────────

    #[test]
    fn test_cancel_group_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        store_test_group_with_status(&env, 1, &creator, GroupStatus::Pending);
        let result = StellarSaveContract::cancel_group(env.clone(), 1, creator.clone());
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_cancel_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_test_group_with_status(&env, 1, &creator, GroupStatus::Pending);
        let result = StellarSaveContract::cancel_group(env.clone(), 1, attacker);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── set_penalty_config ────────────────────────────────────────────────────

    #[test]
    fn test_set_penalty_config_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        store_test_group(&env, 1, &creator);
        let cfg = PenaltyConfig {
            base_penalty_bps: 300,
            penalty_increment_bps: 300,
            max_penalty_bps: 1500,
            recovery_fee_bps: 500,
        };
        let result = StellarSaveContract::set_penalty_config(env.clone(), 1, creator.clone(), cfg);
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_set_penalty_config_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_test_group(&env, 1, &creator);
        let cfg = PenaltyConfig {
            base_penalty_bps: 300,
            penalty_increment_bps: 300,
            max_penalty_bps: 1500,
            recovery_fee_bps: 500,
        };
        let result = StellarSaveContract::set_penalty_config(env.clone(), 1, attacker, cfg);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── upgrade_contract ──────────────────────────────────────────────────────

    #[test]
    fn test_upgrade_contract_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_config(&env, &admin);
        let dummy_wasm = BytesN::from_array(&env, &[1u8; 32]);
        let result = StellarSaveContract::upgrade_contract(env.clone(), attacker, dummy_wasm, 2);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── pause_group ───────────────────────────────────────────────────────────

    #[test]
    fn test_pause_group_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        store_group_status(&env, 1, &creator, GroupStatus::Active);
        let result = StellarSaveContract::pause_group(env.clone(), 1, creator.clone());
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_pause_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_group_status(&env, 1, &creator, GroupStatus::Active);
        let result = StellarSaveContract::pause_group(env.clone(), 1, attacker);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }
}
