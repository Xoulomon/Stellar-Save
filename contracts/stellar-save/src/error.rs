//! Error surface for the Stellar-Save contract.
//!
//! The domain enum lives in [`crate::errors`] and keeps its own stable codes
//! (`1000+`), which clients already depend on. The canonical cross-contract
//! enum from `stellar-save-common` is re-exported here so shared code and
//! callers can speak one vocabulary, with [`to_common`] mapping a domain error
//! onto its canonical equivalent.

/// Re-export from errors module for backward compatibility.
/// This module is maintained for compatibility with existing code.
/// New code should import directly from the errors module.
pub use crate::errors::{ContractError as StellarSaveError, ContractResult, ErrorCategory, ErrorRecoveryStrategy};

pub use stellar_save_common::{CommonResult, Error as CommonError, ErrorCategory as CommonErrorCategory};

use crate::errors::ContractError;

/// Maps a Stellar-Save domain error onto the canonical shared error.
///
/// Lossy by design: several domain errors collapse onto one canonical variant.
/// Use it when handing a failure to a caller that only understands the shared
/// vocabulary; keep the domain error whenever the extra precision is useful.
pub fn to_common(error: ContractError) -> CommonError {
    match error {
        // Access
        ContractError::Unauthorized => CommonError::Unauthorized,
        ContractError::NotInvited => CommonError::Unauthorized,

        // Resource lifecycle
        ContractError::GroupNotFound => CommonError::NotFound,
        ContractError::ContributionNotFound => CommonError::NotFound,
        ContractError::AlreadyMember => CommonError::AlreadyExists,
        ContractError::AlreadyContributed => CommonError::AlreadyExists,
        ContractError::AlreadyRefunded => CommonError::AlreadyExists,
        ContractError::AlreadyVoted => CommonError::AlreadyExists,
        ContractError::AlreadyVotedDissolve => CommonError::AlreadyExists,
        ContractError::PayoutAlreadyProcessed => CommonError::AlreadyExists,
        ContractError::RewardAlreadyClaimed => CommonError::AlreadyExists,
        ContractError::NotMember => CommonError::NotFound,
        ContractError::InvalidState => CommonError::InvalidState,
        ContractError::CycleNotComplete => CommonError::InvalidState,
        ContractError::DeadlineNotReached => CommonError::InvalidState,
        ContractError::CycleDeadlineExpired => CommonError::InvalidState,
        ContractError::DisputeActive => CommonError::InvalidState,
        ContractError::GroupAlreadyDissolved => CommonError::InvalidState,
        ContractError::GroupNotArchivable => CommonError::InvalidState,
        ContractError::RefundNotEligible => CommonError::InvalidState,
        ContractError::RewardNotEligible => CommonError::InvalidState,
        ContractError::InvalidRecipient => CommonError::InvalidState,

        // Input and value validation
        ContractError::InvalidMetadata => CommonError::InvalidInput,
        ContractError::MergeIncompatible => CommonError::InvalidInput,
        ContractError::InvalidToken => CommonError::InvalidInput,
        ContractError::InvalidAmount => CommonError::InvalidAmount,
        ContractError::ContributionTooLow => CommonError::InvalidAmount,
        ContractError::ContributionTooHigh => CommonError::InvalidAmount,
        ContractError::GroupFull => CommonError::LimitExceeded,
        ContractError::MaxMembersExceeded => CommonError::LimitExceeded,
        ContractError::DeadlineExtensionExceedsMax => CommonError::LimitExceeded,

        // Token movement
        ContractError::InsufficientBalance => CommonError::InsufficientBalance,
        ContractError::TokenTransferFailed => CommonError::TransferFailed,
        ContractError::PayoutFailed => CommonError::TransferFailed,

        // System
        ContractError::Overflow => CommonError::Overflow,
        ContractError::InternalError => CommonError::InternalError,
        ContractError::DataCorruption => CommonError::InternalError,
        ContractError::ReentrancyDetected => CommonError::InternalError,
    }
}

// === Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domain_codes_never_collide_with_canonical_codes() {
        // Canonical codes are reserved at 1..=99; every domain code sits above.
        for error in domain_errors() {
            assert!(error.code() >= 100);
        }
    }

    #[test]
    fn access_errors_map_to_the_canonical_access_category() {
        assert_eq!(
            to_common(StellarSaveError::Unauthorized).category(),
            CommonErrorCategory::Access
        );
        assert_eq!(
            to_common(StellarSaveError::NotInvited).category(),
            CommonErrorCategory::Access
        );
    }

    #[test]
    fn transfer_failures_map_to_the_canonical_token_category() {
        assert_eq!(
            to_common(StellarSaveError::TokenTransferFailed),
            CommonError::TransferFailed
        );
        assert_eq!(
            to_common(StellarSaveError::PayoutFailed),
            CommonError::TransferFailed
        );
        assert_eq!(
            to_common(StellarSaveError::InsufficientBalance),
            CommonError::InsufficientBalance
        );
    }

    #[test]
    fn missing_entities_map_to_not_found() {
        assert_eq!(to_common(StellarSaveError::GroupNotFound), CommonError::NotFound);
        assert_eq!(to_common(StellarSaveError::NotMember), CommonError::NotFound);
        assert_eq!(
            to_common(StellarSaveError::ContributionNotFound),
            CommonError::NotFound
        );
    }

    #[test]
    fn every_domain_error_maps_to_a_canonical_error() {
        for error in domain_errors() {
            // A canonical code is always in the reserved range.
            let code = to_common(error).code();
            assert!(code >= 1 && code <= 99);
        }
    }

    fn domain_errors() -> [StellarSaveError; 38] {
        [
            StellarSaveError::GroupNotFound,
            StellarSaveError::GroupFull,
            StellarSaveError::MaxMembersExceeded,
            StellarSaveError::InvalidState,
            StellarSaveError::InvalidMetadata,
            StellarSaveError::AlreadyMember,
            StellarSaveError::NotMember,
            StellarSaveError::Unauthorized,
            StellarSaveError::InvalidAmount,
            StellarSaveError::AlreadyContributed,
            StellarSaveError::CycleNotComplete,
            StellarSaveError::ContributionNotFound,
            StellarSaveError::DeadlineNotReached,
            StellarSaveError::ContributionTooLow,
            StellarSaveError::ContributionTooHigh,
            StellarSaveError::InsufficientBalance,
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
            StellarSaveError::CycleDeadlineExpired,
            StellarSaveError::MergeIncompatible,
            StellarSaveError::NotInvited,
            StellarSaveError::DisputeActive,
            StellarSaveError::GroupNotArchivable,
            StellarSaveError::DeadlineExtensionExceedsMax,
            StellarSaveError::AlreadyVotedDissolve,
            StellarSaveError::GroupAlreadyDissolved,
            StellarSaveError::AlreadyVoted,
        ]
    }
}
