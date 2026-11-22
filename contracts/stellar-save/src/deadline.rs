use soroban_sdk::{Address, Env};

use crate::{
    error::StellarSaveError, events::EventEmitter, group::Group, storage::StorageKeyBuilder,
    time_source::{LedgerTimeSource, TimeSource},
};

/// Maximum allowed extension per call: 7 days in seconds.
/// Maximum allowed extension per call: 7 days in seconds.
/// Canonical definition: `crate::constants::MAX_DEADLINE_EXTENSION_SECONDS`.
pub const MAX_EXTENSION_SECONDS: u64 = crate::constants::MAX_DEADLINE_EXTENSION_SECONDS;

/// Extends the contribution deadline for a specific cycle of a group.
///
/// Only the group creator may call this function. The extension is additive —
/// multiple extensions can be applied to the same cycle, but each individual
/// call must not exceed `MAX_EXTENSION_SECONDS` (7 days).
///
/// The effective deadline for a cycle is:
///   `created_at + cycle_duration * (cycle + 1) + total_extension`
///
/// # Arguments
/// * `env`               - Soroban environment
/// * `caller`            - Address of the caller (must be group creator)
/// * `group_id`          - ID of the group
/// * `cycle`             - Cycle number to extend
/// * `extension_seconds` - Number of seconds to add (max 604_800)
///
/// # Errors
/// * `GroupNotFound`              - Group does not exist
/// * `Unauthorized`               - Caller is not the group creator
/// * `InvalidState`               - Group is not active
/// * `DeadlineExtensionExceedsMax`- `extension_seconds` > 7 days (error code 7001)
pub fn extend_deadline(
    env: &Env,
    caller: Address,
    group_id: u64,
    cycle: u32,
    extension_seconds: u64,
) -> Result<(), StellarSaveError> {
    let ts = LedgerTimeSource::new(env);
    extend_deadline_with_time(env, caller, group_id, cycle, extension_seconds, &ts)
}

