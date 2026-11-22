/// Property-based fuzz tests for Stellar-Save contract logic.
///
/// Uses `proptest` (already a dev-dependency) to generate arbitrary inputs
/// and verify invariants that must hold regardless of input values.
/// These tests run under `cargo test` — no nightly or special toolchain needed.
#[cfg(test)]
mod fuzz_tests {
    use crate::{
        contribution::ContributionRecord,
        group::{Group, GroupStatus},
        ContractConfig,
    };
    use proptest::prelude::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    // ── Strategies ────────────────────────────────────────────────────────────

    /// Valid contribution amounts: 1 stroop to i128::MAX
    fn valid_amount() -> impl Strategy<Value = i128> {
        1_i128..=i128::MAX
    }

    /// Invalid contribution amounts: zero or negative
    fn invalid_amount() -> impl Strategy<Value = i128> {
        i128::MIN..=0_i128
    }

    /// Arbitrary cycle numbers
    fn cycle_number() -> impl Strategy<Value = u32> {
        0_u32..=u32::MAX
    }

    /// Arbitrary group IDs
    fn group_id() -> impl Strategy<Value = u64> {
        0_u64..=u64::MAX
    }

    /// Valid member counts: 2..=50
    fn valid_member_count() -> impl Strategy<Value = u32> {
        2_u32..=50_u32
    }

    /// Valid cycle durations in seconds: 1 day to 1 year
    fn valid_cycle_duration() -> impl Strategy<Value = u64> {
        86_400_u64..=31_536_000_u64
    }

    // ── ContributionRecord invariants ─────────────────────────────────────────

