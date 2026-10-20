//! Storage key definitions for the Stellar-Save contract.
//!
//! This module is a thin re-export of [`keys`](crate::keys). All
//! [`StorageKey`] variants and [`StorageKeyBuilder`] constructors are
//! defined in `keys.rs`, which is the single source of truth for the
//! key namespace. The `storage_optimization.rs` module has been retired.

pub use crate::keys::*;
