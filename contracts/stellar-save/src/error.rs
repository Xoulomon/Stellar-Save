//! Error surface for the Stellar-Save contract.
//!
//! The domain enum lives in [`crate::errors`] and keeps its own stable codes
//! (`1000+`), which clients already depend on. This module is a thin
//! re-export shim maintained for backward compatibility with code that
//! imports from `crate::error`. New code should import directly from
//! [`crate::errors`].

/// Re-export from errors module for backward compatibility.
pub use crate::errors::{
    ContractError as StellarSaveError, ContractResult, ErrorCategory, ErrorRecoveryStrategy,
};
