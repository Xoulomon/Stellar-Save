use soroban_sdk::{contracterror, contracttype};

/// Comprehensive error types for Stellar-Save contract operations.
///
/// Each error has a unique code and represents a specific failure condition
/// that can occur during contract execution. Error codes are designed to be
/// stable across contract versions for client compatibility.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    // Group-related errors (1000-1999)
    /// The specified group ID does not exist.
    /// Error Code: 1001
    GroupNotFound = 1001,

    /// The group has reached its maximum member capacity.
    /// Error Code: 1002
    GroupFull = 1002,

    /// The requested max_members exceeds the protocol-level MAX_MEMBERS cap (20).
    /// Error Code: 1005
    MaxMembersExceeded = 1005,

    /// The group is not in a valid state for the requested operation.
    /// Error Code: 1003
    InvalidState = 1003,

    /// Invalid metadata provided (name, description, or image_url).
    /// Error Code: 1004
    InvalidMetadata = 1004,

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

    /// The contribution record was not found.
    /// Error Code: 3004
    ContributionNotFound = 3004,

    /// The cycle deadline has not yet been reached.
    /// Error Code: 3005
    DeadlineNotReached = 3005,
    /// The contribution amount is below the configured minimum.
    /// Error Code: 3006
    ContributionTooLow = 3006,

    /// The contribution amount exceeds the configured maximum.
    /// Error Code: 3007
    ContributionTooHigh = 3007,

    /// The member's token balance is insufficient for auto-contribution.
    /// Error Code: 3008
    InsufficientBalance = 3008,

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

    // Token-related errors (5000-5999)
    /// The token address failed SEP-41 validation or is not on the allowlist.
    /// Error Code: 5001
    InvalidToken = 5001,

    /// The SEP-41 transfer_from or transfer call failed during contribution or payout.
    /// Error Code: 5002
    TokenTransferFailed = 5002,

    // Reward-related errors (6000-6999)
    /// The member has already claimed their completion reward.
    /// Error Code: 6001
    RewardAlreadyClaimed = 6001,

    /// The member is not eligible to claim a completion reward.
    /// Error Code: 6002
    RewardNotEligible = 6002,

    /// The contribution has already been refunded.
    /// Error Code: 6003
    AlreadyRefunded = 6003,

    /// Refund is not eligible: group is active and payout has already occurred for this cycle.
    /// Error Code: 6004
    RefundNotEligible = 6004,

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

    /// The cycle deadline has passed; contributions are no longer accepted.
    /// Error Code: 3005
    CycleDeadlineExpired = 3005,

    /// The two groups are not compatible for merging (different contribution amount or cycle duration).
    /// Error Code: 1005
    MergeIncompatible = 1005,

    /// The address has not been invited to join this invitation-only group.
    /// Error Code: 2004
    NotInvited = 2004,

    /// A dispute is currently active for this group; payouts are blocked.
    /// Error Code: 1006
    DisputeActive = 1006,

    /// The group cannot be archived because it is not in a terminal state (Completed or Cancelled).
    /// Error Code: 1007
    GroupNotArchivable = 1007,

    // Deadline-related errors (7000-7999)
    /// The requested deadline extension exceeds the maximum allowed (7 days), or is zero.
    /// Error Code: 7001
    DeadlineExtensionExceedsMax = 7001,

    /// The member has already voted to dissolve this group.
    /// Error Code: 7002
    AlreadyVotedDissolve = 7002,

    /// The group has already been dissolved.
    /// Error Code: 7003
    GroupAlreadyDissolved = 7003,
    /// The member has already voted on the current dispute.
    /// Error Code: 2005
    AlreadyVoted = 2005,
}

