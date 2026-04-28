use soroban_sdk::{Address, Env, Symbol};

use crate::{
    error::StellarSaveError,
    events::EventEmitter,
    group::{Group, GroupStatus, TokenConfig},
    storage::StorageKeyBuilder,
};

/// Creates a new group by copying the configuration of an existing group.
///
/// The clone inherits `contribution_amount`, `cycle_duration`, `max_members`,
/// `min_members`, and `grace_period_seconds` from the source group, plus its
/// token configuration. Any of these can be overridden via the `overrides`
/// parameter. The new group starts in `Pending` state with zero members.
///
/// # Arguments
/// * `env`       - Soroban environment
/// * `caller`    - Address of the caller (becomes creator of the new group)
/// * `group_id`  - ID of the group to clone
/// * `overrides` - Optional parameter overrides; `None` values keep the source value
///
/// # Returns
/// The new group's ID.
///
/// # Errors
/// * `GroupNotFound` - Source group does not exist
pub fn clone_group(
    env: &Env,
    caller: Address,
    group_id: u64,
    overrides: CloneOverrides,
) -> Result<u64, StellarSaveError> {
    caller.require_auth();

    // Load source group
    let src_key = StorageKeyBuilder::group_data(group_id);
    let src: Group = env
        .storage()
        .persistent()
        .get(&src_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Load source token config
    let token_config_key = StorageKeyBuilder::group_token_config(group_id);
    let token_config: TokenConfig = env
        .storage()
        .persistent()
        .get(&token_config_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Generate new group ID (mirrors StellarSaveContract::increment_group_id)
    let id_key = StorageKeyBuilder::next_group_id();
    let current_id: u64 = env.storage().persistent().get(&id_key).unwrap_or(0);
    let new_id = current_id
        .checked_add(1)
        .ok_or(StellarSaveError::Overflow)?;
    env.storage().persistent().set(&id_key, &new_id);

    // Apply overrides
    let contribution_amount = overrides.contribution_amount.unwrap_or(src.contribution_amount);
    let cycle_duration = overrides.cycle_duration.unwrap_or(src.cycle_duration);
    let max_members = overrides.max_members.unwrap_or(src.max_members);
    let min_members = overrides.min_members.unwrap_or(src.min_members);
    let grace_period_seconds = overrides.grace_period_seconds.unwrap_or(src.grace_period_seconds);

    let now = env.ledger().timestamp();
    let new_group = Group::new(
        new_id,
        caller.clone(),
        contribution_amount,
        cycle_duration,
        max_members,
        min_members,
        now,
        grace_period_seconds,
    );

    // Persist new group
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::group_data(new_id), &new_group);

    // Persist status as Pending
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::group_status(new_id), &GroupStatus::Pending);

    // Copy token config (use override token if provided, else copy source)
    let new_token_config = match overrides.token_address {
        Some(addr) => TokenConfig {
            token_address: addr,
            token_decimals: token_config.token_decimals,
        },
        None => token_config,
    };
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::group_token_config(new_id), &new_token_config);

    // Emit GroupCloned event
    EventEmitter::emit_group_cloned(env, group_id, new_id, caller.clone(), now);

    // Also emit GroupCreated so existing listeners pick it up
    env.events().publish(
        (Symbol::new(env, "GroupCreated"), caller),
        (new_id, new_token_config.token_address),
    );

    Ok(new_id)
}

/// Optional overrides for cloned group parameters.
/// `None` means "inherit from source group".
pub struct CloneOverrides {
    pub contribution_amount: Option<i128>,
    pub cycle_duration: Option<u64>,
    pub max_members: Option<u32>,
    pub min_members: Option<u32>,
    pub grace_period_seconds: Option<u64>,
    pub token_address: Option<Address>,
}

impl CloneOverrides {
    /// No overrides — clone everything from the source.
    pub fn none() -> Self {
        Self {
            contribution_amount: None,
            cycle_duration: None,
            max_members: None,
            min_members: None,
            grace_period_seconds: None,
            token_address: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn setup_source_group(env: &Env, creator: &Address) -> u64 {
        let group_id = 1u64;
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000, // 1 XLM
            604_800,    // 1 week
            5,          // max_members
            2,          // min_members
            1_000_000,  // created_at
            0,          // grace_period_seconds
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Pending);

        let token = Address::generate(env);
        let token_config = TokenConfig {
            token_address: token,
            token_decimals: 7,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_token_config(group_id), &token_config);

        // Set ID counter so next ID = 2
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &1u64);

        group_id
    }

