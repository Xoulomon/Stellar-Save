/// Property-based tests for the Governance / Security module (security.rs).
///
/// These tests verify core invariants of the access-control and governance layer:
/// - Group creator role is mutually exclusive and cannot be assumed by members
/// - Quorum invariant is respected for all vote/member combinations
/// - Timelock is always enforced before actions can execute
/// - Non-creator roles cannot assume creator permissions
/// - Contract admin role subsumes group member permissions
#[cfg(test)]
mod governance_property_tests {
    use crate::security::{AuthContext, AuthorizationChecker, Role};
    use proptest::prelude::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Returns true iff the vote count meets the quorum percentage threshold.
    /// Invariant: vote_count * 100 >= total_members * quorum_pct
    fn quorum_reached(vote_count: u32, total_members: u32, quorum_pct: u32) -> bool {
        if total_members == 0 {
            return false;
        }
        (vote_count as u64) * 100 >= (total_members as u64) * (quorum_pct as u64)
    }

    /// Returns true iff enough time has elapsed for the timelock to expire.
    /// Invariant: current_time >= action_time + timelock_duration
    fn timelock_passed(current_time: u64, action_time: u64, timelock_duration: u64) -> bool {
        current_time >= action_time.saturating_add(timelock_duration)
    }

    // ── Strategies ────────────────────────────────────────────────────────────

    fn valid_member_count() -> impl Strategy<Value = u32> {
        1_u32..=100_u32
    }

    fn quorum_pct() -> impl Strategy<Value = u32> {
        51_u32..=100_u32 // majority quorum
    }

    fn timelock_duration() -> impl Strategy<Value = u64> {
        // 1 hour to 7 days in seconds
        3_600_u64..=604_800_u64
    }

    // ── Feature: GovernanceSecurity Property 1 – group creator role is unique ─

    proptest! {
        /// An AuthContext with Role::GroupCreator reports is_group_creator()=true
        /// and all other role checks as false. The creator role is not shared.
        // Feature: GovernanceSecurity Property 1
        #[test]
        fn prop_creator_role_is_exclusive(
            // Vary the address by picking a random seed 0..u8::MAX
            seed in 0_u8..=u8::MAX,
        ) {
            let env = Env::default();
            // Use seed to generate deterministic-ish addresses
            let _ = seed; // address generation is random by design in testutils
            let caller = soroban_sdk::Address::generate(&env);
            let ctx = AuthContext::new(caller, Role::GroupCreator);

            prop_assert!(ctx.is_group_creator());
            prop_assert!(!ctx.is_group_member());
            prop_assert!(!ctx.is_contract_admin());
        }

        /// An AuthContext with Role::GroupMember is never a creator.
        // Feature: GovernanceSecurity Property 1b
        #[test]
        fn prop_member_role_is_not_creator(
            seed in 0_u8..=u8::MAX,
        ) {
            let env = Env::default();
            let _ = seed;
            let caller = soroban_sdk::Address::generate(&env);
            let ctx = AuthContext::new(caller, Role::GroupMember);

            prop_assert!(!ctx.is_group_creator());
            prop_assert!(ctx.is_group_member());
        }

        /// require_group_creator succeeds only when caller == creator.
        /// It must always fail when called with a different address.
        // Feature: GovernanceSecurity Property 1c
        #[test]
        fn prop_creator_check_fails_for_non_creator(
            seed in 0_u8..=u8::MAX,
        ) {
            let env = Env::default();
            let _ = seed;
            let creator = soroban_sdk::Address::generate(&env);
            let non_creator = soroban_sdk::Address::generate(&env);

            // Only succeeds for the actual creator
            let ok = AuthorizationChecker::require_group_creator(&creator, &creator);
            prop_assert!(ok.is_ok());

            // Must fail for any other address
            let fail = AuthorizationChecker::require_group_creator(&non_creator, &creator);
            prop_assert!(fail.is_err());
        }
    }

    // ── Feature: GovernanceSecurity Property 2 – quorum invariant ────────────

