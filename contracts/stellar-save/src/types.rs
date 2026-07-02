<<<<<<< HEAD
//! Core contract types shared across modules.
use soroban_sdk::{contracttype, Address, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractConfig {
    pub admin: Address,
    pub min_contribution: i128,
    pub max_contribution: i128,
    pub min_members: u32,
    pub max_members: u32,
    pub min_cycle_duration: u64,
    pub max_cycle_duration: u64,
    /// Optional treasury address that receives the protocol creation fee.
    /// When `None`, no fee is charged.
    pub treasury: Option<Address>,
    /// Protocol fee charged per group creation in stroops.
    /// Only applied when `treasury` is `Some`. Zero means no fee.
    pub creation_fee: i128,
}

impl ContractConfig {
    pub fn validate(&self) -> bool {
        self.min_contribution > 0
            && self.max_contribution >= self.min_contribution
            && self.min_members >= 2
            && self.max_members >= self.min_members
            && self.min_cycle_duration > 0
            && self.max_cycle_duration >= self.min_cycle_duration
            && self.creation_fee >= 0
    }
}

/// Member profile structure for tracking member data in a group.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberProfile {
    pub address: Address,
    pub group_id: u64,
    pub payout_position: u32,
    pub joined_at: u64,
    pub auto_contribute_enabled: bool,
}

/// Payout schedule entry containing recipient and payout date
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutScheduleEntry {
    pub recipient: Address,
    pub cycle: u32,
    pub payout_date: u64,
}

/// Assignment mode for payout positions
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AssignmentMode {
    /// Sequential assignment based on join order (default)
    Sequential,
    /// Randomized assignment using Soroban PRNG and ledger seed salting
    Randomized,
    /// Manual assignment with explicit positions
    Manual(Vec<u32>),
=======
use soroban_sdk::{contracttype, Address, Vec};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum GroupStatus {
    Active,
    Complete,
}

/// Core ROSCA group state stored on-chain.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Group {
    /// Amount each member must contribute per cycle (in stroops).
    pub contribution_amount: i128,
    /// Duration of each cycle in ledgers.
    pub cycle_duration: u32,
    /// Maximum number of members allowed.
    pub max_members: u32,
    /// Current members in join order.
    pub members: Vec<Address>,
    /// Index of the next member to receive payout (0-based).
    pub payout_index: u32,
    /// Current cycle number (1-based, 0 = not started).
    pub current_cycle: u32,
    /// Ledger number when the current cycle started.
    pub cycle_start_ledger: u32,
    pub status: GroupStatus,
}

/// Persistent storage keys.
#[contracttype]
pub enum DataKey {
    /// Counter for the next group ID.
    GroupCounter,
    /// Group state by ID.
    Group(u64),
    /// Whether a member has contributed in a given cycle: (group_id, cycle, member).
    Contributed(u64, u32, Address),
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
}
