use soroban_sdk::{contracttype, Address};
use core::fmt;

/// Represents the lifecycle states of a savings group.
///
/// Groups progress through these states during their lifetime:
/// - Pending: Newly created, waiting for minimum members
/// - Active: Accepting contributions and processing payouts
/// - Paused: Temporarily suspended (can be resumed)
/// - Completed: All cycles finished successfully
/// - Cancelled: Permanently terminated before completion
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GroupStatus {
    /// Group is created but not yet active.
    /// Waiting for minimum members or creator activation.
    Pending,

    /// Group is actively running cycles.
    /// Members can contribute and payouts are processed.
    Active,

    /// Group is temporarily paused.
    /// No contributions accepted, but can be resumed.
    Paused,

    /// Group has completed all cycles successfully.
    /// All members have received their payouts.
    Completed,

    /// Group was cancelled before completion.
    /// Funds should be returned to contributors.
    Cancelled,
}

impl GroupStatus {
    /// Validates if a state transition is allowed.
    ///
    /// Valid transitions:
    /// - Pending → Active, Cancelled
    /// - Active → Paused, Completed, Cancelled
    /// - Paused → Active, Cancelled
    /// - Completed → (no transitions allowed)
    /// - Cancelled → (no transitions allowed)
    pub fn can_transition_to(&self, new_status: &GroupStatus) -> bool {
        // Same state is always valid
        if self == new_status {
            return true;
        }
        
        match (self, new_status) {
            // From Pending
            (GroupStatus::Pending, GroupStatus::Active) => true,
            (GroupStatus::Pending, GroupStatus::Cancelled) => true,

            // From Active
            (GroupStatus::Active, GroupStatus::Paused) => true,
            (GroupStatus::Active, GroupStatus::Completed) => true,
            (GroupStatus::Active, GroupStatus::Cancelled) => true,

            // From Paused
            (GroupStatus::Paused, GroupStatus::Active) => true,
            (GroupStatus::Paused, GroupStatus::Cancelled) => true,

            // Terminal states cannot transition to other states
            (GroupStatus::Completed, _) => false,
            (GroupStatus::Cancelled, _) => false,

            // All other transitions are invalid
            _ => false,
        }
    }

    /// Returns true if the group can accept contributions in this state.
    pub fn accepts_contributions(&self) -> bool {
        matches!(self, GroupStatus::Active)
    }

    /// Returns true if the group can process payouts in this state.
    pub fn can_process_payouts(&self) -> bool {
        matches!(self, GroupStatus::Active)
    }

    /// Returns true if this is a terminal state (no further transitions allowed).
    pub fn is_terminal(&self) -> bool {
        matches!(self, GroupStatus::Completed | GroupStatus::Cancelled)
    }
}

impl fmt::Display for GroupStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let status_str = match self {
            GroupStatus::Pending => "Pending",
            GroupStatus::Active => "Active",
            GroupStatus::Paused => "Paused",
            GroupStatus::Completed => "Completed",
            GroupStatus::Cancelled => "Cancelled",
        };
        write!(f, "{}", status_str)
    }
}
/// Core Group data structure representing a rotational savings group (ROSCA).
/// 
/// A Group manages the configuration and state of a savings circle where members
/// contribute a fixed amount each cycle and take turns receiving the pooled funds.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Group {
    /// Unique identifier for the group.
    /// Generated sequentially when groups are created.
    pub id: u64,

    /// Address of the group creator.
    /// The creator has special privileges like starting the first cycle
    /// and potentially managing group settings.
    pub creator: Address,

    /// Fixed contribution amount in stroops (1 XLM = 10^7 stroops).
    /// All members must contribute this exact amount each cycle.
    /// Must be greater than 0.
    pub contribution_amount: i128,

    /// Duration of each cycle in seconds.
    /// Defines how long members have to contribute before payout.
    /// Common values: 604800 (1 week), 2592000 (30 days).
    /// Must be greater than 0.
    pub cycle_duration: u64,

    /// Maximum number of members allowed in the group.
    /// Once reached, no new members can join.
    /// Must be at least 2 (minimum for a meaningful ROSCA).
    /// Determines total number of cycles (one payout per member).
    pub max_members: u32,

    /// Current cycle number (0-indexed).
    /// Increments after each successful payout.
    /// When current_cycle reaches max_members, the group is complete.
    pub current_cycle: u32,

    /// Whether the group is currently active and accepting contributions.
    /// Set to false when:
    /// - Group is paused by admin/creator
    /// - All cycles are complete
    /// - Group encounters an error state
    pub is_active: bool,

    /// Timestamp when the group was created (Unix timestamp in seconds).
    /// Used for tracking group age and calculating cycle deadlines.
    pub created_at: u64,
}

