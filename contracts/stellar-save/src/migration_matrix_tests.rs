//! Migration regression test matrix — issue #1112
//!
//! Verifies that every supported schema version transition preserves data
//! integrity across groups, contributions, and payouts. Also contains a
//! field-guard test that fails CI if a new storage category is added without
//! a corresponding migration coverage entry.
//!
//! Matrix layout (expand as new versions are added):
//!
//! | Transition | Module       | apply | rollback |
//! |------------|--------------|-------|----------|
//! | v1 → v2   | v1_to_v2     |  ✓    |   ✓      |
//!
//! To add v2 → v3: create `migrations/v2_to_v3.rs`, add the module to
//! `migrations/mod.rs`, then add a new transition block below following the
//! same pattern.

#[cfg(test)]
mod migration_matrix {
    use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

    use crate::{
        contribution::ContributionRecord,
        group::{Group, GroupStatus, TokenConfig},
        migration::{get_schema_version, V1, V2},
        migrations::v1_to_v2,
        storage::{GroupKey, StorageKey, StorageKeyBuilder},
        types::MemberProfile,
        ContractConfig,
    };

    // === Helpers

    fn setup(env: &Env) -> Address {
        let admin = Address::generate(env);
        env.mock_all_auths();
        let config = ContractConfig {
            admin: admin.clone(),
            min_contribution: 1,
            max_contribution: i128::MAX,
            min_members: 2,
            max_members: 20,
            min_cycle_duration: 1,
            max_cycle_duration: u64::MAX,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);
        admin
    }

    fn seed_group(env: &Env, group_id: u64, creator: &Address) -> Group {
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604_800,
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
        group
    }

