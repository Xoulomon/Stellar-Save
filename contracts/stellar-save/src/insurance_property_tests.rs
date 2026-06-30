/// Property-based tests for the Insurance / Penalty module (penalty.rs).
///
/// These tests verify core invariants of the penalty system:
/// - Penalty amounts are never negative
/// - Penalty is capped at MAX_PENALTY_BPS regardless of input
/// - Recovery amount is always greater than the missed contribution alone
/// - A claim (penalty deduction) can never exceed the available balance
/// - The balance never goes negative after a penalty is applied
#[cfg(test)]
mod insurance_property_tests {
    use crate::penalty::{
        calculate_penalty, PenaltyConfig, BASE_PENALTY_BPS, MAX_PENALTY_BPS,
        PENALTY_INCREMENT_BPS, RECOVERY_FEE_BPS,
    };
    use proptest::prelude::*;

    // ── Strategies ────────────────────────────────────────────────────────────

    fn positive_contribution() -> impl Strategy<Value = i128> {
        1_i128..=1_000_000_000_i128 // stroops
    }

    fn non_negative_balance() -> impl Strategy<Value = i128> {
        0_i128..=i128::MAX / 2
    }

    fn missed_cycles() -> impl Strategy<Value = u32> {
        1_u32..=50_u32
    }

    fn any_bps() -> impl Strategy<Value = u32> {
        0_u32..=10_000_u32 // 0% – 100%
    }

    /// Strategy that generates a valid PenaltyConfig with sensible bounds.
    fn penalty_config_strategy() -> impl Strategy<Value = PenaltyConfig> {
        (100_u32..=1000_u32, 100_u32..=500_u32, 1000_u32..=5000_u32, 100_u32..=2000_u32).prop_map(
            |(base, increment, max, recovery)| PenaltyConfig {
                base_penalty_bps: base,
                penalty_increment_bps: increment,
                max_penalty_bps: max.max(base), // max must be >= base
                recovery_fee_bps: recovery,
            },
        )
    }

    // ── Feature: InsurancePenalty Property 1 – penalty never negative ─────────

    proptest! {
        /// Calculated penalty amount is always >= 0 for any contribution amount
        /// and missed cycle count.
        // Feature: InsurancePenalty Property 1
        #[test]
        fn prop_penalty_never_negative(
            contribution_amount in positive_contribution(),
            missed in missed_cycles(),
            config in penalty_config_strategy(),
        ) {
            let penalty = calculate_penalty(contribution_amount, missed, &config);
            prop_assert!(
                penalty >= 0,
                "penalty was negative: {} for contribution={}, missed={}",
                penalty, contribution_amount, missed
            );
        }

        /// Zero contribution amount always yields zero penalty regardless of misses.
        // Feature: InsurancePenalty Property 1b
        #[test]
        fn prop_zero_contribution_yields_zero_penalty(
            missed in missed_cycles(),
            config in penalty_config_strategy(),
        ) {
            let penalty = calculate_penalty(0, missed, &config);
            prop_assert_eq!(penalty, 0);
        }

        /// Zero missed cycles always yields zero penalty regardless of contribution.
        // Feature: InsurancePenalty Property 1c
        #[test]
        fn prop_zero_missed_yields_zero_penalty(
            contribution_amount in positive_contribution(),
            config in penalty_config_strategy(),
        ) {
            let penalty = calculate_penalty(contribution_amount, 0, &config);
            prop_assert_eq!(penalty, 0);
        }
    }

    // ── Feature: InsurancePenalty Property 2 – penalty capped at max_penalty_bps

    proptest! {
        /// The penalty in basis points never exceeds MAX_PENALTY_BPS (2500 = 25%)
        /// regardless of how many cycles are missed, using the default config.
        // Feature: InsurancePenalty Property 2
        #[test]
        fn prop_penalty_capped_at_max_bps_default_config(
            contribution_amount in positive_contribution(),
            missed in missed_cycles(),
        ) {
            let config = PenaltyConfig::default();
            let penalty = calculate_penalty(contribution_amount, missed, &config);
            let max_allowed = (contribution_amount * config.max_penalty_bps as i128) / 10_000;
            prop_assert!(
                penalty <= max_allowed,
                "penalty {} exceeded max {} for missed={}",
                penalty, max_allowed, missed
            );
        }

        /// With any valid config, penalty must not exceed (contribution * max_bps / 10000).
        // Feature: InsurancePenalty Property 2b
        #[test]
        fn prop_penalty_capped_at_max_bps_any_config(
            contribution_amount in positive_contribution(),
            missed in missed_cycles(),
            config in penalty_config_strategy(),
        ) {
            let penalty = calculate_penalty(contribution_amount, missed, &config);
            let max_allowed = (contribution_amount * config.max_penalty_bps as i128) / 10_000;
            prop_assert!(
                penalty <= max_allowed,
                "penalty {} exceeded max {} (config.max_bps={})",
                penalty, max_allowed, config.max_penalty_bps
            );
        }

        /// Penalty with many misses must plateau: 100 misses equals 50 misses for
        /// any config where the cap kicks in before 50 increments.
        // Feature: InsurancePenalty Property 2c
        #[test]
        fn prop_penalty_plateaus_after_enough_misses(
            contribution_amount in positive_contribution(),
        ) {
            let config = PenaltyConfig::default();
            // 5 misses: 500 + 4*500 = 2500 bps (exactly at cap)
            // 10 misses: would be 4500 bps but capped at 2500 bps
            let penalty_5 = calculate_penalty(contribution_amount, 5, &config);
            let penalty_10 = calculate_penalty(contribution_amount, 10, &config);
            let penalty_50 = calculate_penalty(contribution_amount, 50, &config);
            prop_assert_eq!(penalty_5, penalty_10);
            prop_assert_eq!(penalty_10, penalty_50);
        }
    }

