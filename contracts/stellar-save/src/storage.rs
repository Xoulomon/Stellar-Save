use soroban_sdk::{contracttype, Address, Symbol};

/// Storage key structure for efficient data access in the Stellar-Save contract.
/// 
/// This module defines a consistent key naming convention for all contract data,
/// enabling efficient storage and retrieval operations. Keys are designed to:
/// - Provide fast lookups for specific data types
/// - Support range queries where needed
/// - Maintain clear separation between different data categories
/// - Enable efficient iteration over related records

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
    
    /// Group status: GROUP_STATUS_{id}
    /// Stores the current GroupStatus for quick status checks.
    Status(u64),
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
    
    /// Creates a key for storing group status.
    pub fn group_status(group_id: u64) -> StorageKey {
        StorageKey::Group(GroupKey::Status(group_id))
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
            },
            _ => panic!("Wrong key type"),
        }
    }

    #[test]
    fn test_contribution_key_builders() {
        let env = Env::default();
        let group_id = 1;
        let cycle = 2;
        let address = Address::generate(&env);
        
        let individual_key = StorageKeyBuilder::contribution_individual(group_id, cycle, address.clone());
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
            },
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
            },
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
            &next_id_key, &total_groups_key, &active_groups_key, 
            &total_members_key, &version_key
        ];
        
        for i in 0..keys.len() {
            for j in i+1..keys.len() {
                assert_ne!(keys[i], keys[j], "Keys at positions {} and {} should be different", i, j);
            }
        }
        
        // Verify key types
        match next_id_key {
            StorageKey::Counter(CounterKey::NextGroupId) => {},
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
        let keys = [&group_key, &member_key, &contrib_key, &payout_key, &counter_key];
        
        for i in 0..keys.len() {
            for j in i+1..keys.len() {
                assert_ne!(keys[i], keys[j], "Keys at positions {} and {} should be different", i, j);
            }
        }
    }
}