impl ContractError {
    /// Returns a human-readable error message for the error type.
    ///
    /// These messages are intended for debugging and logging purposes.
    /// Client applications should use error codes for programmatic handling.
    pub fn message(&self) -> &'static str {
        match self {
            // Group-related errors
            ContractError::GroupNotFound => {
                "The specified group does not exist. Please verify the group ID."
            }
            ContractError::GroupFull => {
                "The group has reached its maximum member capacity. No new members can join."
            }
            ContractError::InvalidState => {
                "The group is not in a valid state for this operation. Check group status."
            }
            ContractError::InvalidMetadata => {
                "Invalid metadata provided. Name must be 3-50 characters, description 0-500 characters."
            }
            ContractError::MergeIncompatible => {
                "The two groups are not compatible for merging. Both must have the same contribution amount and cycle duration."
            }
            ContractError::DisputeActive => {
                "A dispute is currently active for this group. Payouts are blocked until the dispute is resolved."
            }
            ContractError::GroupNotArchivable => {
                "The group cannot be archived because it is not in a terminal state (Completed or Cancelled)."
            }

            // Member-related errors
            ContractError::AlreadyMember => {
                "This address is already a member of the group."
            }
            ContractError::NotMember => {
                "This address is not a member of the group. Only members can perform this action."
            }
            ContractError::Unauthorized => {
                "You are not authorized to perform this operation. Check permissions."
            }
            ContractError::NotInvited => {
                "This address has not been invited to join the group. Only invited addresses can join invitation-only groups."
            }

            // Contribution-related errors
            ContractError::InvalidAmount => {
                "The contribution amount is invalid. Must be positive and match group requirements."
            }
            ContractError::AlreadyContributed => {
                "You have already contributed for the current cycle. Wait for the next cycle."
            }
            ContractError::CycleNotComplete => {
                "The current cycle is not complete. All members must contribute before payout."
            }
            ContractError::ContributionNotFound => {
                "The contribution record was not found for the specified member and cycle."
            }
            ContractError::DeadlineNotReached => {
                "The cycle deadline has not yet been reached. Cannot advance cycle until deadline passes."
            }
            ContractError::ContributionTooLow => {
                "The contribution amount is below the configured minimum limit."
            }
            ContractError::ContributionTooHigh => {
                "The contribution amount exceeds the configured maximum limit."
            }
            ContractError::InsufficientBalance => {
                "The member's token balance is insufficient to cover the auto-contribution amount."
            }
            ContractError::CycleDeadlineExpired => {
                "The cycle deadline has passed. Contributions are no longer accepted for this cycle."
            }

            // Payout-related errors
            ContractError::PayoutFailed => {
                "The payout operation failed. This may be due to insufficient contract funds or transfer restrictions."
            }
            ContractError::PayoutAlreadyProcessed => {
                "The payout has already been processed for this cycle."
            }
            ContractError::InvalidRecipient => {
                "The specified recipient is not eligible for payout in this cycle."
            }

            // Token-related errors
            ContractError::InvalidToken => {
                "The token address failed SEP-41 validation or is not on the allowed token list."
            }
            ContractError::TokenTransferFailed => {
                "The token transfer failed. Ensure the member has granted sufficient allowance to the contract."
            }

            // Reward-related errors
            ContractError::RewardAlreadyClaimed => {
                "You have already claimed your completion reward for this group."
            }
            ContractError::RewardNotEligible => {
                "You are not eligible to claim a completion reward. Only members who completed all cycles are eligible."
            }
            ContractError::AlreadyRefunded => {
                "This contribution has already been refunded."
            }
            ContractError::RefundNotEligible => {
                "Refund is not eligible: the group is active and a payout has already occurred for this cycle."
            }

            // System-related errors
            ContractError::InternalError => {
                "An internal contract error occurred. Please try again or contact support."
            }
            ContractError::DataCorruption => {
                "Contract data appears to be corrupted. This is a critical error."
            }
            ContractError::Overflow => {
                "The ID counter has reached its maximum limit. No more IDs can be generated."
            }

            // Deadline-related errors
            ContractError::DeadlineExtensionExceedsMax => {
                "The requested deadline extension exceeds the maximum allowed (7 days), or is zero."
            }

            // Dissolution errors
            ContractError::AlreadyVotedDissolve => {
                "You have already voted to dissolve this group."
            }
            ContractError::GroupAlreadyDissolved => {
                "The group has already been dissolved or completed."
            }
            ContractError::AlreadyVoted => {
                "You have already raised a dispute for this group. Each member may only vote once per dispute round."
            }
        }
    }

    /// Returns the error code for this error.
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
            5000..=5999 => ErrorCategory::Token,
            6000..=6999 => ErrorCategory::Reward,
            7000..=7999 => ErrorCategory::Deadline,
            9000..=9999 => ErrorCategory::System,
            _ => ErrorCategory::Unknown,
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

    /// Errors related to token validation and transfer operations.
    Token,

    /// Errors related to completion reward operations.
    Reward,

    /// Errors related to deadline extension operations.
    Deadline,

    /// System-level errors and internal failures.
    System,

    /// Unknown or uncategorized errors.
    Unknown,
}

/// Result type alias for contract operations.
///
/// This provides a convenient way to return either a success value
/// or a ContractError from contract functions.
pub type ContractResult<T> = Result<T, ContractError>;

/// Error recovery strategies for different error types.
///
/// This module provides guidance on how to recover from different error conditions.
pub struct ErrorRecoveryStrategy;

