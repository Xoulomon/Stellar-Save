//! Non-Fungible Token Core Module.
//!
//! Handles base token state, initialization, minting logic, authorization,
//! and standard non-fungible token trait implementations.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};
use stellar_save_common::admin::require_owner;
use stellar_tokens::non_fungible::{
    burnable::NonFungibleBurnable, enumerable::Enumerable, Base, NonFungibleToken,
};

#[contracttype]
pub enum DataKey {
    Owner,
}

#[contract]
pub struct ExampleContract;

#[contractimpl]
impl ExampleContract {
    pub fn __constructor(e: &Env, uri: String, name: String, symbol: String, owner: Address) {
        e.storage().instance().set(&DataKey::Owner, &owner);
        Base::set_metadata(e, uri, name, symbol);
    }

    pub fn mint(e: &Env, to: Address) -> u32 {
        // Require auth from the stored owner.
        // Delegates to stellar_save_common::admin::require_owner so the
        // instance-storage owner-auth pattern is not duplicated here and in
        // guess-the-number.
        require_owner(e, &DataKey::Owner);
        Enumerable::sequential_mint(e, &to)
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for ExampleContract {
    type ContractType = Enumerable;
}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for ExampleContract {}
