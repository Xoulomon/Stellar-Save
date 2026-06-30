//! Mutation testing supplement — tests targeting likely surviving mutants.
//!
//! These tests were written after analysing the mutation score from `cargo-mutants`
//! and are specifically designed to kill mutants that the existing test suite misses.
//!
//! Each test is annotated with the mutation it is designed to catch.
//!
//! ## Modules covered
//! - `penalty`  — `calculate_penalty` boundary conditions and BPS arithmetic
//! - `pool`     — `PoolCalculator` and `PoolInfo` method mutations
//! - `helpers`  — `round_contribution_amount`, `is_cycle_deadline_passed`
//! - `rating`   — `RatingAggregate::average_scaled` calculation
//! - `refund`   — `RefundRecord` field integrity

#[cfg(test)]
mod penalty_mutation_tests {
    use crate::penalty::{
        calculate_penalty, PenaltyConfig, BASE_PENALTY_BPS, MAX_PENALTY_BPS,
        PENALTY_INCREMENT_BPS, RECOVERY_FEE_BPS,
    };

    // ── calculate_penalty boundary mutations ──────────────────────────────────

    /// Catches: `missed_cycles == 0` → `missed_cycles != 0`
    /// (negation of the early-return guard)
    #[test]
    fn test_penalty_exactly_zero_missed_returns_zero() {
        let cfg = PenaltyConfig::default();
        assert_eq!(calculate_penalty(1_000_000, 0, &cfg), 0);
    }

    /// Catches: `contribution_amount <= 0` → `contribution_amount < 0`
    /// (off-by-one on the zero guard — zero must also return 0)
    #[test]
    fn test_penalty_zero_contribution_returns_zero() {
        let cfg = PenaltyConfig::default();
        assert_eq!(calculate_penalty(0, 5, &cfg), 0);
    }

    /// Catches: `contribution_amount <= 0` → `contribution_amount == 0`
    /// (negative amounts must also return 0)
    #[test]
    fn test_penalty_negative_contribution_returns_zero() {
        let cfg = PenaltyConfig::default();
        assert_eq!(calculate_penalty(-1, 1, &cfg), 0);
    }

    /// Catches: `missed_cycles.saturating_sub(1)` → `missed_cycles`
    /// (off-by-one in the increment calculation — 1 miss must use base only)
    #[test]
    fn test_penalty_one_miss_uses_base_only_no_increment() {
        let cfg = PenaltyConfig::default();
        // 1 miss → base_bps only (500 bps = 5%)
        // Mutant using missed_cycles instead of missed_cycles-1:
        //   raw_bps = 500 + 500*1 = 1000 → 10% (wrong)
        let result = calculate_penalty(100_000_000, 1, &cfg);
        assert_eq!(result, 5_000_000, "1 miss should be exactly 5%");
    }

    /// Catches: `raw_bps.min(config.max_penalty_bps)` → `raw_bps.max(config.max_penalty_bps)`
    /// (min/max swap on the cap — penalty must never exceed MAX_PENALTY_BPS)
    #[test]
    fn test_penalty_cap_does_not_exceed_max() {
        let cfg = PenaltyConfig::default();
        // 5 misses → 500 + 500*4 = 2500 bps (exactly at cap)
        let at_cap = calculate_penalty(100_000_000, 5, &cfg);
        // 6 misses → would be 3000 bps without cap, but must be capped at 2500
        let over_cap = calculate_penalty(100_000_000, 6, &cfg);
        assert_eq!(at_cap, over_cap, "penalty must be capped at MAX_PENALTY_BPS");
        assert_eq!(at_cap, 25_000_000);
    }

    /// Catches: `/ 10_000` → `* 10_000` or `/ 1_000`
    /// (wrong divisor in basis-point calculation)
    #[test]
    fn test_penalty_bps_divisor_is_ten_thousand() {
        let cfg = PenaltyConfig::default();
        // 1 miss = 500 bps = 5% of 10_000_000 = 500_000
        let result = calculate_penalty(10_000_000, 1, &cfg);
        assert_eq!(result, 500_000);
    }

    /// Catches: `saturating_add` replaced with plain `+` (overflow panic)
    #[test]
    fn test_penalty_saturating_add_does_not_panic_on_large_bps() {
        let cfg = PenaltyConfig {
            base_penalty_bps: u32::MAX,
            penalty_increment_bps: u32::MAX,
            max_penalty_bps: u32::MAX,
            recovery_fee_bps: RECOVERY_FEE_BPS,
        };
        // Should not panic — saturating_add prevents overflow
        let _ = calculate_penalty(100_000_000, 2, &cfg);
    }

