use soroban_sdk::{contracterror, contracttype};

/// Comprehensive error types for Stellar-Save contract operations.
/// 
/// Each error has a unique code and represents a specific failure condition
/// that can occur during contract execution. Error codes are designed to be
/// stable across contract versions for client compatibility.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StellarSaveError {
    // Group-related errors (1000-1999)
    /// The specified group ID does not exist.
    /// Error Code: 1001
    GroupNotFound = 1001,
    
    /// The group has reached its maximum member capacity.
    /// Error Code: 1002
    GroupFull = 1002,
    
    /// The group is not in a valid state for the requested operation.
    /// Error Code: 1003
    InvalidState = 1003,
    
    // Member-related errors (2000-2999)
    /// The address is already a member of this group.
    /// Error Code: 2001
    AlreadyMember = 2001,
    
    /// The address is not a member of this group.
    /// Error Code: 2002
    NotMember = 2002,
    
    /// The caller is not authorized to perform this operation.
    /// Error Code: 2003
    Unauthorized = 2003,
    
    // Contribution-related errors (3000-3999)
    /// The contribution amount is invalid (zero, negative, or incorrect).
    /// Error Code: 3001
    InvalidAmount = 3001,
    
    /// The member has already contributed for the current cycle.
    /// Error Code: 3002
    AlreadyContributed = 3002,
    
    /// The current cycle is not complete (missing contributions).
    /// Error Code: 3003
    CycleNotComplete = 3003,
    
    // Payout-related errors (4000-4999)
    /// The payout operation failed due to insufficient funds or transfer error.
    /// Error Code: 4001
    PayoutFailed = 4001,
    
    /// The payout has already been processed for this cycle.
    /// Error Code: 4002
    PayoutAlreadyProcessed = 4002,
    
    /// The recipient is not eligible for payout in this cycle.
    /// Error Code: 4003
    InvalidRecipient = 4003,
    
    // System-related errors (9000-9999)
    /// An internal contract error occurred.
    /// Error Code: 9001
    InternalError = 9001,
    
    /// The contract data is corrupted or invalid.
    /// Error Code: 9002
    DataCorruption = 9002,

    /// Added for ID Generation: The counter has reached its maximum limit.
    /// Error Code: 9003
    Overflow = 9003,
}

impl StellarSaveError {
    /// Returns a human-readable error message for the error type.
    /// 
    /// These messages are intended for debugging and logging purposes.
    /// Client applications should use error codes for programmatic handling.
    pub fn message(&self) -> &'static str {
        match self {
            // Group-related errors
            StellarSaveError::GroupNotFound => {
                "The specified group does not exist. Please verify the group ID."
            }
            StellarSaveError::GroupFull => {
                "The group has reached its maximum member capacity. No new members can join."
            }
            StellarSaveError::InvalidState => {
                "The group is not in a valid state for this operation. Check group status."
            }
            
            // Member-related errors
            StellarSaveError::AlreadyMember => {
                "This address is already a member of the group."
            }
            StellarSaveError::NotMember => {
                "This address is not a member of the group. Only members can perform this action."
            }
            StellarSaveError::Unauthorized => {
                "You are not authorized to perform this operation. Check permissions."
            }
            
            // Contribution-related errors
            StellarSaveError::InvalidAmount => {
                "The contribution amount is invalid. Must be positive and match group requirements."
            }
            StellarSaveError::AlreadyContributed => {
                "You have already contributed for the current cycle. Wait for the next cycle."
            }
            StellarSaveError::CycleNotComplete => {
                "The current cycle is not complete. All members must contribute before payout."
            }
            
            // Payout-related errors
            StellarSaveError::PayoutFailed => {
                "The payout operation failed. This may be due to insufficient contract funds or transfer restrictions."
            }
            StellarSaveError::PayoutAlreadyProcessed => {
                "The payout has already been processed for this cycle."
            }
            StellarSaveError::InvalidRecipient => {
                "The specified recipient is not eligible for payout in this cycle."
            }
            
            // System-related errors
            StellarSaveError::InternalError => {
                "An internal contract error occurred. Please try again or contact support."
            }
            StellarSaveError::DataCorruption => {
                "Contract data appears to be corrupted. This is a critical error."
            }
        }
    }
    
    /// Returns the numeric error code for this error type.
    /// 
    /// Error codes are stable across contract versions and should be used
    /// by client applications for programmatic error handling.
    pub fn code(&self) -> u32 {
        *self as u32
    }
    
    /// Returns the error category based on the error code range.
    pub fn category(&self) -> ErrorCategory {
        match self.code() {
            1000..=1999 => ErrorCategory::Group,
            2000..=2999 => ErrorCategory::Member,
            3000..=3999 => ErrorCategory::Contribution,
            4000..=4999 => ErrorCategory::Payout,
            9000..=9999 => ErrorCategory::System,
            _ => ErrorCategory::Unknown,
        }
    }
    
    pub fn message(&self) -> &'static str {
    match self {
        // ... existing matches ...
        StellarSaveError::Overflow => {
            "The ID counter has reached its maximum limit. No more IDs can be generated."
        }
    }
}

