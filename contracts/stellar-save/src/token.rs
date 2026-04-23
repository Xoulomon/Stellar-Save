//! Token validation utilities for the Stellar-Save contract.
//!
//! This module provides helpers for validating SEP-41-compliant token contracts
//! before they are accepted as the token for a savings group.

use soroban_sdk::{token::TokenClient, Address, Env};

use crate::StellarSaveError;

/// Maximum allowed token decimal precision.
///
/// Tokens with more than 38 decimal places are rejected because amounts
/// expressed in their base units would overflow `i128` for any meaningful
/// contribution value.
const MAX_TOKEN_DECIMALS: u32 = 38;

/// Validates a token address by calling `decimals()` on the SEP-41 token contract.
///
/// # Arguments
/// * `env`           - Soroban environment
/// * `token_address` - Address of the token contract to validate
///
/// # Returns
/// * `Ok(decimals)` — the token contract is callable, implements `decimals()`,
///   and the returned value is in the range `[0, 38]`.
/// * `Err(StellarSaveError::InvalidToken)` — the `decimals()` value exceeds 38.
///
/// # Panics / Traps
/// If `token_address` does not refer to a deployed contract, or the contract
/// does not implement the SEP-41 `decimals()` function, the Soroban runtime
/// will trap the invocation.  The trap propagates as a contract error to the
/// caller, which surfaces as `StellarSaveError::InvalidToken` at the
/// `create_group` boundary.
pub fn validate_token(env: &Env, token_address: &Address) -> Result<u32, StellarSaveError> {
    let client = TokenClient::new(env, token_address);
    let decimals = client.decimals();

    if decimals > MAX_TOKEN_DECIMALS {
        return Err(StellarSaveError::InvalidToken);
    }

    Ok(decimals)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::TokenClient,
        Address, Env,
    };

    /// Deploy a mock SEP-41 token (Stellar Asset Contract) in the test environment.
    fn deploy_mock_token(env: &Env, admin: &Address) -> Address {
        let token_address = env.register_stellar_asset_contract_v2(admin.clone());
        token_address.address()
    }

    #[test]
    fn test_validate_token_valid_7_decimals() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token_address = deploy_mock_token(&env, &admin);

        // Stellar Asset Contracts report 7 decimals
        let result = validate_token(&env, &token_address);
        assert_eq!(result, Ok(7));
    }

    #[test]
    fn test_validate_token_returns_decimals() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token_address = deploy_mock_token(&env, &admin);

        let client = TokenClient::new(&env, &token_address);
        let expected_decimals = client.decimals();

        let result = validate_token(&env, &token_address);
        assert_eq!(result, Ok(expected_decimals));
    }
}
