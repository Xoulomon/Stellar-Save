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
//! - `error`: Comprehensive error types and handling
//! - `group`: Core Group data structure and state management
//! - `payout`: Payout record tracking for fund distributions

pub mod error;
pub mod group;
pub mod payout;

// Re-export for convenience
pub use error::{StellarSaveError, ErrorCategory, ContractResult};
pub use group::{Group, GroupStatus};
pub use payout::PayoutRecord;