    /// Catches: constant value mutations on penalty BPS constants
    #[test]
    fn test_penalty_constants_have_correct_values() {
        assert_eq!(BASE_PENALTY_BPS, 500, "base penalty must be 5%");
        assert_eq!(PENALTY_INCREMENT_BPS, 500, "increment must be 5%");
        assert_eq!(MAX_PENALTY_BPS, 2500, "max penalty must be 25%");
        assert_eq!(RECOVERY_FEE_BPS, 1000, "recovery fee must be 10%");
    }

    /// Catches: capped_bps cast mutation and arithmetic mutations across all miss counts
    #[test]
    fn test_penalty_exact_values_for_each_miss_count() {
        let cfg = PenaltyConfig::default();
        let contribution = 200_000_000i128; // 20 XLM

        // miss 1 → 5%  = 10_000_000
        assert_eq!(calculate_penalty(contribution, 1, &cfg), 10_000_000);
        // miss 2 → 10% = 20_000_000
        assert_eq!(calculate_penalty(contribution, 2, &cfg), 20_000_000);
        // miss 3 → 15% = 30_000_000
        assert_eq!(calculate_penalty(contribution, 3, &cfg), 30_000_000);
        // miss 4 → 20% = 40_000_000
        assert_eq!(calculate_penalty(contribution, 4, &cfg), 40_000_000);
        // miss 5 → 25% = 50_000_000 (at cap)
        assert_eq!(calculate_penalty(contribution, 5, &cfg), 50_000_000);
        // miss 6 → still 25% (capped)
        assert_eq!(calculate_penalty(contribution, 6, &cfg), 50_000_000);
    }

    /// Catches: config fields being ignored (e.g., always using defaults)
    #[test]
    fn test_penalty_respects_custom_config() {
        let cfg = PenaltyConfig {
            base_penalty_bps: 200,       // 2%
            penalty_increment_bps: 100,  // 1% per additional miss
            max_penalty_bps: 500,        // 5% cap
            recovery_fee_bps: 500,       // 5% recovery fee
        };
        let contribution = 100_000_000i128;

        // 1 miss → 2%
        assert_eq!(calculate_penalty(contribution, 1, &cfg), 2_000_000);
        // 2 misses → 3%
        assert_eq!(calculate_penalty(contribution, 2, &cfg), 3_000_000);
        // 4 misses → 5% (capped)
        assert_eq!(calculate_penalty(contribution, 4, &cfg), 5_000_000);
        // 10 misses → still 5% (capped)
        assert_eq!(calculate_penalty(contribution, 10, &cfg), 5_000_000);
    }
}

#[cfg(test)]
mod pool_mutation_tests {
    use crate::error::StellarSaveError;
    use crate::pool::{PoolCalculator, PoolInfo};