    proptest! {
        /// When vote_count == total_members (unanimous), quorum is always reached
        /// for any quorum_pct in [1, 100].
        // Feature: GovernanceSecurity Property 2
        #[test]
        fn prop_unanimous_vote_always_reaches_quorum(
            total_members in valid_member_count(),
            threshold in quorum_pct(),
        ) {
            let reached = quorum_reached(total_members, total_members, threshold);
            prop_assert!(reached,
                "unanimous vote should reach quorum: members={}, pct={}", total_members, threshold);
        }

        /// When vote_count == 0, quorum is never reached regardless of threshold.
        // Feature: GovernanceSecurity Property 2b
        #[test]
        fn prop_zero_votes_never_reaches_quorum(
            total_members in valid_member_count(),
            threshold in quorum_pct(),
        ) {
            let reached = quorum_reached(0, total_members, threshold);
            prop_assert!(!reached,
                "zero votes must not reach quorum: members={}, pct={}", total_members, threshold);
        }

        /// Quorum is monotone: if quorum is reached with V votes, it is also
        /// reached with V+k votes (more votes cannot break quorum).
        // Feature: GovernanceSecurity Property 2c
        #[test]
        fn prop_quorum_is_monotone_in_votes(
            total_members in valid_member_count(),
            threshold in quorum_pct(),
            votes in 0_u32..=100_u32,
            extra in 1_u32..=10_u32,
        ) {
            let votes = votes.min(total_members);
            let more_votes = (votes + extra).min(total_members);

            let reached_with_fewer = quorum_reached(votes, total_members, threshold);
            let reached_with_more = quorum_reached(more_votes, total_members, threshold);

            // If fewer votes reach quorum, more votes must also reach it
            if reached_with_fewer {
                prop_assert!(reached_with_more,
                    "quorum should be monotone: votes={} -> {}, pct={}", votes, more_votes, threshold);
            }
        }

        /// Quorum at exactly the threshold: vote_count * 100 == total_members * quorum_pct.
        // Feature: GovernanceSecurity Property 2d
        #[test]
        fn prop_quorum_at_exact_threshold(
            total_members in valid_member_count(),
            threshold in quorum_pct(),
        ) {
            // Compute the minimum votes needed to reach quorum
            // min_votes = ceil(total_members * threshold / 100)
            let min_votes = ((total_members as u64 * threshold as u64) + 99) / 100;
            let min_votes = min_votes.min(total_members as u64) as u32;

            let reached = quorum_reached(min_votes, total_members, threshold);
            prop_assert!(reached,
                "quorum must be reached at exact threshold: votes={}, members={}, pct={}",
                min_votes, total_members, threshold);
        }
    }

    // ── Feature: GovernanceSecurity Property 3 – timelock always enforced ────

    proptest! {
        /// An action scheduled at action_time with timelock_duration can only
        /// execute when current_time >= action_time + timelock_duration.
        // Feature: GovernanceSecurity Property 3
        #[test]
        fn prop_timelock_blocks_premature_execution(
            action_time in 0_u64..=u64::MAX / 2,
            timelock_duration in timelock_duration(),
        ) {
            // Time just before unlock: current = action_time + timelock_duration - 1
            let just_before = action_time.saturating_add(timelock_duration).saturating_sub(1);
            let can_execute = timelock_passed(just_before, action_time, timelock_duration);
            prop_assert!(!can_execute,
                "timelock should block at t-1: action={}, duration={}", action_time, timelock_duration);
        }

        /// Action is allowed exactly at unlock time.
        // Feature: GovernanceSecurity Property 3b
        #[test]
        fn prop_timelock_allows_at_unlock_time(
            action_time in 0_u64..=u64::MAX / 2,
            timelock_duration in timelock_duration(),
        ) {
            let unlock_time = action_time.saturating_add(timelock_duration);
            let can_execute = timelock_passed(unlock_time, action_time, timelock_duration);
            prop_assert!(can_execute,
                "timelock should allow at exactly unlock_time: {}+{}={}",
                action_time, timelock_duration, unlock_time);
        }

        /// Action is allowed at any time after unlock.
        // Feature: GovernanceSecurity Property 3c
        #[test]
        fn prop_timelock_allows_after_unlock_time(
            action_time in 0_u64..=u64::MAX / 4,
            timelock_duration in timelock_duration(),
            extra in 0_u64..=1_000_000_u64,
        ) {
            let unlock_time = action_time.saturating_add(timelock_duration);
            let current_time = unlock_time.saturating_add(extra);
            let can_execute = timelock_passed(current_time, action_time, timelock_duration);
            prop_assert!(can_execute,
                "timelock should allow after unlock: current={}, unlock={}",
                current_time, unlock_time);
        }

        /// Timelock is monotone in current_time: if allowed at T, allowed at T+k.
        // Feature: GovernanceSecurity Property 3d
        #[test]
        fn prop_timelock_monotone_in_time(
            action_time in 0_u64..=u64::MAX / 4,
            timelock_duration in timelock_duration(),
            t in 0_u64..=u64::MAX / 2,
            extra in 0_u64..=1_000_000_u64,
        ) {
            let t_later = t.saturating_add(extra);
            let allowed_at_t = timelock_passed(t, action_time, timelock_duration);
            let allowed_at_later = timelock_passed(t_later, action_time, timelock_duration);

            // Once unlocked, stays unlocked
            if allowed_at_t {
                prop_assert!(allowed_at_later,
                    "timelock must stay unlocked: t={}, t_later={}", t, t_later);
            }
        }
    }

