use soroban_sdk::{contracttype, Address};

// Storage key structure for efficient data access in the Stellar-Save contract.
//
// This module defines a consistent key naming convention for all contract data,
// enabling efficient storage and retrieval operations. Keys are designed to:
// - Provide fast lookups for specific data types
// - Support range queries where needed
// - Maintain clear separation between different data categories
// - Enable efficient iteration over related records

/// Main storage key enum that encompasses all data types stored in the contract.
///
/// Each variant represents a different category of data with its own key structure
/// optimized for the specific access patterns required by that data type.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum StorageKey {
    /// Keys for group data storage.
    Group(GroupKey),

    /// Keys for member data storage.
    Member(MemberKey),

    /// Keys for contribution tracking.
    Contribution(ContributionKey),

    /// Keys for payout records.
    Payout(PayoutKey),

    /// Keys for various counters and metadata.
    Counter(CounterKey),

    /// Keys for tracking individual user state across the contract.
    User(UserKey),
}

/// Keys for individual user tracking across the entire contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum UserKey {
    /// Tracks the last ledger timestamp a specific user created a group.
    LastGroupCreation(Address),

    /// Tracks the last ledger timestamp a specific user joined a group.
    LastGroupJoin(Address),
}

/// Storage keys for group-related data.
///
/// Groups are the core entities in the ROSCA system. Each group has a unique ID
/// and stores configuration, state, and metadata.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum GroupKey {
    /// Individual group data: GROUP_{id}
    /// Stores the complete Group struct for a specific group ID.
    Data(u64),

    /// Group member list: GROUP_MEMBERS_{id}
    /// Stores the list of member addresses for efficient member enumeration.
    Members(u64),

    /// Group payout sequence: GROUP_PAYOUT_SEQUENCE_{id}
    /// Stores the randomized payout order as a vector of addresses.
    PayoutSequence(u64),

    /// Group status: GROUP_STATUS_{id}
    /// Stores the current GroupStatus for quick status checks.
    Status(u64),

    /// Token configuration: GROUP_TOKEN_CONFIG_{id}
    /// Stores the TokenConfig (token address + decimals) for a specific group.
    TokenConfig(u64),
    /// Dispute reason string: GROUP_DISPUTE_REASON_{id}
    DisputeReason(u64),

    /// Merged-from source group IDs: GROUP_MERGED_FROM_{id}
    /// Stores the two source group IDs that were merged to create this group.
    MergedFrom(u64),

    /// Invitation list: GROUP_INVITATIONS_{id}
    /// Stores the Vec<Address> of addresses invited to join this group.
    Invitations(u64),

    /// Payout position reverse index: GROUP_PAYOUT_POS_IDX_{id}_{position}
    ///
    /// Gas opt: stores the Address of the member assigned to a given payout
    /// position. Written once at join/assign time; read once per payout cycle.
    /// Replaces the O(n) member-list scan in `identify_recipient` with a single
    /// O(1) SLOAD: `position → Address`.
    PayoutPositionIndex(u64, u32),

    /// Archived flag: GROUP_ARCHIVED_{id}
    /// Stores a bool indicating whether the group has been archived by its creator.
    /// Archived groups are excluded from `list_groups()` by default and are only
    /// visible via `list_archived_groups()`.
    Archived(u64),

    /// Per-member rating: GROUP_RATING_{id}_{member}
    /// Stores the RatingEntry submitted by a specific member for this group.
    Rating(u64, Address),

    /// Rating aggregate: GROUP_RATING_AGG_{id}
    /// Stores the running RatingAggregate (total_stars + rating_count) for a group.
    RatingAggregate(u64),
}

