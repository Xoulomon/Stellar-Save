//! Backward-compatibility re-export shim.
//!
//! All error types now live in [`crate::errors`], which is the single source of
//! truth. This module re-exports them under their original names so that any
//! code compiled against an earlier version of the crate continues to compile
//! without changes.
//!
//! **New code should import from [`crate::errors`] directly.**

pub use crate::errors::{
    ContractError, ContractResult, ErrorCategory, ErrorRecoveryStrategy, StellarSaveError,
};
