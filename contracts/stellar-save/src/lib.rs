#![no_std]

//! # Stellar-Save Smart Contract
//!
//! A decentralized rotational savings and credit association (ROSCA) built on Stellar Soroban.
//!
//! ## Module layout
//! - `types`:   Core contract-level types (`ContractConfig`, `MemberProfile`, etc.)
//! - `contract`: All `#[contractimpl]` entry-point methods (thin facades to domain modules)
//! - `group`, `contribution`, `payout`, `storage`, …: Domain modules

pub mod admin_actions_tests;
pub mod auth;
pub mod clone;
pub mod constants;
pub mod contract;
pub mod contribution;
pub mod cycle_advancement;
pub mod deadline;
pub mod error;
pub mod errors;
pub mod events;
pub mod governance;
pub mod group;
pub mod helpers;
pub mod migration;
pub mod migrations;
pub mod payout;
pub mod payout_executor;
pub mod penalty;
pub mod pool;
pub mod rating;
pub mod refund;
pub mod repository;
pub mod search;
pub mod status;
pub mod storage;
pub mod storage_benchmark;
pub mod storage_optimization;
pub mod token;
pub mod types;

// mod auto_contribution_tests;
pub mod cei_tests;
pub mod gas_benchmark;
pub mod insurance_integration_tests;
pub mod test_utils;
// mod invitation_tests;
// mod merge_tests;
// mod migration_matrix_tests;
// mod migration_tests;
// mod milestone_tests;
pub mod milestones;
// mod multi_token_tests;
// mod mutation_tests;
// mod upgrade_tests;
pub mod wrapping_audit;
pub mod zk_tests;

// ── Re-exports ────────────────────────────────────────────────────────────────
pub use auth::{is_active_member, require_admin, require_creator, require_member};
pub use contract::{StellarSaveContract, StellarSaveContractClient};
pub use contribution::{ContributionPage, ContributionRecord};
pub use error::{ContractResult, ErrorCategory, StellarSaveError};
pub use errors::{ContractError, ErrorRecoveryStrategy};
pub use events::EventEmitter;
pub use events::*;
pub use group::{Group, GroupStatus};
pub use payout::PayoutRecord;
pub use storage::StorageKeyBuilder;
pub use types::{ContractConfig, MemberProfile};