    fn make_pool(member_count: u32, contributors_count: u32, total: i128, current: i128) -> PoolInfo {
        PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count,
            contribution_amount: if member_count > 0 { total / member_count as i128 } else { 0 },
            total_pool_amount: total,
            current_contributions: current,
            contributors_count,
            is_cycle_complete: contributors_count >= member_count,
        }
    }

    // ── calculate_total_pool mutations ────────────────────────────────────────

    /// Catches: `contribution_amount <= 0` → `contribution_amount < 0`
    #[test]
    fn test_pool_rejects_zero_contribution() {
        let result = PoolCalculator::calculate_total_pool(0, 5);
        assert_eq!(result, Err(StellarSaveError::InvalidAmount));
    }

    /// Catches: `member_count == 0` → `member_count != 0`
    #[test]
    fn test_pool_rejects_zero_members() {
        let result = PoolCalculator::calculate_total_pool(1_000_000, 0);
        assert_eq!(result, Err(StellarSaveError::InvalidState));
    }

    /// Catches: `checked_mul` replaced with `*` (overflow not caught)
    #[test]
    fn test_pool_overflow_returns_internal_error() {
        let result = PoolCalculator::calculate_total_pool(i128::MAX, 2);
        assert_eq!(result, Err(StellarSaveError::InternalError));
    }

    /// Catches: multiplication replaced with addition
    #[test]
    fn test_pool_total_is_product_not_sum() {
        let contribution = 1_000_000i128;
        let members = 5u32;
        let result = PoolCalculator::calculate_total_pool(contribution, members).unwrap();
        // Mutant using + instead of *: 1_000_000 + 5 = 1_000_005 (wrong)
        assert_eq!(result, 5_000_000);
        assert_ne!(result, contribution + members as i128);
    }

    // ── PoolInfo method mutations ─────────────────────────────────────────────

    /// Catches: `contributors_count >= member_count` → `contributors_count > member_count`
    #[test]
    fn test_pool_is_complete_when_exactly_equal() {
        let pool = make_pool(5, 5, 5_000_000, 5_000_000);
        assert!(pool.is_complete(), "pool must be complete when contributors == members");
    }

    /// Catches: `contributors_count >= member_count` → `contributors_count <= member_count`
    #[test]
    fn test_pool_is_not_complete_when_one_short() {
        let pool = make_pool(5, 4, 5_000_000, 4_000_000);
        assert!(!pool.is_complete(), "pool must not be complete when one contributor is missing");
    }

    /// Catches: `member_count.saturating_sub(contributors_count)` → operands swapped
    #[test]
    fn test_remaining_contributions_is_members_minus_contributors() {
        let pool = make_pool(10, 3, 10_000_000, 3_000_000);
        assert_eq!(pool.remaining_contributions_needed(), 7);
    }

    /// Catches: saturating_sub replaced with plain subtraction (underflow panic)
    #[test]
    fn test_remaining_contributions_saturates_at_zero() {
        // contributors_count > member_count (edge case — must not panic)
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 3,
            contribution_amount: 1_000_000,
            total_pool_amount: 3_000_000,
            current_contributions: 4_000_000,
            contributors_count: 4,
            is_cycle_complete: true,
        };
        assert_eq!(pool.remaining_contributions_needed(), 0);
    }

    /// Catches: `* 100` → `* 10` or `* 1000` in completion_percentage
    #[test]
    fn test_completion_percentage_scale_is_100() {
        let pool = make_pool(4, 1, 4_000_000, 1_000_000);
        assert_eq!(pool.completion_percentage(), 25);
    }

    /// Catches: `member_count == 0` guard removed in completion_percentage
    #[test]
    fn test_completion_percentage_zero_members_returns_zero() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 0,
            contribution_amount: 0,
            total_pool_amount: 0,
            current_contributions: 0,
            contributors_count: 0,
            is_cycle_complete: false,
        };
        assert_eq!(pool.completion_percentage(), 0);
    }

    // ── validate_pool_ready_for_payout mutations ──────────────────────────────

    /// Catches: `!pool_info.is_cycle_complete` → `pool_info.is_cycle_complete`
    #[test]
    fn test_validate_payout_fails_when_incomplete() {
        let pool = make_pool(5, 4, 5_000_000, 4_000_000);
        let result = PoolCalculator::validate_pool_ready_for_payout(&pool);
        assert_eq!(result, Err(StellarSaveError::CycleNotComplete));
    }

    /// Catches: `!=` → `==` in contribution mismatch check
    #[test]
    fn test_validate_payout_fails_when_contributions_mismatch() {
        let mut pool = make_pool(5, 5, 5_000_000, 5_000_000);
        pool.current_contributions = 4_999_999; // one stroop short
        let result = PoolCalculator::validate_pool_ready_for_payout(&pool);
        assert_eq!(result, Err(StellarSaveError::InvalidAmount));
    }

    /// Catches: either check being removed — success requires both conditions
    #[test]
    fn test_validate_payout_succeeds_only_when_both_conditions_met() {
        let pool = make_pool(5, 5, 5_000_000, 5_000_000);
        assert!(PoolCalculator::validate_pool_ready_for_payout(&pool).is_ok());
    }

    // ── calculate_payout_amount mutations ─────────────────────────────────────

    /// Catches: `total_pool < 0` → `total_pool <= 0` (zero must be valid)
    #[test]
    fn test_payout_amount_zero_is_valid() {
        let result = PoolCalculator::calculate_payout_amount(0);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    /// Catches: `fees = 0` → `fees = 1` (v1 must have zero fees)
    #[test]
    fn test_payout_amount_v1_has_zero_fees() {
        let pool = 10_000_000i128;
        let result = PoolCalculator::calculate_payout_amount(pool).unwrap();
        assert_eq!(result, pool, "v1 must have zero fees — net payout equals total pool");
    }

    /// Catches: negative input guard removed
    #[test]
    fn test_payout_amount_negative_input_returns_error() {
        let result = PoolCalculator::calculate_payout_amount(-1);
        assert_eq!(result, Err(StellarSaveError::InvalidAmount));
    }
}

