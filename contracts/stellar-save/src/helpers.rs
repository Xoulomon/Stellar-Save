//! Helper utilities for formatting and display

use soroban_sdk::{String, Env, Bytes};
use crate::{Group, StellarSaveError, StorageKeyBuilder};

/// Validates a group metadata string (name or description).
///
/// Rejects inputs that:
/// - Exceed `max_bytes` in byte length
/// - Contain null bytes (0x00), which can cause frontend rendering issues
///
/// Soroban `String` values are always valid UTF-8 by construction, so no
/// additional UTF-8 check is required.
///
/// # Arguments
/// * `s`         - The string to validate
/// * `max_bytes` - Maximum allowed byte length
///
/// # Returns
/// * `Ok(())` - String is valid
/// * `Err(StellarSaveError::InvalidMetadata)` - String exceeds limit or contains null bytes
pub fn validate_group_string(s: &String, max_bytes: u32) -> Result<(), StellarSaveError> {
    if s.len() > max_bytes {
        return Err(StellarSaveError::InvalidMetadata);
    }
    // Convert to Bytes and scan for null bytes (0x00)
    let bytes = s.to_bytes();
    for i in 0..bytes.len() {
        if bytes.get(i).unwrap() == 0x00 {
            return Err(StellarSaveError::InvalidMetadata);
        }
    }
    Ok(())
}

/// Rounding precision for contribution amounts (0.01 XLM = 10^5 stroops).
/// This prevents precision issues with very small amounts.
/// Canonical definition lives in `crate::constants::CONTRIBUTION_ROUNDING_PRECISION`.
pub const ROUNDING_PRECISION: i128 = crate::constants::CONTRIBUTION_ROUNDING_PRECISION;

/// Rounds a contribution amount to the nearest 0.01 XLM (or token equivalent).
///
/// This prevents precision issues that can occur with very small amounts by
/// rounding to the nearest 0.01 unit (100,000 stroops for XLM).
///
/// # Arguments
/// * `amount` - The contribution amount in stroops (e.g., 1 XLM = 10,000,000 stroops)
///
/// # Returns
/// The rounded amount in stroops
///
/// # Examples
/// ```
/// // 1,234,567 stroops -> 1,200,000 (rounded to nearest 0.01 XLM)
/// let rounded = round_contribution_amount(1_234_567);
/// ```
///
/// ```
/// // 1,255,555 stroops -> 1,300,000 (rounded up)
/// let rounded = round_contribution_amount(1_255_555);
/// ```
pub fn round_contribution_amount(amount: i128) -> i128 {
    if amount <= 0 {
        return amount;
    }
    
    // Round to nearest ROUNDING_PRECISION
    // For positive numbers: (amount + ROUNDING_PRECISION/2) / ROUNDING_PRECISION * ROUNDING_PRECISION
    let half_precision = ROUNDING_PRECISION / 2;
    ((amount + half_precision) / ROUNDING_PRECISION) * ROUNDING_PRECISION
}

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
    let mut buf = [0u8; 32];
    buf[0] = b'G';
    buf[1] = b'R';
    buf[2] = b'O';
    buf[3] = b'U';
    buf[4] = b'P';
    buf[5] = b'-';

    let mut num = group_id;
    if num == 0 {
        buf[6] = b'0';
        String::from_bytes(env, &buf[..7])
    } else {
        let mut digits = [0u8; 20];
        let mut len = 0;
        while num > 0 {
            digits[len] = b'0' + (num % 10) as u8;
            num /= 10;
            len += 1;
        }
        let mut idx = 6;
        for i in (0..len).rev() {
            buf[idx] = digits[i];
            idx += 1;
        }
        String::from_bytes(env, &buf[..idx])
    }
}