/// Storage keys for member-related data.
///
/// Members are associated with specific groups and have individual contribution
/// tracking and payout eligibility data.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum MemberKey {
    /// Member profile: MEMBER_{group_id}_{address}
    /// Stores member-specific data including join date and contribution history.
    Profile(u64, Address),

    /// Member contribution status for current cycle: MEMBER_CONTRIB_{group_id}_{address}
    /// Tracks whether the member has contributed in the current cycle.
    ContributionStatus(u64, Address),

    /// Member payout eligibility: MEMBER_PAYOUT_{group_id}_{address}
    /// Tracks payout turn order and eligibility status.
    PayoutEligibility(u64, Address),

    /// Member total contributions: MEMBER_TOTAL_CONTRIB_{group_id}_{address}
    /// Tracks total amount contributed by member across all cycles.
    TotalContributions(u64, Address),

    /// Member reward claimed flag: MEMBER_REWARD_CLAIMED_{group_id}_{address}
    /// Tracks whether a member has claimed their completion reward.
    RewardClaimed(u64, Address),

    /// Member total penalties: MEMBER_PENALTY_{group_id}_{address}
    /// Tracks cumulative penalty amount charged to a member for missed contributions.
    PenaltyTotal(u64, Address),

    /// Member contribution streak: MEMBER_STREAK_{group_id}_{address}
    /// Tracks the current and best consecutive-contribution streak for a member.
    Streak(u64, Address),

    /// Auto-contribution enabled flag: MEMBER_AUTO_CONTRIBUTE_{group_id}_{address}
    /// Tracks whether a member has opted in to automatic contributions at cycle start.
    AutoContribute(u64, Address),
}

/// Storage keys for contribution tracking.
///
/// Contributions are tracked per member, per cycle to ensure proper
/// cycle completion validation and payout calculations.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum ContributionKey {
    /// Individual contribution: CONTRIB_{group_id}_{cycle}_{address}
    /// Stores the contribution amount and timestamp for a specific member in a cycle.
    Individual(u64, u32, Address),

    /// Cycle total contributions: CONTRIB_TOTAL_{group_id}_{cycle}
    /// Stores the total amount contributed in a specific cycle for quick validation.
    CycleTotal(u64, u32),

    /// Cycle contributor count: CONTRIB_COUNT_{group_id}_{cycle}
    /// Tracks how many members have contributed in the current cycle.
    CycleCount(u64, u32),

    /// Proof verified flag: CONTRIB_PROOF_{group_id}_{cycle}_{address}
    /// Tracks whether a member's contribution proof has been verified for a cycle.
    ProofVerified(u64, u32, Address),

    /// Pending amount change: CONTRIB_PENDING_AMOUNT_{group_id}
    /// Stores a proposed new contribution amount awaiting approval.
    PendingAmountChange(u64),

    /// Amount change vote count: CONTRIB_VOTE_COUNT_{group_id}
    /// Tracks how many members have voted to approve the pending amount change.
    AmountChangeVoteCount(u64),

    /// Member vote record: CONTRIB_VOTE_{group_id}_{address}
    /// Tracks whether a specific member has voted on the pending amount change.
    MemberVote(u64, Address),
}

/// Storage keys for payout records.
///
/// Payouts are tracked per group per cycle to maintain transparency
/// and enable payout history queries.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum PayoutKey {
    /// Payout record: PAYOUT_{group_id}_{cycle}
    /// Stores the complete PayoutRecord for a specific group cycle.
    Record(u64, u32),

    /// Payout recipient: PAYOUT_RECIPIENT_{group_id}_{cycle}
    /// Quick lookup for who received the payout in a specific cycle.
    Recipient(u64, u32),

    /// Payout status: PAYOUT_STATUS_{group_id}_{cycle}
    /// Tracks whether the payout has been processed for the cycle.
    Status(u64, u32),
}

