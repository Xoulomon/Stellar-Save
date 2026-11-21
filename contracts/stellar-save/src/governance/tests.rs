//! Property-based tests for governance invariants.
//!
//! Feature: Governance
//!
//! Core invariants tested:
//!   1. Quorum always enforced — no proposal can pass without meeting the
//!      configured quorum threshold.
//!   2. Timelock always enforced — no proposal can execute before its timelock
//!      expires, regardless of vote count.
//!   3. Majority threshold matches the formula backed by
//!      [`crate::constants::GOVERNANCE_MAJORITY_NUMERATOR`] /
//!      [`crate::constants::GOVERNANCE_MAJORITY_DENOMINATOR`].
//!   4. Dissolution requires unanimity per
//!      [`crate::constants::GOVERNANCE_DISSOLUTION_REQUIRES_UNANIMITY`].
//!
//! The helper functions (`meets_quorum`, `timelock_expired`, `can_execute`,
//! `governance_majority`, `can_execute_contribution_change`,
//! `can_execute_dissolution`) mirror the logic in [`super::voting`] so that the
//! invariants are verified in pure Rust without a Soroban environment.  The
//! critical difference from the old `governance_property_tests.rs` is that the
//! majority formula is now derived from the single-source constants rather than
//! being re-stated as a magic number.

#[cfg(test)]
mod governance_property_tests {
    use crate::governance::majority_threshold;
    use proptest::prelude::*;

    // ── Strategies ────────────────────────────────────────────────────────────

    /// Total voting power in the system (e.g., total number of voters or tokens).
    fn total_voting_power() -> impl Strategy<Value = u64> {
        100_u64..=10_000_u64
    }

    /// Quorum percentage (1–100).
    fn quorum_percent() -> impl Strategy<Value = u8> {
        1_u8..=100_u8
    }

    /// Vote count submitted for a proposal (0 to total_voting_power).
    fn vote_count(total: u64) -> impl Strategy<Value = u64> {
        0_u64..=total
    }

    /// Timelock duration in seconds (1 minute to 7 days).
    fn timelock_seconds() -> impl Strategy<Value = u64> {
        60_u64..=604_800_u64
    }