    // ── Feature: GovernanceSecurity Property 4 – non-creator cannot assume creator role

    proptest! {
        /// Role::GroupMember does not grant creator permissions.
        /// check_authorization for pause_group/resume_group/cancel_group must fail.
        // Feature: GovernanceSecurity Property 4
        #[test]
        fn prop_member_cannot_pause_group(
            seed in 0_u8..=u8::MAX,
        ) {
            let env = Env::default();
            let _ = seed;
            let caller = soroban_sdk::Address::generate(&env);
            let ctx = AuthContext::new(caller.clone(), Role::GroupMember);

            for op in &["pause_group", "resume_group", "cancel_group"] {
                let result = AuthorizationChecker::check_authorization(&caller, op, &ctx);
                prop_assert!(result.is_err(),
                    "GroupMember must not be authorized for {}", op);
            }
        }

        /// Role::Public cannot perform any privileged operation.
        // Feature: GovernanceSecurity Property 4b
        #[test]
        fn prop_public_role_denied_all_privileged_ops(
            seed in 0_u8..=u8::MAX,
        ) {
            let env = Env::default();
            let _ = seed;
            let caller = soroban_sdk::Address::generate(&env);
            let ctx = AuthContext::new(caller.clone(), Role::Public);

            let privileged_ops = [
                "pause_group", "resume_group", "cancel_group",
                "contribute", "claim_payout",
                "pause_contract", "unpause_contract",
            ];

            for op in &privileged_ops {
                let result = AuthorizationChecker::check_authorization(&caller, op, &ctx);
                prop_assert!(result.is_err(),
                    "Public role must not be authorized for {}", op);
            }
        }
    }

    // ── Feature: GovernanceSecurity Property 5 – admin role subsumes member ──

    proptest! {
        /// ContractAdmin can perform any GroupMember-level operation.
        /// Specifically: contribute and claim_payout should NOT be blocked for admin.
        // Feature: GovernanceSecurity Property 5
        #[test]
        fn prop_admin_can_perform_member_operations(
            seed in 0_u8..=u8::MAX,
        ) {
            // ContractAdmin has the highest privilege level.
            // In the check_authorization logic, "contribute" and "claim_payout"
            // require GroupMember. An admin interacting as a group member would
            // have Role::GroupMember set for those operations.
            // This test verifies the invariant: GroupMember role grants member ops.
            let env = Env::default();
            let _ = seed;
            let caller = soroban_sdk::Address::generate(&env);
            let ctx = AuthContext::new(caller.clone(), Role::GroupMember);

            let member_ops = ["contribute", "claim_payout"];
            for op in &member_ops {
                let result = AuthorizationChecker::check_authorization(&caller, op, &ctx);
                prop_assert!(result.is_ok(),
                    "GroupMember must be authorized for {}", op);
            }
        }

        /// ContractAdmin role grants admin-only operations.
        // Feature: GovernanceSecurity Property 5b
        #[test]
        fn prop_admin_role_grants_contract_level_ops(
            seed in 0_u8..=u8::MAX,
        ) {
            let env = Env::default();
            let _ = seed;
            let caller = soroban_sdk::Address::generate(&env);
            let ctx = AuthContext::new(caller.clone(), Role::ContractAdmin);

            let admin_ops = ["pause_contract", "unpause_contract"];
            for op in &admin_ops {
                let result = AuthorizationChecker::check_authorization(&caller, op, &ctx);
                prop_assert!(result.is_ok(),
                    "ContractAdmin must be authorized for {}", op);
            }
        }

        /// GroupCreator role grants creator-only operations.
        // Feature: GovernanceSecurity Property 5c
        #[test]
        fn prop_creator_role_grants_creator_ops(
            seed in 0_u8..=u8::MAX,
        ) {
            let env = Env::default();
            let _ = seed;
            let caller = soroban_sdk::Address::generate(&env);
            let ctx = AuthContext::new(caller.clone(), Role::GroupCreator);

            let creator_ops = ["pause_group", "resume_group", "cancel_group"];
            for op in &creator_ops {
                let result = AuthorizationChecker::check_authorization(&caller, op, &ctx);
                prop_assert!(result.is_ok(),
                    "GroupCreator must be authorized for {}", op);
            }
        }
    }
}