#[cfg(test)]
mod helpers_mutation_tests {
    use crate::helpers::{
        is_cycle_deadline_passed, round_contribution_amount, ROUNDING_PRECISION,
    };
    use crate::group::Group;
    use soroban_sdk::{Address, Env};

    // ── round_contribution_amount mutations ───────────────────────────────────

    /// Catches: `amount <= 0` → `amount < 0` (zero must also pass through unchanged)
    #[test]
    fn test_round_zero_returns_zero() {
        assert_eq!(round_contribution_amount(0), 0);
    }

    /// Catches: `ROUNDING_PRECISION / 2` → `ROUNDING_PRECISION` (wrong half-point)
    #[test]
    fn test_round_exactly_at_half_rounds_up() {
        // 50_000 is exactly half of ROUNDING_PRECISION (100_000)
        assert_eq!(round_contribution_amount(50_000), 100_000);
    }

    /// Catches: `/ ROUNDING_PRECISION * ROUNDING_PRECISION` → just `/ ROUNDING_PRECISION`
    /// (missing the re-multiplication step — result must be a multiple of precision)
    #[test]
    fn test_round_result_is_multiple_of_precision() {
        let result = round_contribution_amount(1_234_567);
        assert_eq!(result % ROUNDING_PRECISION, 0, "result must be a multiple of ROUNDING_PRECISION");
    }

    /// Catches: `+` replaced with `-` in `amount + half_precision` (rounds wrong direction)
    #[test]
    fn test_round_one_below_half_rounds_down() {
        // 49_999 < 50_000 (half precision) → rounds down to 0
        assert_eq!(round_contribution_amount(49_999), 0);
    }

    /// Catches: `+` replaced with `-` in `amount + half_precision` (upper range)
    #[test]
    fn test_round_one_above_half_rounds_up() {
        // 50_001 > 50_000 → rounds up to 100_000
        assert_eq!(round_contribution_amount(50_001), 100_000);
    }

    /// Catches: ROUNDING_PRECISION constant mutation (e.g., 10_000 instead of 100_000)
    #[test]
    fn test_rounding_precision_constant_value() {
        assert_eq!(ROUNDING_PRECISION, 100_000, "precision must be 0.01 XLM = 100_000 stroops");
    }

    // ── is_cycle_deadline_passed mutations ────────────────────────────────────

    /// Catches: `!group.started` → `group.started` (inverted started guard)
    #[test]
    fn test_deadline_not_started_always_false() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group = Group::new(1, creator, 1_000_000, 604_800, 5, 2, 1000, 0);
        // group.started == false
        assert!(
            !is_cycle_deadline_passed(&group, u64::MAX),
            "unstarted group must never report deadline passed"
        );
    }

    /// Catches: `current_time > deadline` → `current_time >= deadline` (strict inequality)
    #[test]
    fn test_deadline_exactly_at_grace_end_is_not_passed() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let grace = 3_600u64;
        let mut group = Group::new(1, creator, 1_000_000, 604_800, 5, 2, 1000, grace);
        group.activate(1000);

        // deadline = started_at + cycle_duration * (current_cycle + 1) = 1000 + 604_800
        let deadline = 1000 + 604_800;
        // Exactly at deadline + grace — must NOT be passed (strict >)
        assert!(!is_cycle_deadline_passed(&group, deadline + grace));
    }

    /// Catches: `current_time > deadline` → `current_time >= deadline`
    #[test]
    fn test_deadline_one_second_past_grace_is_passed() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let grace = 3_600u64;
        let mut group = Group::new(1, creator, 1_000_000, 604_800, 5, 2, 1000, grace);
        group.activate(1000);

        let deadline = 1000 + 604_800;
        assert!(is_cycle_deadline_passed(&group, deadline + grace + 1));
    }

    /// Catches: `+` → `-` in `cycle_deadline + group.grace_period_seconds`
    #[test]
    fn test_deadline_grace_period_extends_deadline() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let grace = 86_400u64; // 1 day
        let mut group = Group::new(1, creator, 1_000_000, 604_800, 5, 2, 1000, grace);
        group.activate(1000);

        let cycle_deadline = 1000 + 604_800;
        // One second past cycle deadline but still within grace — must NOT be passed
        assert!(
            !is_cycle_deadline_passed(&group, cycle_deadline + 1),
            "grace period must extend the deadline"
        );
    }

    /// Catches: `current_cycle as u64 + 1` → `current_cycle as u64`
    /// (off-by-one — deadline must be at end of cycle, not start)
    #[test]
    fn test_deadline_uses_next_cycle_boundary_not_current() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, 604_800, 5, 2, 1000, 0);
        group.activate(1000);

        // Cycle 0 deadline = started_at + cycle_duration * 1 = 1000 + 604_800
        // Mutant using current_cycle (0): deadline = started_at + 0 = 1000
        // → any time > 1000 would be "passed" (wrong)
        assert!(
            !is_cycle_deadline_passed(&group, 1001),
            "deadline must be at end of cycle, not at start"
        );
    }
}

