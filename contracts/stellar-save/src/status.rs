use soroban_sdk::contracterror;

/// Error types for invalid state transitions.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StatusError {
    /// Attempted an invalid state transition.
    InvalidTransition = 1,
    /// Cannot transition from Completed state.
    AlreadyCompleted = 2,
    /// Cannot transition from Cancelled state.
    AlreadyCancelled = 3,
}


/// GroupStatus enum representing the lifecycle states of a savings group.
/// 
/// A group progresses through various states from creation to completion.
/// State transitions are validated to ensure proper group lifecycle management.
/// 
/// # State Flow
/// ```text
/// Pending -> Active -> Completed
///     |         |
///     v         v
/// Cancelled   Paused -> Active
///                |
///                v
///            Cancelled
/// ```
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GroupStatus {
    /// Group has been created but not yet started.
    /// Waiting for minimum members to join before activation.
    /// Can transition to: Active, Cancelled
    Pending = 0,
    
    /// Group is actively running with members contributing and receiving payouts.
    /// Normal operational state where contributions and payouts occur.
    /// Can transition to: Paused, Completed, Cancelled
    Active = 1,
    
    /// Group is temporarily paused.
    /// No contributions or payouts can occur while paused.
    /// Can transition to: Active, Cancelled
    Paused = 2,
    
    /// Group has completed all cycles successfully.
    /// All members have received their payouts.
    /// Terminal state - no further transitions allowed.
    Completed = 3,
    
    /// Group has been cancelled and will not continue.
    /// May occur due to insufficient members, admin action, or other issues.
    /// Terminal state - no further transitions allowed.
    Cancelled = 4,
}

impl GroupStatus {
    /// Checks if a transition from the current status to a new status is valid.
    /// 
    /// # Arguments
    /// * `new_status` - The desired new status
    /// 
    /// # Returns
    /// * `Ok(())` if the transition is valid
    /// * `Err(StatusError)` if the transition is invalid
    /// 
    /// # Valid Transitions
    /// - Pending -> Active, Cancelled
    /// - Active -> Paused, Completed, Cancelled
    /// - Paused -> Active, Cancelled
    /// - Completed -> None (terminal state)
    /// - Cancelled -> None (terminal state)
    pub fn can_transition_to(&self, new_status: GroupStatus) -> Result<(), StatusError> {
        match (self, new_status) {
            // From Pending
            (GroupStatus::Pending, GroupStatus::Active) => Ok(()),
            (GroupStatus::Pending, GroupStatus::Cancelled) => Ok(()),
            
            // From Active
            (GroupStatus::Active, GroupStatus::Paused) => Ok(()),
            (GroupStatus::Active, GroupStatus::Completed) => Ok(()),
            (GroupStatus::Active, GroupStatus::Cancelled) => Ok(()),
            
            // From Paused
            (GroupStatus::Paused, GroupStatus::Active) => Ok(()),
            (GroupStatus::Paused, GroupStatus::Cancelled) => Ok(()),
            
            // Terminal states cannot transition
            (GroupStatus::Completed, _) => Err(StatusError::AlreadyCompleted),
            (GroupStatus::Cancelled, _) => Err(StatusError::AlreadyCancelled),
            
            // All other transitions are invalid
            _ => Err(StatusError::InvalidTransition),
        }
    }
    
    /// Validates and performs a state transition.
    /// 
    /// # Arguments
    /// * `new_status` - The desired new status
    /// 
    /// # Returns
    /// * `Ok(new_status)` if the transition is valid
    /// * `Err(StatusError)` if the transition is invalid
    pub fn transition_to(&self, new_status: GroupStatus) -> Result<GroupStatus, StatusError> {
        self.can_transition_to(new_status)?;
        Ok(new_status)
    }
    
    /// Checks if the group is in a terminal state (Completed or Cancelled).
    pub fn is_terminal(&self) -> bool {
        matches!(self, GroupStatus::Completed | GroupStatus::Cancelled)
    }
    
    /// Checks if the group can accept contributions in its current state.
    pub fn can_accept_contributions(&self) -> bool {
        matches!(self, GroupStatus::Active)
    }
    
    /// Checks if the group can process payouts in its current state.
    pub fn can_process_payouts(&self) -> bool {
        matches!(self, GroupStatus::Active)
    }
    
    /// Checks if new members can join the group in its current state.
    pub fn can_accept_members(&self) -> bool {
        matches!(self, GroupStatus::Pending | GroupStatus::Active)
    }
    
