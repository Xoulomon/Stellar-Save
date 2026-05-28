#[cfg(test)]
mod tests {
    use crate::{
        group::{Group, GroupStatus},
        storage::StorageKeyBuilder,
        MemberProfile, StellarSaveContract, StellarSaveError,
    };
    use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

    // ── helpers ──────────────────────────────────────────────────────────────

    fn setup_pending_group(
        env: &Env,
        group_id: u64,
        creator: &Address,
        contribution_amount: i128,
        cycle_duration: u64,
        max_members: u32,
        members: &[Address],
    ) {
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            cycle_duration,
            max_members,
            2,
            env.ledger().timestamp(),
            0,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut member_vec: Vec<Address> = Vec::new(env);
        for (i, m) in members.iter().enumerate() {
            member_vec.push_back(m.clone());
            let profile = MemberProfile {
                address: m.clone(),
                group_id,
                payout_position: i as u32,
                joined_at: env.ledger().timestamp(),
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, m.clone()),
                &profile,
            );
            env.storage().persistent().set(
                &StorageKeyBuilder::member_payout_eligibility(group_id, m.clone()),
                &(i as u32),
            );
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &member_vec);
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    /// Happy path: two compatible Pending groups merge successfully.
    #[test]
    fn test_merge_groups_success() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let m1 = Address::generate(&env);
        let m2 = Address::generate(&env);
        let m3 = Address::generate(&env);
        let m4 = Address::generate(&env);

        // Manually seed the group-id counter so IDs are predictable
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        setup_pending_group(
            &env,
            1,
            &creator,
            100,
            3600,
            3,
            &[creator.clone(), m1.clone()],
        );
        setup_pending_group(
            &env,
            2,
            &creator,
            100,
            3600,
            3,
            &[m2.clone(), m3.clone(), m4.clone()],
        );

        let merged_id = client.merge_groups(&1u64, &2u64);

        // Merged group should have id = 3 (next after 2)
        assert_eq!(merged_id, 3);

        // Merged group data
        let merged = client.get_group(&merged_id);
        assert_eq!(merged.contribution_amount, 100);
        assert_eq!(merged.cycle_duration, 3600);
        assert_eq!(merged.max_members, 6); // 3 + 3
        assert_eq!(merged.member_count, 5); // 2 + 3

        // Status of merged group is Pending
        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(merged_id))
            .unwrap();
        assert_eq!(status, GroupStatus::Pending);

        // Source groups are Cancelled
        let s1: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(1))
            .unwrap();
        let s2: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(2))
            .unwrap();
        assert_eq!(s1, GroupStatus::Cancelled);
        assert_eq!(s2, GroupStatus::Cancelled);

        // All 5 members have profiles in the merged group with sequential positions
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_members(merged_id))
            .unwrap();
        assert_eq!(members.len(), 5);

        for i in 0..members.len() {
            let member = members.get(i).unwrap();
            let pos: u32 = env
                .storage()
                .persistent()
                .get(&StorageKeyBuilder::member_payout_eligibility(
                    merged_id, member,
                ))
                .unwrap();
            assert_eq!(pos, i);
        }
    }

    /// Merging groups with different contribution amounts must fail.
    #[test]
    fn test_merge_groups_incompatible_contribution_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let m1 = Address::generate(&env);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        setup_pending_group(
            &env,
            1,
            &creator,
            100,
            3600,
            3,
            &[creator.clone(), m1.clone()],
        );
        setup_pending_group(&env, 2, &creator, 200, 3600, 3, &[m1.clone()]); // different amount

        let result = client.try_merge_groups(&1u64, &2u64);
        assert_eq!(result, Err(Ok(StellarSaveError::MergeIncompatible)));
    }

    /// Merging groups with different cycle durations must fail.
    #[test]
    fn test_merge_groups_incompatible_cycle_duration() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let m1 = Address::generate(&env);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        setup_pending_group(
            &env,
            1,
            &creator,
            100,
            3600,
            3,
            &[creator.clone(), m1.clone()],
        );
        setup_pending_group(&env, 2, &creator, 100, 7200, 3, &[m1.clone()]); // different duration

        let result = client.try_merge_groups(&1u64, &2u64);
        assert_eq!(result, Err(Ok(StellarSaveError::MergeIncompatible)));
    }

    /// Merging when group 1 is not Pending must fail.
    #[test]
    fn test_merge_groups_source_not_pending() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let m1 = Address::generate(&env);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        setup_pending_group(
            &env,
            1,
            &creator,
            100,
            3600,
            3,
            &[creator.clone(), m1.clone()],
        );
        setup_pending_group(&env, 2, &creator, 100, 3600, 3, &[m1.clone()]);

        // Force group 1 to Active
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(1), &GroupStatus::Active);

        let result = client.try_merge_groups(&1u64, &2u64);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    /// Merging a non-existent group must fail with GroupNotFound.
    #[test]
    fn test_merge_groups_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let m1 = Address::generate(&env);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &1u64);

        setup_pending_group(
            &env,
            1,
            &creator,
            100,
            3600,
            3,
            &[creator.clone(), m1.clone()],
        );

        let result = client.try_merge_groups(&1u64, &999u64);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    /// Combined balance is correctly summed in the merged group.
    #[test]
    fn test_merge_groups_combined_balance() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let m1 = Address::generate(&env);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        setup_pending_group(
            &env,
            1,
            &creator,
            100,
            3600,
            3,
            &[creator.clone(), m1.clone()],
        );
        setup_pending_group(&env, 2, &creator, 100, 3600, 3, &[m1.clone()]);

        // Seed balances for both source groups
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_balance(1), &500i128);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_balance(2), &300i128);

        let merged_id = client.merge_groups(&1u64, &2u64);

        let balance: i128 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_balance(merged_id))
            .unwrap_or(0);
        assert_eq!(balance, 800);
    }

    /// Merging two empty-member groups still produces a valid merged group.
    #[test]
    fn test_merge_groups_empty_members() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        setup_pending_group(&env, 1, &creator, 100, 3600, 5, &[]);
        setup_pending_group(&env, 2, &creator, 100, 3600, 5, &[]);

        let merged_id = client.merge_groups(&1u64, &2u64);

        let merged = client.get_group(&merged_id);
        assert_eq!(merged.member_count, 0);
        assert_eq!(merged.max_members, 10);
    }
}