    #[test]
    fn test_clone_group_inherits_config() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &creator);

        let new_id = clone_group(&env, creator.clone(), src_id, CloneOverrides::none()).unwrap();
        assert_eq!(new_id, 2);

        let new_group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(new_id))
            .unwrap();

        assert_eq!(new_group.contribution_amount, 10_000_000);
        assert_eq!(new_group.cycle_duration, 604_800);
        assert_eq!(new_group.max_members, 5);
        assert_eq!(new_group.min_members, 2);
        assert_eq!(new_group.creator, creator);
        assert_eq!(new_group.member_count, 0);
        assert_eq!(new_group.current_cycle, 0);
    }

    #[test]
    fn test_clone_group_status_is_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &creator);

        let new_id = clone_group(&env, creator, src_id, CloneOverrides::none()).unwrap();

        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(new_id))
            .unwrap();
        assert_eq!(status, GroupStatus::Pending);
    }

    #[test]
    fn test_clone_group_with_overrides() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &creator);

        let new_id = clone_group(
            &env,
            creator.clone(),
            src_id,
            CloneOverrides {
                contribution_amount: Some(20_000_000),
                cycle_duration: Some(1_209_600), // 2 weeks
                max_members: Some(10),
                min_members: Some(3),
                grace_period_seconds: Some(86_400),
                token_address: None,
            },
        )
        .unwrap();

        let new_group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(new_id))
            .unwrap();

        assert_eq!(new_group.contribution_amount, 20_000_000);
        assert_eq!(new_group.cycle_duration, 1_209_600);
        assert_eq!(new_group.max_members, 10);
        assert_eq!(new_group.min_members, 3);
        assert_eq!(new_group.grace_period_seconds, 86_400);
    }

    #[test]
    fn test_clone_group_different_creator() {
        let env = Env::default();
        env.mock_all_auths();
        let original_creator = Address::generate(&env);
        let new_creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &original_creator);

        let new_id = clone_group(&env, new_creator.clone(), src_id, CloneOverrides::none()).unwrap();

        let new_group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(new_id))
            .unwrap();

        assert_eq!(new_group.creator, new_creator);
        assert_ne!(new_group.creator, original_creator);
    }

    #[test]
    fn test_clone_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let caller = Address::generate(&env);

        let result = clone_group(&env, caller, 9999, CloneOverrides::none());
        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    #[test]
    fn test_clone_group_increments_id_counter() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &creator);

        let id1 = clone_group(&env, creator.clone(), src_id, CloneOverrides::none()).unwrap();
        let id2 = clone_group(&env, creator.clone(), src_id, CloneOverrides::none()).unwrap();

        assert_eq!(id2, id1 + 1);
    }

    #[test]
    fn test_clone_group_copies_token_config() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &creator);

        let src_token: TokenConfig = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_token_config(src_id))
            .unwrap();

        let new_id = clone_group(&env, creator, src_id, CloneOverrides::none()).unwrap();

        let new_token: TokenConfig = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_token_config(new_id))
            .unwrap();

        assert_eq!(new_token.token_address, src_token.token_address);
        assert_eq!(new_token.token_decimals, src_token.token_decimals);
    }

    #[test]
    fn test_clone_group_override_token() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &creator);
        let new_token_addr = Address::generate(&env);

        let new_id = clone_group(
            &env,
            creator,
            src_id,
            CloneOverrides {
                token_address: Some(new_token_addr.clone()),
                ..CloneOverrides::none()
            },
        )
        .unwrap();

        let new_token: TokenConfig = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_token_config(new_id))
            .unwrap();

        assert_eq!(new_token.token_address, new_token_addr);
    }

    #[test]
    fn test_clone_group_source_unchanged() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let src_id = setup_source_group(&env, &creator);

        let src_before: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(src_id))
            .unwrap();

        clone_group(&env, creator, src_id, CloneOverrides::none()).unwrap();

        let src_after: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(src_id))
            .unwrap();

        assert_eq!(src_before, src_after);
    }
}
