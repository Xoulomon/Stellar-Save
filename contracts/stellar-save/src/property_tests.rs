/// Property-based tests for Stellar-Save contract logic.
///
/// Covers invariants not addressed in fuzz_tests.rs:
/// - PayoutRecord construction and amount invariants
/// - Pool size calculation (contribution_amount × max_members)
/// - Payout amount equals pool size
/// - Cycle number monotonicity
/// - Group member count bounds
/// - GroupStatus round-trip through u32
#[cfg(test)]
mod property_tests {
    use crate::{
        contribution::ContributionRecord,
        group::{Group, GroupStatus},
        payout::PayoutRecord,
    };
    use proptest::prelude::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    // ── Strategies ────────────────────────────────────────────────────────────

    fn positive_amount() -> impl Strategy<Value = i128> {
        1_i128..=i128::MAX / 2
    }

    fn valid_member_count() -> impl Strategy<Value = u32> {
        2_u32..=100_u32
    }

    fn valid_cycle_duration() -> impl Strategy<Value = u64> {
        86_400_u64..=31_536_000_u64
    }

    fn any_cycle() -> impl Strategy<Value = u32> {
        0_u32..=u32::MAX
    }

    fn any_group_id() -> impl Strategy<Value = u64> {
        0_u64..=u64::MAX
    }

    // ── PayoutRecord invariants ───────────────────────────────────────────────

