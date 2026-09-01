use soroban_sdk::{contracttype, Address};

/// Current storage schema version for migration compatibility.
///
/// This version number should be incremented whenever breaking changes
/// are made to the storage layout that require data migration.
///
/// Deliberately left at 2 by the key-encoding change in Issue #1517: that change
/// alters how keys are *encoded*, not which values are stored, and it ships no
/// re-key migration. Bumping the version here without a `migrate_v2_to_v3`
/// handler would mark an already-deployed instance as migrated while its entries
/// remain under the old nested encoding and therefore unreachable. Deploying
/// this encoding over live data requires a re-key migration first; see
/// `STORAGE_KEY_ENCODING.md`.
pub const STORAGE_VERSION: u32 = 2;

/// Storage key structure for efficient data access in the Stellar-Save contract.
///
/// This module defines a consistent key naming convention for all contract data,
/// enabling efficient storage and retrieval operations. Keys are designed to:
/// - Provide fast lookups for specific data types
/// - Support range queries where needed
/// - Maintain clear separation between different data categories
/// - Enable efficient iteration over related records
///
/// # Key encoding (Issue #1517)
///
/// Keys were previously a two-level enum - `StorageKey::Group(GroupKey::Data(id))`
/// - which the host encodes as a `Vec` holding a discriminant symbol and a nested
/// `Vec` holding a second discriminant symbol plus the payload. That is two
/// symbols, two vectors and one extra indirection for every entry the contract
/// owns.
///
/// The enum is now flat: one discriminant symbol plus the payload, in a single
/// vector. Every variant name is also nine characters or shorter, which is the
/// threshold below which the host packs a `Symbol` into an immediate 64-bit
/// value instead of allocating a separate object for it. Measurements are in
/// `STORAGE_KEY_ENCODING.md`.
///
/// All construction goes through [`StorageKeyBuilder`], so the encoding is an
/// implementation detail: no call site names a variant directly.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum StorageKey {
    // ── Group data ───────────────────────────────────────────────────────────
    /// Complete `Group` struct for a group id.
    Grp(u64),

    /// Member address list, for efficient member enumeration.
    GrpMbrs(u64),

    /// Randomized payout order, as a vector of addresses.
    GrpSeq(u64),

    /// Current `GroupStatus`, for quick status checks.
    GrpStat(u64),

    /// `TokenConfig` (token address + cached decimals) for a group.
    GrpTok(u64),

    /// Free-text reason recorded when a dispute is raised.
    GrpDspR(u64),

    /// The two source group ids that were merged to create this group.
    GrpMrgF(u64),

    /// `Vec<Address>` of addresses invited to join this group.
    GrpInv(u64),

    /// Payout position reverse index: `(group_id, position) → Address`.
    ///
    /// Gas opt: written once at join/assign time, read once per payout cycle.
    /// Replaces the O(n) member-list scan in `identify_recipient` with a single
    /// O(1) SLOAD.
    GrpPosIx(u64, u32),

    /// Whether the group has been archived by its creator.
    ///
    /// Archived groups are excluded from `list_groups()` by default and are only
    /// visible via `list_archived_groups()`.
    GrpArch(u64),

    /// `RatingEntry` submitted by a specific member for this group.
    GrpRate(u64, Address),

    /// Running `RatingAggregate` (total stars + rating count) for a group.
    GrpRateA(u64),

    /// Whether a specific member has raised a dispute.
    GrpDspV(u64, Address),

    /// Member bid amount for the `Bid` payout order, per cycle.
    GrpBid(u64, u32, Address),

    // ── Member data ──────────────────────────────────────────────────────────
    /// Member profile: join date and contribution history.
    MbrProf(u64, Address),

    /// Whether the member has contributed in the current cycle.
    MbrCStat(u64, Address),

    /// Payout turn order and eligibility status.
    MbrPElig(u64, Address),

    /// Total amount contributed by the member across all cycles.
    MbrTotC(u64, Address),

    /// Whether the member has claimed their completion reward.
    MbrRwdC(u64, Address),

    /// Cumulative penalty charged to a member for missed contributions.
    MbrPen(u64, Address),

    /// Current and best consecutive-contribution streak for a member.
    MbrStrk(u64, Address),

    /// Whether the member opted in to automatic contributions at cycle start.
    MbrAuto(u64, Address),

    /// Referrer address for a given invitee within a group.
    MbrRef(u64, Address),

    // ── Contribution tracking ────────────────────────────────────────────────
    /// Contribution amount and timestamp for a member in a cycle.
    Contrib(u64, u32, Address),

    /// Total amount contributed in a cycle, for quick validation.
    CycTotal(u64, u32),

    /// Number of members who have contributed in a cycle.
    CycCount(u64, u32),

    /// Whether a member's contribution proof was verified for a cycle.
    CProof(u64, u32, Address),

    /// Whether a contribution-due reminder was emitted for a member.
    CRemind(u64, u32, Address),

    /// Proposed new contribution amount awaiting approval.
    CPendAmt(u64),

    /// How many members have voted to approve the pending amount change.
    CAmtVote(u64),

    /// Whether a member has voted on the pending amount change.
    CMbrVote(u64, Address),

    /// How many members have voted to dissolve the group.
    CDisCnt(u64),

    /// Whether a member has voted to dissolve the group.
    CDisVote(u64, Address),

    // ── Refunds ──────────────────────────────────────────────────────────────
    /// `RefundRecord` for a member's contribution in a cycle.
    Refund(u64, u32, Address),

    // ── Payouts ──────────────────────────────────────────────────────────────
    /// Complete `PayoutRecord` for a group cycle.
    Payout(u64, u32),

    /// Recipient address, for quick lookup of who was paid in a cycle.
    PayRecip(u64, u32),

    /// Whether the payout has been processed for the cycle.
    PayStat(u64, u32),

    // ── Counters and global metadata ─────────────────────────────────────────
    /// Next available group id.
    CntNextG,

    /// Total number of groups ever created.
    CntTotG,

    /// Number of currently active groups.
    CntActG,

    /// Global member count across all groups.
    CntTotM,

    /// Contract version, for upgrade compatibility.
    CntVer,

    /// Global contract configuration.
    Config,

    /// Reentrancy protection flag for transfer operations.
    Guard,

    /// Incrementally tracked current balance for a group.
    GrpBal(u64),

    /// Incrementally tracked total amount paid out for a group.
    GrpPaid(u64),

    /// Whether the contract is paused by the admin.
    EmrgPause,

    /// Current storage schema version, for migration compatibility.
    StoreVer,

    /// Optional admin-managed allowlist of permitted token addresses.
    AlwdToks,

    /// Total extension in seconds applied to a cycle's contribution deadline.
    DlExt(u64, u32),

    /// Number of members who have raised a dispute, avoiding O(n) member scans.
    DspCount(u64),

    // ── Per-user tracking ────────────────────────────────────────────────────
    /// Ledger timestamp of a user's last group creation.
    UsrLastC(Address),

    /// Ledger timestamp of a user's last group join.
    UsrLastJ(Address),

    /// All group ids a user is a member of.
    UsrGrps(Address),
}

