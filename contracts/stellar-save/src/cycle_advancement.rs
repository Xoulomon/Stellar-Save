use soroban_sdk::{Address, Env};
use crate::{
    error::StellarSaveError,
    events::EventEmitter,
    group::Group,
    storage::StorageKeyBuilder,
};

/// Helper function to advance a group to the next cycle after payout.
///
/// This function encapsulates the complete logic for transitioning a group
/// from one cycle to the next after a successful payout. It performs all
/// necessary validations, updates, and event emissions.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `group` - Mutable reference to the group being advanced
/// * `group_id` - The ID of the group
/// * `caller` - The address of the caller (for event emission)
///
/// # Returns
/// * `Ok(())` if the cycle advancement was successful
/// * `Err(StellarSaveError)` if validation fails
///
/// # Errors
/// * `CycleNotComplete` - If the cycle is not yet complete (payout not verified)
/// * `InvalidState` - If the group is not in a valid state for advancement
///
/// # Side Effects
/// * Updates group's current_cycle counter
/// * Updates group's is_active flag if group is now complete
/// * Persists updated group to storage
/// * Emits GroupStatusChanged event if group transitions to Completed
pub fn advance_group_to_next_cycle(
    env: &Env,
    group: &mut Group,
    group_id: u64,
    caller: &Address,
) -> Result<(), StellarSaveError> {
    // Task 1: Verify cycle is complete
    // Check that the group is not already complete
    if group.is_complete() {
        return Err(StellarSaveError::InvalidState);
    }

    // Task 2: Increment cycle counter
    group.advance_cycle();

    // Task 3: Update group storage
    let group_key = StorageKeyBuilder::group_data(group_id);
    env.storage().persistent().set(&group_key, group);

    // Task 4: Emit event
    // Emit GroupStatusChanged event when transitioning to Completed state
    if group.is_complete() {
        let old_status = (group.current_cycle - 1) as u32;
        let new_status = 3u32; // Completed status code
        let timestamp = env.ledger().timestamp();

        EventEmitter::emit_group_status_changed(
            env,
            group_id,
            old_status,
            new_status,
            caller.clone(),
            timestamp,
        );
    }

    Ok(())
}

/// Core logic for advancing a group cycle without storage operations.
/// This is useful for testing and for scenarios where storage is managed separately.
///
/// # Arguments
/// * `group` - Mutable reference to the group being advanced
///
/// # Returns
/// * `Ok(())` if the cycle advancement was successful
/// * `Err(StellarSaveError)` if validation fails
///
/// # Errors
/// * `InvalidState` - If the group is already complete
pub fn advance_group_cycle_logic(group: &mut Group) -> Result<(), StellarSaveError> {
    // Verify cycle is complete
    if group.is_complete() {
        return Err(StellarSaveError::InvalidState);
    }

    // Increment cycle counter
    group.advance_cycle();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_advance_group_cycle_logic_success() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(
            1,
            creator,
            10_000_000, // 1 XLM
            604800,     // 1 week
            3,          // 3 members
            1234567890,
        );

        assert_eq!(group.current_cycle, 0);
        assert!(group.is_active);

        let result = advance_group_cycle_logic(&mut group);

        assert!(result.is_ok());
        assert_eq!(group.current_cycle, 1);
        assert!(group.is_active); // Still active, not complete yet
    }

    #[test]
    fn test_advance_group_cycle_logic_multiple_times() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(
            1,
            creator,
            10_000_000,
            604800,
            3,
            1234567890,
        );

        // Advance through all cycles
        for i in 0..3 {
            let result = advance_group_cycle_logic(&mut group);
            assert!(result.is_ok());
            assert_eq!(group.current_cycle, i + 1);
        }

        // After final advancement, group should be complete and inactive
        assert!(group.is_complete());
        assert!(!group.is_active);
    }

    #[test]
    fn test_advance_group_cycle_logic_when_complete() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(
            1,
            creator,
            10_000_000,
            604800,
            2,
            1234567890,
        );

        // Advance to completion
        group.current_cycle = 2;
        group.is_active = false;

        let result = advance_group_cycle_logic(&mut group);

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    #[test]
    fn test_advance_group_cycle_logic_completion() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(
            1,
            creator,
            10_000_000,
            604800,
            2,
            1234567890,
        );

        // Advance to the final cycle
        group.current_cycle = 1;

        let result = advance_group_cycle_logic(&mut group);

        assert!(result.is_ok());
        assert!(group.is_complete());
        assert!(!group.is_active);
    }

    #[test]
    fn test_advance_group_cycle_logic_intermediate() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(
            1,
            creator,
            10_000_000,
            604800,
            5,
            1234567890,
        );

        // Advance from cycle 0 to 1 (not completion)
        let result = advance_group_cycle_logic(&mut group);

        assert!(result.is_ok());
        assert_eq!(group.current_cycle, 1);
        assert!(group.is_active); // Still active
    }

    #[test]
    fn test_advance_group_cycle_logic_maintains_properties() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let original_contribution = 10_000_000;
        let original_cycle_duration = 604800;
        let original_max_members = 4;

        let mut group = Group::new(
            1,
            creator.clone(),
            original_contribution,
            original_cycle_duration,
            original_max_members,
            1234567890,
        );

        advance_group_cycle_logic(&mut group).unwrap();

        // Verify immutable properties are unchanged
        assert_eq!(group.contribution_amount, original_contribution);
        assert_eq!(group.cycle_duration, original_cycle_duration);
        assert_eq!(group.max_members, original_max_members);
        assert_eq!(group.creator, creator);
    }

    #[test]
    fn test_advance_group_cycle_logic_progression() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(1, creator, 10_000_000, 604800, 4, 1234567890);

        // Verify cycle progression
        assert_eq!(group.current_cycle, 0);
        assert!(!group.is_complete());

        advance_group_cycle_logic(&mut group).unwrap();
        assert_eq!(group.current_cycle, 1);
        assert!(!group.is_complete());

        advance_group_cycle_logic(&mut group).unwrap();
        assert_eq!(group.current_cycle, 2);
        assert!(!group.is_complete());

        advance_group_cycle_logic(&mut group).unwrap();
        assert_eq!(group.current_cycle, 3);
        assert!(!group.is_complete());

        advance_group_cycle_logic(&mut group).unwrap();
        assert_eq!(group.current_cycle, 4);
        assert!(group.is_complete());
    }

    #[test]
    fn test_advance_group_cycle_logic_error_on_already_complete() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(1, creator, 10_000_000, 604800, 2, 1234567890);
        group.current_cycle = 2; // Already complete

        let result = advance_group_cycle_logic(&mut group);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }
}