/// Error categories for grouping related error types.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ErrorCategory {
    /// Errors related to group operations and state.
    Group,
    
    /// Errors related to member management and permissions.
    Member,
    
    /// Errors related to contribution processing.
    Contribution,
    
    /// Errors related to payout operations.
    Payout,
    
    /// System-level errors and internal failures.
    System,
    
    /// Unknown or uncategorized errors.
    Unknown,
}

/// Result type alias for contract operations.
/// 
/// This provides a convenient way to return either a success value
/// or a StellarSaveError from contract functions.
pub type ContractResult<T> = Result<T, StellarSaveError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        // Test that error codes match expected values
        assert_eq!(StellarSaveError::GroupNotFound.code(), 1001);
        assert_eq!(StellarSaveError::GroupFull.code(), 1002);
        assert_eq!(StellarSaveError::InvalidState.code(), 1003);
        
        assert_eq!(StellarSaveError::AlreadyMember.code(), 2001);
        assert_eq!(StellarSaveError::NotMember.code(), 2002);
        assert_eq!(StellarSaveError::Unauthorized.code(), 2003);
        
        assert_eq!(StellarSaveError::InvalidAmount.code(), 3001);
        assert_eq!(StellarSaveError::AlreadyContributed.code(), 3002);
        assert_eq!(StellarSaveError::CycleNotComplete.code(), 3003);
        
        assert_eq!(StellarSaveError::PayoutFailed.code(), 4001);
        assert_eq!(StellarSaveError::PayoutAlreadyProcessed.code(), 4002);
        assert_eq!(StellarSaveError::InvalidRecipient.code(), 4003);
        
        assert_eq!(StellarSaveError::InternalError.code(), 9001);
        assert_eq!(StellarSaveError::DataCorruption.code(), 9002);
    }

    #[test]
    fn test_error_categories() {
        // Test error categorization
        assert_eq!(StellarSaveError::GroupNotFound.category(), ErrorCategory::Group);
        assert_eq!(StellarSaveError::GroupFull.category(), ErrorCategory::Group);
        
        assert_eq!(StellarSaveError::AlreadyMember.category(), ErrorCategory::Member);
        assert_eq!(StellarSaveError::NotMember.category(), ErrorCategory::Member);
        
        assert_eq!(StellarSaveError::InvalidAmount.category(), ErrorCategory::Contribution);
        assert_eq!(StellarSaveError::AlreadyContributed.category(), ErrorCategory::Contribution);
        
        assert_eq!(StellarSaveError::PayoutFailed.category(), ErrorCategory::Payout);
        assert_eq!(StellarSaveError::PayoutAlreadyProcessed.category(), ErrorCategory::Payout);
        
        assert_eq!(StellarSaveError::InternalError.category(), ErrorCategory::System);
        assert_eq!(StellarSaveError::DataCorruption.category(), ErrorCategory::System);
    }

    #[test]
    fn test_error_messages() {
        // Test that all errors have non-empty messages
        let errors = [
            StellarSaveError::GroupNotFound,
            StellarSaveError::GroupFull,
            StellarSaveError::InvalidState,
            StellarSaveError::AlreadyMember,
            StellarSaveError::NotMember,
            StellarSaveError::Unauthorized,
            StellarSaveError::InvalidAmount,
            StellarSaveError::AlreadyContributed,
            StellarSaveError::CycleNotComplete,
            StellarSaveError::PayoutFailed,
            StellarSaveError::PayoutAlreadyProcessed,
            StellarSaveError::InvalidRecipient,
            StellarSaveError::InternalError,
            StellarSaveError::DataCorruption,
        ];

        for error in &errors {
            let message = error.message();
            assert!(!message.is_empty(), "Error {:?} has empty message", error);
            assert!(message.len() > 10, "Error {:?} has too short message", error);
        }
    }

    #[test]
    fn test_error_ordering() {
        // Test that errors can be ordered (useful for sorting)
        assert!(StellarSaveError::GroupNotFound < StellarSaveError::GroupFull);
        assert!(StellarSaveError::AlreadyMember < StellarSaveError::NotMember);
        assert!(StellarSaveError::InvalidAmount < StellarSaveError::AlreadyContributed);
    }

    #[test]
    fn test_contract_result_type() {
        // Test the ContractResult type alias
        let success: ContractResult<u32> = Ok(42);
        let failure: ContractResult<u32> = Err(StellarSaveError::GroupNotFound);
        
        assert!(success.is_ok());
        assert!(failure.is_err());
        
        match failure {
            Err(StellarSaveError::GroupNotFound) => {}, // Expected
            _ => panic!("Unexpected result"),
        }
    }
}