/// Utility functions for creating storage keys with consistent formatting.
///
/// These functions provide a clean API for generating storage keys without
/// requiring direct enum construction throughout the contract code. They are the
/// only supported way to build a key: the variant names above are free to change
/// as long as these signatures do not.
pub struct StorageKeyBuilder;

impl StorageKeyBuilder {
    // Group key builders

    /// Creates a key for storing group data.
    pub fn group_data(group_id: u64) -> StorageKey {
        StorageKey::Grp(group_id)
    }

    /// Creates a key for storing group member list.
    pub fn group_members(group_id: u64) -> StorageKey {
        StorageKey::GrpMbrs(group_id)
    }

    /// Creates a key for storing the randomized payout order sequence.
    pub fn payout_sequence(group_id: u64) -> StorageKey {
        StorageKey::GrpSeq(group_id)
    }

    /// Creates a key for storing group status.
    pub fn group_status(group_id: u64) -> StorageKey {
        StorageKey::GrpStat(group_id)
    }

    pub fn group_dispute_reason(group_id: u64) -> StorageKey {
        StorageKey::GrpDspR(group_id)
    }

    /// Creates a key for storing the source group IDs of a merged group.
    pub fn group_merged_from(group_id: u64) -> StorageKey {
        StorageKey::GrpMrgF(group_id)
    }

    /// Creates a key for the invitation list of a group.
    pub fn group_invitations(group_id: u64) -> StorageKey {
        StorageKey::GrpInv(group_id)
    }

    /// Creates a key for the payout-position reverse index.
    ///
    /// Gas opt: maps `(group_id, position) → Address` so `identify_recipient`
    /// can do a single O(1) SLOAD instead of iterating all members.
    pub fn group_payout_position_index(group_id: u64, position: u32) -> StorageKey {
        StorageKey::GrpPosIx(group_id, position)
    }

