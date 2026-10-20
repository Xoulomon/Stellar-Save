//! Error types for Stellar-Save contract operations.
//!
//! This module re-exports the canonical [`StellarSaveError`] enum from the
//! `error` module. The `ContractError` type alias is kept for backward
//! compatibility with external consumers and documentation.
//!
//! Error codes are stable across contract versions for client compatibility.

use crate::error::{
    ContractResult, ErrorCategory, ErrorRecoveryStrategy, StellarSaveError,
};

/// Backward-compatible alias for [`StellarSaveError`].
///
/// This type alias preserves the `ContractError` name used in existing
/// documentation and external integrations. All error codes remain unchanged.
pub type ContractError = StellarSaveError;

/// Re-export of [`StellarSaveError::message()`].
impl StellarSaveError {
    /// Returns a human-readable error message for the error type.
    pub fn message(&self) -> &'static str {
        StellarSaveError::message(self)
    }

    /// Returns the error code for this error.
    pub fn code(&self) -> u32 {
        StellarSaveError::code(self)
    }

    /// Returns the error category based on the error code range.
    pub fn category(&self) -> ErrorCategory {
        StellarSaveError::category(self)
    }
}

/// Re-export of [`ErrorRecoveryStrategy`].
pub use crate::error::ErrorRecoveryStrategy;

/// Result type alias for contract operations.
pub type ContractResult<T> = ContractResult<T>;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::StellarSaveError;

    #[test]
    fn contract_error_alias_matches_stellar_save_error() {
        let err: ContractError = StellarSaveError::GroupNotFound;
        assert_eq!(err.code(), 1001);
        assert_eq!(err.message(), "The specified group does not exist. Please verify the group ID.");
    }

    #[test]
    fn all_contract_error_codes_are_stable() {
        // Every numeric code must match the values defined in the enum.
        assert_eq!(StellarSaveError::GroupNotFound.code(), 1001);
        assert_eq!(StellarSaveError::GroupFull.code(), 1002);
        assert_eq!(StellarSaveError::InvalidState.code(), 1003);
        assert_eq!(StellarSaveError::InvalidMetadata.code(), 1004);
        assert_eq!(StellarSaveError::MaxMembersExceeded.code(), 1005);
        assert_eq!(StellarSaveError::DisputeActive.code(), 1006);
        assert_eq!(StellarSaveError::GroupNotArchivable.code(), 1007);
        assert_eq!(StellarSaveError::MergeIncompatible.code(), 1008);
        assert_eq!(StellarSaveError::AlreadyMember.code(), 2001);
        assert_eq!(StellarSaveError::NotMember.code(), 2002);
        assert_eq!(StellarSaveError::Unauthorized.code(), 2003);
        assert_eq!(StellarSaveError::NotInvited.code(), 2004);
        assert_eq!(StellarSaveError::AlreadyVoted.code(), 2005);
        assert_eq!(StellarSaveError::InvalidAmount.code(), 3001);
        assert_eq!(StellarSaveError::AlreadyContributed.code(), 3002);
        assert_eq!(StellarSaveError::CycleNotComplete.code(), 3003);
        assert_eq!(StellarSaveError::ContributionNotFound.code(), 3004);
        assert_eq!(StellarSaveError::DeadlineNotReached.code(), 3005);
        assert_eq!(StellarSaveError::ContributionTooLow.code(), 3006);
        assert_eq!(StellarSaveError::ContributionTooHigh.code(), 3007);
        assert_eq!(StellarSaveError::InsufficientBalance.code(), 3008);
        assert_eq!(StellarSaveError::CycleDeadlineExpired.code(), 3009);
        assert_eq!(StellarSaveError::InvalidProof.code(), 3010);
        assert_eq!(StellarSaveError::PayoutFailed.code(), 4001);
        assert_eq!(StellarSaveError::PayoutAlreadyProcessed.code(), 4002);
        assert_eq!(StellarSaveError::InvalidRecipient.code(), 4003);
        assert_eq!(StellarSaveError::InvalidToken.code(), 5001);
        assert_eq!(StellarSaveError::TokenTransferFailed.code(), 5002);
        assert_eq!(StellarSaveError::RewardAlreadyClaimed.code(), 6001);
        assert_eq!(StellarSaveError::RewardNotEligible.code(), 6002);
        assert_eq!(StellarSaveError::AlreadyRefunded.code(), 6003);
        assert_eq!(StellarSaveError::RefundNotEligible.code(), 6004);
        assert_eq!(StellarSaveError::InternalError.code(), 9001);
        assert_eq!(StellarSaveError::DataCorruption.code(), 9002);
        assert_eq!(StellarSaveError::Overflow.code(), 9003);
        assert_eq!(StellarSaveError::ReentrancyDetected.code(), 9004);
    }

    #[test]
    fn no_unconstructed_variant_remains() {
        // Every variant in StellarSaveError must have a non-empty message.
        let all_errors = [
            StellarSaveError::GroupNotFound,
            StellarSaveError::GroupFull,
            StellarSaveError::InvalidState,
            StellarSaveError::InvalidMetadata,
            StellarSaveError::MaxMembersExceeded,
            StellarSaveError::DisputeActive,
            StellarSaveError::GroupNotArchivable,
            StellarSaveError::MergeIncompatible,
            StellarSaveError::AlreadyMember,
            StellarSaveError::NotMember,
            StellarSaveError::Unauthorized,
            StellarSaveError::NotInvited,
            StellarSaveError::AlreadyVoted,
            StellarSaveError::InvalidAmount,
            StellarSaveError::AlreadyContributed,
            StellarSaveError::CycleNotComplete,
            StellarSaveError::ContributionNotFound,
            StellarSaveError::DeadlineNotReached,
            StellarSaveError::ContributionTooLow,
            StellarSaveError::ContributionTooHigh,
            StellarSaveError::InsufficientBalance,
            StellarSaveError::InvalidProof,
            StellarSaveError::CycleDeadlineExpired,
            StellarSaveError::PayoutFailed,
            StellarSaveError::PayoutAlreadyProcessed,
            StellarSaveError::InvalidRecipient,
            StellarSaveError::InvalidToken,
            StellarSaveError::TokenTransferFailed,
            StellarSaveError::RewardAlreadyClaimed,
            StellarSaveError::RewardNotEligible,
            StellarSaveError::AlreadyRefunded,
            StellarSaveError::RefundNotEligible,
            StellarSaveError::InternalError,
            StellarSaveError::DataCorruption,
            StellarSaveError::Overflow,
            StellarSaveError::ReentrancyDetected,
        ];
        for err in all_errors {
            assert!(!err.message().is_empty(), "Variant {:?} has no message", err);
        }
    }
}