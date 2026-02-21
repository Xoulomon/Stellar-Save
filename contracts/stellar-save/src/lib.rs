#![no_std]

//! # Stellar-Save Smart Contract
//! 
//! A decentralized rotational savings and credit association (ROSCA) built on Stellar Soroban.
//! 
//! This contract enables groups to pool funds in a rotating savings system where:
//! - Members contribute a fixed amount each cycle
//! - One member receives the total pool each cycle
//! - The process rotates until all members have received a payout
//! 
//! ## Modules
//! - `group`: Core Group data structure and state management

pub mod group;

// Re-export for convenience
pub use group::Group;
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct StellarSaveContract;

#[contractimpl]
impl StellarSaveContract {
    pub fn hello(env: Env) -> soroban_sdk::Symbol {
        soroban_sdk::symbol_short!("hello")
    }
}
