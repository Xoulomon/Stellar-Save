/// Re-export from errors module for backward compatibility.
/// This module is maintained for compatibility with existing code.
/// New code should import directly from the errors module.
pub use crate::errors::{ContractError as StellarSaveError, ContractResult, ErrorCategory, ErrorRecoveryStrategy};