impl Group {
    /// Creates a new Group with validation.
    /// 
    /// # Arguments
    /// * `id` - Unique group identifier
    /// * `creator` - Address of the group creator
    /// * `contribution_amount` - Amount each member contributes per cycle (in stroops)
    /// * `cycle_duration` - Duration of each cycle in seconds
    /// * `max_members` - Maximum number of members allowed
    /// * `created_at` - Creation timestamp
    /// 
    /// # Panics
    /// Panics if validation constraints are violated:
    /// - contribution_amount must be > 0
    /// - cycle_duration must be > 0
    /// - max_members must be >= 2
    pub fn new(
        id: u64,
        creator: Address,
        contribution_amount: i128,
        cycle_duration: u64,
        max_members: u32,
        created_at: u64,
    ) -> Self {
        // Validate contribution amount
        assert!(
            contribution_amount > 0,
            "contribution_amount must be greater than 0"
        );

        // Validate cycle duration
        assert!(
            cycle_duration > 0,
            "cycle_duration must be greater than 0"
        );

        // Validate max members (minimum 2 for a meaningful ROSCA)
        assert!(
            max_members >= 2,
            "max_members must be at least 2"
        );

        Self {
            id,
            creator,
            contribution_amount,
            cycle_duration,
            max_members,
            current_cycle: 0,
            is_active: true,
            created_at,
        }
    }

    /// Checks if the group has completed all cycles.
    /// A group is complete when current_cycle equals max_members.
    pub fn is_complete(&self) -> bool {
        self.current_cycle >= self.max_members
    }

    /// Advances to the next cycle.
    /// Should be called after a successful payout.
    /// 
    /// # Panics
    /// Panics if the group is already complete.
    pub fn advance_cycle(&mut self) {
        assert!(!self.is_complete(), "group is already complete");
        self.current_cycle += 1;
        
        // Deactivate if we've reached the final cycle
        if self.is_complete() {
            self.is_active = false;
        }
    }

    /// Deactivates the group, preventing further contributions.
    pub fn deactivate(&mut self) {
        self.is_active = false;
    }

    /// Reactivates the group if it's not complete.
    /// 
    /// # Panics
    /// Panics if attempting to reactivate a completed group.
    pub fn reactivate(&mut self) {
        assert!(!self.is_complete(), "cannot reactivate a completed group");
        self.is_active = true;
    }

    /// Calculates the total pool amount for a cycle.
    /// This is the amount distributed to the recipient each cycle.
    pub fn total_pool_amount(&self) -> i128 {
        self.contribution_amount * (self.max_members as i128)
    }

    /// Validates that the group configuration is sound.
    /// Returns true if all constraints are met.
    pub fn validate(&self) -> bool {
        self.contribution_amount > 0
            && self.cycle_duration > 0
            && self.max_members >= 2
            && self.current_cycle <= self.max_members
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_group_creation() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let group = Group::new(
            1,
            creator.clone(),
            10_000_000, // 1 XLM
            604800,     // 1 week
            5,          // 5 members
            1234567890,
        );

        assert_eq!(group.id, 1);
        assert_eq!(group.creator, creator);
        assert_eq!(group.contribution_amount, 10_000_000);
        assert_eq!(group.cycle_duration, 604800);
        assert_eq!(group.max_members, 5);
        assert_eq!(group.current_cycle, 0);
        assert_eq!(group.is_active, true);
        assert_eq!(group.created_at, 1234567890);
    }