    /// Creates a key for the archived flag of a group.
    ///
    /// Stores a `bool` indicating whether the group has been archived.
    /// Archived groups are hidden from `list_groups()` by default.
    pub fn group_archived(group_id: u64) -> StorageKey {
        StorageKey::GrpArch(group_id)
    }

    /// Creates a key for a member's bid amount in a specific cycle.
    ///
    /// Used by the `Bid` payout order: stores the i128 bid submitted by
    /// `member` for `cycle` in `group_id`.
    pub fn group_bid_amount(group_id: u64, cycle: u32, member: Address) -> StorageKey {
        StorageKey::GrpBid(group_id, cycle, member)
    }

    /// Creates a key for a member's individual rating of a group.
    pub fn group_rating(group_id: u64, member: Address) -> StorageKey {
        StorageKey::GrpRate(group_id, member)
    }

    /// Creates a key for the rating aggregate of a group.
    pub fn group_rating_aggregate(group_id: u64) -> StorageKey {
        StorageKey::GrpRateA(group_id)
    }

    /// Creates a key for a member's dispute vote.
    pub fn group_dispute_vote(group_id: u64, member: Address) -> StorageKey {
        StorageKey::GrpDspV(group_id, member)
    }

    // Member key builders

    /// Creates a key for storing member profile data.
    pub fn member_profile(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrProf(group_id, address)
    }

    /// Creates a key for tracking member contribution status.
    pub fn member_contribution_status(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrCStat(group_id, address)
    }

    /// Creates a key for member payout eligibility.
    pub fn member_payout_eligibility(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrPElig(group_id, address)
    }

    /// Creates a key for member total contributions.
    pub fn member_total_contributions(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrTotC(group_id, address)
    }

    /// Creates a key for tracking whether a member has claimed their completion reward.
    pub fn member_reward_claimed(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrRwdC(group_id, address)
    }

    /// Creates a key for member cumulative penalty total.
    pub fn member_penalty_total(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrPen(group_id, address)
    }

    /// Creates a key for member contribution streak.
    pub fn member_streak(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrStrk(group_id, address)
    }

    /// Creates a key for member auto-contribution enabled flag.
    pub fn member_auto_contribute(group_id: u64, address: Address) -> StorageKey {
        StorageKey::MbrAuto(group_id, address)
    }

    /// Creates a key for storing the referrer of a member within a group.
    pub fn member_referral(group_id: u64, invitee: Address) -> StorageKey {
        StorageKey::MbrRef(group_id, invitee)
    }

    // Contribution key builders

    /// Creates a key for individual contribution records.
    pub fn contribution_individual(group_id: u64, cycle: u32, address: Address) -> StorageKey {
        StorageKey::Contrib(group_id, cycle, address)
    }

    /// Creates a key for cycle total contributions.
    pub fn contribution_cycle_total(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::CycTotal(group_id, cycle)
    }

    /// Creates a key for cycle contributor count.
    pub fn contribution_cycle_count(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::CycCount(group_id, cycle)
    }

    /// Creates a key for tracking whether a member's proof was verified for a cycle.
    pub fn contribution_proof_verified(group_id: u64, cycle: u32, address: Address) -> StorageKey {
        StorageKey::CProof(group_id, cycle, address)
    }

    /// Creates a key for tracking whether a contribution reminder was emitted for a member.
    pub fn contribution_reminder_emitted(
        group_id: u64,
        cycle: u32,
        address: Address,
    ) -> StorageKey {
        StorageKey::CRemind(group_id, cycle, address)
    }

    /// Creates a key for a pending contribution amount change proposal.
    pub fn contribution_pending_amount(group_id: u64) -> StorageKey {
        StorageKey::CPendAmt(group_id)
    }

    /// Creates a key for the vote count on a pending amount change.
    pub fn contribution_amount_vote_count(group_id: u64) -> StorageKey {
        StorageKey::CAmtVote(group_id)
    }

    /// Creates a key for tracking whether a member has voted on the pending amount change.
    pub fn contribution_member_vote(group_id: u64, address: Address) -> StorageKey {
        StorageKey::CMbrVote(group_id, address)
    }

    /// Creates a key for the dissolution vote count of a group.
    pub fn dissolve_vote_count(group_id: u64) -> StorageKey {
        StorageKey::CDisCnt(group_id)
    }

    /// Creates a key for tracking whether a member has voted to dissolve the group.
    pub fn dissolve_vote(group_id: u64, address: Address) -> StorageKey {
        StorageKey::CDisVote(group_id, address)
    }

    // Payout key builders

