//! Helper utilities for formatting and display

use soroban_sdk::{String, Env, Bytes};
use crate::{Group, StellarSaveError, StorageKeyBuilder};

/// Formats a group ID for display with a "GROUP-" prefix.
/// 
/// # Arguments
/// * `env` - Soroban environment for string allocation
/// * `group_id` - The numeric group ID to format
/// 
/// # Returns
/// A formatted string in the format "GROUP-{id}"
/// 
/// # Example
/// ```
/// let formatted = format_group_id(&env, 42);
/// // Returns: "GROUP-42"
/// ```
pub fn format_group_id(env: &Env, group_id: u64) -> String {
    // Convert u64 to bytes manually
    let mut num = group_id;
    let mut digits = Bytes::new(env);
    
    if num == 0 {
        digits.push_back(b'0');
    } else {
        // Build digits in reverse, then reverse them
        let mut temp = Bytes::new(env);
        while num > 0 {
            temp.push_back(b'0' + (num % 10) as u8);
            num /= 10;
        }
        // Reverse the digits
        for i in (0..temp.len()).rev() {
            digits.push_back(temp.get(i).unwrap());
        }
    }
    
    // Build the final string: "GROUP-" + digits
    let mut result = Bytes::new(env);
    result.push_back(b'G');
    result.push_back(b'R');
    result.push_back(b'O');
    result.push_back(b'U');
    result.push_back(b'P');
    result.push_back(b'-');
    
    // Append digits
    for i in 0..digits.len() {
        result.push_back(digits.get(i).unwrap());
    }
    
    String::from_bytes(env, &result)
}

/// Checks if the current cycle deadline has passed.
/// 
/// # Arguments
/// * `group` - The group to check
/// * `current_time` - Current timestamp in seconds
/// 
/// # Returns
/// `true` if the deadline has passed, `false` otherwise
/// 
/// # Example
/// ```
/// let deadline_passed = is_cycle_deadline_passed(&group, env.ledger().timestamp());
/// ```
pub fn is_cycle_deadline_passed(group: &Group, current_time: u64) -> bool {
    if !group.started {
        return false;
    }
    
    let cycle_deadline = group.started_at + (group.cycle_duration * (group.current_cycle as u64 + 1));
    current_time > cycle_deadline
}

/// Calculates the current cycle number for a savings group.
///
/// # Arguments
/// * `env`      - Soroban environment (storage + ledger access)
/// * `group_id` - ID of the group to query
///
/// # Returns
/// * `Ok(0)`                        - group not yet started, or current_time < started_at
/// * `Ok(n)` where n ≤ max_members-1 - number of complete cycles elapsed, capped
/// * `Err(StellarSaveError::GroupNotFound)` - group_id not in storage
pub fn calculate_current_cycle(env: &Env, group_id: u64) -> Result<u32, StellarSaveError> {
    // Step 1: Load Group from storage
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Step 2: If group has not been started, return cycle 0
    if !group.started {
        return Ok(0);
    }

    // Step 3: Get current ledger time; guard against clock skew
    let current_time: u64 = env.ledger().timestamp();
    if current_time < group.started_at {
        return Ok(0);
    }

    // Step 4: Compute elapsed cycles, cap at max_members - 1, cast to u32
    let elapsed: u64 = current_time - group.started_at;
    let cycles: u64 = elapsed / group.cycle_duration;
    let cap: u64 = (group.max_members - 1) as u64;
    let result: u32 = cycles.min(cap) as u32;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, Address};
    use crate::group::GroupStatus;

    #[test]
    fn test_format_group_id_single_digit() {
        let env = Env::default();
        let result = format_group_id(&env, 1);
        assert_eq!(result, String::from_str(&env, "GROUP-1"));
    }

    #[test]
    fn test_format_group_id_multi_digit() {
        let env = Env::default();
        let result = format_group_id(&env, 12345);
        assert_eq!(result, String::from_str(&env, "GROUP-12345"));
    }

    #[test]
    fn test_format_group_id_zero() {
        let env = Env::default();
        let result = format_group_id(&env, 0);
        assert_eq!(result, String::from_str(&env, "GROUP-0"));
    }

    #[test]
    fn test_format_group_id_max_value() {
        let env = Env::default();
        let result = format_group_id(&env, u64::MAX);
        let expected = String::from_str(&env, "GROUP-18446744073709551615");
        assert_eq!(result, expected);
    }

    #[test]
    fn test_is_cycle_deadline_passed_not_started() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000);
        
        assert!(!is_cycle_deadline_passed(&group, 2000));
    }

    #[test]
    fn test_is_cycle_deadline_passed_before_deadline() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000);
        group.activate(1000);
        
        // Current time before deadline (started_at + cycle_duration)
        assert!(!is_cycle_deadline_passed(&group, 1000 + 604800));
    }

    #[test]
    fn test_is_cycle_deadline_passed_after_deadline() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000);
        group.activate(1000);
        
        // Current time after deadline
        assert!(is_cycle_deadline_passed(&group, 1000 + 604800 + 1));
    }

    #[test]
    fn test_is_cycle_deadline_passed_second_cycle() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000);
        group.activate(1000);
        group.advance_cycle(&env);
        
        // Deadline for cycle 1 is started_at + (cycle_duration * 2)
        assert!(!is_cycle_deadline_passed(&group, 1000 + 604800 * 2));
        assert!(is_cycle_deadline_passed(&group, 1000 + 604800 * 2 + 1));
    }

    // --- calculate_current_cycle tests ---

    fn store_group(env: &Env, group: &Group) {
        let key = StorageKeyBuilder::group_data(group.id);
        env.storage().persistent().set(&key, group);
    }

    #[test]
    fn test_calculate_current_cycle_group_not_found() {
        let env = Env::default();
        let result = calculate_current_cycle(&env, 9999);
        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    #[test]
    fn test_calculate_current_cycle_not_started() {
        let env = Env::default();
        let creator = Address::generate(&env);
        // Group with started = false (default)
        let group = Group::new(1, creator, 1_000_000, 604800, 5, 2, 1000);
        store_group(&env, &group);

        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(0));
    }

    #[test]
    fn test_calculate_current_cycle_at_started_at() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, 604800, 5, 2, 1000);
        group.member_count = 2;
        group.activate(1000); // started_at = 1000
        store_group(&env, &group);

        // current_time == started_at → elapsed = 0 → cycle 0
        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(0));
    }

    #[test]
    fn test_calculate_current_cycle_n_full_cycles() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;

        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, 10, 2, started_at);
        group.member_count = 2;
        group.activate(started_at);
        store_group(&env, &group);

        for n in 1u64..=5 {
            env.ledger().set_timestamp(started_at + cycle_duration * n);
            let result = calculate_current_cycle(&env, 1);
            assert_eq!(result, Ok(n as u32), "expected cycle {} at time {}", n, started_at + cycle_duration * n);
        }
    }

    #[test]
    fn test_calculate_current_cycle_no_partial_cycle() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;

        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, 10, 2, started_at);
        group.member_count = 2;
        group.activate(started_at);
        store_group(&env, &group);

        // One second before the second cycle boundary → still cycle 1
        env.ledger().set_timestamp(started_at + cycle_duration * 2 - 1);
        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(1));
    }

    #[test]
    fn test_calculate_current_cycle_capped_at_max_members_minus_one() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let max_members: u32 = 5;

        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, max_members, 2, started_at);
        group.member_count = 2;
        group.activate(started_at);
        store_group(&env, &group);

        // Far in the future: many more cycles than max_members
        env.ledger().set_timestamp(started_at + cycle_duration * 1000);
        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(max_members - 1));
    }
}