/// Internal implementation of [`extend_deadline`] that accepts an injectable
/// [`TimeSource`].  Use this variant in tests to control the apparent current
/// time without needing to advance the ledger.
pub fn extend_deadline_with_time<T: TimeSource>(
    env: &Env,
    caller: Address,
    group_id: u64,
    cycle: u32,
    extension_seconds: u64,
    time_source: &T,
) -> Result<(), StellarSaveError> {
    caller.require_auth();

    // Validate extension amount
    if extension_seconds == 0 || extension_seconds > MAX_EXTENSION_SECONDS {
        return Err(StellarSaveError::DeadlineExtensionExceedsMax);
    }

    // Load group
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group: Group = env
        .storage()
        .persistent()
        .get(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Only the creator may extend deadlines
    if group.creator != caller {
        return Err(StellarSaveError::Unauthorized);
    }

    // Group must be active
    if !group.is_active {
        return Err(StellarSaveError::InvalidState);
    }

    // Accumulate extension for this cycle
    let ext_key = StorageKeyBuilder::deadline_extension(group_id, cycle);
    let existing: u64 = env.storage().persistent().get(&ext_key).unwrap_or(0);
    let new_total = existing
        .checked_add(extension_seconds)
        .ok_or(StellarSaveError::InternalError)?;
    env.storage().persistent().set(&ext_key, &new_total);

    // Calculate new effective deadline:
    //   base_deadline = created_at + cycle_duration * (cycle + 1)
    //   new_deadline  = base_deadline + new_total
    let base_deadline = group
        .created_at
        .checked_add(
            group
                .cycle_duration
                .checked_mul(cycle as u64 + 1)
                .ok_or(StellarSaveError::InternalError)?,
        )
        .ok_or(StellarSaveError::InternalError)?;
    let new_deadline = base_deadline
        .checked_add(new_total)
        .ok_or(StellarSaveError::InternalError)?;

    // Use the injectable time source instead of calling env.ledger().timestamp() directly.
    let now = time_source.now();
    EventEmitter::emit_cycle_deadline_extended(
        env,
        group_id,
        cycle,
        extension_seconds,
        new_deadline,
        caller,
        now,
    );

    Ok(())
}

/// Returns the effective deadline (UNIX timestamp) for a given cycle of a group.
///
/// The effective deadline is:
///   `created_at + cycle_duration * (cycle + 1) + total_extension`
///
/// Returns `None` if arithmetic overflow would occur or the group is not found.
pub fn effective_deadline(env: &Env, group_id: u64, cycle: u32) -> Option<u64> {
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group: Group = env.storage().persistent().get(&group_key)?;

    let base_deadline = group.created_at.checked_add(
        group
            .cycle_duration
            .checked_mul(cycle as u64 + 1)?,
    )?;
    let extension = get_deadline_extension(env, group_id, cycle);
    base_deadline.checked_add(extension)
}

/// Returns `true` if the given timestamp is **at or after** the effective deadline.
///
/// Accepts an injectable [`TimeSource`] so that callers can test boundary
/// conditions (exact deadline instant, one second before, one second after)
/// without needing to manipulate the ledger clock.
pub fn is_past_deadline<T: TimeSource>(
    env: &Env,
    group_id: u64,
    cycle: u32,
    time_source: &T,
) -> bool {
    match effective_deadline(env, group_id, cycle) {
        Some(deadline) => time_source.now() >= deadline,
        None => false,
    }
}

/// Returns the total deadline extension (in seconds) applied to a cycle.
pub fn get_deadline_extension(env: &Env, group_id: u64, cycle: u32) -> u64 {
    let ext_key = StorageKeyBuilder::deadline_extension(group_id, cycle);
    env.storage().persistent().get(&ext_key).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::{
        DEFAULT_TEST_TIMESTAMP, NON_EXISTENT_GROUP_ID, ONE_HOUR_SECONDS, ONE_WEEK_SECONDS,
        STROOPS_PER_XLM, THREE_HOURS_SECONDS, TWO_HOURS_SECONDS,
    };
    use crate::time_source::FixedTimeSource;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn setup_group(env: &Env, creator: &Address) -> u64 {
        let group_id = 1u64;
        let group = Group::new(
            group_id,
            creator.clone(),
            STROOPS_PER_XLM,        // 1 XLM in stroops
            ONE_WEEK_SECONDS,       // 1 week duration
            5,
            DEFAULT_TEST_TIMESTAMP, // created_at
        );
        let key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&key, &group);
        group_id
    }

    // ── Existing regression tests ─────────────────────────────────────────────

    #[test]
    fn test_extend_deadline_success() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let result = extend_deadline(&env, creator.clone(), group_id, 0, ONE_HOUR_SECONDS);
        assert!(result.is_ok());

        let ext = get_deadline_extension(&env, group_id, 0);
        assert_eq!(ext, ONE_HOUR_SECONDS);
    }

    #[test]
    fn test_extend_deadline_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        extend_deadline(&env, creator.clone(), group_id, 0, ONE_HOUR_SECONDS).unwrap();
        extend_deadline(&env, creator.clone(), group_id, 0, TWO_HOURS_SECONDS).unwrap();

        let ext = get_deadline_extension(&env, group_id, 0);
        assert_eq!(ext, THREE_HOURS_SECONDS);
    }

    #[test]
    fn test_extend_deadline_max_allowed() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let result = extend_deadline(&env, creator.clone(), group_id, 0, MAX_EXTENSION_SECONDS);
        assert!(result.is_ok());
    }

    #[test]
    fn test_extend_deadline_exceeds_max() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let result = extend_deadline(
            &env,
            creator.clone(),
            group_id,
            0,
            MAX_EXTENSION_SECONDS + 1,
        );
        assert_eq!(result, Err(StellarSaveError::DeadlineExtensionExceedsMax));
    }

    #[test]
    fn test_extend_deadline_zero_seconds() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let result = extend_deadline(&env, creator.clone(), group_id, 0, 0);
        assert_eq!(result, Err(StellarSaveError::DeadlineExtensionExceedsMax));
    }

    #[test]
    fn test_extend_deadline_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let caller = Address::generate(&env);

        let result = extend_deadline(&env, caller, NON_EXISTENT_GROUP_ID, 0, ONE_HOUR_SECONDS);
        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    #[test]
    fn test_extend_deadline_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let other = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let result = extend_deadline(&env, other, group_id, 0, ONE_HOUR_SECONDS);
        assert_eq!(result, Err(StellarSaveError::Unauthorized));
    }

    #[test]
    fn test_extend_deadline_inactive_group() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        // Deactivate the group
        let key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&key).unwrap();
        group.deactivate();
        env.storage().persistent().set(&key, &group);

        let result = extend_deadline(&env, creator, group_id, 0, ONE_HOUR_SECONDS);
        assert_eq!(result, Err(StellarSaveError::InvalidState));
    }

    #[test]
    fn test_extend_deadline_different_cycles_independent() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        extend_deadline(&env, creator.clone(), group_id, 0, ONE_HOUR_SECONDS).unwrap();
        extend_deadline(&env, creator.clone(), group_id, 1, TWO_HOURS_SECONDS).unwrap();

        assert_eq!(get_deadline_extension(&env, group_id, 0), ONE_HOUR_SECONDS);
        assert_eq!(get_deadline_extension(&env, group_id, 1), TWO_HOURS_SECONDS);
    }

    #[test]
    fn test_get_deadline_extension_default_zero() {
        let env = Env::default();
        // No extension stored — should return 0
        assert_eq!(get_deadline_extension(&env, 1, 0), 0);
    }

    // ── New boundary / time-source tests ─────────────────────────────────────

    /// Verify that the public `extend_deadline` wrapper and the
    /// `extend_deadline_with_time` variant produce identical storage outcomes.
    #[test]
    fn test_extend_deadline_with_time_uses_injected_timestamp() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        // Use a fixed timestamp far in the past to distinguish it from ledger time.
        let ts = FixedTimeSource::new(500_000);
        let result =
            extend_deadline_with_time(&env, creator.clone(), group_id, 0, 3600, &ts);
        assert!(result.is_ok(), "should succeed with injected time source");

        let ext = get_deadline_extension(&env, group_id, 0);
        assert_eq!(ext, 3600);
    }

    /// `effective_deadline` returns the correct value without any extension.
    ///
    /// Group: created_at = 1_000_000, cycle_duration = 604_800 (1 week)
    /// Cycle 0: deadline = 1_000_000 + 604_800 * 1 = 1_604_800
    #[test]
    fn test_effective_deadline_no_extension() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let deadline = effective_deadline(&env, group_id, 0);
        // created_at(1_000_000) + cycle_duration(604_800) * (0+1)
        assert_eq!(deadline, Some(1_604_800));
    }

    /// `effective_deadline` incorporates any stored extension.
    #[test]
    fn test_effective_deadline_with_extension() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        extend_deadline(&env, creator.clone(), group_id, 0, 3600).unwrap();

        let deadline = effective_deadline(&env, group_id, 0);
        // 1_604_800 + 3_600
        assert_eq!(deadline, Some(1_608_400));
    }

    /// `effective_deadline` for a later cycle (cycle 2) is further out.
    ///
    /// Cycle 2: deadline = 1_000_000 + 604_800 * 3 = 2_814_400
    #[test]
    fn test_effective_deadline_cycle_2() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let deadline = effective_deadline(&env, group_id, 2);
        assert_eq!(deadline, Some(2_814_400));
    }

    /// `effective_deadline` returns `None` for an unknown group.
    #[test]
    fn test_effective_deadline_unknown_group() {
        let env = Env::default();
        assert_eq!(effective_deadline(&env, 9999, 0), None);
    }

    /// Boundary: timestamp **one second before** the deadline → not past.
    #[test]
    fn test_is_past_deadline_one_second_before() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        // Deadline for cycle 0 = 1_604_800
        let ts = FixedTimeSource::new(1_604_799); // one second before
        assert!(!is_past_deadline(&env, group_id, 0, &ts));
    }

    /// Boundary: timestamp **exactly at** the deadline → past (inclusive).
    #[test]
    fn test_is_past_deadline_exact_boundary() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        // Deadline for cycle 0 = 1_604_800
        let ts = FixedTimeSource::new(1_604_800); // exact deadline
        assert!(is_past_deadline(&env, group_id, 0, &ts));
    }

    /// Boundary: timestamp **one second after** the deadline → past.
    #[test]
    fn test_is_past_deadline_one_second_after() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        // Deadline for cycle 0 = 1_604_800
        let ts = FixedTimeSource::new(1_604_801); // one second after
        assert!(is_past_deadline(&env, group_id, 0, &ts));
    }

    /// Boundary: verify `is_past_deadline` respects a stored extension.
    ///
    /// After adding a 3 600-second extension, the deadline becomes 1_608_400.
    /// Timestamp of 1_604_800 (old deadline) should no longer be "past".
    #[test]
    fn test_is_past_deadline_after_extension_boundary() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        extend_deadline(&env, creator.clone(), group_id, 0, 3600).unwrap();
        // New deadline = 1_608_400

        // Old deadline — now before the new deadline, so NOT past.
        let ts_before = FixedTimeSource::new(1_604_800);
        assert!(!is_past_deadline(&env, group_id, 0, &ts_before));

        // Exactly at the new deadline — IS past.
        let ts_exact = FixedTimeSource::new(1_608_400);
        assert!(is_past_deadline(&env, group_id, 0, &ts_exact));

        // One second after new deadline — IS past.
        let ts_after = FixedTimeSource::new(1_608_401);
        assert!(is_past_deadline(&env, group_id, 0, &ts_after));
    }

    /// Post-deadline scenario: `is_past_deadline` returns `false` for an
    /// unknown group (no group → no deadline → defensively not past).
    #[test]
    fn test_is_past_deadline_unknown_group() {
        let env = Env::default();
        let ts = FixedTimeSource::new(u64::MAX);
        // Should not panic; should return false because the group doesn't exist.
        assert!(!is_past_deadline(&env, 9999, 0, &ts));
    }
}