    /// Creates a key for refund records.
    pub fn refund_record(group_id: u64, cycle: u32, address: Address) -> StorageKey {
        StorageKey::Refund(group_id, cycle, address)
    }

    /// Creates a key for payout records.
    pub fn payout_record(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::Payout(group_id, cycle)
    }

    /// Creates a key for payout recipient lookup.
    pub fn payout_recipient(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::PayRecip(group_id, cycle)
    }

    /// Creates a key for payout status tracking.
    pub fn payout_status(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::PayStat(group_id, cycle)
    }

    // Counter key builders

    /// Creates a key for the next group ID counter.
    pub fn next_group_id() -> StorageKey {
        StorageKey::CntNextG
    }

    /// Creates a key for total groups counter.
    pub fn total_groups() -> StorageKey {
        StorageKey::CntTotG
    }

    /// Creates a key for active groups counter.
    pub fn active_groups() -> StorageKey {
        StorageKey::CntActG
    }

    /// Creates a key for total members counter.
    pub fn total_members() -> StorageKey {
        StorageKey::CntTotM
    }

    /// Creates a key for contract version.
    pub fn contract_version() -> StorageKey {
        StorageKey::CntVer
    }

    /// Creates a key for the global contract configuration.
    pub fn contract_config() -> StorageKey {
        StorageKey::Config
    }

    /// Creates a key for the reentrancy protection guard.
    pub fn reentrancy_guard() -> StorageKey {
        StorageKey::Guard
    }

    /// Creates a key for group balance.
    pub fn group_balance(group_id: u64) -> StorageKey {
        StorageKey::GrpBal(group_id)
    }

    /// Creates a key for group total paid out.
    pub fn group_total_paid_out(group_id: u64) -> StorageKey {
        StorageKey::GrpPaid(group_id)
    }

    /// Creates a key for the global emergency pause flag.
    pub fn emergency_pause() -> StorageKey {
        StorageKey::EmrgPause
    }

    /// Creates a key for the storage schema version.
    pub fn storage_version() -> StorageKey {
        StorageKey::StoreVer
    }

    /// Creates a key for the deadline extension of a specific group cycle.
    pub fn deadline_extension(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::DlExt(group_id, cycle)
    }

    /// Creates a key for the dispute vote count of a group.
    pub fn dispute_count(group_id: u64) -> StorageKey {
        StorageKey::DspCount(group_id)
    }

    /// Creates a key for the token configuration of a specific group.
    pub fn group_token_config(group_id: u64) -> StorageKey {
        StorageKey::GrpTok(group_id)
    }

    /// Creates a key for the admin-managed allowed tokens list.
    pub fn allowed_tokens() -> StorageKey {
        StorageKey::AlwdToks
    }

    /// Creates a key storing the timestamp of a user's last group creation.
    pub fn user_last_creation(user: Address) -> StorageKey {
        StorageKey::UsrLastC(user)
    }

    /// Creates a key storing the timestamp of a user's last group join action.
    pub fn user_last_join(user: Address) -> StorageKey {
        StorageKey::UsrLastJ(user)
    }

    /// Creates a key storing a user's joined groups list.
    pub fn user_member_groups(user: Address) -> StorageKey {
        StorageKey::UsrGrps(user)
    }
}
/// Constants for storage key prefixes used in string representations.
///
/// These constants ensure consistent key naming across the contract
/// and can be used for debugging or external tooling.
pub mod key_prefixes {
    /// Group data key prefix
    pub const GROUP: &str = "GROUP";

    /// Group members list prefix
    pub const GROUP_MEMBERS: &str = "GROUP_MEMBERS";

    /// Group status prefix
    pub const GROUP_STATUS: &str = "GROUP_STATUS";

    /// Member profile prefix
    pub const MEMBER: &str = "MEMBER";

    /// Member contribution status prefix
    pub const MEMBER_CONTRIB: &str = "MEMBER_CONTRIB";

    /// Member payout eligibility prefix
    pub const MEMBER_PAYOUT: &str = "MEMBER_PAYOUT";

    /// Individual contribution prefix
    pub const CONTRIB: &str = "CONTRIB";

    /// Cycle total contributions prefix
    pub const CONTRIB_TOTAL: &str = "CONTRIB_TOTAL";

    /// Cycle contributor count prefix
    pub const CONTRIB_COUNT: &str = "CONTRIB_COUNT";

    /// Payout record prefix
    pub const PAYOUT: &str = "PAYOUT";

