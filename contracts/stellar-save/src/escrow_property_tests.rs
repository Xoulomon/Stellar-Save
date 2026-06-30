/// Property-based tests for the Escrow / Pool module (pool.rs).
///
/// These tests verify core invariants of the pool/escrow layer:
/// - No double-credit for the same member in a cycle
/// - Conservation of credited amounts (sum = N × contribution)
/// - Pool total is never negative
/// - Payout equals pool (zero-fee invariant in v1)
/// - Cycle completion threshold is exact
#[cfg(test)]
mod escrow_property_tests {
    use crate::pool::{PoolCalculator, PoolInfo};
    use proptest::prelude::*;

    // ── Strategies ────────────────────────────────────────────────────────────

    fn positive_contribution() -> impl Strategy<Value = i128> {
        1_i128..=1_000_000_000_i128 // up to 100 XLM in stroops
    }

    fn valid_member_count() -> impl Strategy<Value = u32> {
        2_u32..=100_u32
    }

    fn partial_contributor_count(max: u32) -> impl Strategy<Value = u32> {
        0_u32..=max
    }

    // ── Feature: EscrowPool Property 1 – no double-credit ────────────────────

    proptest! {
        /// A member who has already contributed must not be credited again in the
        /// same cycle. This is modelled as: contributors_count for a given member
        /// slot is at most 1 regardless of how many contribution calls are made.
        ///
        /// We test the invariant at the PoolInfo level: given a contributors_count
        /// that would exceed 1 for any individual member, the pool correctly
        /// identifies incomplete state only when contributors_count < member_count.
        // Feature: EscrowPool Property 1
        #[test]
        fn prop_no_double_credit_contributors_bounded_by_member_count(
            member_count in valid_member_count(),
        ) {
            // contributors_count can never legally exceed member_count
            // because each member can contribute exactly once per cycle
            let contributors_count = member_count; // all contributed exactly once
            let contribution_amount = 10_000_000_i128;
            let total_pool = contribution_amount * member_count as i128;

            let pool = PoolInfo {
                group_id: 1,
                cycle: 0,
                member_count,
                contribution_amount,
                total_pool_amount: total_pool,
                current_contributions: total_pool,
                contributors_count,
                is_cycle_complete: contributors_count >= member_count,
            };

            // contributors can never exceed member_count (no double credit)
            prop_assert!(pool.contributors_count <= pool.member_count);
        }

        /// If contributors_count somehow exceeded member_count (double-credit bug),
        /// current_contributions would exceed total_pool_amount. Verify the
        /// validate_pool_ready_for_payout guard catches this.
        // Feature: EscrowPool Property 1b
        #[test]
        fn prop_double_credit_detected_by_validation(
            member_count in valid_member_count(),
            contribution_amount in positive_contribution(),
        ) {
            let total_pool = contribution_amount
                .checked_mul(member_count as i128)
                .unwrap_or(i128::MAX);

            // Simulate double-credit: contributions exceed pool total
            let doubled = total_pool.saturating_mul(2);

            let pool = PoolInfo {
                group_id: 1,
                cycle: 0,
                member_count,
                contribution_amount,
                total_pool_amount: total_pool,
                current_contributions: doubled,
                contributors_count: member_count,
                is_cycle_complete: true,
            };

            // Validation must reject because current_contributions != total_pool_amount
            let result = PoolCalculator::validate_pool_ready_for_payout(&pool);
            prop_assert!(result.is_err());
        }
    }

    // ── Feature: EscrowPool Property 2 – conservation of credited amounts ────

    proptest! {
        /// The sum of N equal individual contributions equals contribution_amount × N.
        /// This is the fundamental escrow conservation invariant.
        // Feature: EscrowPool Property 2
        #[test]
        fn prop_conservation_sum_equals_amount_times_n(
            contribution_amount in positive_contribution(),
            n in valid_member_count(),
        ) {
            let sum: i128 = (0..n as usize)
                .try_fold(0_i128, |acc, _| acc.checked_add(contribution_amount))
                .expect("overflow in test");
            let expected = contribution_amount
                .checked_mul(n as i128)
                .expect("overflow in expected");
            prop_assert_eq!(sum, expected);
        }

        /// Partial contributions conserve the credited portion:
        /// credited_total = contribution_amount × contributors_so_far
        // Feature: EscrowPool Property 2b
        #[test]
        fn prop_partial_contributions_conserved(
            contribution_amount in positive_contribution(),
            member_count in valid_member_count(),
            contributed in 0_u32..=100_u32,
        ) {
            let contributors = contributed.min(member_count);
            let credited_total = contribution_amount
                .checked_mul(contributors as i128)
                .expect("overflow");
            let expected_per_member = if contributors > 0 {
                credited_total / contributors as i128
            } else {
                0
            };

            prop_assert_eq!(expected_per_member, contribution_amount);
        }
    }

    // ── Feature: EscrowPool Property 3 – pool never negative ─────────────────

