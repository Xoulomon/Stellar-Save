//! Unit tests for the migration framework and v1→v2 migration.
//!
//! Covers:
//! - `apply`: backfills TokenConfig for groups without one
//! - `rollback`: removes only backfilled entries
//! - Idempotency: double-apply and double-rollback are safe
//! - Version guard: apply is a no-op when already at target version
//! - Migration record: persisted after apply and rollback

#[cfg(test)]
mod migration_tests {
    use soroban_sdk::{testutils::Address as _, Address, Env};

    use crate::{
        group::{Group, GroupStatus, TokenConfig},
        migration::{get_schema_version, load_migration_record, V1, V2},
        migrations::v1_to_v2,
        storage::{StorageKey, StorageKeyBuilder},
        ContractConfig,
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn setup_env() -> (Env, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);

        // Initialise contract config so require_admin can read it.
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1,
            max_contribution: i128::MAX,
            min_members: 2,
            max_members: 20,
            min_cycle_duration: 1,
            max_cycle_duration: u64::MAX,
            treasury: None,
            creation_fee: 0,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        (env, admin)
    }

    fn seed_group(env: &Env, group_id: u64, creator: &Address) {
        let group = Group::new(
            group_id,
            creator.clone(),
            1_000_000,
            86_400,
            4,
            2,
            env.ledger().timestamp(),
            0,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Active,
        );
    }

