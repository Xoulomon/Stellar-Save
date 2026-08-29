//! Contract Constants
//!
//! Single source of truth for all business-rule numeric constants used
//! throughout the Stellar-Save smart contract.
//!
//! # Grouping
//! - [Group Membership Limits]
//! - [Contribution Amount Limits]
//! - [Cycle / Timing Limits]
//! - [Pagination Limits]
//! - [Penalty System Constants]
//! - [Rounding Precision]
//!
//! # Cross-references
//! - `zk/CIRCUIT_AUDIT.md` item ZK-007: circuit constants must align with values here.
//! - `docs/admin-actions.md`: admin-settable limits use these as defaults.

// ─── Group Membership Limits ─────────────────────────────────────────────────

/// Absolute protocol-level cap on group members.
///
/// No group may have more members than this, regardless of the per-instance
/// `ContractConfig.max_members` setting.
/// Unit: count
/// Valid range: 2..=MAX_MEMBERS
pub const MAX_MEMBERS: u32 = 20;

/// Minimum number of members required to activate a group.
///
/// A `create_group` call or config with `min_members < MIN_MEMBERS_FLOOR`
/// is rejected.
/// Unit: count
pub const MIN_MEMBERS_FLOOR: u32 = 2;

// ─── Contribution Amount Limits ───────────────────────────────────────────────

/// Rounding precision for contribution amounts (0.01 XLM = 10^5 stroops).
///
/// All contribution amounts are rounded to the nearest multiple of this value
/// to prevent precision issues with very small sub-stroop amounts.
/// Unit: stroops (1 XLM = 10,000,000 stroops)
pub const CONTRIBUTION_ROUNDING_PRECISION: i128 = 100_000;

/// Default minimum contribution per cycle across all groups.
///
/// Groups with a contribution amount below this are rejected unless the
/// `ContractConfig.min_contribution` override is lower.
/// Unit: stroops
pub const DEFAULT_MIN_CONTRIBUTION: i128 = 1_000_000; // 0.1 XLM

/// Default maximum contribution per cycle across all groups.
///
/// Unit: stroops
pub const DEFAULT_MAX_CONTRIBUTION: i128 = 1_000_000_000_000; // 100,000 XLM

// ─── Cycle / Timing Limits ────────────────────────────────────────────────────

/// Default minimum cycle duration allowed in contract configuration.
///
/// Unit: seconds
pub const DEFAULT_MIN_CYCLE_DURATION: u64 = 86_400; // 1 day

/// Default maximum cycle duration allowed in contract configuration.
///
/// Unit: seconds
pub const DEFAULT_MAX_CYCLE_DURATION: u64 = 2_592_000; // 30 days

/// One week in seconds — used as a common cycle duration and deadline
/// extension unit.
///
/// Unit: seconds
pub const ONE_WEEK_SECONDS: u64 = 604_800;

/// One day in seconds.
///
/// Unit: seconds
pub const ONE_DAY_SECONDS: u64 = 86_400;

/// Maximum deadline extension per single `extend_deadline` call.
///
/// Prevents a creator from extending a deadline by an unreasonably large
/// amount in one transaction.
/// Unit: seconds
pub const MAX_DEADLINE_EXTENSION_SECONDS: u64 = ONE_WEEK_SECONDS; // 7 days = 604,800 s

/// Number of inactive cycles before an `emergency_withdraw` is allowed.
///
/// A member may only emergency-withdraw after the group has been inactive for
/// at least this many cycle durations.
/// Unit: cycle count (multiplied by cycle_duration to get seconds)
pub const EMERGENCY_WITHDRAW_INACTIVE_CYCLES: u64 = 2;

// ─── Pagination Limits ────────────────────────────────────────────────────────

/// Maximum number of members returned per `get_group_members` page.
///
/// Hard cap for gas safety: no single call may return more than this many
/// member addresses.
/// Unit: count
pub const MAX_MEMBERS_PER_PAGE: u32 = 100;

/// Maximum number of contribution/payout history records returned per page.
///
/// Used by `get_member_contribution_history`, `get_payout_history`, and
/// similar list endpoints.
/// Unit: count
pub const MAX_HISTORY_PER_PAGE: u32 = 50;

/// Maximum number of groups returned per `list_groups` page.
///
/// Unit: count
pub const MAX_GROUPS_PER_PAGE: u32 = 50;

/// Maximum number of search results returned per query.
///
/// Unit: count
pub const MAX_SEARCH_RESULTS: u32 = 50;

// ─── Penalty System Constants ────────────────────────────────────────────────

/// Base penalty rate per missed contribution cycle (5%).
///
/// Expressed in basis points (1 bp = 0.01%). 500 bp = 5%.
/// Unit: basis points
pub const PENALTY_BASE_BPS: u32 = 500;

