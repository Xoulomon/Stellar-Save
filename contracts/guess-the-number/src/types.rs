use soroban_sdk::{contracttype, Address, String, Vec};

/// Status of a savings group
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GroupStatus {
    /// Group is being formed, accepting new members
    Forming,
    /// Group is active and running cycles
    Active,
    /// Group has completed all cycles
    Completed,
    /// Group has been cancelled
    Cancelled,
}

/// Member information
#[contracttype]
#[derive(Clone, Debug)]
pub struct Member {
    /// Member's address
    pub address: Address,
    /// Whether member has received payout
    pub has_received_payout: bool,
    /// Total contributions made
    pub total_contributed: i128,
}

/// Group configuration and state
#[contracttype]
#[derive(Clone, Debug)]
pub struct Group {
    /// Unique group identifier
    pub id: u64,
    /// Group name
    pub name: String,
    /// Group creator/admin
    pub admin: Address,
    /// Contribution amount per cycle
    pub contribution_amount: i128,
    /// Cycle duration in seconds
    pub cycle_duration: u64,
    /// Maximum number of members
    pub max_members: u32,
    /// Current member count
    pub member_count: u32,
    /// Current group status
    pub status: GroupStatus,
    /// List of member addresses
    pub members: Vec<Address>,
    /// Current cycle number
    pub current_cycle: u32,
    /// Timestamp when group started
    pub start_time: u64,
}