/// Checks if the current cycle deadline (plus grace period) has passed.
/// 
/// A member is only considered late once both the cycle deadline AND the
/// grace period have elapsed.
/// 
/// # Arguments
/// * `group` - The group to check
/// * `current_time` - Current timestamp in seconds
/// 
/// # Returns
/// `true` if the deadline + grace period has passed, `false` otherwise
pub fn is_cycle_deadline_passed(group: &Group, current_time: u64) -> bool {
    if !group.started {
        return false;
    }
    
    let cycle_deadline = group.started_at + (group.cycle_duration * (group.current_cycle as u64 + 1));
    current_time > cycle_deadline + group.grace_period_seconds
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

    // ── validate_group_string tests ──────────────────────────────────────────

    #[test]
    fn test_validate_group_string_valid_name() {
        let env = Env::default();
        let s = String::from_str(&env, "My Group");
        assert!(validate_group_string(&s, 64).is_ok());
    }

    #[test]
    fn test_validate_group_string_exactly_max_bytes() {
        let env = Env::default();
        // 64 ASCII characters = 64 bytes
        let s = String::from_str(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assert_eq!(s.len(), 64);
        assert!(validate_group_string(&s, 64).is_ok());
    }

    #[test]
    fn test_validate_group_string_exceeds_max_bytes() {
        let env = Env::default();
        // 65 ASCII characters = 65 bytes
        let s = String::from_str(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assert_eq!(s.len(), 65);
        assert_eq!(validate_group_string(&s, 64), Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_validate_group_string_empty_allowed_by_zero_limit() {
        let env = Env::default();
        let s = String::from_str(&env, "");
        // Empty string has 0 bytes — passes any max_bytes >= 0
        assert!(validate_group_string(&s, 256).is_ok());
    }

    #[test]
    fn test_validate_group_string_description_exactly_256_bytes() {
        let env = Env::default();
        // 256 ASCII characters = 256 bytes
        let desc = "a".repeat(256);
        let s = String::from_str(&env, &desc);
        assert_eq!(s.len(), 256);
        assert!(validate_group_string(&s, 256).is_ok());
    }

    #[test]
    fn test_validate_group_string_description_exceeds_256_bytes() {
        let env = Env::default();
        let desc = "a".repeat(257);
        let s = String::from_str(&env, &desc);
        assert_eq!(s.len(), 257);
        assert_eq!(validate_group_string(&s, 256), Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_validate_group_string_multibyte_utf8_within_limit() {
        let env = Env::default();
        // "é" is 2 bytes in UTF-8; 32 × "é" = 64 bytes
        let s = String::from_str(&env, "éééééééééééééééééééééééééééééééé");
        assert_eq!(s.len(), 64);
        assert!(validate_group_string(&s, 64).is_ok());
    }

    #[test]
    fn test_validate_group_string_multibyte_utf8_exceeds_limit() {
        let env = Env::default();
        // 33 × "é" = 66 bytes > 64
        let s = String::from_str(&env, "ééééééééééééééééééééééééééééééééé");
        assert!(s.len() > 64);
        assert_eq!(validate_group_string(&s, 64), Err(StellarSaveError::InvalidMetadata));
    }

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
        let group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000, 0);
        
        assert!(!is_cycle_deadline_passed(&group, 2000));
    }

    #[test]
    fn test_is_cycle_deadline_passed_before_deadline() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000, 0);
        group.activate(1000);
        
        // Current time before deadline (started_at + cycle_duration)
        assert!(!is_cycle_deadline_passed(&group, 1000 + 604800));
    }

    #[test]
    fn test_is_cycle_deadline_passed_after_deadline() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000, 0);
        group.activate(1000);
        
        // Current time after deadline (no grace period)
        assert!(is_cycle_deadline_passed(&group, 1000 + 604800 + 1));
    }

    #[test]
    fn test_is_cycle_deadline_passed_within_grace_period() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let grace = 3600u64; // 1 hour grace
        let mut group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000, grace);
        group.activate(1000);

        let deadline = 1000 + 604800;
        // After deadline but within grace period — not yet missed
        assert!(!is_cycle_deadline_passed(&group, deadline + grace));
        // One second past grace period — now missed
        assert!(is_cycle_deadline_passed(&group, deadline + grace + 1));
    }

    #[test]
    fn test_is_cycle_deadline_passed_second_cycle() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1000000, 604800, 5, 2, 1000, 0);
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
        let group = Group::new(1, creator, 1_000_000, 604800, 5, 2, 1000, 0);
        store_group(&env, &group);

        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(0));
    }

    #[test]
    fn test_calculate_current_cycle_at_started_at() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, 604800, 5, 2, 1000, 0);
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
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, 10, 2, started_at, 0);
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
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, 10, 2, started_at, 0);
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
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, max_members, 2, started_at, 0);
        group.member_count = 2;
        group.activate(started_at);
        store_group(&env, &group);

        // Far in the future: many more cycles than max_members
        env.ledger().set_timestamp(started_at + cycle_duration * 1000);
        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(max_members - 1));
    }

    #[test]
    fn test_calculate_current_cycle_clock_skew_returns_zero() {
        // Guard: if current_time < started_at (e.g. due to clock skew) → Ok(0), no panic.
        let env = Env::default();
        let started_at: u64 = 5000;
        let cycle_duration: u64 = 604800;

        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, 5, 2, started_at, 0);
        group.member_count = 2;
        group.activate(started_at);
        store_group(&env, &group);

        // Set ledger time to before started_at
        env.ledger().set_timestamp(started_at - 1);
        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(0));
    }

    #[test]
    fn test_calculate_current_cycle_exactly_one_second_before_first_boundary() {
        // Boundary: exactly (cycle_duration - 1) seconds elapsed → still cycle 0
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 86400; // 1 day

        let creator = Address::generate(&env);
        let mut group = Group::new(1, creator, 1_000_000, cycle_duration, 5, 2, started_at, 0);
        group.member_count = 2;
        group.activate(started_at);
        store_group(&env, &group);

        env.ledger().set_timestamp(started_at + cycle_duration - 1);
        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(0));

        // Exactly at the boundary → cycle 1
        env.ledger().set_timestamp(started_at + cycle_duration);
        let result = calculate_current_cycle(&env, 1);
        assert_eq!(result, Ok(1));
    }

    // --- round_contribution_amount tests ---

    #[test]
    fn test_round_contribution_amount_exact() {
        // Exact multiple of 0.01 XLM (100,000 stroops)
        assert_eq!(round_contribution_amount(100_000), 100_000);
        assert_eq!(round_contribution_amount(1_000_000), 1_000_000);
        assert_eq!(round_contribution_amount(10_000_000), 10_000_000);
    }

    #[test]
    fn test_round_contribution_amount_rounds_down() {
        // Amounts that should round down (less than halfway)
        assert_eq!(round_contribution_amount(49_999), 0);
        assert_eq!(round_contribution_amount(149_999), 100_000);
        assert_eq!(round_contribution_amount(1_049_999), 1_000_000);
    }

    #[test]
    fn test_round_contribution_amount_rounds_up() {
        // Amounts that should round up (more than halfway)
        assert_eq!(round_contribution_amount(50_001), 100_000);
        assert_eq!(round_contribution_amount(150_001), 200_000);
        assert_eq!(round_contribution_amount(1_050_001), 1_100_000);
    }

    #[test]
    fn test_round_contribution_amount_at_halfway() {
        // Exactly at halfway point - should round up
        assert_eq!(round_contribution_amount(50_000), 100_000);
        assert_eq!(round_contribution_amount(150_000), 200_000);
    }

    #[test]
    fn test_round_contribution_amount_zero() {
        // Zero should remain zero
        assert_eq!(round_contribution_amount(0), 0);
    }

    #[test]
    fn test_round_contribution_amount_negative() {
        // Negative amounts should remain unchanged
        assert_eq!(round_contribution_amount(-100_000), -100_000);
        assert_eq!(round_contribution_amount(-1), -1);
    }

    #[test]
    fn test_round_contribution_amount_typical_values() {
        // Typical contribution amounts in stroops
        assert_eq!(round_contribution_amount(50_000_000), 50_000_000);
        assert_eq!(round_contribution_amount(100_000_000), 100_000_000);
        assert_eq!(round_contribution_amount(255_000_000), 255_000_000);
        assert_eq!(round_contribution_amount(1_002_500_000), 1_002_500_000);
    }
}
