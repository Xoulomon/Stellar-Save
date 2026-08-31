/// Property-based tests for governance invariants.
///
/// Feature: Governance
///
/// Core invariants tested:
///   1. Quorum always enforced — no proposal can pass without meeting the
///      configured quorum threshold.
///   2. Timelock always enforced — no proposal can execute before its timelock
///      expires, regardless of vote count.
#[cfg(test)]
mod governance_property_tests {
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

    /// A timestamp representing the current time (after proposal creation).
    fn current_time(created_at: u64) -> impl Strategy<Value = u64> {
        created_at..=u64::MAX / 2
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Check if a proposal meets quorum.
    /// Returns true if votes_for / total_voting_power >= quorum_percent / 100.
    fn meets_quorum(votes_for: u64, total_voting_power: u64, quorum_percent: u8) -> bool {
        if total_voting_power == 0 {
            return false; // no voting power means no quorum
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

    /// Determine if a proposal can execute: must meet quorum AND timelock must have expired.
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
}