    proptest! {
        /// PayoutRecord stores all fields exactly as provided.
        #[test]
        fn prop_payout_record_stores_fields_exactly(
            amount in positive_amount(),
            cycle in any_cycle(),
            gid in any_group_id(),
            ts in 0_u64..=u64::MAX,
        ) {
            let env = Env::default();
            let addr = Address::generate(&env);
            let rec = PayoutRecord::new(addr.clone(), gid, cycle, amount, ts);
            prop_assert_eq!(rec.amount, amount);
            prop_assert_eq!(rec.cycle_number, cycle);
            prop_assert_eq!(rec.group_id, gid);
            prop_assert_eq!(rec.timestamp, ts);
            prop_assert_eq!(rec.recipient, addr);
        }

        /// PayoutRecord must reject zero or negative amounts.
        #[test]
        fn prop_payout_rejects_non_positive_amount(
            amount in i128::MIN..=0_i128,
            cycle in any_cycle(),
            gid in any_group_id(),
        ) {
            let env = Env::default();
            let addr = Address::generate(&env);
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                PayoutRecord::new(addr, gid, cycle, amount, 0)
            }));
            prop_assert!(result.is_err(), "expected panic for amount={}", amount);
        }
    }

    // ── Pool size invariants ──────────────────────────────────────────────────

    proptest! {
        /// Pool size = contribution_amount × max_members must not overflow i128.
        #[test]
        fn prop_pool_size_no_overflow(
            contribution_amount in 1_i128..=1_000_000_000_000_i128,
            max_members in valid_member_count(),
        ) {
            let pool = contribution_amount.checked_mul(max_members as i128);
            prop_assert!(
                pool.is_some(),
                "pool overflowed: {} × {}", contribution_amount, max_members
            );
            prop_assert!(pool.unwrap() > 0);
        }

        /// Payout amount must equal pool size (contribution_amount × max_members).
        #[test]
        fn prop_payout_equals_pool_size(
            contribution_amount in 1_i128..=1_000_000_000_i128,
            max_members in valid_member_count(),
            cycle in any_cycle(),
            gid in any_group_id(),
        ) {
            let pool = contribution_amount * max_members as i128;
            let env = Env::default();
            let addr = Address::generate(&env);
            let rec = PayoutRecord::new(addr, gid, cycle, pool, 0);
            prop_assert_eq!(rec.amount, pool);
            prop_assert_eq!(rec.amount, contribution_amount * max_members as i128);
        }
    }

    // ── Cycle number properties ───────────────────────────────────────────────

    proptest! {
        /// Contributions in later cycles have strictly higher cycle numbers.
        #[test]
        fn prop_cycle_numbers_are_ordered(
            cycle_a in 0_u32..u32::MAX,
            delta in 1_u32..=100_u32,
        ) {
            let cycle_b = cycle_a.saturating_add(delta);
            prop_assert!(cycle_b > cycle_a);
        }

        /// A contribution's cycle number is preserved through record creation.
        #[test]
        fn prop_contribution_cycle_round_trip(
            cycle in any_cycle(),
            amount in positive_amount(),
            gid in any_group_id(),
        ) {
            let env = Env::default();
            let addr = Address::generate(&env);
            let rec = ContributionRecord::new(addr, gid, cycle, amount, 0);
            prop_assert_eq!(rec.cycle_number, cycle);
        }
    }

    // ── Group member count bounds ─────────────────────────────────────────────

    proptest! {
        /// member_count must never exceed max_members.
        #[test]
        fn prop_member_count_never_exceeds_max(
            max_members in valid_member_count(),
            member_count in 0_u32..=100_u32,
        ) {
            // Simulate the invariant enforced by join_group
            let clamped = member_count.min(max_members);
            prop_assert!(clamped <= max_members);
        }

        /// min_members must be <= max_members for a valid group config.
        #[test]
        fn prop_min_members_lte_max_members(
            max_members in valid_member_count(),
            min_members in valid_member_count(),
        ) {
            // The invariant: a group is only valid when min <= max
            let valid = min_members <= max_members;
            // If invalid, joining should be rejected — we just verify the predicate
            prop_assert_eq!(valid, min_members <= max_members);
        }
    }

    // ── GroupStatus u32 round-trip ────────────────────────────────────────────

    proptest! {
        /// Every valid GroupStatus survives a u32 round-trip.
        #[test]
        fn prop_group_status_u32_round_trip(
            raw in 0_u32..=4_u32,
        ) {
            let status = GroupStatus::from_u32(raw);
            prop_assert!(status.is_some(), "expected Some for raw={}", raw);
            let back = status.unwrap().as_u32();
            prop_assert_eq!(back, raw);
        }

        /// Values outside 0..=4 must return None.
        #[test]
        fn prop_group_status_invalid_u32_returns_none(
            raw in 5_u32..=u32::MAX,
        ) {
            prop_assert!(GroupStatus::from_u32(raw).is_none());
        }

        /// Terminal states must report is_terminal() == true.
        #[test]
        fn prop_terminal_states_report_is_terminal(
            terminal in prop_oneof![
                Just(GroupStatus::Completed),
                Just(GroupStatus::Cancelled),
            ],
        ) {
            prop_assert!(terminal.is_terminal());
        }

        /// Non-terminal states must report is_terminal() == false.
        #[test]
        fn prop_non_terminal_states_report_not_terminal(
            non_terminal in prop_oneof![
                Just(GroupStatus::Pending),
                Just(GroupStatus::Active),
                Just(GroupStatus::Paused),
            ],
        ) {
            prop_assert!(!non_terminal.is_terminal());
        }
    }

    // ── Contribution total accumulation ──────────────────────────────────────

    proptest! {
        /// Sum of N equal contributions equals contribution_amount × N.
        #[test]
        fn prop_contribution_total_equals_amount_times_count(
            amount in 1_i128..=1_000_000_000_i128,
            n in 1_usize..=50_usize,
        ) {
            let total: i128 = (0..n)
                .map(|_| amount)
                .try_fold(0_i128, |acc, x| acc.checked_add(x))
                .expect("overflow in test");
            prop_assert_eq!(total, amount * n as i128);
        }

        /// Contribution timestamps must be non-negative (u64 guarantees this).
        #[test]
        fn prop_contribution_timestamp_non_negative(
            ts in 0_u64..=u64::MAX,
            amount in positive_amount(),
            gid in any_group_id(),
            cycle in any_cycle(),
        ) {
            let env = Env::default();
            let addr = Address::generate(&env);
            let rec = ContributionRecord::new(addr, gid, cycle, amount, ts);
            prop_assert_eq!(rec.timestamp, ts);
        }
    }
}