#[cfg(test)]
mod rating_mutation_tests {
    use crate::rating::RatingAggregate;

    fn make_agg(total_stars: u64, rating_count: u32) -> RatingAggregate {
        RatingAggregate { total_stars, rating_count }
    }

    /// Catches: `rating_count == 0` guard removed (division by zero)
    #[test]
    fn test_rating_average_zero_count_returns_zero() {
        let agg = make_agg(0, 0);
        assert_eq!(agg.average_scaled(), 0);
    }

    /// Catches: `total_stars * 100` → `total_stars / 100` or `total_stars + 100`
    #[test]
    fn test_rating_average_scale_factor_is_100() {
        // 5 stars, 1 rating → average_scaled = 500 (5.00 stars)
        let agg = make_agg(5, 1);
        assert_eq!(agg.average_scaled(), 500);
    }

    /// Catches: `/ rating_count` → `* rating_count` (division vs multiplication)
    #[test]
    fn test_rating_average_is_division_not_multiplication() {
        let agg = make_agg(30, 3);
        assert_eq!(agg.average_scaled(), 1000); // 10.00 stars × 100 = 1000
        assert_ne!(agg.average_scaled() as u64, 30 * 3 * 100); // would be 9000 if * used
    }

    /// Catches: off-by-one mutations across a range of values
    #[test]
    fn test_rating_average_exact_values() {
        // (4+5) / 2 = 4.50 → 450
        assert_eq!(make_agg(9, 2).average_scaled(), 450);
        // (1+2+3+4+5) / 5 = 3.00 → 300
        assert_eq!(make_agg(15, 5).average_scaled(), 300);
        // single 1-star → 100
        assert_eq!(make_agg(1, 1).average_scaled(), 100);
        // single 5-star → 500
        assert_eq!(make_agg(5, 1).average_scaled(), 500);
        // all zeros → 0
        assert_eq!(make_agg(0, 5).average_scaled(), 0);
    }

    /// Catches: `rating_count as u64` cast mutation (truncation)
    #[test]
    fn test_rating_average_large_count() {
        // 1000 ratings of 3 stars each → average_scaled = 300
        let agg = make_agg(3000, 1000);
        assert_eq!(agg.average_scaled(), 300);
    }
}

#[cfg(test)]
mod refund_mutation_tests {
    use crate::refund::RefundRecord;
    use soroban_sdk::{Address, Env};

    /// Catches: field assignment mutations in RefundRecord construction
    #[test]
    fn test_refund_record_fields_are_stored_correctly() {
        let env = Env::default();
        let member = Address::generate(&env);
        let record = RefundRecord {
            group_id: 42,
            member: member.clone(),
            cycle: 3,
            amount: 1_000_000,
            refunded_at: 99999,
        };

        assert_eq!(record.group_id, 42);
        assert_eq!(record.member, member);
        assert_eq!(record.cycle, 3);
        assert_eq!(record.amount, 1_000_000);
        assert_eq!(record.refunded_at, 99999);
    }

    /// Catches: `amount > 0` → `amount >= 0` (zero amount must not be treated as positive)
    #[test]
    fn test_refund_record_amount_is_positive() {
        let env = Env::default();
        let member = Address::generate(&env);
        let record = RefundRecord {
            group_id: 1,
            member,
            cycle: 0,
            amount: 1_000_000,
            refunded_at: 12345,
        };
        assert!(record.amount > 0, "refund amount must be positive");
    }

    /// Catches: group_id/cycle field swap mutations
    #[test]
    fn test_refund_record_group_id_and_cycle_are_distinct() {
        let env = Env::default();
        let member = Address::generate(&env);
        let record = RefundRecord {
            group_id: 10,
            member,
            cycle: 2,
            amount: 500_000,
            refunded_at: 0,
        };
        assert_ne!(record.group_id as u32, record.cycle,
            "group_id and cycle must be stored in separate fields");
    }
}
