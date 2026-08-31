#[cfg(test)]
mod tests {
    use crate::{
        group::{Group, GroupStatus},
        milestones::{self, MILESTONE_THRESHOLDS},
        storage::StorageKeyBuilder,
        ContributionRecord, MemberProfile, StellarSaveContract, StellarSaveError,
    };
    use soroban_sdk::{testutils::Address as _, Address, Env};

    // ── helpers ──────────────────────────────────────────────────────────────

    /// Store a minimal group and member profile so milestone queries work.
    fn setup_group_and_member(
        env: &Env,
        group_id: u64,
        creator: &Address,
        member: &Address,
        current_cycle: u32,
    ) {
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            3600,
            30,
            2,
            env.ledger().timestamp(),
            0,
        );
        group.current_cycle = current_cycle;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Active,
        );

        let profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: env.ledger().timestamp(),
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &profile,
        );
    }

    /// Record a contribution directly in storage (bypasses token transfer).
    fn store_contribution(env: &Env, group_id: u64, cycle: u32, member: &Address) {
        let record = ContributionRecord::new(member.clone(), group_id, cycle, 100, 0);
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone()),
            &record,
        );
    }

    // ── streak unit tests ─────────────────────────────────────────────────────

    #[test]
    fn test_streak_starts_at_one_on_first_contribution() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 0);
        milestones::update_streak(&env, group_id, member.clone(), 0);

        let streak = milestones::get_streak(&env, group_id, member);
        assert_eq!(streak.current_streak, 1);
        assert_eq!(streak.best_streak, 1);
        assert_eq!(streak.last_contributed_cycle, 0);
    }

    #[test]
    fn test_streak_increments_on_consecutive_cycles() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 4);

        for cycle in 0..5u32 {
            milestones::update_streak(&env, group_id, member.clone(), cycle);
        }

        let streak = milestones::get_streak(&env, group_id, member);
        assert_eq!(streak.current_streak, 5);
        assert_eq!(streak.best_streak, 5);
    }

    #[test]
    fn test_streak_resets_on_gap() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 5);

        // Contribute cycles 0, 1, 2 — then skip 3 — then contribute 4
        for cycle in [0u32, 1, 2] {
            milestones::update_streak(&env, group_id, member.clone(), cycle);
        }
        // Skip cycle 3
        milestones::update_streak(&env, group_id, member.clone(), 4);

        let streak = milestones::get_streak(&env, group_id, member);
        assert_eq!(streak.current_streak, 1); // reset after gap
        assert_eq!(streak.best_streak, 3); // best was 3 before the gap
    }

    #[test]
    fn test_best_streak_preserved_after_reset() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 12);

        // Build streak of 10
        for cycle in 0..10u32 {
            milestones::update_streak(&env, group_id, member.clone(), cycle);
        }
        // Gap at 10, then restart
        milestones::update_streak(&env, group_id, member.clone(), 11);
        milestones::update_streak(&env, group_id, member.clone(), 12);

        let streak = milestones::get_streak(&env, group_id, member);
        assert_eq!(streak.current_streak, 2);
        assert_eq!(streak.best_streak, 10);
    }

    // ── milestone threshold tests ─────────────────────────────────────────────

    #[test]
    fn test_milestone_thresholds_are_5_10_20() {
        assert_eq!(MILESTONE_THRESHOLDS, [5, 10, 20]);
    }

    #[test]
    fn test_get_member_milestones_empty_before_any_contribution() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 0);

        let milestones_vec = milestones::get_member_milestones(&env, group_id, member).unwrap();
        assert_eq!(milestones_vec.len(), 0);
    }

    #[test]
    fn test_get_member_milestones_reaches_5_cycle_milestone() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 4);

        for cycle in 0..5u32 {
            store_contribution(&env, group_id, cycle, &member);
        }

        let ms = milestones::get_member_milestones(&env, group_id, member).unwrap();
        assert_eq!(ms.len(), 1);
        assert_eq!(ms.get(0).unwrap().threshold, 5);
        assert_eq!(ms.get(0).unwrap().reached_at_cycle, 4);
    }

    #[test]
    fn test_get_member_milestones_reaches_10_cycle_milestone() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 9);

        for cycle in 0..10u32 {
            store_contribution(&env, group_id, cycle, &member);
        }

        let ms = milestones::get_member_milestones(&env, group_id, member).unwrap();
        assert_eq!(ms.len(), 2); // 5 and 10
        assert_eq!(ms.get(0).unwrap().threshold, 5);
        assert_eq!(ms.get(1).unwrap().threshold, 10);
        assert_eq!(ms.get(1).unwrap().reached_at_cycle, 9);
    }

    #[test]
    fn test_get_member_milestones_reaches_all_three() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 19);

        for cycle in 0..20u32 {
            store_contribution(&env, group_id, cycle, &member);
        }

        let ms = milestones::get_member_milestones(&env, group_id, member).unwrap();
        assert_eq!(ms.len(), 3);
        assert_eq!(ms.get(0).unwrap().threshold, 5);
        assert_eq!(ms.get(1).unwrap().threshold, 10);
        assert_eq!(ms.get(2).unwrap().threshold, 20);
        assert_eq!(ms.get(2).unwrap().reached_at_cycle, 19);
    }

    #[test]
    fn test_get_member_milestones_gap_prevents_milestone() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        // Contribute 4 cycles, skip 1, then contribute 4 more — never hits 5 streak
        setup_group_and_member(&env, group_id, &creator, &member, 9);

        for cycle in [0u32, 1, 2, 3] {
            store_contribution(&env, group_id, cycle, &member);
        }
        // skip cycle 4
        for cycle in [5u32, 6, 7, 8] {
            store_contribution(&env, group_id, cycle, &member);
        }

        let ms = milestones::get_member_milestones(&env, group_id, member).unwrap();
        assert_eq!(ms.len(), 0); // streak never reached 5
    }

    #[test]
    fn test_get_member_milestones_milestone_after_reset() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        // Miss cycle 0, then contribute 5 consecutive starting at cycle 1
        setup_group_and_member(&env, group_id, &creator, &member, 5);

        for cycle in 1..6u32 {
            store_contribution(&env, group_id, cycle, &member);
        }

        let ms = milestones::get_member_milestones(&env, group_id, member).unwrap();
        assert_eq!(ms.len(), 1);
        assert_eq!(ms.get(0).unwrap().threshold, 5);
        assert_eq!(ms.get(0).unwrap().reached_at_cycle, 5);
    }

    // ── error path tests ──────────────────────────────────────────────────────

    #[test]
    fn test_get_member_milestones_group_not_found() {
        let env = Env::default();
        let member = Address::generate(&env);

        let result = milestones::get_member_milestones(&env, 999, member);
        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    #[test]
    fn test_get_member_milestones_not_member() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let outsider = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 0);

        let result = milestones::get_member_milestones(&env, group_id, outsider);
        assert_eq!(result, Err(StellarSaveError::NotMember));
    }

    // ── contract-level query test ─────────────────────────────────────────────

    #[test]
    fn test_contract_get_member_milestones_via_client() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 4);

        for cycle in 0..5u32 {
            store_contribution(&env, group_id, cycle, &member);
        }

        let ms = client.get_member_milestones(&group_id, &member).unwrap();
        assert_eq!(ms.len(), 1);
        assert_eq!(ms.get(0).unwrap().threshold, 5);
    }

    // ── MilestoneReached event emission test ──────────────────────────────────

    #[test]
    fn test_update_streak_emits_milestone_event_at_threshold_5() {
        use soroban_sdk::testutils::Events;

        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;

        setup_group_and_member(&env, group_id, &creator, &member, 4);

        for cycle in 0..5u32 {
            milestones::update_streak(&env, group_id, member.clone(), cycle);
        }

        // At least one event with topic "milestone_reached" must have been emitted.
        let all_events = env.events().all();
        let mut found = false;
        for i in 0..all_events.len() {
            let (_, topics, _) = all_events.get(i).unwrap();
            if topics.len() == 1 {
                found = true;
                break;
            }
        }
        assert!(found, "expected at least one MilestoneReached event");
    }
}
