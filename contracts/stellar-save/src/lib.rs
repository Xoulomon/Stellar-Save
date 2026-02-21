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
//! - `payout`: Payout record tracking for fund distributions
//! - `storage`: Storage key structure for efficient data access
//! - `status`: Group lifecycle status enum with state transitions
//! - `events`: Event definitions for contract actions

pub mod events;
pub mod group;
pub mod payout;
pub mod status;
pub mod storage;

// Re-export for convenience
pub use group::Group;
pub use payout::PayoutRecord;
pub use status::{GroupStatus, StatusError};
pub use storage::{StorageKey, StorageKeyBuilder};
pub use events::EventEmitter;