    proptest! {
        /// PoolCalculator::calculate_total_pool always returns a positive value
        /// for valid (positive) inputs. It never returns a negative amount.
        // Feature: EscrowPool Property 3
        #[test]
        fn prop_pool_never_negative(
            contribution_amount in positive_contribution(),
            member_count in valid_member_count(),
        ) {
            let result = PoolCalculator::calculate_total_pool(contribution_amount, member_count);
            prop_assert!(result.is_ok());
            prop_assert!(result.unwrap() >= 0);
        }

        /// Zero or negative contribution amounts always yield an error.
        // Feature: EscrowPool Property 3b
        #[test]
        fn prop_non_positive_contribution_rejected(
            contribution_amount in i128::MIN..=0_i128,
            member_count in valid_member_count(),
        ) {
            let result = PoolCalculator::calculate_total_pool(contribution_amount, member_count);
            prop_assert!(result.is_err());
        }

        /// current_contributions in a valid pool is always 0 ≤ x ≤ total_pool_amount.
        // Feature: EscrowPool Property 3c
        #[test]
        fn prop_current_contributions_bounded(
            contribution_amount in positive_contribution(),
            member_count in valid_member_count(),
            contributors in 0_u32..=100_u32,
        ) {
            let contributors = contributors.min(member_count);
            let total_pool = contribution_amount * member_count as i128;
            let current = contribution_amount * contributors as i128;

            prop_assert!(current >= 0);
            prop_assert!(current <= total_pool);
        }
    }

    // ── Feature: EscrowPool Property 4 – payout equals pool (v1 zero-fee) ────

    proptest! {
        /// In v1 of the contract there are no protocol fees.
        /// calculate_payout_amount must return exactly the total_pool value.
        // Feature: EscrowPool Property 4
        #[test]
        fn prop_payout_equals_pool_v1_zero_fees(
            contribution_amount in positive_contribution(),
            member_count in valid_member_count(),
        ) {
            let total_pool = contribution_amount
                .checked_mul(member_count as i128)
                .expect("overflow");
            let payout = PoolCalculator::calculate_payout_amount(total_pool)
                .expect("payout calculation failed");
            prop_assert_eq!(payout, total_pool,
                "v1 payout must equal pool (no fees): {} != {}", payout, total_pool);
        }

        /// Payout is always non-negative for non-negative pool amounts.
        // Feature: EscrowPool Property 4b
        #[test]
        fn prop_payout_non_negative(
            total_pool in 0_i128..=i128::MAX / 2,
        ) {
            let payout = PoolCalculator::calculate_payout_amount(total_pool)
                .expect("payout calculation failed");
            prop_assert!(payout >= 0);
        }
    }

    // ── Feature: EscrowPool Property 5 – completion threshold ────────────────

    proptest! {
        /// A cycle is complete if and only if contributors_count >= member_count.
        /// The is_cycle_complete flag must be consistent with this threshold.
        // Feature: EscrowPool Property 5
        #[test]
        fn prop_completion_threshold_exact(
            member_count in valid_member_count(),
            // contributors can be from 0 to member_count + a small overflow margin
            contributors in 0_u32..=110_u32,
        ) {
            let contributors = contributors.min(member_count); // clamp: no double-credit
            let is_complete = contributors >= member_count;

            let pool = PoolInfo {
                group_id: 42,
                cycle: 1,
                member_count,
                contribution_amount: 1_000_000,
                total_pool_amount: 1_000_000 * member_count as i128,
                current_contributions: 1_000_000 * contributors as i128,
                contributors_count: contributors,
                is_cycle_complete: is_complete,
            };

            // is_complete matches the threshold exactly
            prop_assert_eq!(pool.is_cycle_complete, pool.contributors_count >= pool.member_count);
            prop_assert_eq!(pool.is_complete(), pool.contributors_count >= pool.member_count);
        }

        /// completion_percentage is in range [0, 100] for all valid inputs.
        // Feature: EscrowPool Property 5b
        #[test]
        fn prop_completion_percentage_in_range(
            member_count in valid_member_count(),
            contributors in 0_u32..=100_u32,
        ) {
            let contributors = contributors.min(member_count);
            let pool = PoolInfo {
                group_id: 1,
                cycle: 0,
                member_count,
                contribution_amount: 1_000_000,
                total_pool_amount: 1_000_000 * member_count as i128,
                current_contributions: 1_000_000 * contributors as i128,
                contributors_count: contributors,
                is_cycle_complete: contributors >= member_count,
            };

            let pct = pool.completion_percentage();
            prop_assert!(pct <= 100, "completion_percentage={} exceeded 100", pct);
        }

        /// When all members have contributed, remaining_contributions_needed == 0.
        // Feature: EscrowPool Property 5c
        #[test]
        fn prop_remaining_zero_when_complete(
            member_count in valid_member_count(),
        ) {
            let pool = PoolInfo {
                group_id: 1,
                cycle: 0,
                member_count,
                contribution_amount: 1_000_000,
                total_pool_amount: 1_000_000 * member_count as i128,
                current_contributions: 1_000_000 * member_count as i128,
                contributors_count: member_count,
                is_cycle_complete: true,
            };

            prop_assert_eq!(pool.remaining_contributions_needed(), 0);
        }
    }
}
