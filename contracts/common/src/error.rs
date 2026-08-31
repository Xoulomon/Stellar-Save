//! Canonical error type shared by every contract in the workspace.

use soroban_sdk::{contracterror, contracttype};

/// Canonical failure conditions shared across all Stellar-Save contracts.
///
/// Codes are reserved in the range `1..=99` and are stable across contract
/// versions: clients decode them identically no matter which contract trapped.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // Access control (1-19)
    /// The caller is not permitted to perform this operation.
    Unauthorized = 1,

    /// The account is not present on the contract's allowlist.
    NotAllowlisted = 2,

    // Resource lifecycle (20-39)
    /// The requested entity does not exist.
    NotFound = 20,

    /// The entity already exists and cannot be created again.
    AlreadyExists = 21,

    /// The entity is not in a state that permits this operation.
    InvalidState = 22,

    // Input and value validation (40-59)
    /// A supplied argument failed validation.
    InvalidInput = 40,

    /// The supplied amount is zero, negative, or outside the accepted range.
    InvalidAmount = 41,

    /// A configured or protocol-level limit would be exceeded.
    LimitExceeded = 42,

    // Token movement (60-79)
    /// The account holds less than the amount required.
    InsufficientBalance = 60,

    /// A token transfer did not complete.
    TransferFailed = 61,

    // System (80-99)
    /// An arithmetic operation overflowed.
    Overflow = 80,

    /// An unexpected internal failure occurred.
    InternalError = 81,
}

impl Error {
    /// Returns the stable numeric code carried on-chain for this error.
    pub fn code(&self) -> u32 {
        *self as u32
    }

    /// Returns the category this error belongs to, derived from its code range.
    pub fn category(&self) -> ErrorCategory {
        match self.code() {
            1..=19 => ErrorCategory::Access,
            20..=39 => ErrorCategory::Resource,
            40..=59 => ErrorCategory::Validation,
            60..=79 => ErrorCategory::Token,
            _ => ErrorCategory::System,
        }
    }

    /// Returns a human-readable message intended for logs and debugging.
    ///
    /// Clients should branch on [`Error::code`] rather than on this string.
    pub fn message(&self) -> &'static str {
        match self {
            Error::Unauthorized => "The caller is not authorized to perform this operation.",
            Error::NotAllowlisted => "The account is not on the contract's allowlist.",
            Error::NotFound => "The requested entity does not exist.",
            Error::AlreadyExists => "The entity already exists.",
            Error::InvalidState => "The entity is not in a valid state for this operation.",
            Error::InvalidInput => "One or more arguments failed validation.",
            Error::InvalidAmount => "The amount is zero, negative, or out of range.",
            Error::LimitExceeded => "A configured limit would be exceeded.",
            Error::InsufficientBalance => "The account balance is insufficient.",
            Error::TransferFailed => "The token transfer did not complete.",
            Error::Overflow => "An arithmetic operation overflowed.",
            Error::InternalError => "An unexpected internal error occurred.",
        }
    }
}

/// Coarse grouping of [`Error`] variants by code range.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ErrorCategory {
    /// Authorization and allowlist failures.
    Access,

    /// Missing, duplicate, or wrongly-staged entities.
    Resource,

    /// Rejected arguments, amounts, and limits.
    Validation,

    /// Balance and transfer failures.
    Token,

    /// Overflow and internal failures.
    System,
}

/// Result alias for operations that fail with the canonical [`Error`].
pub type CommonResult<T> = Result<T, Error>;

// === Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable() {
        assert_eq!(Error::Unauthorized.code(), 1);
        assert_eq!(Error::NotAllowlisted.code(), 2);
        assert_eq!(Error::NotFound.code(), 20);
        assert_eq!(Error::AlreadyExists.code(), 21);
        assert_eq!(Error::InvalidState.code(), 22);
        assert_eq!(Error::InvalidInput.code(), 40);
        assert_eq!(Error::InvalidAmount.code(), 41);
        assert_eq!(Error::LimitExceeded.code(), 42);
        assert_eq!(Error::InsufficientBalance.code(), 60);
        assert_eq!(Error::TransferFailed.code(), 61);
        assert_eq!(Error::Overflow.code(), 80);
        assert_eq!(Error::InternalError.code(), 81);
    }

    #[test]
    fn codes_stay_below_the_contract_specific_range() {
        // Contract-local enums start at 100; canonical codes must never reach it.
        for error in every_error() {
            assert!(error.code() >= 1 && error.code() <= 99);
        }
    }

    #[test]
    fn categories_follow_code_ranges() {
        assert_eq!(Error::Unauthorized.category(), ErrorCategory::Access);
        assert_eq!(Error::NotAllowlisted.category(), ErrorCategory::Access);
        assert_eq!(Error::NotFound.category(), ErrorCategory::Resource);
        assert_eq!(Error::AlreadyExists.category(), ErrorCategory::Resource);
        assert_eq!(Error::InvalidState.category(), ErrorCategory::Resource);
        assert_eq!(Error::InvalidInput.category(), ErrorCategory::Validation);
        assert_eq!(Error::InvalidAmount.category(), ErrorCategory::Validation);
        assert_eq!(Error::LimitExceeded.category(), ErrorCategory::Validation);
        assert_eq!(Error::InsufficientBalance.category(), ErrorCategory::Token);
        assert_eq!(Error::TransferFailed.category(), ErrorCategory::Token);
        assert_eq!(Error::Overflow.category(), ErrorCategory::System);
        assert_eq!(Error::InternalError.category(), ErrorCategory::System);
    }

    #[test]
    fn every_variant_has_a_distinct_code() {
        let errors = every_error();
        for i in 0..errors.len() {
            for j in (i + 1)..errors.len() {
                assert_ne!(errors[i].code(), errors[j].code());
            }
        }
    }

    #[test]
    fn every_variant_has_a_message() {
        for error in every_error() {
            assert!(!error.message().is_empty());
        }
    }

    #[test]
    fn common_result_carries_the_canonical_error() {
        let ok: CommonResult<u32> = Ok(7);
        let err: CommonResult<u32> = Err(Error::TransferFailed);
        assert_eq!(ok, Ok(7));
        assert_eq!(err, Err(Error::TransferFailed));
    }

    fn every_error() -> [Error; 12] {
        [
            Error::Unauthorized,
            Error::NotAllowlisted,
            Error::NotFound,
            Error::AlreadyExists,
            Error::InvalidState,
            Error::InvalidInput,
            Error::InvalidAmount,
            Error::LimitExceeded,
            Error::InsufficientBalance,
            Error::TransferFailed,
            Error::Overflow,
            Error::InternalError,
        ]
    }
}