/// Additional penalty rate applied per each extra missed cycle beyond the first.
///
/// Unit: basis points
pub const PENALTY_INCREMENT_BPS: u32 = 500;

/// Maximum total penalty rate (25%), regardless of number of missed cycles.
///
/// Unit: basis points
pub const PENALTY_MAX_BPS: u32 = 2_500;

/// Recovery fee charged on top of the missed contribution when a member
/// recovers from a penalty (10%).
///
/// Unit: basis points
pub const PENALTY_RECOVERY_FEE_BPS: u32 = 1_000;

// ─── Dispute / Governance Thresholds ─────────────────────────────────────────

/// Fraction of members that must raise a dispute to trigger auto-pause.
///
/// When more than this percentage of members have an open dispute, the group
/// is automatically paused.
/// Unit: percentage (0-100)
pub const AUTO_PAUSE_DISPUTE_THRESHOLD_PCT: u32 = 50;

// ─── Contribution History ─────────────────────────────────────────────────────

/// Maximum number of contribution history entries returned per page in the
/// `get_member_contribution_history` call.
///
/// Unit: count
pub const MAX_CONTRIBUTION_HISTORY_PER_PAGE: u32 = 50;

// ─── Storage TTL / Rent-bump Constants (Issue #75) ───────────────────────────

/// Minimum number of ledgers an entry must remain live before a TTL bump is
/// triggered.  Set to ~30 days at ~5 s per ledger.
///
/// Unit: ledgers
pub const TTL_THRESHOLD_LEDGERS: u32 = 518_400; // 30 days

/// Target TTL (live_until_ledger_seq extension) for critical persistent entries
/// after a bump.  Set to ~365 days at ~5 s per ledger.
///
/// Unit: ledgers
pub const TTL_EXTEND_TO_LEDGERS: u32 = 6_307_200; // 365 days

#[cfg(test)]
mod tests {
    use super::*;

    /// Verifies constant values match expected business rules.
    #[test]
    fn test_penalty_constants_match_business_rules() {
        // 5% base penalty
        assert_eq!(PENALTY_BASE_BPS, 500, "Base penalty must be 5%");
        // 5% increment
        assert_eq!(PENALTY_INCREMENT_BPS, 500, "Increment must be 5%");
        // 25% max cap
        assert_eq!(PENALTY_MAX_BPS, 2_500, "Max penalty must be 25%");
        // 10% recovery fee
        assert_eq!(PENALTY_RECOVERY_FEE_BPS, 1_000, "Recovery fee must be 10%");
    }

    #[test]
    fn test_member_limits_are_consistent() {
        assert!(MIN_MEMBERS_FLOOR >= 2, "Min members must be at least 2");
        assert!(
            MAX_MEMBERS >= MIN_MEMBERS_FLOOR,
            "Max must be >= min members floor"
        );
    }

    #[test]
    fn test_contribution_limits_are_consistent() {
        assert!(
            DEFAULT_MIN_CONTRIBUTION > 0,
            "Min contribution must be positive"
        );
        assert!(
            DEFAULT_MAX_CONTRIBUTION >= DEFAULT_MIN_CONTRIBUTION,
            "Max contribution must be >= min"
        );
    }

    #[test]
    fn test_cycle_duration_limits_are_consistent() {
        assert!(
            DEFAULT_MIN_CYCLE_DURATION > 0,
            "Min cycle duration must be positive"
        );
        assert!(
            DEFAULT_MAX_CYCLE_DURATION >= DEFAULT_MIN_CYCLE_DURATION,
            "Max cycle duration must be >= min"
        );
        assert_eq!(
            ONE_DAY_SECONDS, 86_400,
            "One day must be 86400 seconds"
        );
        assert_eq!(
            ONE_WEEK_SECONDS, 604_800,
            "One week must be 604800 seconds"
        );
    }

    #[test]
    fn test_pagination_limits_are_sane() {
        assert!(MAX_MEMBERS_PER_PAGE > 0);
        assert!(MAX_HISTORY_PER_PAGE > 0);
        assert!(MAX_GROUPS_PER_PAGE > 0);
        assert!(MAX_SEARCH_RESULTS > 0);
        // Members-per-page must not exceed the protocol member cap
        assert!(
            MAX_MEMBERS_PER_PAGE >= MAX_MEMBERS,
            "Members per page must accommodate a full group"
        );
    }

    #[test]
    fn test_rounding_precision_is_standard_xlm_unit() {
        // 0.01 XLM = 100,000 stroops
        assert_eq!(
            CONTRIBUTION_ROUNDING_PRECISION, 100_000,
            "Rounding precision must be 0.01 XLM"
        );
    }

    #[test]
    fn test_deadline_extension_max_is_one_week() {
        assert_eq!(
            MAX_DEADLINE_EXTENSION_SECONDS,
            ONE_WEEK_SECONDS,
            "Max deadline extension must be 7 days"
        );
    }
}
