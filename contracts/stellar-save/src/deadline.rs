use soroban_sdk::{Address, Env};

use crate::{
    error::StellarSaveError,
    events::EventEmitter,
    group::Group,
    storage::StorageKeyBuilder,
};

/// Maximum allowed extension per call: 7 days in seconds.
pub const MAX_EXTENSION_SECONDS: u64 = 7 * 24 * 60 * 60; // 604_800

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
        .checked_add(group.cycle_duration.checked_mul(cycle as u64 + 1).ok_or(StellarSaveError::InternalError)?)
        .ok_or(StellarSaveError::InternalError)?;
    let new_deadline = base_deadline
        .checked_add(new_total)
        .ok_or(StellarSaveError::InternalError)?;

    let now = env.ledger().timestamp();
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

/// Returns the total deadline extension (in seconds) applied to a cycle.
pub fn get_deadline_extension(env: &Env, group_id: u64, cycle: u32) -> u64 {
    let ext_key = StorageKeyBuilder::deadline_extension(group_id, cycle);
    env.storage().persistent().get(&ext_key).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn setup_group(env: &Env, creator: &Address) -> u64 {
        let group_id = 1u64;
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000, // 1 XLM
            604_800,    // 1 week
            5,
            1_000_000,  // created_at
        );
        let key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&key, &group);
        group_id
    }

    #[test]
    fn test_extend_deadline_success() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let result = extend_deadline(&env, creator.clone(), group_id, 0, 3600);
        assert!(result.is_ok());

        let ext = get_deadline_extension(&env, group_id, 0);
        assert_eq!(ext, 3600);
    }

    #[test]
    fn test_extend_deadline_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        extend_deadline(&env, creator.clone(), group_id, 0, 3600).unwrap();
        extend_deadline(&env, creator.clone(), group_id, 0, 7200).unwrap();

        let ext = get_deadline_extension(&env, group_id, 0);
        assert_eq!(ext, 10_800);
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

        let result = extend_deadline(&env, creator.clone(), group_id, 0, MAX_EXTENSION_SECONDS + 1);
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

        let result = extend_deadline(&env, caller, 9999, 0, 3600);
        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    #[test]
    fn test_extend_deadline_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let other = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        let result = extend_deadline(&env, other, group_id, 0, 3600);
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

        let result = extend_deadline(&env, creator, group_id, 0, 3600);
        assert_eq!(result, Err(StellarSaveError::InvalidState));
    }

    #[test]
    fn test_extend_deadline_different_cycles_independent() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let group_id = setup_group(&env, &creator);

        extend_deadline(&env, creator.clone(), group_id, 0, 3600).unwrap();
        extend_deadline(&env, creator.clone(), group_id, 1, 7200).unwrap();

        assert_eq!(get_deadline_extension(&env, group_id, 0), 3600);
        assert_eq!(get_deadline_extension(&env, group_id, 1), 7200);
    }

    #[test]
    fn test_get_deadline_extension_default_zero() {
        let env = Env::default();
        // No extension stored — should return 0
        assert_eq!(get_deadline_extension(&env, 1, 0), 0);
    }
}