    #[test]
    #[should_panic(expected = "contribution_amount must be greater than 0")]
    fn test_invalid_contribution_amount() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        Group::new(1, creator, 0, 604800, 5, 1234567890);
    }

    #[test]
    #[should_panic(expected = "cycle_duration must be greater than 0")]
    fn test_invalid_cycle_duration() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        Group::new(1, creator, 10_000_000, 0, 5, 1234567890);
    }

    #[test]
    #[should_panic(expected = "max_members must be at least 2")]
    fn test_invalid_max_members() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        Group::new(1, creator, 10_000_000, 604800, 1, 1234567890);
    }

    #[test]
    fn test_is_complete() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let mut group = Group::new(1, creator, 10_000_000, 604800, 3, 1234567890);
        
        assert!(!group.is_complete());
        
        group.current_cycle = 2;
        assert!(!group.is_complete());
        
        group.current_cycle = 3;
        assert!(group.is_complete());
    }

    #[test]
    fn test_advance_cycle() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let mut group = Group::new(1, creator, 10_000_000, 604800, 3, 1234567890);
        
        assert_eq!(group.current_cycle, 0);
        assert!(group.is_active);
        
        group.advance_cycle();
        assert_eq!(group.current_cycle, 1);
        assert!(group.is_active);
        
        group.advance_cycle();
        assert_eq!(group.current_cycle, 2);
        assert!(group.is_active);
        
        group.advance_cycle();
        assert_eq!(group.current_cycle, 3);
        assert!(!group.is_active); // Auto-deactivated when complete
    }

    #[test]
    #[should_panic(expected = "group is already complete")]
    fn test_advance_cycle_when_complete() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let mut group = Group::new(1, creator, 10_000_000, 604800, 2, 1234567890);
        group.current_cycle = 2;
        
        group.advance_cycle(); // Should panic
    }

    #[test]
    fn test_deactivate_reactivate() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let mut group = Group::new(1, creator, 10_000_000, 604800, 3, 1234567890);
        
        assert!(group.is_active);
        
        group.deactivate();
        assert!(!group.is_active);
        
        group.reactivate();
        assert!(group.is_active);
    }

    #[test]
    #[should_panic(expected = "cannot reactivate a completed group")]
    fn test_reactivate_completed_group() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let mut group = Group::new(1, creator, 10_000_000, 604800, 2, 1234567890);
        group.current_cycle = 2;
        
        group.reactivate(); // Should panic
    }

    #[test]
    fn test_total_pool_amount() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let group = Group::new(1, creator, 10_000_000, 604800, 5, 1234567890);
        
        assert_eq!(group.total_pool_amount(), 50_000_000); // 5 XLM total
    }

    #[test]
    fn test_validate() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let group = Group::new(1, creator, 10_000_000, 604800, 5, 1234567890);
        assert!(group.validate());
    }

    // GroupStatus tests
    #[test]
    fn test_group_status_transitions() {
        // Test valid transitions from Pending
        assert!(GroupStatus::Pending.can_transition_to(&GroupStatus::Active));
        assert!(GroupStatus::Pending.can_transition_to(&GroupStatus::Cancelled));
        assert!(!GroupStatus::Pending.can_transition_to(&GroupStatus::Paused));
        assert!(!GroupStatus::Pending.can_transition_to(&GroupStatus::Completed));

        // Test valid transitions from Active
        assert!(GroupStatus::Active.can_transition_to(&GroupStatus::Paused));
        assert!(GroupStatus::Active.can_transition_to(&GroupStatus::Completed));
        assert!(GroupStatus::Active.can_transition_to(&GroupStatus::Cancelled));
        assert!(!GroupStatus::Active.can_transition_to(&GroupStatus::Pending));

        // Test valid transitions from Paused
        assert!(GroupStatus::Paused.can_transition_to(&GroupStatus::Active));
        assert!(GroupStatus::Paused.can_transition_to(&GroupStatus::Cancelled));
        assert!(!GroupStatus::Paused.can_transition_to(&GroupStatus::Pending));
        assert!(!GroupStatus::Paused.can_transition_to(&GroupStatus::Completed));

        // Test terminal states cannot transition
        assert!(!GroupStatus::Completed.can_transition_to(&GroupStatus::Active));
        assert!(!GroupStatus::Completed.can_transition_to(&GroupStatus::Pending));
        assert!(!GroupStatus::Completed.can_transition_to(&GroupStatus::Paused));
        assert!(!GroupStatus::Completed.can_transition_to(&GroupStatus::Cancelled));

        assert!(!GroupStatus::Cancelled.can_transition_to(&GroupStatus::Active));
        assert!(!GroupStatus::Cancelled.can_transition_to(&GroupStatus::Pending));
        assert!(!GroupStatus::Cancelled.can_transition_to(&GroupStatus::Paused));
        assert!(!GroupStatus::Cancelled.can_transition_to(&GroupStatus::Completed));

        // Test same state transitions are always valid
        assert!(GroupStatus::Pending.can_transition_to(&GroupStatus::Pending));
        assert!(GroupStatus::Active.can_transition_to(&GroupStatus::Active));
        assert!(GroupStatus::Paused.can_transition_to(&GroupStatus::Paused));
        assert!(GroupStatus::Completed.can_transition_to(&GroupStatus::Completed));
        assert!(GroupStatus::Cancelled.can_transition_to(&GroupStatus::Cancelled));
    }

    #[test]
    fn test_group_status_accepts_contributions() {
        assert!(!GroupStatus::Pending.accepts_contributions());
        assert!(GroupStatus::Active.accepts_contributions());
        assert!(!GroupStatus::Paused.accepts_contributions());
        assert!(!GroupStatus::Completed.accepts_contributions());
        assert!(!GroupStatus::Cancelled.accepts_contributions());
    }

    #[test]
    fn test_group_status_can_process_payouts() {
        assert!(!GroupStatus::Pending.can_process_payouts());
        assert!(GroupStatus::Active.can_process_payouts());
        assert!(!GroupStatus::Paused.can_process_payouts());
        assert!(!GroupStatus::Completed.can_process_payouts());
        assert!(!GroupStatus::Cancelled.can_process_payouts());
    }

    #[test]
    fn test_group_status_is_terminal() {
        assert!(!GroupStatus::Pending.is_terminal());
        assert!(!GroupStatus::Active.is_terminal());
        assert!(!GroupStatus::Paused.is_terminal());
        assert!(GroupStatus::Completed.is_terminal());
        assert!(GroupStatus::Cancelled.is_terminal());
    }
}