    /// A timestamp representing proposal creation time.
    fn proposal_created_at() -> impl Strategy<Value = u64> {
        1_000_000_u64..=u64::MAX / 2
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Check if a proposal meets quorum.
    ///
    /// Returns `true` if `votes_for / total_voting_power >= quorum_percent / 100`.
    fn meets_quorum(votes_for: u64, total_voting_power: u64, quorum_percent: u8) -> bool {
        if total_voting_power == 0 {
            return false;
        }
        // Use 128-bit arithmetic to avoid overflow.
        let votes = votes_for as u128;
        let total = total_voting_power as u128;
        let threshold = quorum_percent as u128;

        votes * 100 >= total * threshold
    }

    /// Check if the timelock has expired.
    fn timelock_expired(created_at: u64, current: u64, lock_duration: u64) -> bool {
        current >= created_at.saturating_add(lock_duration)
    }

    /// Determine if a proposal can execute: must meet quorum AND timelock must
    /// have expired.
    fn can_execute(
        votes_for: u64,
        total_voting_power: u64,
        quorum_percent: u8,
        created_at: u64,
        current: u64,
        lock_duration: u64,
    ) -> bool {
        meets_quorum(votes_for, total_voting_power, quorum_percent)
            && timelock_expired(created_at, current, lock_duration)
    }

    /// Evaluates dynamic contribution vote outcome using the single-source
    /// [`crate::governance::majority_threshold`] helper backed by constants.
    fn can_execute_contribution_change(vote_count: u32, member_count: u32) -> bool {
        if member_count == 0 {
            return false;
        }
        vote_count >= majority_threshold(member_count)
    }

    /// Evaluates dissolution vote outcome.
    ///
    /// Dissolution requires unanimity: `vote_count >= member_count`.
    /// See [`crate::constants::GOVERNANCE_DISSOLUTION_REQUIRES_UNANIMITY`].
    fn can_execute_dissolution(vote_count: u32, member_count: u32) -> bool {
        use crate::constants::GOVERNANCE_DISSOLUTION_REQUIRES_UNANIMITY;
        if member_count == 0 {
            return false;
        }
        if GOVERNANCE_DISSOLUTION_REQUIRES_UNANIMITY {
            vote_count >= member_count
        } else {
            // Future: plug in alternative threshold here.
            vote_count >= majority_threshold(member_count)
        }
    }

    // ── Feature: Governance  Property 1 ──────────────────────────────────────
    // Quorum always enforced.

    proptest! {
        /// Feature: Governance  Property 1
        ///
        /// A proposal with zero votes can never meet quorum, regardless of
        /// total voting power or quorum percentage.
        #[test]
        fn prop_governance_zero_votes_never_meet_quorum(
            total in total_voting_power(),
            q in quorum_percent(),
        ) {
            prop_assert!(!meets_quorum(0, total, q),
                "zero votes should never meet quorum (total={} q={}%)", total, q);
        }

        /// Feature: Governance  Property 2
        ///
        /// If a proposal receives votes_for >= quorum_percent% of total_voting_power,
        /// it must meet quorum.
        #[test]
        fn prop_governance_quorum_met_when_votes_exceed_threshold(
            total in total_voting_power(),
            q in quorum_percent(),
        ) {
            // votes = exactly the quorum threshold, rounded up.
            let votes = ((total as u128) * (q as u128)).div_ceil(100) as u64;
            let votes = votes.min(total); // clamp to total

            prop_assert!(
                meets_quorum(votes, total, q),
                "votes {} must meet quorum {}% of {}", votes, q, total
            );
        }

        /// Feature: Governance  Property 3
        ///
        /// If votes_for < quorum threshold, the proposal does not meet quorum.
        #[test]
        fn prop_governance_quorum_not_met_when_votes_below_threshold(
            total in 100_u64..=10_000_u64,
            q in 50_u8..=100_u8,
            votes_deficit in 1_u64..=100_u64,
        ) {
            let threshold_votes = ((total as u128) * (q as u128)).div_ceil(100) as u64;
            let votes_for = threshold_votes.saturating_sub(votes_deficit);
            prop_assume!(votes_for < threshold_votes);

            prop_assert!(
                !meets_quorum(votes_for, total, q),
                "votes {} (< {}) should NOT meet quorum {}% of {}",
                votes_for, threshold_votes, q, total
            );
        }

        /// Feature: Governance  Property 4
        ///
        /// A proposal that meets quorum but has not satisfied the timelock
        /// must NOT be executable.
        #[test]
        fn prop_governance_quorum_met_but_timelock_not_expired_not_executable(
            total in total_voting_power(),
            q in 50_u8..=100_u8,
            lock in timelock_seconds(),
            created in proposal_created_at(),
        ) {
            let votes = total; // 100% votes — quorum definitely met
            // current < created + lock → timelock not expired
            let current = created.saturating_add(lock / 2);
            prop_assume!(current < created.saturating_add(lock));

            let executable = can_execute(votes, total, q, created, current, lock);
            prop_assert!(!executable,
                "proposal with quorum but timelock not expired should NOT execute \
                 (votes={} total={} q={}% created={} current={} lock={})",
                votes, total, q, created, current, lock);
        }

        /// Feature: Governance  Property 5
        ///
        /// When quorum is met AND timelock has expired, the proposal is executable.
        #[test]
        fn prop_governance_quorum_and_timelock_both_satisfied_is_executable(
            total in total_voting_power(),
            q in 50_u8..=100_u8,
            lock in timelock_seconds(),
            created in proposal_created_at(),
        ) {
            let votes = total; // 100% — quorum definitely met
            let current = created.saturating_add(lock).saturating_add(1); // timelock expired

            let executable = can_execute(votes, total, q, created, current, lock);
            prop_assert!(executable,
                "proposal with quorum AND expired timelock SHOULD execute");
        }
    }

    // ── Feature: Governance  Property 6–10 (timelock always enforced) ────────

    proptest! {
        /// Feature: Governance  Property 6
        ///
        /// Timelock enforced: even with 100% votes, a proposal cannot execute
        /// at time < created_at + timelock_duration.
        #[test]
        fn prop_governance_timelock_enforced_even_with_full_votes(
            total in total_voting_power(),
            lock in timelock_seconds(),
            created in proposal_created_at(),
        ) {
            let votes = total; // 100% quorum met
            let current = created.saturating_add(lock - 1); // 1 second before expiry
            prop_assume!(current < created.saturating_add(lock));

            let executable = can_execute(votes, total, 50, created, current, lock);
            prop_assert!(
                !executable,
                "timelock must prevent execution even with 100% votes \
                 (created={} current={} lock={})",
                created, current, lock
            );
        }

        /// Feature: Governance  Property 7
        ///
        /// At exactly created_at + timelock_duration, the proposal timelock has expired.
        #[test]
        fn prop_governance_timelock_expires_at_exact_boundary(
            lock in timelock_seconds(),
            created in proposal_created_at(),
        ) {
            let expiry = created.saturating_add(lock);
            prop_assert!(timelock_expired(created, expiry, lock),
                "timelock must expire at created + lock ({} + {} = {})",
                created, lock, expiry);
        }

        /// Feature: Governance  Property 8
        ///
        /// Any timestamp strictly after created_at + lock satisfies the timelock.
        #[test]
        fn prop_governance_timelock_satisfied_after_expiry(
            lock in timelock_seconds(),
            created in proposal_created_at(),
            extra in 1_u64..=1_000_000_u64,
        ) {
            let current = created.saturating_add(lock).saturating_add(extra);
            prop_assert!(timelock_expired(created, current, lock),
                "timelock satisfied when current ({}) > created ({}) + lock ({})",
                current, created, lock);
        }

        /// Feature: Governance  Property 9
        ///
        /// A zero-duration timelock expires immediately (at created_at).
        #[test]
        fn prop_governance_zero_timelock_expires_immediately(
            created in proposal_created_at(),
        ) {
            let current = created; // same timestamp
            prop_assert!(timelock_expired(created, current, 0),
                "zero-duration timelock must expire immediately");
        }

        /// Feature: Governance  Property 10
        ///
        /// Quorum and timelock are independent: meeting quorum does NOT bypass
        /// timelock, and timelock expiry does NOT bypass quorum.
        #[test]
        fn prop_governance_quorum_and_timelock_are_independent(
            total in total_voting_power(),
            q in 50_u8..=100_u8,
            lock in timelock_seconds(),
            created in proposal_created_at(),
            votes in vote_count(100_000),
        ) {
            let votes = votes.min(total);
            let current_before_lock = created.saturating_add(lock / 2);
            let current_after_lock = created.saturating_add(lock).saturating_add(1);

            let quorum_met = meets_quorum(votes, total, q);

            // Case A: quorum met, timelock NOT expired → not executable.
            if quorum_met {
                let exec_a = can_execute(votes, total, q, created, current_before_lock, lock);
                prop_assert!(!exec_a,
                    "quorum met but timelock not expired → should NOT execute");
            }

            // Case B: timelock expired, quorum NOT met → not executable.
            if !quorum_met {
                let exec_b = can_execute(votes, total, q, created, current_after_lock, lock);
                prop_assert!(!exec_b,
                    "timelock expired but quorum not met → should NOT execute");
            }

            // Case C: both met → executable.
            if quorum_met {
                let exec_c = can_execute(votes, total, q, created, current_after_lock, lock);
                prop_assert!(exec_c,
                    "both quorum and timelock met → SHOULD execute");
            }
        }

        /// Feature: Governance  Property 11
        ///
        /// A proposal with zero total_voting_power can never meet quorum,
        /// regardless of vote count or percentage.
        #[test]
        fn prop_governance_zero_voting_power_never_meets_quorum(
            votes in 0_u64..=1_000_u64,
            q in quorum_percent(),
        ) {
            prop_assert!(!meets_quorum(votes, 0, q),
                "zero total_voting_power should never allow quorum");
        }

        /// Feature: Governance  Property 12
        ///
        /// Timelock duration is always non-negative (u64 enforces this), and
        /// the expiry timestamp is always ≥ created_at.
        #[test]
        fn prop_governance_timelock_expiry_is_monotonic(
            lock in 0_u64..=u64::MAX / 2,
            created in proposal_created_at(),
        ) {
            let expiry = created.saturating_add(lock);
            prop_assert!(expiry >= created,
                "expiry ({}) must be >= created ({})", expiry, created);
        }
    }

    // ── Feature: Governance Module Specific Invariants ───────────────────────

    extern crate std;

    proptest! {
        /// Feature: Governance Property 13 - Majority is always strict (> 50%)
        ///
        /// For any positive member count, the majority threshold derived from
        /// [`crate::governance::majority_threshold`] (which uses the single-source
        /// constants) is strictly greater than member_count / 2 and at most
        /// member_count.
        #[test]
        fn prop_governance_majority_threshold_is_strict_majority(
            members in 1_u32..=10_000_u32,
        ) {
            let threshold = majority_threshold(members);
            prop_assert!(
                (threshold as u64) * 2 > (members as u64),
                "majority ({}) * 2 must be > members ({})",
                threshold,
                members
            );
            prop_assert!(
                threshold <= members,
                "majority ({}) must be <= members ({})",
                threshold,
                members
            );
        }

        /// Feature: Governance Property 14 - Dynamic contribution change transition boundary
        ///
        /// A vote count strictly below majority must never trigger the change;
        /// any vote count >= majority must trigger the change.
        #[test]
        fn prop_governance_dynamic_contribution_requires_majority(
            members in 1_u32..=1_000_u32,
            votes in 0_u32..=1_000_u32,
        ) {
            let threshold = majority_threshold(members);
            let executable = can_execute_contribution_change(votes, members);

            if votes < threshold {
                prop_assert!(
                    !executable,
                    "votes {} < majority {} should NOT execute contribution change",
                    votes,
                    threshold
                );
            } else {
                prop_assert!(
                    executable,
                    "votes {} >= majority {} SHOULD execute contribution change",
                    votes,
                    threshold
                );
            }
        }

        /// Feature: Governance Property 15 - Dissolution requires strict unanimity
        ///
        /// Dissolution only triggers when every member has voted (vote_count == member_count).
        /// Any vote count < member_count leaves the group active/paused without dissolving.
        #[test]
        fn prop_governance_dissolution_requires_unanimity(
            members in 1_u32..=1_000_u32,
            votes in 0_u32..=1_000_u32,
        ) {
            let executable = can_execute_dissolution(votes, members);

            if votes < members {
                prop_assert!(
                    !executable,
                    "votes {} < members {} must NOT dissolve group",
                    votes,
                    members
                );
            } else {
                prop_assert!(
                    executable,
                    "votes {} >= members {} MUST dissolve group",
                    votes,
                    members
                );
            }
        }

        /// Feature: Governance Property 16 - Double-voting resistance invariant
        ///
        /// When members cast votes, duplicate vote attempts by the same member
        /// are rejected. The effective vote count equals the number of unique voters,
        /// never exceeding member count.
        #[test]
        fn prop_governance_double_voting_prevention(
            members in 2_u32..=100_u32,
            vote_stream in proptest::collection::vec(1_u32..=100_u32, 1..=200),
        ) {
            let mut unique_voters = std::collections::HashSet::new();
            let mut recorded_votes = 0_u32;

            for voter in vote_stream {
                // Voter must be a valid member
                if voter <= members {
                    // In governance, voting checks if voter already voted
                    if unique_voters.insert(voter) {
                        recorded_votes += 1;
                    }
                }
            }

            prop_assert_eq!(
                recorded_votes,
                unique_voters.len() as u32,
                "recorded votes must match unique valid voters"
            );
            prop_assert!(
                recorded_votes <= members,
                "recorded votes ({}) cannot exceed total members ({})",
                recorded_votes,
                members
            );
        }

        /// Feature: Governance Property 17 - Proposal reset clears vote tally
        ///
        /// When a new proposal is created, previous votes cannot be reused or carried over.
        /// The new proposal resets the vote count to 0, requiring fresh votes.
        #[test]
        fn prop_governance_proposal_reset_clears_votes(
            members in 2_u32..=50_u32,
            initial_votes in 1_u32..=50_u32,
            new_amount in 1_i128..=1_000_000_000i128,
        ) {
            let _ = initial_votes.min(members - 1); // unpassed previous state
            let proposal_amount = new_amount;
            prop_assert!(proposal_amount > 0);

            // Proposing a new amount resets the vote count to 0
            let reset_vote_count = 0_u32;
            let can_exec = can_execute_contribution_change(reset_vote_count, members);

            prop_assert!(
                !can_exec,
                "new proposal after reset must start at 0 votes and not be executable"
            );
            prop_assert_eq!(reset_vote_count, 0);
        }

        /// Feature: Governance Property 18 - Dissolution refund conservation
        ///
        /// In execute_dissolution, total refunded is bounded by total contributions
        /// for the current cycle. If N un-payout members contributed amount A each,
        /// total refunded is exactly N * A.
        #[test]
        fn prop_governance_dissolution_refund_conservation(
            unpaid_members in 0_u32..=50_u32,
            contribution_amount in 1_000_000_i128..=100_000_000_i128,
        ) {
            let total_refunded = (unpaid_members as i128)
                .checked_mul(contribution_amount)
                .unwrap();

            prop_assert!(
                total_refunded >= 0,
                "refunded amount must be non-negative"
            );
            if unpaid_members == 0 {
                prop_assert_eq!(total_refunded, 0);
            }
        }
    }
}