/// Storage keys for counters and global metadata.
///
/// Counters track global state and provide unique ID generation
/// for various contract entities.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum CounterKey {
    /// Next group ID counter: COUNTER_GROUP_ID
    /// Provides unique sequential IDs for new groups.
    NextGroupId,

    /// Total groups created: COUNTER_TOTAL_GROUPS
    /// Tracks the total number of groups ever created.
    TotalGroups,

    /// Active groups count: COUNTER_ACTIVE_GROUPS
    /// Tracks the number of currently active groups.
    ActiveGroups,

    /// Total members across all groups: COUNTER_TOTAL_MEMBERS
    /// Global member count for statistics.
    TotalMembers,

    /// Contract version: COUNTER_VERSION
    /// Tracks contract version for upgrade compatibility.
    ContractVersion,

    /// Global contract configuration.
    ContractConfig,

    /// Reentrancy protection flag for transfer operations.
    ReentrancyGuard,

    /// Group balance: COUNTER_GROUP_BALANCE_{group_id}
    /// Tracks current balance for a group incrementally.
    GroupBalance(u64),

    /// Group total paid out: COUNTER_GROUP_PAID_OUT_{group_id}
    /// Tracks total amount paid out incrementally.
    GroupTotalPaidOut(u64),

    /// Emergency pause flag: COUNTER_EMERGENCY_PAUSE
    /// Tracks if the contract is paused by admin.
    EmergencyPause,

    /// Allowed tokens list: COUNTER_ALLOWED_TOKENS
    /// Stores the optional admin-managed allowlist of permitted token addresses.
    AllowedTokens,
}

/// Utility functions for creating storage keys with consistent formatting.
///
/// These functions provide a clean API for generating storage keys without
/// requiring direct enum construction throughout the contract code.
pub struct StorageKeyBuilder;

impl StorageKeyBuilder {
    // Group key builders