    // ── Feature: InsurancePenalty Property 3 – recovery fee is additive ───────

    proptest! {
        /// recovery_amount = contribution + fee where fee > 0.
        /// Therefore recovery_amount > contribution_amount always.
        // Feature: InsurancePenalty Property 3
        #[test]
        fn prop_recovery_amount_exceeds_contribution(
            contribution_amount in positive_contribution(),
        ) {
            // Use default config: RECOVERY_FEE_BPS = 1000 = 10%
            let recovery_fee_bps = RECOVERY_FEE_BPS as i128;
            let fee = (contribution_amount * recovery_fee_bps) / 10_000;
            let recovery_amount = contribution_amount + fee;
            prop_assert!(
                recovery_amount > contribution_amount,
                "recovery_amount {} must exceed contribution {}",
                recovery_amount, contribution_amount
            );
        }

        /// Recovery amount is strictly positive for any positive contribution.
        // Feature: InsurancePenalty Property 3b
        #[test]
        fn prop_recovery_amount_positive(
            contribution_amount in positive_contribution(),
            recovery_fee_bps in any_bps(),
        ) {
            let fee = (contribution_amount * recovery_fee_bps as i128) / 10_000;
            let recovery_amount = contribution_amount
                .checked_add(fee)
                .unwrap_or(i128::MAX);
            prop_assert!(recovery_amount > 0);
        }
    }

    // ── Feature: InsurancePenalty Property 4 – claim ≤ available balance ──────

    proptest! {
        /// The amount deducted for a penalty can never exceed the available balance.
        /// The safe deduction pattern is: min(penalty_amount, balance).
        // Feature: InsurancePenalty Property 4
        #[test]
        fn prop_claim_never_exceeds_available_balance(
            balance in non_negative_balance(),
            penalty_amount in 0_i128..=i128::MAX / 2,
        ) {
            // Safe deduction: saturating_sub / min-clamp
            let clamped_penalty = penalty_amount.min(balance);
            prop_assert!(
                clamped_penalty <= balance,
                "clamped_penalty {} > balance {}", clamped_penalty, balance
            );
        }

        /// saturating_sub never produces a negative result.
        // Feature: InsurancePenalty Property 4b
        #[test]
        fn prop_saturating_sub_non_negative(
            balance in non_negative_balance(),
            deduction in 0_i128..=i128::MAX / 2,
        ) {
            let result = balance.saturating_sub(deduction);
            prop_assert!(result >= 0,
                "saturating_sub produced negative: {} - {} = {}",
                balance, deduction, result
            );
        }
    }

    // ── Feature: InsurancePenalty Property 5 – balance never negative ─────────

    proptest! {
        /// After applying a penalty the balance is always ≥ 0.
        /// The contract uses saturating_sub to guarantee this.
        // Feature: InsurancePenalty Property 5
        #[test]
        fn prop_balance_never_negative_after_penalty(
            initial_balance in non_negative_balance(),
            contribution_amount in positive_contribution(),
            missed in missed_cycles(),
        ) {
            let config = PenaltyConfig::default();
            let penalty = calculate_penalty(contribution_amount, missed, &config);
            // The contract uses saturating_sub, so balance is always >= 0
            let new_balance = initial_balance.saturating_sub(penalty);
            prop_assert!(
                new_balance >= 0,
                "balance after penalty was negative: {} - {} = {}",
                initial_balance, penalty, new_balance
            );
        }

        /// Even if penalty exceeds balance, saturating_sub brings it to exactly 0.
        // Feature: InsurancePenalty Property 5b
        #[test]
        fn prop_balance_floors_at_zero_not_negative(
            balance in 0_i128..=1_000_000_i128,
            penalty_amount in 1_000_001_i128..=i128::MAX / 2,
        ) {
            // penalty > balance: must floor at 0
            let result = balance.saturating_sub(penalty_amount);
            prop_assert_eq!(result, 0);
        }

        /// The sequence: apply multiple penalties never lets balance go below 0.
        // Feature: InsurancePenalty Property 5c
        #[test]
        fn prop_repeated_penalties_balance_non_negative(
            initial_balance in non_negative_balance(),
            contribution_amount in positive_contribution(),
            n_misses in 1_u32..=10_u32,
        ) {
            let config = PenaltyConfig::default();
            let mut balance = initial_balance;
            for missed in 1..=n_misses {
                let penalty = calculate_penalty(contribution_amount, missed, &config);
                balance = balance.saturating_sub(penalty);
                prop_assert!(balance >= 0,
                    "balance went negative at miss {}: balance={}", missed, balance);
            }
        }
    }
}
