// Re-export the canonical stroop/XLM conversion constant from the shared crate
// so that callers within this crate do not need to depend on stellar-save-common
// directly for this one constant.
pub use stellar_save_common::constants::STROOPS_PER_XLM;

use soroban_sdk::{token, Address, Env};

/// Convenience wrapper: transfer XLM between addresses.
pub fn transfer(env: &Env, token_id: &Address, from: &Address, to: &Address, amount: i128) {
    token::TokenClient::new(env, token_id).transfer(from, to, &amount);
}
