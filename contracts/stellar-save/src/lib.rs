#![no_std]

//! # Stellar-Save Smart Contract
//!
//! A decentralized rotational savings and credit association (ROSCA) built on Stellar Soroban.
//!
//! ## Module layout
//! - `types`:   Core contract-level types (`ContractConfig`, `MemberProfile`, etc.)
//! - `contract`: All `#[contractimpl]` entry-point methods (thin facades to domain modules)
//! - `group`, `contribution`, `payout`, `storage`, …: Domain modules
//! - Test modules (`*_tests`, `test_utils`, etc.) are gated with `#[cfg(test)]`
//!   and do not appear in production builds.
//!
//! ## Upgrade / migration path
//!
//! `stellar-save` is **not upgradeable in place**. The contract exposes no
//! `upgrade`, `migrate`, or admin-gated WASM-replacement entrypoint, and the
//! deployed contract address is immutable once installed. This is an explicit
//! design constraint: pool, contribution, and payout storage are keyed by the
//! contract instance, so replacing the WASM would silently orphan existing
//! storage data.
//!
//! Because there is no in-place upgrade path, there is no migration test to
//! write for an upgrade simulation. Any future version must be deployed as a
//! new contract address, and existing state must be migrated by reading from
//! the old contract and writing to the new one at the application layer.
//!
//! The `migration` and `migrations` modules below provide *data-shape*
//! migrations for storage written by earlier versions of this same contract
//! (e.g. schema/version bumps), not WASM upgrades.

pub mod auth;
// `clone` is an intended-but-unfinished feature: clone_group / CloneOverrides are
// fully implemented and tested but no contract entry-point in contract.rs calls
// them.  Gate behind `clone-group` so the dead code is excluded from production
// WASM until the entry-point is wired.  To integrate: add a `clone_group`
// entry-point to contract.rs that delegates to `crate::clone::clone_group`, then
// enable the feature in the release profile.  See Cargo.toml [features] for the
// tracking note.
#[cfg(feature = "clone-group")]
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
pub mod pause;
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
pub mod time_source;
pub mod token;
pub mod types;
// ZK proof verification (Ed25519 Phase-1 scheme, zk/CIRCUIT_AUDIT.md).
// Excluded from the default build — enable with `--features zk`.
// The circuit audit must close (issue #1327) before this ships by default.
#[cfg(feature = "zk")]
pub mod zk_proof;

// ── Unfinished / not-yet-wired features ───────────────────────────────────────
// These modules are fully implemented and tested but are not yet exposed through
// any #[contractimpl] entry-point in contract.rs.  They are compiled only when
// the corresponding feature flag is enabled, keeping the default production WASM
// free of dead code.  See Cargo.toml [features] for full tracking notes.

// `group-templates` feature — list_templates / get_template / create_group_from_template.
// Wire to contract.rs entry-points when the frontend template-picker flow is ready.
// Docs: docs/group-templates.md
#[cfg(feature = "group-templates")]
pub mod templates;

// mod auto_contribution_tests;
// mod invitation_tests;
#[cfg(test)]
pub mod test_utils;
// mod merge_tests;
// mod migration_matrix_tests;
// mod migration_tests;
// mod milestone_tests;
// mod multi_token_tests;
// mod mutation_tests;
// mod upgrade_tests;

// ZK test modules — only compiled when the `zk` feature is active.
// Run with: cargo test -p stellar-save --features zk
#[cfg(all(test, feature = "zk"))]
mod zk_tests;
#[cfg(all(test, feature = "zk"))]
mod zk_integration_tests;

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