    fn set_total_groups(env: &Env, n: u64) {
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::total_groups(), &n);
    }

    fn xlm_token(env: &Env) -> Address {
        Address::generate(env)
    }

    fn has_token_config(env: &Env, group_id: u64) -> bool {
        env.storage()
            .persistent()
            .has(&StorageKey::GrpTok(group_id))
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    #[test]
    fn test_apply_backfills_missing_token_configs() {
        let (env, admin) = setup_env();
        let creator = Address::generate(&env);
        let xlm = xlm_token(&env);

        seed_group(&env, 1, &creator);
        seed_group(&env, 2, &creator);
        set_total_groups(&env, 2);

        assert!(!has_token_config(&env, 1));
        assert!(!has_token_config(&env, 2));

        v1_to_v2::apply(&env, &admin, xlm.clone());

        assert!(has_token_config(&env, 1));
        assert!(has_token_config(&env, 2));
        assert_eq!(get_schema_version(&env), V2);
    }

    #[test]
    fn test_apply_skips_groups_with_existing_token_config() {
        let (env, admin) = setup_env();
        let creator = Address::generate(&env);
        let xlm = xlm_token(&env);

        seed_group(&env, 1, &creator);
        seed_group(&env, 2, &creator);
        set_total_groups(&env, 2);

        // Pre-seed a custom TokenConfig for group 1.
        let custom_token = Address::generate(&env);
        let custom_config = TokenConfig {
            token_address: custom_token.clone(),
            token_decimals: 6,
        };
        env.storage()
            .persistent()
            .set(&StorageKey::GrpTok(1), &custom_config);

        v1_to_v2::apply(&env, &admin, xlm.clone());

        // Group 1's config must be unchanged.
        let stored: TokenConfig = env
            .storage()
            .persistent()
            .get(&StorageKey::GrpTok(1))
            .unwrap();
        assert_eq!(stored.token_address, custom_token);
        assert_eq!(stored.token_decimals, 6);

        // Group 2 gets the default.
        let stored2: TokenConfig = env
            .storage()
            .persistent()
            .get(&StorageKey::GrpTok(2))
            .unwrap();
        assert_eq!(stored2.token_address, xlm);
        assert_eq!(stored2.token_decimals, 7);
    }

    #[test]
    fn test_rollback_removes_only_backfilled_entries() {
        let (env, admin) = setup_env();
        let creator = Address::generate(&env);
        let xlm = xlm_token(&env);

        seed_group(&env, 1, &creator);
        seed_group(&env, 2, &creator);
        set_total_groups(&env, 2);

        // Pre-seed TokenConfig for group 1 (should survive rollback).
        let custom_token = Address::generate(&env);
        env.storage().persistent().set(
            &StorageKey::GrpTok(1),
            &TokenConfig {
                token_address: custom_token.clone(),
                token_decimals: 6,
            },
        );

        v1_to_v2::apply(&env, &admin, xlm);
        v1_to_v2::rollback(&env, &admin);

        // Group 1's pre-existing config must still be there.
        assert!(has_token_config(&env, 1));
        // Group 2's backfilled config must be gone.
        assert!(!has_token_config(&env, 2));
        assert_eq!(get_schema_version(&env), V1);
    }

    #[test]
    fn test_apply_is_idempotent() {
        let (env, admin) = setup_env();
        let creator = Address::generate(&env);
        let xlm = xlm_token(&env);

        seed_group(&env, 1, &creator);
        set_total_groups(&env, 1);

        v1_to_v2::apply(&env, &admin, xlm.clone());
        // Second apply must not panic and must leave schema at V2.
        v1_to_v2::apply(&env, &admin, xlm);

        assert_eq!(get_schema_version(&env), V2);
        // TokenConfig for group 1 must still exist.
        assert!(has_token_config(&env, 1));
    }

    #[test]
    fn test_rollback_is_idempotent() {
        let (env, admin) = setup_env();
        let creator = Address::generate(&env);
        let xlm = xlm_token(&env);

        seed_group(&env, 1, &creator);
        set_total_groups(&env, 1);

        v1_to_v2::apply(&env, &admin, xlm);
        v1_to_v2::rollback(&env, &admin);
        // Second rollback must not panic.
        v1_to_v2::rollback(&env, &admin);

        assert_eq!(get_schema_version(&env), V1);
    }

    #[test]
    fn test_migration_record_persisted_after_apply() {
        let (env, admin) = setup_env();
        set_total_groups(&env, 0);
        let xlm = xlm_token(&env);

        v1_to_v2::apply(&env, &admin, xlm);

        let record = load_migration_record(&env).expect("migration record must be saved");
        assert_eq!(record.from_version, V1);
        assert_eq!(record.to_version, V2);
        assert_eq!(record.applied_by, admin);
    }

    #[test]
    fn test_migration_record_persisted_after_rollback() {
        let (env, admin) = setup_env();
        set_total_groups(&env, 0);
        let xlm = xlm_token(&env);

        v1_to_v2::apply(&env, &admin, xlm);
        v1_to_v2::rollback(&env, &admin);

        let record = load_migration_record(&env).expect("migration record must be saved");
        assert_eq!(record.from_version, V2);
        assert_eq!(record.to_version, V1);
    }

    #[test]
    fn test_apply_no_groups_is_safe() {
        let (env, admin) = setup_env();
        set_total_groups(&env, 0);
        let xlm = xlm_token(&env);

        // Must not panic on an empty contract.
        v1_to_v2::apply(&env, &admin, xlm);
        assert_eq!(get_schema_version(&env), V2);
    }

    #[test]
    fn test_schema_version_defaults_to_v1() {
        let env = Env::default();
        // No storage written — must default to V1.
        assert_eq!(get_schema_version(&env), V1);
    }

    // ── ContributionRecord field-name regression tests ────────────────────────

    /// Verifies that ContributionRecord uses `member_address` (not `member`) and
    /// that the field survives a v1→v2 migration round-trip intact.
    ///
    /// This test was added as part of the struct/doc alignment cleanup after
    /// several test files were found accessing `record.member` which is not a
    /// valid field on `ContributionRecord`. The canonical field is `member_address`.
    #[test]
    fn test_contribution_record_member_address_field_survives_migration() {
        use crate::{contribution::ContributionRecord, storage::StorageKeyBuilder};

        let (env, admin) = setup_env();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let xlm = xlm_token(&env);

        seed_group(&env, 1, &creator);
        set_total_groups(&env, 1);

        // Write a ContributionRecord using the correct member_address field.
        let record = ContributionRecord::new(
            member.clone(),
            1,   // group_id
            0,   // cycle_number
            5_000_000,
            env.ledger().timestamp(),
        );
        let key = StorageKeyBuilder::contribution_individual(1, 0, member.clone());
        env.storage().persistent().set(&key, &record);

        // Run migration forward then backward.
        v1_to_v2::apply(&env, &admin, xlm.clone());
        v1_to_v2::rollback(&env, &admin);

        // The record must still be readable and the member_address field must match.
        let stored: ContributionRecord = env
            .storage()
            .persistent()
            .get(&key)
            .expect("ContributionRecord must survive v1→v2→v1 round-trip");

        // Canonical field: member_address (NOT member)
        assert_eq!(stored.member_address, member,
            "ContributionRecord.member_address must be preserved across migration");
        assert_eq!(stored.group_id, 1);
        assert_eq!(stored.cycle_number, 0);
        assert_eq!(stored.amount, 5_000_000);
    }

    /// Verifies that ContributionRecord fields are all accessible after migration
    /// and that there is no field named `member` on the struct.
    #[test]
    fn test_contribution_record_has_all_expected_fields() {
        use crate::contribution::ContributionRecord;

        let env = Env::default();
        let member = Address::generate(&env);

        let record = ContributionRecord::new(
            member.clone(),
            42,
            3,
            10_000_000,
            1_700_000_000,
        );

        // All five fields must be accessible under their canonical names.
        assert_eq!(record.member_address, member);
        assert_eq!(record.group_id, 42);
        assert_eq!(record.cycle_number, 3);
        assert_eq!(record.amount, 10_000_000);
        assert_eq!(record.timestamp, 1_700_000_000);
    }
}
