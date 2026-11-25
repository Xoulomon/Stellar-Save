//! Contract-wide emergency pause (#2089).
//!
//! Group-level pause (`pause_group` / `unpause_group`) is a separate mechanism
//! and is unchanged. This module owns only the contract-wide flag, stored under
//! `StorageKeyBuilder::emergency_pause()`. The v1 to v2 migration initialises
//! that flag to `false`, so existing deployments behave as before until an
//! admin pauses them.

use soroban_sdk::{Address, Env};

use crate::auth;
use crate::error::StellarSaveError;
use crate::events::EventEmitter;
use crate::storage::StorageKeyBuilder;

/// Returns true when the admin has paused the whole contract.
pub fn is_contract_paused(env: &Env) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&StorageKeyBuilder::emergency_pause())
        .unwrap_or(false)
}

/// Rejects the call with `ContractPaused` while the contract is paused.
pub fn require_not_paused(env: &Env) -> Result<(), StellarSaveError> {
    if is_contract_paused(env) {
        return Err(StellarSaveError::ContractPaused);
    }
    Ok(())
}

/// Sets the contract-wide pause flag. Admin only.
///
/// Idempotent: setting the flag to its current value succeeds without
/// emitting a second event.
pub fn set_contract_paused(
    env: &Env,
    admin: &Address,
    paused: bool,
) -> Result<(), StellarSaveError> {
    auth::require_admin(env, admin)?;

    if is_contract_paused(env) == paused {
        return Ok(());
    }

    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::emergency_pause(), &paused);

    let now = env.ledger().timestamp();
    if paused {
        EventEmitter::emit_contract_paused(env, admin.clone(), now);
    } else {
        EventEmitter::emit_contract_unpaused(env, admin.clone(), now);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn is_contract_paused_defaults_to_false() {
        let env = Env::default();
        let contract_id = Address::generate(&env);
        env.as_contract(&contract_id, || {
            assert!(!is_contract_paused(&env));
        });
    }

    #[test]
    fn require_not_paused_rejects_when_flag_is_set() {
        let env = Env::default();
        let contract_id = Address::generate(&env);
        env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::emergency_pause(), &true);
            assert_eq!(
                require_not_paused(&env),
                Err(StellarSaveError::ContractPaused)
            );
        });
    }

    #[test]
    fn require_not_paused_allows_when_flag_is_clear() {
        let env = Env::default();
        let contract_id = Address::generate(&env);
        env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::emergency_pause(), &false);
            assert_eq!(require_not_paused(&env), Ok(()));
        });
    }

    #[test]
    fn set_contract_paused_rejects_non_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = Address::generate(&env);
        let caller = Address::generate(&env);
        env.as_contract(&contract_id, || {
            assert_eq!(
                set_contract_paused(&env, &caller, true),
                Err(StellarSaveError::Unauthorized)
            );
            assert!(!is_contract_paused(&env));
        });
    }
}