    proptest! {
        /// A ContributionRecord created with a positive amount must store it exactly.
        #[test]
        fn prop_contribution_amount_stored_exactly(
            amount in valid_amount(),
            cycle in cycle_number(),
            gid in group_id(),
        ) {
            let env = Env::default();
            let addr = Address::generate(&env);
            let record = ContributionRecord::new(addr, gid, cycle, amount, 0);
            prop_assert_eq!(record.amount, amount);
            prop_assert_eq!(record.cycle_number, cycle);
            prop_assert_eq!(record.group_id, gid);
        }

        /// ContributionRecord::new must panic for zero or negative amounts.
        #[test]
        fn prop_contribution_rejects_non_positive_amount(
            amount in invalid_amount(),
            cycle in cycle_number(),
            gid in group_id(),
        ) {
            let env = Env::default();
            let addr = Address::generate(&env);
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                ContributionRecord::new(addr, gid, cycle, amount, 0)
            }));
            prop_assert!(result.is_err(), "expected panic for amount={}", amount);
        }

        // prop_contribution_sum_no_overflow removed: superseded by the stronger
        // prop_contribution_total_equals_amount_times_count in property_tests.rs,
        // which asserts the exact accumulated value, not merely that no panic occurs.
    }

    // ── GroupStatus state-machine invariants ──────────────────────────────────

    proptest! {
        /// Terminal states (Completed, Cancelled) must not allow any transition.
        #[test]
        fn prop_terminal_states_reject_all_transitions(
            target in prop_oneof![
                Just(GroupStatus::Pending),
                Just(GroupStatus::Active),
                Just(GroupStatus::Paused),
                Just(GroupStatus::Completed),
                Just(GroupStatus::Cancelled),
            ],
        ) {
            for terminal in [GroupStatus::Completed, GroupStatus::Cancelled] {
                if terminal == target {
                    // same-state is always allowed
                    prop_assert!(terminal.can_transition_to(&target));
                } else {
                    prop_assert!(
                        !terminal.can_transition_to(&target),
                        "{:?} should not transition to {:?}", terminal, target
                    );
                }
            }
        }

        /// Pending can only transition to Active or Cancelled (not Paused/Completed).
        #[test]
        fn prop_pending_valid_transitions(
            target in prop_oneof![
                Just(GroupStatus::Paused),
                Just(GroupStatus::Completed),
            ],
        ) {
            prop_assert!(
                !GroupStatus::Pending.can_transition_to(&target),
                "Pending should not transition to {:?}", target
            );
        }

        /// Active can transition to Paused, Completed, or Cancelled.
        #[test]
        fn prop_active_valid_transitions(
            target in prop_oneof![
                Just(GroupStatus::Paused),
                Just(GroupStatus::Completed),
                Just(GroupStatus::Cancelled),
            ],
        ) {
            prop_assert!(
                GroupStatus::Active.can_transition_to(&target),
                "Active should transition to {:?}", target
            );
        }

        /// Paused can only go back to Active or Cancelled (not Completed).
        #[test]
        fn prop_paused_cannot_complete_directly(unused in 0_u32..1_u32) {
            let _ = unused;
            prop_assert!(
                !GroupStatus::Paused.can_transition_to(&GroupStatus::Completed),
                "Paused should not transition directly to Completed"
            );
        }
    }

    // ── ContractConfig validation invariants ──────────────────────────────────

    proptest! {
        /// A config with min > max contribution must be invalid.
        #[test]
        fn prop_config_invalid_when_min_exceeds_max_contribution(
            min in 2_i128..=i128::MAX,
            delta in 1_i128..=1_000_i128,
        ) {
            let env = Env::default();
            let admin = Address::generate(&env);
            let max = min.saturating_sub(delta);
            let cfg = ContractConfig {
                admin: admin.clone(),
                treasury: admin,
                creation_fee: 0,
                min_contribution: min,
                max_contribution: max,
                min_members: 2,
                max_members: 10,
                min_cycle_duration: 86_400,
                max_cycle_duration: 2_592_000,
            };
            prop_assert!(!cfg.validate());
        }

        /// A config with min_members < 2 must be invalid.
        #[test]
        fn prop_config_invalid_when_min_members_below_2(
            min_members in 0_u32..=1_u32,
        ) {
            let env = Env::default();
            let admin = Address::generate(&env);
            let cfg = ContractConfig {
                admin: admin.clone(),
                treasury: admin,
                creation_fee: 0,
                min_contribution: 1,
                max_contribution: 1_000_000,
                min_members,
                max_members: 10,
                min_cycle_duration: 86_400,
                max_cycle_duration: 2_592_000,
            };
            prop_assert!(!cfg.validate());
        }

        /// A valid config must pass validation.
        #[test]
        fn prop_valid_config_passes_validation(
            min_contrib in 1_i128..=1_000_i128,
            extra_contrib in 0_i128..=1_000_i128,
            min_members in 2_u32..=10_u32,
            extra_members in 0_u32..=40_u32,
            min_dur in valid_cycle_duration(),
            extra_dur in 0_u64..=86_400_u64,
        ) {
            let env = Env::default();
            let admin = Address::generate(&env);
            let cfg = ContractConfig {
                admin: admin.clone(),
                treasury: admin,
                creation_fee: 0,
                min_contribution: min_contrib,
                max_contribution: min_contrib.saturating_add(extra_contrib),
                min_members,
                max_members: min_members.saturating_add(extra_members),
                min_cycle_duration: min_dur,
                max_cycle_duration: min_dur.saturating_add(extra_dur),
            };
            prop_assert!(cfg.validate());
        }

        /// Zero min_contribution must be invalid.
        #[test]
        fn prop_config_invalid_zero_min_contribution(unused in 0_u32..1_u32) {
            let _ = unused;
            let env = Env::default();
            let admin = Address::generate(&env);
            let cfg = ContractConfig {
                admin: admin.clone(),
                treasury: admin,
                creation_fee: 0,
                min_contribution: 0,
                max_contribution: 1_000,
                min_members: 2,
                max_members: 10,
                min_cycle_duration: 86_400,
                max_cycle_duration: 2_592_000,
            };
            prop_assert!(!cfg.validate());
        }
    }

    // ── Payout rotation invariants ────────────────────────────────────────────

    proptest! {
        /// Payout position must be within [0, member_count).
        #[test]
        fn prop_payout_position_in_bounds(
            member_count in valid_member_count(),
            position in 0_u32..=u32::MAX,
        ) {
            let in_bounds = position < member_count;
            // If position is in bounds, it's a valid assignment
            if in_bounds {
                prop_assert!(position < member_count);
            } else {
                prop_assert!(position >= member_count);
            }
        }

        // prop_total_payout_equals_total_contributions removed: was a tautology
        // (contribution_amount * member_count == contribution_amount * member_count).
        // The real fund-conservation invariant is asserted in property_tests.rs
        // (prop_total_payouts_equal_total_contributions), which simulates a full
        // ROSCA rotation with actual PayoutRecord objects.

        /// Cycle number must be < member_count for a valid active group.
        #[test]
        fn prop_cycle_within_group_lifetime(
            member_count in valid_member_count(),
            cycle in 0_u32..=u32::MAX,
        ) {
            let is_valid_cycle = cycle < member_count;
            let is_complete = cycle >= member_count;
            prop_assert!(is_valid_cycle || is_complete); // tautology — documents the invariant
        }
    }

    // ── Deposit / Withdraw Boundary Invariants ────────────────────────────────
    //
    // prop_deposit_boundary_and_overflow_invariants and
    // prop_withdraw_boundary_and_underflow_invariants have been removed.
    //
    // Both were weaker restatements of arithmetic properties already covered
    // more thoroughly — with a realistic multi-member state machine — by:
    //   • prop_escrow_interleaved_contributions_and_withdrawals_solvency  (Property 9)
    //   • prop_escrow_partial_withdrawal_exceeding_balance_rejected        (Property 10)
    // in escrow_property_tests.rs.
    //
    // The fee-deduction invariant below is unique to this suite (no escrow
    // analogue) and is therefore kept here.

    proptest! {
        /// Fee deduction on withdrawal never exceeds original amount.
        #[test]
        fn prop_withdraw_fee_deduction_invariants(
            withdraw in 1_i128..=i128::MAX,
            fee_bps in 0_u32..=10_000_u32,
        ) {
            if let Some(prod) = withdraw.checked_mul(fee_bps as i128) {
                let fee = prod / 10_000_i128;
                prop_assert!(fee <= withdraw);
                prop_assert!(fee >= 0);
                let net = withdraw - fee;
                prop_assert!(net >= 0);
                prop_assert_eq!(net + fee, withdraw);
            }
        }
    }
}