    /// Returns a string representation of the status.
    pub fn as_str(&self) -> &'static str {
        match self {
            GroupStatus::Pending => "Pending",
            GroupStatus::Active => "Active",
            GroupStatus::Paused => "Paused",
            GroupStatus::Completed => "Completed",
            GroupStatus::Cancelled => "Cancelled",
        }
    }
    
    /// Converts a u32 value to GroupStatus.
    /// 
    /// # Arguments
    /// * `value` - The u32 representation of the status
    /// 
    /// # Returns
    /// * `Some(GroupStatus)` if the value is valid
    /// * `None` if the value doesn't correspond to any status
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0 => Some(GroupStatus::Pending),
            1 => Some(GroupStatus::Active),
            2 => Some(GroupStatus::Paused),
            3 => Some(GroupStatus::Completed),
            4 => Some(GroupStatus::Cancelled),
            _ => None,
        }
    }
    
    /// Converts the GroupStatus to its u32 representation.
    pub fn to_u32(&self) -> u32 {
        *self as u32
    }
}

// Implement Display-like functionality through as_str
impl GroupStatus {
    /// Returns a detailed description of the status.
    pub fn description(&self) -> &'static str {
        match self {
            GroupStatus::Pending => "Group is pending activation, waiting for members to join",
            GroupStatus::Active => "Group is active and accepting contributions",
            GroupStatus::Paused => "Group is temporarily paused, no contributions or payouts allowed",
            GroupStatus::Completed => "Group has completed all cycles successfully",
            GroupStatus::Cancelled => "Group has been cancelled and will not continue",
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions_from_pending() {
        let status = GroupStatus::Pending;
        
        assert!(status.can_transition_to(GroupStatus::Active).is_ok());
        assert!(status.can_transition_to(GroupStatus::Cancelled).is_ok());
        
        assert!(status.can_transition_to(GroupStatus::Paused).is_err());
        assert!(status.can_transition_to(GroupStatus::Completed).is_err());
    }

    #[test]
    fn test_valid_transitions_from_active() {
        let status = GroupStatus::Active;
        
        assert!(status.can_transition_to(GroupStatus::Paused).is_ok());
        assert!(status.can_transition_to(GroupStatus::Completed).is_ok());
        assert!(status.can_transition_to(GroupStatus::Cancelled).is_ok());
        
        assert!(status.can_transition_to(GroupStatus::Pending).is_err());
    }

    #[test]
    fn test_valid_transitions_from_paused() {
        let status = GroupStatus::Paused;
        
        assert!(status.can_transition_to(GroupStatus::Active).is_ok());
        assert!(status.can_transition_to(GroupStatus::Cancelled).is_ok());
        
        assert!(status.can_transition_to(GroupStatus::Pending).is_err());
        assert!(status.can_transition_to(GroupStatus::Completed).is_err());
    }

    #[test]
    fn test_terminal_state_completed() {
        let status = GroupStatus::Completed;
        
        assert_eq!(
            status.can_transition_to(GroupStatus::Active),
            Err(StatusError::AlreadyCompleted)
        );
        assert_eq!(
            status.can_transition_to(GroupStatus::Paused),
            Err(StatusError::AlreadyCompleted)
        );
        assert_eq!(
            status.can_transition_to(GroupStatus::Cancelled),
            Err(StatusError::AlreadyCompleted)
        );
        
        assert!(status.is_terminal());
    }

    #[test]
    fn test_terminal_state_cancelled() {
        let status = GroupStatus::Cancelled;
        
        assert_eq!(
            status.can_transition_to(GroupStatus::Active),
            Err(StatusError::AlreadyCancelled)
        );
        assert_eq!(
            status.can_transition_to(GroupStatus::Paused),
            Err(StatusError::AlreadyCancelled)
        );
        assert_eq!(
            status.can_transition_to(GroupStatus::Completed),
            Err(StatusError::AlreadyCancelled)
        );
        
        assert!(status.is_terminal());
    }

    #[test]
    fn test_transition_to_success() {
        let status = GroupStatus::Pending;
        let result = status.transition_to(GroupStatus::Active);
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), GroupStatus::Active);
    }

    #[test]
    fn test_transition_to_failure() {
        let status = GroupStatus::Pending;
        let result = status.transition_to(GroupStatus::Paused);
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusError::InvalidTransition);
    }

    #[test]
    fn test_is_terminal() {
        assert!(!GroupStatus::Pending.is_terminal());
        assert!(!GroupStatus::Active.is_terminal());
        assert!(!GroupStatus::Paused.is_terminal());
        assert!(GroupStatus::Completed.is_terminal());
        assert!(GroupStatus::Cancelled.is_terminal());
    }

    #[test]
    fn test_can_accept_contributions() {
        assert!(!GroupStatus::Pending.can_accept_contributions());
        assert!(GroupStatus::Active.can_accept_contributions());
        assert!(!GroupStatus::Paused.can_accept_contributions());
        assert!(!GroupStatus::Completed.can_accept_contributions());
        assert!(!GroupStatus::Cancelled.can_accept_contributions());
    }

    #[test]
    fn test_can_process_payouts() {
        assert!(!GroupStatus::Pending.can_process_payouts());
        assert!(GroupStatus::Active.can_process_payouts());
        assert!(!GroupStatus::Paused.can_process_payouts());
        assert!(!GroupStatus::Completed.can_process_payouts());
        assert!(!GroupStatus::Cancelled.can_process_payouts());
    }

    #[test]
    fn test_can_accept_members() {
        assert!(GroupStatus::Pending.can_accept_members());
        assert!(GroupStatus::Active.can_accept_members());
        assert!(!GroupStatus::Paused.can_accept_members());
        assert!(!GroupStatus::Completed.can_accept_members());
        assert!(!GroupStatus::Cancelled.can_accept_members());
    }

    #[test]
    fn test_as_str() {
        assert_eq!(GroupStatus::Pending.as_str(), "Pending");
        assert_eq!(GroupStatus::Active.as_str(), "Active");
        assert_eq!(GroupStatus::Paused.as_str(), "Paused");
        assert_eq!(GroupStatus::Completed.as_str(), "Completed");
        assert_eq!(GroupStatus::Cancelled.as_str(), "Cancelled");
    }

    #[test]
    fn test_description() {
        assert!(GroupStatus::Pending.description().contains("pending"));
        assert!(GroupStatus::Active.description().contains("active"));
        assert!(GroupStatus::Paused.description().contains("paused"));
        assert!(GroupStatus::Completed.description().contains("completed"));
        assert!(GroupStatus::Cancelled.description().contains("cancelled"));
    }

    #[test]
    fn test_from_u32() {
        assert_eq!(GroupStatus::from_u32(0), Some(GroupStatus::Pending));
        assert_eq!(GroupStatus::from_u32(1), Some(GroupStatus::Active));
        assert_eq!(GroupStatus::from_u32(2), Some(GroupStatus::Paused));
        assert_eq!(GroupStatus::from_u32(3), Some(GroupStatus::Completed));
        assert_eq!(GroupStatus::from_u32(4), Some(GroupStatus::Cancelled));
        assert_eq!(GroupStatus::from_u32(5), None);
        assert_eq!(GroupStatus::from_u32(999), None);
    }

    #[test]
    fn test_to_u32() {
        assert_eq!(GroupStatus::Pending.to_u32(), 0);
        assert_eq!(GroupStatus::Active.to_u32(), 1);
        assert_eq!(GroupStatus::Paused.to_u32(), 2);
        assert_eq!(GroupStatus::Completed.to_u32(), 3);
        assert_eq!(GroupStatus::Cancelled.to_u32(), 4);
    }

    #[test]
    fn test_round_trip_conversion() {
        for i in 0..=4 {
            let status = GroupStatus::from_u32(i).unwrap();
            assert_eq!(status.to_u32(), i);
        }
    }

    #[test]
    fn test_status_ordering() {
        assert!(GroupStatus::Pending < GroupStatus::Active);
        assert!(GroupStatus::Active < GroupStatus::Paused);
        assert!(GroupStatus::Paused < GroupStatus::Completed);
        assert!(GroupStatus::Completed < GroupStatus::Cancelled);
    }

    #[test]
    fn test_status_equality() {
        assert_eq!(GroupStatus::Pending, GroupStatus::Pending);
        assert_ne!(GroupStatus::Pending, GroupStatus::Active);
    }

    #[test]
    fn test_full_lifecycle_happy_path() {
        // Pending -> Active -> Completed
        let mut status = GroupStatus::Pending;
        
        status = status.transition_to(GroupStatus::Active).unwrap();
        assert_eq!(status, GroupStatus::Active);
        assert!(status.can_accept_contributions());
        
        status = status.transition_to(GroupStatus::Completed).unwrap();
        assert_eq!(status, GroupStatus::Completed);
        assert!(status.is_terminal());
    }

    #[test]
    fn test_full_lifecycle_with_pause() {
        // Pending -> Active -> Paused -> Active -> Completed
        let mut status = GroupStatus::Pending;
        
        status = status.transition_to(GroupStatus::Active).unwrap();
        status = status.transition_to(GroupStatus::Paused).unwrap();
        assert!(!status.can_accept_contributions());
        
        status = status.transition_to(GroupStatus::Active).unwrap();
        assert!(status.can_accept_contributions());
        
        status = status.transition_to(GroupStatus::Completed).unwrap();
        assert!(status.is_terminal());
    }

    #[test]
    fn test_cancellation_from_various_states() {
        // Can cancel from Pending
        assert!(GroupStatus::Pending.transition_to(GroupStatus::Cancelled).is_ok());
        
        // Can cancel from Active
        assert!(GroupStatus::Active.transition_to(GroupStatus::Cancelled).is_ok());
        
        // Can cancel from Paused
        assert!(GroupStatus::Paused.transition_to(GroupStatus::Cancelled).is_ok());
    }
}