    /// Creates a key for storing group data.
    pub fn group_data(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::Data(group_id))
    }

    /// Creates a key for storing group member list.
    pub fn group_members(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::Members(group_id))
    }

    /// Creates a key for storing the randomized payout order sequence.
    pub fn payout_sequence(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::PayoutSequence(group_id))
    }

    /// Creates a key for storing group status.
    pub fn group_status(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::Status(group_id))
    }

    pub fn group_dispute_reason(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::DisputeReason(group_id))
    }

    /// Creates a key for storing the source group IDs of a merged group.
    pub fn group_merged_from(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::MergedFrom(group_id))
    }

    /// Creates a key for the invitation list of a group.
    pub fn group_invitations(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::Invitations(group_id))
    }

    /// Creates a key for the payout-position reverse index.
    ///
    /// Gas opt: maps `(group_id, position) → Address` so `identify_recipient`
    /// can do a single O(1) SLOAD instead of iterating all members.
    pub fn group_payout_position_index(group_id: u64, position: u32) -> StorageKey {
        StorageKey::Group(GroupKey::PayoutPositionIndex(group_id, position))
    }

    /// Creates a key for the archived flag of a group.
    ///
    /// Stores a `bool` indicating whether the group has been archived.
    /// Archived groups are hidden from `list_groups()` by default.
    pub fn group_archived(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::Archived(group_id))
    }

    /// Creates a key for a member's individual rating of a group.
    pub fn group_rating(group_id: u64, member: Address) -> StorageKey {
        StorageKey::Group(GroupKey::Rating(group_id, member))
    }

    /// Creates a key for the rating aggregate of a group.
    pub fn group_rating_aggregate(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::RatingAggregate(group_id))
    }

    // Member key builders

    /// Creates a key for storing member profile data.
    pub fn member_profile(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::Profile(group_id, address))
    }

    /// Creates a key for tracking member contribution status.
    pub fn member_contribution_status(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::ContributionStatus(group_id, address))
    }

    /// Creates a key for member payout eligibility.
    pub fn member_payout_eligibility(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::PayoutEligibility(group_id, address))
    }

    /// Creates a key for member total contributions.
    pub fn member_total_contributions(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::TotalContributions(group_id, address))
    }

    /// Creates a key for tracking whether a member has claimed their completion reward.
    pub fn member_reward_claimed(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::RewardClaimed(group_id, address))
    }

    /// Creates a key for member cumulative penalty total.
    pub fn member_penalty_total(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::PenaltyTotal(group_id, address))
    }

    /// Creates a key for member contribution streak.
    pub fn member_streak(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::Streak(group_id, address))
    }

    /// Creates a key for member auto-contribution enabled flag.
    pub fn member_auto_contribute(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Member(MemberKey::AutoContribute(group_id, address))
    }

    // Contribution key builders

    /// Creates a key for individual contribution records.
    pub fn contribution_individual(group_id: u64, cycle: u32, address: Address) -> StorageKey {
        StorageKey::Contribution(ContributionKey::Individual(group_id, cycle, address))
    }

    /// Creates a key for cycle total contributions.
    pub fn contribution_cycle_total(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::Contribution(ContributionKey::CycleTotal(group_id, cycle))
    }

    /// Creates a key for cycle contributor count.
    pub fn contribution_cycle_count(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::Contribution(ContributionKey::CycleCount(group_id, cycle))
    }

    /// Creates a key for tracking whether a member's proof was verified for a cycle.
    pub fn contribution_proof_verified(group_id: u64, cycle: u32, address: Address) -> StorageKey {
        StorageKey::Contribution(ContributionKey::ProofVerified(group_id, cycle, address))
    }

    /// Creates a key for tracking whether a contribution reminder was emitted for a member.
    pub fn contribution_reminder_emitted(
        group_id: u64,
        cycle: u32,
        address: Address,
    ) -> StorageKey {
        StorageKey::Contribution(ContributionKey::ProofVerified(group_id, cycle, address))
    }

    /// Creates a key for a pending contribution amount change proposal.
    pub fn contribution_pending_amount(group_id: u64) -> StorageKey {
        StorageKey::Contribution(ContributionKey::PendingAmountChange(group_id))
    }

    /// Creates a key for the vote count on a pending amount change.
    pub fn contribution_amount_vote_count(group_id: u64) -> StorageKey {
        StorageKey::Contribution(ContributionKey::AmountChangeVoteCount(group_id))
    }

    /// Creates a key for tracking whether a member has voted on the pending amount change.
    pub fn contribution_member_vote(group_id: u64, address: Address) -> StorageKey {
        StorageKey::Contribution(ContributionKey::MemberVote(group_id, address))
    }

    // Payout key builders

    /// Creates a key for payout records.
    pub fn payout_record(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::Payout(PayoutKey::Record(group_id, cycle))
    }

    /// Creates a key for payout recipient lookup.
    pub fn payout_recipient(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::Payout(PayoutKey::Recipient(group_id, cycle))
    }

    /// Creates a key for payout status tracking.
    pub fn payout_status(group_id: u64, cycle: u32) -> StorageKey {
        StorageKey::Payout(PayoutKey::Status(group_id, cycle))
    }

    // Counter key builders

    /// Creates a key for the next group ID counter.
    pub fn next_group_id() -> StorageKey {
        StorageKey::Counter(CounterKey::NextGroupId)
    }

    /// Creates a key for total groups counter.
    pub fn total_groups() -> StorageKey {
        StorageKey::Counter(CounterKey::TotalGroups)
    }

    /// Creates a key for active groups counter.
    pub fn active_groups() -> StorageKey {
        StorageKey::Counter(CounterKey::ActiveGroups)
    }

    /// Creates a key for total members counter.
    pub fn total_members() -> StorageKey {
        StorageKey::Counter(CounterKey::TotalMembers)
    }

    /// Creates a key for contract version.
    pub fn contract_version() -> StorageKey {
        StorageKey::Counter(CounterKey::ContractVersion)
    }

    /// Creates a key for the global contract configuration.
    pub fn contract_config() -> StorageKey {
        StorageKey::Counter(CounterKey::ContractConfig)
    }

    /// Creates a key for the reentrancy protection guard.
    pub fn reentrancy_guard() -> StorageKey {
        StorageKey::Counter(CounterKey::ReentrancyGuard)
    }

    /// Creates a key for group balance.
    pub fn group_balance(group_id: u64) -> StorageKey {
        StorageKey::Counter(CounterKey::GroupBalance(group_id))
    }

    /// Creates a key for group total paid out.
    pub fn group_total_paid_out(group_id: u64) -> StorageKey {
        StorageKey::Counter(CounterKey::GroupTotalPaidOut(group_id))
    }

    /// Creates a key for the global emergency pause flag.
    pub fn emergency_pause() -> StorageKey {
        StorageKey::Counter(CounterKey::EmergencyPause)
    }

    /// Creates a key for the token configuration of a specific group.
    pub fn group_token_config(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::TokenConfig(group_id))
    }

    /// Creates a key for the admin-managed allowed tokens list.
    pub fn allowed_tokens() -> StorageKey {
        StorageKey::Counter(CounterKey::AllowedTokens)
    }

    /// Creates a key storing the timestamp of a user's last group creation.
    pub fn user_last_creation(user: Address) -> StorageKey {
        StorageKey::User(UserKey::LastGroupCreation(user))
    }

    /// Creates a key storing the timestamp of a user's last group join action.
    pub fn user_last_join(user: Address) -> StorageKey {
        StorageKey::User(UserKey::LastGroupJoin(user))
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
/// ## Group Storage (GroupKey)
/// - `GROUP_{id}`: Complete group data (configuration, state)
/// - `GROUP_MEMBERS_{id}`: List of member addresses
/// - `GROUP_STATUS_{id}`: Current group status
/// - `GROUP_ARCHIVED_{id}`: Boolean flag indicating whether the group has been archived
///
/// Archived groups are excluded from `list_groups()` by default and are only
/// visible via `list_archived_groups()`. Archiving is a one-way, creator-only
/// operation available after a group reaches a terminal state (Completed or Cancelled).
///
/// ## Member Storage (MemberKey)
/// - `MEMBER_{group_id}_{address}`: Member profile (join date, status)
/// - `MEMBER_CONTRIB_{group_id}_{address}`: Current cycle contribution status
/// - `MEMBER_PAYOUT_{group_id}_{address}`: Payout eligibility and turn order
/// - `MEMBER_TOTAL_CONTRIB_{group_id}_{address}`: Total contributions across all cycles
///
/// ## Contribution Storage (ContributionKey)
/// - `CONTRIB_{group_id}_{cycle}_{address}`: Individual contribution amount and timestamp
/// - `CONTRIB_TOTAL_{group_id}_{cycle}`: Total pool for the cycle
/// - `CONTRIB_COUNT_{group_id}_{cycle}`: Number of contributors in the cycle
///
/// ## Payout Storage (PayoutKey)
/// - `PAYOUT_{group_id}_{cycle}`: Complete payout record
/// - `PAYOUT_RECIPIENT_{group_id}_{cycle}`: Recipient address for quick lookup
/// - `PAYOUT_STATUS_{group_id}_{cycle}`: Payout execution status
///
/// ## Counter Storage (CounterKey)
/// - `COUNTER_GROUP_ID`: Next available group ID
/// - `COUNTER_TOTAL_GROUPS`: Total groups created
/// - `COUNTER_ACTIVE_GROUPS`: Currently active groups
/// - `COUNTER_TOTAL_MEMBERS`: Total members across all groups
/// - `COUNTER_VERSION`: Contract version for upgrades
/// - `COUNTER_GROUP_BALANCE_{id}`: Current balance for a group
/// - `COUNTER_GROUP_PAID_OUT_{id}`: Total paid out for a group
/// - `COUNTER_EMERGENCY_PAUSE`: Global pause flag
///
/// ## User Storage (UserKey)
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
            StorageKey::Group(GroupKey::Data(id)) => assert_eq!(id, group_id),
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
            StorageKey::Member(MemberKey::Profile(id, addr)) => {
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
            StorageKey::Contribution(ContributionKey::Individual(id, c, addr)) => {
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
            StorageKey::Payout(PayoutKey::Record(id, c)) => {
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
            StorageKey::Counter(CounterKey::NextGroupId) => {}
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
            StorageKey::User(UserKey::LastGroupCreation(addr)) => {
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
            StorageKey::Counter(CounterKey::GroupBalance(id)) => assert_eq!(id, group_id),
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_emergency_pause_key() {
        let pause_key = StorageKeyBuilder::emergency_pause();

        match pause_key {
            StorageKey::Counter(CounterKey::EmergencyPause) => {}
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_reentrancy_guard_key() {
        let guard_key = StorageKeyBuilder::reentrancy_guard();

        match guard_key {
            StorageKey::Counter(CounterKey::ReentrancyGuard) => {}
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_contract_config_key() {
        let config_key = StorageKeyBuilder::contract_config();

        match config_key {
            StorageKey::Counter(CounterKey::ContractConfig) => {}
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
            StorageKey::Member(MemberKey::TotalContributions(id, addr)) => {
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
}