impl ErrorRecoveryStrategy {
    /// Returns recovery guidance for a given error.
    pub fn recovery_guidance(error: &ContractError) -> &'static str {
        match error {
            // Group errors - recovery strategies
            ContractError::GroupNotFound => {
                "Verify the group ID is correct. Check if the group has been deleted or if you're using the correct contract instance."
            }
            ContractError::GroupFull => {
                "Wait for a member to leave the group or create a new group with higher max_members capacity."
            }
            ContractError::InvalidState => {
                "Check the group's current status. Some operations are only available in specific states (e.g., Active, Paused)."
            }
            ContractError::InvalidMetadata => {
                "Check that the group name is 3-50 characters and description is 0-500 characters."
            }
            ContractError::MergeIncompatible => {
                "Ensure both groups have the same contribution_amount and cycle_duration before merging."
            }
            ContractError::DisputeActive => {
                "A dispute is active for this group. Wait for the dispute to be resolved before payouts can proceed."
            }
            ContractError::GroupNotArchivable => {
                "Only groups in a terminal state (Completed or Cancelled) can be archived. Wait until the group finishes all cycles or is cancelled."
            }

            // Member errors - recovery strategies
            ContractError::AlreadyMember => {
                "You are already a member of this group. Leave the group first if you want to rejoin."
            }
            ContractError::NotMember => {
                "Join the group first before attempting member-only operations."
            }
            ContractError::Unauthorized => {
                "Ensure you have the required permissions. Only group creators can pause/resume/cancel groups. Only members can contribute."
            }
            ContractError::NotInvited => {
                "Ask the group creator to invite your address before attempting to join."
            }

            // Contribution errors - recovery strategies
            ContractError::InvalidAmount => {
                "Ensure the contribution amount matches the group's required amount exactly and is positive."
            }
            ContractError::AlreadyContributed => {
                "You have already contributed for this cycle. Wait for the next cycle to contribute again."
            }
            ContractError::CycleNotComplete => {
                "Not all members have contributed yet. Wait for all members to contribute before executing payout."
            }
            ContractError::ContributionNotFound => {
                "The contribution record doesn't exist. Verify the member and cycle number are correct."
            }
            ContractError::DeadlineNotReached => {
                "The cycle deadline has not yet passed. Wait until the deadline is reached before calling tick()."
            }
            ContractError::ContributionTooLow => {
                "Increase the contribution amount to meet the configured minimum."
            }
            ContractError::ContributionTooHigh => {
                "Decrease the contribution amount to stay within the configured maximum."
            }
            ContractError::InsufficientBalance => {
                "Ensure your token balance is sufficient to cover the contribution amount before the cycle starts, or disable auto-contribution."
            }
            ContractError::CycleDeadlineExpired => {
                "The cycle deadline has passed. Contributions are no longer accepted for this cycle."
            }

            // Payout errors - recovery strategies
            ContractError::PayoutFailed => {
                "Ensure the contract has sufficient funds and the recipient's wallet can receive transfers. Check network conditions."
            }
            ContractError::PayoutAlreadyProcessed => {
                "This payout has already been executed. Move to the next cycle for the next payout."
            }
            ContractError::InvalidRecipient => {
                "The recipient is not eligible for payout in this cycle. Check the payout queue order."
            }

            // Token errors - recovery strategies
            ContractError::InvalidToken => {
                "Ensure the token address refers to a valid SEP-41 token contract. If an allowlist is configured, verify the token has been added by the admin."
            }
            ContractError::TokenTransferFailed => {
                "Ensure you have called `approve` on the token contract granting the StellarSave contract an allowance of at least the contribution amount before calling `contribute`."
            }

            // Reward errors - recovery strategies
            ContractError::RewardAlreadyClaimed => {
                "You have already claimed your reward for this group. Each member can only claim once."
            }
            ContractError::RewardNotEligible => {
                "Only members who contributed in every cycle are eligible. Verify your contribution history."
            }
            ContractError::AlreadyRefunded => {
                "This contribution has already been refunded. Each contribution can only be refunded once."
            }
            ContractError::RefundNotEligible => {
                "Refund is not eligible. The group is active and a payout has already occurred for this cycle."
            }

            // System errors - recovery strategies
            ContractError::InternalError => {
                "This is an internal contract error. Try the operation again. If it persists, contact support."
            }
            ContractError::DataCorruption => {
                "Critical data corruption detected. This requires immediate investigation and potential contract upgrade."
            }
            ContractError::Overflow => {
                "The ID counter has reached its maximum. This is extremely rare and requires contract upgrade."
            }

            // Deadline errors - recovery strategies
            ContractError::DeadlineExtensionExceedsMax => {
                "Provide an extension between 1 and 604800 seconds (7 days). Split larger extensions across multiple calls."
            }

            // Dissolution errors - recovery strategies
            ContractError::AlreadyVotedDissolve => {
                "Each member can only vote once to dissolve a group."
            }
            ContractError::GroupAlreadyDissolved => {
                "The group is already in a terminal state and cannot be dissolved again."
            }
        }
    }

    /// Determines if an error is retryable.
    pub fn is_retryable(error: &ContractError) -> bool {
        matches!(
            error,
            ContractError::PayoutFailed
                | ContractError::InternalError
                | ContractError::CycleNotComplete
                | ContractError::DeadlineNotReached
        )
    }

    /// Determines if an error is a user input error (vs system error).
    pub fn is_user_error(error: &ContractError) -> bool {
        matches!(
            error.category(),
            ErrorCategory::Member | ErrorCategory::Contribution | ErrorCategory::Payout
        )
    }
}