    /// Payout recipient prefix
    pub const PAYOUT_RECIPIENT: &str = "PAYOUT_RECIPIENT";

    /// Payout status prefix
    pub const PAYOUT_STATUS: &str = "PAYOUT_STATUS";

    /// Counter prefix
    pub const COUNTER: &str = "COUNTER";
}

/// Storage layout documentation and access patterns.
///
/// # Storage Organization
///
/// The contract uses a hierarchical key structure to organize data:
///
/// ## Group Storage (`Grp*` variants)
/// - `GROUP_{id}`: Complete group data (configuration, state)
/// - `GROUP_MEMBERS_{id}`: List of member addresses
/// - `GROUP_STATUS_{id}`: Current group status
/// - `GROUP_ARCHIVED_{id}`: Boolean flag indicating whether the group has been archived
///
/// Archived groups are excluded from `list_groups()` by default and are only
/// visible via `list_archived_groups()`. Archiving is a one-way, creator-only
/// operation available after a group reaches a terminal state (Completed or Cancelled).
///
/// ## Member Storage (`Mbr*` variants)
/// - `MEMBER_{group_id}_{address}`: Member profile (join date, status)
/// - `MEMBER_CONTRIB_{group_id}_{address}`: Current cycle contribution status
/// - `MEMBER_PAYOUT_{group_id}_{address}`: Payout eligibility and turn order
/// - `MEMBER_TOTAL_CONTRIB_{group_id}_{address}`: Total contributions across all cycles
///
/// ## Contribution Storage (`Contrib`, `Cyc*`, `C*` variants)
/// - `CONTRIB_{group_id}_{cycle}_{address}`: Individual contribution amount and timestamp
/// - `CONTRIB_TOTAL_{group_id}_{cycle}`: Total pool for the cycle
/// - `CONTRIB_COUNT_{group_id}_{cycle}`: Number of contributors in the cycle
///
/// ## Payout Storage (`Payout`, `Pay*` variants)
/// - `PAYOUT_{group_id}_{cycle}`: Complete payout record
/// - `PAYOUT_RECIPIENT_{group_id}_{cycle}`: Recipient address for quick lookup
/// - `PAYOUT_STATUS_{group_id}_{cycle}`: Payout execution status
///
/// ## Counter Storage (`Cnt*` and global variants)
/// - `COUNTER_GROUP_ID`: Next available group ID
/// - `COUNTER_TOTAL_GROUPS`: Total groups created
/// - `COUNTER_ACTIVE_GROUPS`: Currently active groups
/// - `COUNTER_TOTAL_MEMBERS`: Total members across all groups
/// - `COUNTER_VERSION`: Contract version for upgrades
/// - `COUNTER_GROUP_BALANCE_{id}`: Current balance for a group
/// - `COUNTER_GROUP_PAID_OUT_{id}`: Total paid out for a group
/// - `COUNTER_EMERGENCY_PAUSE`: Global pause flag
/// - `COUNTER_STORAGE_VERSION`: Storage schema version for migrations
///
/// ## User Storage (`Usr*` variants)
/// - `USER_LAST_CREATION_{address}`: Last group creation timestamp
/// - `USER_LAST_JOIN_{address}`: Last group join timestamp
///
/// # Access Patterns
///
/// - **Fast lookups**: O(1) for individual records using direct keys
/// - **Range queries**: Supported for cycles and members within a group
/// - **Aggregations**: Counters enable O(1) access to totals
/// - **Iteration**: Member lists and contribution records support enumeration
pub struct StorageLayout;

