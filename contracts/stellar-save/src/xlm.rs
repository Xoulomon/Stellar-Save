use soroban_sdk::{token, Address, Env};

pub const STROOPS_PER_XLM: i128 = 10_000_000;

/// Convenience wrapper: transfer XLM between addresses.
pub fn transfer(env: &Env, token_id: &Address, from: &Address, to: &Address, amount: i128) {
    token::TokenClient::new(env, token_id).transfer(from, to, &amount);
}