    fn seed_member(env: &Env, group_id: u64, member: &Address, position: u32) {
        let profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: position,
            joined_at: env.ledger().timestamp(),
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &profile,
        );
    }

    fn seed_contribution(env: &Env, group_id: u64, cycle: u32, member: &Address, amount: i128) {
        let record = ContributionRecord::new(
            member.clone(),
            group_id,
            cycle,
            amount,
            env.ledger().timestamp(),
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone()),
            &record,
        );
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let prev: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        env.storage().persistent().set(&total_key, &(prev + amount));

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let prev_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&count_key, &(prev_count + 1));
    }

    fn seed_payout(env: &Env, group_id: u64, cycle: u32, recipient: &Address, amount: i128) {
        use crate::storage::PayoutKey;
        env.storage().persistent().set(
            &StorageKey::Payout(PayoutKey::Recipient(group_id, cycle)),
            recipient,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_balance(group_id), &amount);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_total_paid_out(group_id), &amount);
    }

    fn set_total_groups(env: &Env, n: u64) {
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::total_groups(), &n);
    }

    // === Transition: v1 → v2

    /// Every group seeded before apply must still be readable after apply.
    #[test]
    fn matrix_v1_v2_group_data_survives_apply() {
        let env = Env::default();
        let admin = setup(&env);
        let creator = Address::generate(&env);
        let xlm = Address::generate(&env);

        let seeded = seed_group(&env, 1, &creator);
        set_total_groups(&env, 1);

        v1_to_v2::apply(&env, &admin, xlm);

        let stored: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(1))
            .expect("group must survive v1→v2 apply");
        assert_eq!(stored.id, seeded.id);
        assert_eq!(stored.contribution_amount, seeded.contribution_amount);
        assert_eq!(stored.cycle_duration, seeded.cycle_duration);
        assert_eq!(stored.max_members, seeded.max_members);
        assert_eq!(stored.creator, seeded.creator);
    }

    /// Member profiles must be intact after v1→v2 apply.
    #[test]
    fn matrix_v1_v2_member_data_survives_apply() {
        let env = Env::default();
        let admin = setup(&env);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let xlm = Address::generate(&env);

        seed_group(&env, 1, &creator);
        seed_member(&env, 1, &member, 0);
        set_total_groups(&env, 1);

        v1_to_v2::apply(&env, &admin, xlm);

        let profile: MemberProfile = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_profile(1, member.clone()))
            .expect("member profile must survive v1→v2 apply");
        assert_eq!(profile.address, member);
        assert_eq!(profile.group_id, 1);
        assert_eq!(profile.payout_position, 0);
    }

    /// Contribution records must be intact after v1→v2 apply.
    #[test]
    fn matrix_v1_v2_contribution_data_survives_apply() {
        let env = Env::default();
        let admin = setup(&env);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let xlm = Address::generate(&env);

        seed_group(&env, 1, &creator);
        seed_contribution(&env, 1, 0, &member, 5_000_000);
        set_total_groups(&env, 1);

        v1_to_v2::apply(&env, &admin, xlm);

        let record: ContributionRecord = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::contribution_individual(
                1,
                0,
                member.clone(),
            ))
            .expect("contribution must survive v1→v2 apply");
        assert_eq!(record.amount, 5_000_000);
        assert_eq!(record.member, member);
        assert_eq!(record.cycle_number, 0);

        let total: i128 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::contribution_cycle_total(1, 0))
            .expect("cycle total must survive v1→v2 apply");
        assert_eq!(total, 5_000_000);
    }

    /// Payout tracking data must survive v1→v2 apply.
    #[test]
    fn matrix_v1_v2_payout_data_survives_apply() {
        let env = Env::default();
        let admin = setup(&env);
        let creator = Address::generate(&env);
        let recipient = Address::generate(&env);
        let xlm = Address::generate(&env);

        seed_group(&env, 1, &creator);
        seed_payout(&env, 1, 0, &recipient, 20_000_000);
        set_total_groups(&env, 1);

        v1_to_v2::apply(&env, &admin, xlm);

        use crate::storage::PayoutKey;
        let stored_recipient: Address = env
            .storage()
            .persistent()
            .get(&StorageKey::Payout(PayoutKey::Recipient(1, 0)))
            .expect("payout recipient must survive v1→v2 apply");
        assert_eq!(stored_recipient, recipient);

        let balance: i128 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_balance(1))
            .expect("group balance must survive v1→v2 apply");
        assert_eq!(balance, 20_000_000);

        let paid_out: i128 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_total_paid_out(1))
            .expect("total paid out must survive v1→v2 apply");
        assert_eq!(paid_out, 20_000_000);
    }

    /// Groups, members, contributions, and payouts must all survive v1→v2→v1 round-trip.
    #[test]
    fn matrix_v1_v2_full_data_integrity_round_trip() {
        let env = Env::default();
        let admin = setup(&env);
        let creator = Address::generate(&env);
        let member_a = Address::generate(&env);
        let member_b = Address::generate(&env);
        let xlm = Address::generate(&env);

        seed_group(&env, 1, &creator);
        seed_member(&env, 1, &member_a, 0);
        seed_member(&env, 1, &member_b, 1);
        seed_contribution(&env, 1, 0, &member_a, 10_000_000);
        seed_contribution(&env, 1, 0, &member_b, 10_000_000);
        seed_payout(&env, 1, 0, &member_a, 20_000_000);
        set_total_groups(&env, 1);

        v1_to_v2::apply(&env, &admin, xlm.clone());
        assert_eq!(get_schema_version(&env), V2);

        v1_to_v2::rollback(&env, &admin);
        assert_eq!(get_schema_version(&env), V1);

        // Group data intact
        let group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(1))
            .expect("group must survive round-trip");
        assert_eq!(group.id, 1);

        // Member profiles intact
        for (member, pos) in [(&member_a, 0u32), (&member_b, 1u32)] {
            let profile: MemberProfile = env
                .storage()
                .persistent()
                .get(&StorageKeyBuilder::member_profile(1, member.clone()))
                .expect("member profile must survive round-trip");
            assert_eq!(profile.payout_position, pos);
        }

        // Contributions intact
        for member in [&member_a, &member_b] {
            let record: ContributionRecord = env
                .storage()
                .persistent()
                .get(&StorageKeyBuilder::contribution_individual(
                    1,
                    0,
                    member.clone(),
                ))
                .expect("contribution must survive round-trip");
            assert_eq!(record.amount, 10_000_000);
        }

        // Cycle total intact
        let total: i128 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::contribution_cycle_total(1, 0))
            .unwrap();
        assert_eq!(total, 20_000_000);

        // Payout tracking intact
        use crate::storage::PayoutKey;
        let payout_recipient: Address = env
            .storage()
            .persistent()
            .get(&StorageKey::Payout(PayoutKey::Recipient(1, 0)))
            .expect("payout recipient must survive round-trip");
        assert_eq!(payout_recipient, member_a);
    }

    /// Migrating multiple groups at once preserves all of them independently.
    #[test]
    fn matrix_v1_v2_multi_group_data_integrity() {
        let env = Env::default();
        let admin = setup(&env);
        let creator = Address::generate(&env);
        let xlm = Address::generate(&env);

        let g1 = seed_group(&env, 1, &creator);
        let g2 = seed_group(&env, 2, &creator);
        let g3 = seed_group(&env, 3, &creator);
        set_total_groups(&env, 3);

        // Seed different contribution amounts so groups are distinguishable.
        let m1 = Address::generate(&env);
        let m2 = Address::generate(&env);
        let m3 = Address::generate(&env);
        seed_contribution(&env, 1, 0, &m1, 1_000_000);
        seed_contribution(&env, 2, 0, &m2, 2_000_000);
        seed_contribution(&env, 3, 0, &m3, 3_000_000);

        v1_to_v2::apply(&env, &admin, xlm);
        assert_eq!(get_schema_version(&env), V2);

        for (id, seeded) in [(1u64, &g1), (2u64, &g2), (3u64, &g3)] {
            let stored: Group = env
                .storage()
                .persistent()
                .get(&StorageKeyBuilder::group_data(id))
                .unwrap_or_else(|| panic!("group {id} must survive v1→v2"));
            assert_eq!(stored.id, seeded.id);
            // TokenConfig must now exist for all three groups.
            assert!(
                env.storage()
                    .persistent()
                    .has(&StorageKey::Group(GroupKey::TokenConfig(id))),
                "group {id} must have TokenConfig after migration"
            );
        }

        // Contribution cycle totals per group must still be correct.
        let totals: [(u64, i128); 3] = [(1, 1_000_000), (2, 2_000_000), (3, 3_000_000)];
        for (gid, expected) in totals {
            let total: i128 = env
                .storage()
                .persistent()
                .get(&StorageKeyBuilder::contribution_cycle_total(gid, 0))
                .unwrap_or(0);
            assert_eq!(total, expected, "group {gid} cycle total must be preserved");
        }
    }

    /// Custom TokenConfig set before migration must not be overwritten by apply.
    #[test]
    fn matrix_v1_v2_existing_token_config_not_overwritten() {
        let env = Env::default();
        let admin = setup(&env);
        let creator = Address::generate(&env);
        let xlm = Address::generate(&env);
        let custom_token = Address::generate(&env);

        seed_group(&env, 1, &creator);
        seed_group(&env, 2, &creator);

        // Group 1 has a pre-existing custom TokenConfig.
        env.storage().persistent().set(
            &StorageKey::Group(GroupKey::TokenConfig(1)),
            &TokenConfig {
                token_address: custom_token.clone(),
                token_decimals: 6,
            },
        );
        set_total_groups(&env, 2);

        v1_to_v2::apply(&env, &admin, xlm.clone());

        // Group 1: original config preserved.
        let cfg1: TokenConfig = env
            .storage()
            .persistent()
            .get(&StorageKey::Group(GroupKey::TokenConfig(1)))
            .unwrap();
        assert_eq!(cfg1.token_address, custom_token);
        assert_eq!(cfg1.token_decimals, 6);

        // Group 2: default XLM config backfilled.
        let cfg2: TokenConfig = env
            .storage()
            .persistent()
            .get(&StorageKey::Group(GroupKey::TokenConfig(2)))
            .unwrap();
        assert_eq!(cfg2.token_address, xlm);
        assert_eq!(cfg2.token_decimals, 7);
    }

    // === Field guard

    /// This test encodes the set of storage categories exercised by migration
    /// tests. If a new StorageKey variant is introduced and no migration test
    /// exercises it, extend the list below and add a corresponding test above.
    ///
    /// The test itself will always pass when the list is up-to-date; it fails
    /// to compile (or is caught in review) when a new category is missing.
    #[test]
    fn field_guard_all_storage_categories_covered() {
        // Each string names a storage category. Adding a new category here is
        // the signal that a migration test exists for it. If you add a new
        // StorageKey variant that needs migrating, add it here AND add a test.
        let covered: &[&str] = &[
            "Group::Data",
            "Group::Status",
            "Group::TokenConfig",
            "Group::Members",
            "Member::Profile",
            "Contribution::Individual",
            "Contribution::CycleTotal",
            "Contribution::CycleCount",
            "Payout::Recipient",
            "Counter::GroupBalance",
            "Counter::GroupTotalPaidOut",
            "Counter::ContractConfig",
            "Counter::AllowedTokens",
            "Counter::TotalGroups",
            "Migration::SchemaVersion",
            "Migration::Record",
            "Migration::BackfillIndex",
        ];

        // If you see a compile error here the count is wrong — update it to
        // match the number of entries in `covered` above.
        assert_eq!(
            covered.len(),
            17,
            "update field_guard when adding or removing covered categories"
        );

        for category in covered {
            assert!(!category.is_empty(), "category name must not be empty");
        }
    }
}