impl StorageLayout {
    /// Returns documentation about the storage layout.
    pub fn documentation() -> &'static str {
        "Stellar-Save uses a hierarchical key structure with categories: Group, Member, Contribution, Payout, Counter, and User. Each category has optimized access patterns for its specific use case."
    }

    /// Returns the total number of storage key categories.
    pub fn key_categories() -> usize {
        6 // Group, Member, Contribution, Payout, Counter, User
    }

    /// Returns the estimated storage overhead per group.
    pub fn estimated_overhead_per_group() -> &'static str {
        "Approximately 6-11 storage entries per group (group data, members list, status, balance, paid_out, archived flag)"
    }

    /// Returns the estimated storage overhead per member.
    pub fn estimated_overhead_per_member() -> &'static str {
        "Approximately 4 storage entries per member per group (profile, contribution status, payout eligibility, total contributions)"
    }

    /// Returns the estimated storage overhead per cycle.
    pub fn estimated_overhead_per_cycle() -> &'static str {
        "Approximately 3 storage entries per cycle (cycle total, contributor count, payout record)"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_storage_key_ordering() {
        // Test that storage keys can be ordered (important for range queries)
        let key1 = StorageKeyBuilder::group_data(1);
        let key2 = StorageKeyBuilder::group_data(2);

        assert!(key1 < key2);
    }

    #[test]
    fn test_group_key_builders() {
        let group_id = 42;

        let data_key = StorageKeyBuilder::group_data(group_id);
        let members_key = StorageKeyBuilder::group_members(group_id);
        let status_key = StorageKeyBuilder::group_status(group_id);

        // Verify the keys are different
        assert_ne!(data_key, members_key);
        assert_ne!(data_key, status_key);
        assert_ne!(members_key, status_key);

        // Verify they contain the correct group ID
        match data_key {
            StorageKey::Grp(id) => assert_eq!(id, group_id),
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_member_key_builders() {
        let env = Env::default();
        let group_id = 1;
        let address = Address::generate(&env);

        let profile_key = StorageKeyBuilder::member_profile(group_id, address.clone());
        let contrib_key = StorageKeyBuilder::member_contribution_status(group_id, address.clone());
        let payout_key = StorageKeyBuilder::member_payout_eligibility(group_id, address.clone());

        // Verify all keys are different
        assert_ne!(profile_key, contrib_key);
        assert_ne!(profile_key, payout_key);
        assert_ne!(contrib_key, payout_key);

        // Verify they contain the correct data
        match profile_key {
            StorageKey::MbrProf(id, addr) => {
                assert_eq!(id, group_id);
                assert_eq!(addr, address);
            }
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_contribution_key_builders() {
        let env = Env::default();
        let group_id = 1;
        let cycle = 2;
        let address = Address::generate(&env);

        let individual_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, address.clone());
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);

        // Verify all keys are different
        assert_ne!(individual_key, total_key);
        assert_ne!(individual_key, count_key);
        assert_ne!(total_key, count_key);

        // Verify they contain the correct data
        match individual_key {
            StorageKey::Contrib(id, c, addr) => {
                assert_eq!(id, group_id);
                assert_eq!(c, cycle);
                assert_eq!(addr, address);
            }
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_payout_key_builders() {
        let group_id = 1;
        let cycle = 2;

        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
        let status_key = StorageKeyBuilder::payout_status(group_id, cycle);

        // Verify all keys are different
        assert_ne!(record_key, recipient_key);
        assert_ne!(record_key, status_key);
        assert_ne!(recipient_key, status_key);

        // Verify they contain the correct data
        match record_key {
            StorageKey::Payout(id, c) => {
                assert_eq!(id, group_id);
                assert_eq!(c, cycle);
            }
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_counter_key_builders() {
        let next_id_key = StorageKeyBuilder::next_group_id();
        let total_groups_key = StorageKeyBuilder::total_groups();
        let active_groups_key = StorageKeyBuilder::active_groups();
        let total_members_key = StorageKeyBuilder::total_members();
        let version_key = StorageKeyBuilder::contract_version();

        // Verify all keys are different
        let keys = [
            &next_id_key,
            &total_groups_key,
            &active_groups_key,
            &total_members_key,
            &version_key,
        ];

        for i in 0..keys.len() {
            for j in i + 1..keys.len() {
                assert_ne!(
                    keys[i], keys[j],
                    "Keys at positions {} and {} should be different",
                    i, j
                );
            }
        }

        // Verify key types
        match next_id_key {
            StorageKey::CntNextG => {}
            _ => panic!("Wrong key type for next_group_id"),
        }
    }

    #[test]
    fn test_key_equality_and_cloning() {
        let key1 = StorageKeyBuilder::group_data(1);
        let key2 = StorageKeyBuilder::group_data(1);
        let key3 = key1.clone();

        assert_eq!(key1, key2);
        assert_eq!(key1, key3);
    }

    #[test]
    fn test_different_key_categories() {
        let env = Env::default();
        let address = Address::generate(&env);

        let group_key = StorageKeyBuilder::group_data(1);
        let member_key = StorageKeyBuilder::member_profile(1, address);
        let contrib_key = StorageKeyBuilder::contribution_cycle_total(1, 1);
        let payout_key = StorageKeyBuilder::payout_record(1, 1);
        let counter_key = StorageKeyBuilder::next_group_id();

        // Verify all different categories produce different keys
        let keys = [
            &group_key,
            &member_key,
            &contrib_key,
            &payout_key,
            &counter_key,
        ];

        for i in 0..keys.len() {
            for j in i + 1..keys.len() {
                assert_ne!(
                    keys[i], keys[j],
                    "Keys at positions {} and {} should be different",
                    i, j
                );
            }
        }
    }

    #[test]
    fn test_storage_layout_documentation() {
        let doc = StorageLayout::documentation();
        assert!(!doc.is_empty());
        assert!(doc.contains("hierarchical"));
        assert!(doc.contains("key structure"));
    }

    #[test]
    fn test_storage_layout_categories() {
        assert_eq!(StorageLayout::key_categories(), 6);
    }

    #[test]
    fn test_user_key_builders() {
        let env = Env::default();
        let user = Address::generate(&env);

        let creation_key = StorageKeyBuilder::user_last_creation(user.clone());
        let join_key = StorageKeyBuilder::user_last_join(user.clone());

        // Verify keys are different
        assert_ne!(creation_key, join_key);

        // Verify they contain the correct data
        match creation_key {
            StorageKey::UsrLastC(addr) => {
                assert_eq!(addr, user);
            }
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_group_balance_and_payout_keys() {
        let group_id = 42;

        let balance_key = StorageKeyBuilder::group_balance(group_id);
        let paid_out_key = StorageKeyBuilder::group_total_paid_out(group_id);

        // Verify keys are different
        assert_ne!(balance_key, paid_out_key);

        // Verify they contain the correct group ID
        match balance_key {
            StorageKey::GrpBal(id) => assert_eq!(id, group_id),
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_emergency_pause_key() {
        let pause_key = StorageKeyBuilder::emergency_pause();

        match pause_key {
            StorageKey::EmrgPause => {}
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_reentrancy_guard_key() {
        let guard_key = StorageKeyBuilder::reentrancy_guard();

        match guard_key {
            StorageKey::Guard => {}
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_contract_config_key() {
        let config_key = StorageKeyBuilder::contract_config();

        match config_key {
            StorageKey::Config => {}
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_member_total_contributions_key() {
        let env = Env::default();
        let group_id = 1;
        let address = Address::generate(&env);

        let total_contrib_key =
            StorageKeyBuilder::member_total_contributions(group_id, address.clone());

        match total_contrib_key {
            StorageKey::MbrTotC(id, addr) => {
                assert_eq!(id, group_id);
                assert_eq!(addr, address);
            }
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_storage_key_uniqueness_across_groups() {
        let key1 = StorageKeyBuilder::group_data(1);
        let key2 = StorageKeyBuilder::group_data(2);
        let key3 = StorageKeyBuilder::group_data(1);

        assert_ne!(key1, key2);
        assert_eq!(key1, key3);
    }

    #[test]
    fn test_storage_key_uniqueness_across_cycles() {
        let key1 = StorageKeyBuilder::contribution_cycle_total(1, 1);
        let key2 = StorageKeyBuilder::contribution_cycle_total(1, 2);
        let key3 = StorageKeyBuilder::contribution_cycle_total(2, 1);

        assert_ne!(key1, key2);
        assert_ne!(key1, key3);
        assert_ne!(key2, key3);
    }

    #[test]
    fn test_key_prefixes_constants() {
        assert_eq!(key_prefixes::GROUP, "GROUP");
        assert_eq!(key_prefixes::GROUP_MEMBERS, "GROUP_MEMBERS");
        assert_eq!(key_prefixes::MEMBER, "MEMBER");
        assert_eq!(key_prefixes::CONTRIB, "CONTRIB");
        assert_eq!(key_prefixes::PAYOUT, "PAYOUT");
        assert_eq!(key_prefixes::COUNTER, "COUNTER");
    }

    #[test]
    fn test_storage_version_key() {
        let version_key = StorageKeyBuilder::storage_version();

        match version_key {
            StorageKey::StoreVer => {}
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_storage_version_constant() {
        assert_eq!(STORAGE_VERSION, 2);
        assert!(STORAGE_VERSION > 0, "Storage version should be positive");
    }

    // === Key encoding (Issue #1517)

    /// Every variant name the host has to encode as a `Symbol`.
    ///
    /// Kept as an explicit list so a newly added variant with an over-long name
    /// fails this test rather than silently costing an extra host object.
    const VARIANT_NAMES: [&str; 54] = [
        "Grp",
        "GrpMbrs",
        "GrpSeq",
        "GrpStat",
        "GrpTok",
        "GrpDspR",
        "GrpMrgF",
        "GrpInv",
        "GrpPosIx",
        "GrpArch",
        "GrpRate",
        "GrpRateA",
        "GrpDspV",
        "GrpBid",
        "MbrProf",
        "MbrCStat",
        "MbrPElig",
        "MbrTotC",
        "MbrRwdC",
        "MbrPen",
        "MbrStrk",
        "MbrAuto",
        "MbrRef",
        "Contrib",
        "CycTotal",
        "CycCount",
        "CProof",
        "CRemind",
        "CPendAmt",
        "CAmtVote",
        "CMbrVote",
        "CDisCnt",
        "CDisVote",
        "Refund",
        "Payout",
        "PayRecip",
        "PayStat",
        "CntNextG",
        "CntTotG",
        "CntActG",
        "CntTotM",
        "CntVer",
        "Config",
        "Guard",
        "GrpBal",
        "GrpPaid",
        "EmrgPause",
        "StoreVer",
        "AlwdToks",
        "DlExt",
        "DspCount",
        "UsrLastC",
        "UsrLastJ",
        "UsrGrps",
    ];

    #[test]
    fn every_variant_name_fits_a_small_symbol() {
        // The host packs a Symbol of nine characters or fewer into an immediate
        // 64-bit value; anything longer allocates a separate object per key.
        for name in VARIANT_NAMES {
            assert!(
                name.len() <= 9,
                "variant name is too long for a small Symbol"
            );
        }
    }

    #[test]
    fn variant_names_are_unique() {
        for i in 0..VARIANT_NAMES.len() {
            for j in (i + 1)..VARIANT_NAMES.len() {
                assert_ne!(VARIANT_NAMES[i], VARIANT_NAMES[j]);
            }
        }
    }

    #[test]
    fn keys_from_different_categories_never_collide() {
        let env = Env::default();
        let address = Address::generate(&env);

        // Flattening removed the outer discriminant, so category separation now
        // rests entirely on distinct variant names. Same payload, different key.
        assert_ne!(
            StorageKeyBuilder::group_data(1),
            StorageKeyBuilder::group_balance(1)
        );
        assert_ne!(
            StorageKeyBuilder::group_members(1),
            StorageKeyBuilder::group_invitations(1)
        );
        assert_ne!(
            StorageKeyBuilder::member_profile(1, address.clone()),
            StorageKeyBuilder::member_streak(1, address.clone())
        );
        assert_ne!(
            StorageKeyBuilder::contribution_cycle_total(1, 0),
            StorageKeyBuilder::contribution_cycle_count(1, 0)
        );
        assert_ne!(
            StorageKeyBuilder::payout_record(1, 0),
            StorageKeyBuilder::payout_status(1, 0)
        );
        assert_ne!(
            StorageKeyBuilder::user_last_creation(address.clone()),
            StorageKeyBuilder::user_last_join(address)
        );
    }

    #[test]
    fn unit_variants_carry_no_payload() {
        // The global singletons encode as a bare discriminant: no group id, no
        // address, nothing to serialise alongside the symbol.
        assert_eq!(StorageKeyBuilder::next_group_id(), StorageKey::CntNextG);
        assert_eq!(StorageKeyBuilder::contract_config(), StorageKey::Config);
        assert_eq!(StorageKeyBuilder::reentrancy_guard(), StorageKey::Guard);
        assert_eq!(StorageKeyBuilder::emergency_pause(), StorageKey::EmrgPause);
        assert_eq!(StorageKeyBuilder::allowed_tokens(), StorageKey::AlwdToks);
        assert_eq!(StorageKeyBuilder::storage_version(), StorageKey::StoreVer);
    }

    #[test]
    fn builders_are_the_only_construction_surface_needed() {
        let env = Env::default();
        let address = Address::generate(&env);

        // Each builder still round-trips its arguments after the flattening.
        assert_eq!(StorageKeyBuilder::group_data(7), StorageKey::Grp(7));
        assert_eq!(
            StorageKeyBuilder::group_payout_position_index(7, 3),
            StorageKey::GrpPosIx(7, 3)
        );
        assert_eq!(
            StorageKeyBuilder::contribution_individual(7, 3, address.clone()),
            StorageKey::Contrib(7, 3, address.clone())
        );
        assert_eq!(
            StorageKeyBuilder::refund_record(7, 3, address.clone()),
            StorageKey::Refund(7, 3, address.clone())
        );
        assert_eq!(
            StorageKeyBuilder::deadline_extension(7, 3),
            StorageKey::DlExt(7, 3)
        );
        assert_eq!(
            StorageKeyBuilder::user_member_groups(address.clone()),
            StorageKey::UsrGrps(address)
        );
    }
}
