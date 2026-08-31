//! Issue #1329 — Admin Actions Authorization Tests
//!
//! Dedicated authorization tests for every admin-gated function.
//! Each function gets: (1) authorized-caller success, (2) unauthorized rejection.
//!
//! Cross-referenced: `docs/admin-actions.md`, `docs/runbooks/on-chain-admin-action.md`

#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, Address, Env};

    use crate::{
        group::{Group, GroupStatus},
        penalty::PenaltyConfig,
        storage::StorageKeyBuilder,
        types::ContractConfig,
        StellarSaveContract, StellarSaveError,
    };

    fn make_config(admin: &Address) -> ContractConfig {
        ContractConfig {
            admin: admin.clone(),
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000_000,
            min_members: 2,
            max_members: 20,
            min_cycle_duration: 86_400,
            max_cycle_duration: 2_592_000,
            treasury: None,
            creation_fee: 0,
        }
    }

    fn store_config(env: &Env, admin: &Address) {
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &make_config(admin));
    }

    fn store_group(env: &Env, group_id: u64, creator: &Address) {
        let g = Group::new(group_id, creator.clone(), 1_000_000, 604_800, 5, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &g);
    }

    fn store_group_status(env: &Env, group_id: u64, creator: &Address, status: GroupStatus) {
        store_group(env, group_id, creator);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &status);
    }

    // ── migrate_storage ───────────────────────────────────────────────────────

    #[test]
    fn test_migrate_storage_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        store_config(&env, &admin);
        crate::migration::initialize_storage_version(&env);
        let result = StellarSaveContract::migrate_storage(env.clone(), admin.clone());
        assert!(result.is_ok(), "admin must trigger migrate_storage: {:?}", result.err());
    }

    #[test]
    fn test_migrate_storage_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_config(&env, &admin);
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
        store_config(&env, &admin);
        let result = StellarSaveContract::update_contribution_limits(
            env.clone(), admin.clone(), 500_000, 2_000_000_000,
        );
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_update_contribution_limits_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_config(&env, &admin);
        let result = StellarSaveContract::update_contribution_limits(
            env.clone(), attacker, 500_000, 2_000_000_000,
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
        store_config(&env, &admin);
        let result = StellarSaveContract::add_allowed_token(env.clone(), admin.clone(), token.clone());
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
        store_config(&env, &admin);
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
        store_config(&env, &admin);
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
        store_config(&env, &admin);
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
        store_group_status(&env, 1, &creator, GroupStatus::Paused);
        let result = StellarSaveContract::resume_group(env.clone(), 1, creator.clone());
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_resume_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_group_status(&env, 1, &creator, GroupStatus::Paused);
        let result = StellarSaveContract::resume_group(env.clone(), 1, attacker);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── cancel_group ──────────────────────────────────────────────────────────

    #[test]
    fn test_cancel_group_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        store_group_status(&env, 1, &creator, GroupStatus::Pending);
        let result = StellarSaveContract::cancel_group(env.clone(), 1, creator.clone());
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_cancel_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_group_status(&env, 1, &creator, GroupStatus::Pending);
        let result = StellarSaveContract::cancel_group(env.clone(), 1, attacker);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    // ── set_penalty_config ────────────────────────────────────────────────────

    #[test]
    fn test_set_penalty_config_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        store_group(&env, 1, &creator);
        let cfg = PenaltyConfig { base_penalty_bps: 300, penalty_increment_bps: 300, max_penalty_bps: 1500, recovery_fee_bps: 500 };
        let result = StellarSaveContract::set_penalty_config(env.clone(), 1, creator.clone(), cfg);
        assert!(result.is_ok(), "{:?}", result.err());
    }

    #[test]
    fn test_set_penalty_config_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        store_group(&env, 1, &creator);
        let cfg = PenaltyConfig { base_penalty_bps: 300, penalty_increment_bps: 300, max_penalty_bps: 1500, recovery_fee_bps: 500 };
        let result = StellarSaveContract::set_penalty_config(env.clone(), 1, attacker, cfg);
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }
}
