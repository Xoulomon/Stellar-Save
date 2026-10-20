//! Centralized error module for Stellar-Save.
//!
//! This module defines the [`StellarSaveError`] enum, which consolidates all
//! error variants used across the contract into a single, versioned error type.
//! Error codes are stable across contract versions for client compatibility.
//!
//! # Code ranges
//! - 1000-1999: Group-related errors
//! - 2000-2999: Member-related errors
//! - 3000-3999: Contribution-related errors
//! - 4000-4999: Payout-related errors
//! - 5000-5999: Token-related errors
//! - 6000-6999: Reward-related errors
//! - 7000-7999: Deadline-related errors
//! - 9000-9999: System-related errors

use soroban_sdk::{contracterror, contracttype};

/// Canonical error type for Stellar-Save contract operations.
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
    /// Condition: `env.storage().persistent().get::<_, Group>(&group_key)` returns `None`.
    /// Error Code: 1001
    GroupNotFound = 1001,

    /// The group has reached its maximum member capacity.
    /// Condition: `group.member_count >= group.max_members`.
    /// Error Code: 1002
    GroupFull = 1002,

    /// The group is not in a valid state for the requested operation.
    /// Condition: `group.status` is not `Active` or `Paused` when the operation requires it.
    /// Error Code: 1003
    InvalidState = 1003,

    /// Invalid metadata provided (name, description, or image_url).
    /// Condition: `name` exceeds 50 bytes, `description` exceeds 500 bytes, or contains null bytes.
    /// Error Code: 1004
    InvalidMetadata = 1004,

    /// The requested max_members exceeds the protocol-level MAX_MEMBERS cap (20).
    /// Condition: `max_members > 20`.
    /// Error Code: 1005
    MaxMembersExceeded = 1005,

    /// The two groups are not compatible for merging (different contribution amount or cycle duration).
    /// Condition: `group_a.contribution_amount != group_b.contribution_amount` or `group_a.cycle_duration != group_b.cycle_duration`.
    /// Error Code: 1008
    MergeIncompatible = 1008,

    /// A dispute is currently active for this group; payouts are blocked.
    /// Condition: `group.dispute_active == true`.
    /// Error Code: 1006
    DisputeActive = 1006,

    /// The group cannot be archived because it is not in a terminal state.
    /// Condition: `group.status` is not `Completed` or `Cancelled`.
    /// Error Code: 1007
    GroupNotArchivable = 1007,

    // Member-related errors (2000-2999)

    /// The address is already a member of this group.
    /// Condition: `env.storage().persistent().has(&member_key)` returns `true`.
    /// Error Code: 2001
    AlreadyMember = 2001,

    /// The address is not a member of this group.
    /// Condition: `env.storage().persistent().has(&member_key)` returns `false`.
    /// Error Code: 2002
    NotMember = 2002,

    /// The caller is not authorized to perform this operation.
    /// Condition: `caller != config.admin && caller != group.creator`.
    /// Error Code: 2003
    Unauthorized = 2003,

    /// The address has not been invited to join this invitation-only group.
    /// Condition: `invitee` is not in the group's invitation list.
    /// Error Code: 2004
    NotInvited = 2004,

    /// The member has already voted on the current dispute.
    /// Condition: `gov_storage::has_voted_dispute(&env, group_id, &member)` returns `true`.
    /// Error Code: 2005
    AlreadyVoted = 2005,

    // Contribution-related errors (3000-3999)

    /// The contribution amount is invalid (zero, negative, or does not match group requirements).
    /// Condition: `amount <= 0 || amount != group.contribution_amount`.
    /// Error Code: 3001
    InvalidAmount = 3001,

    /// The member has already contributed for the current cycle.
    /// Condition: `env.storage().persistent().has(&contrib_key)` returns `true` for the current cycle.
    /// Error Code: 3002
    AlreadyContributed = 3002,

    /// The current cycle is not complete (missing contributions).
    /// Condition: Not all members have contributed for the current cycle.
    /// Error Code: 3003
    CycleNotComplete = 3003,

    /// The contribution record was not found for the specified member and cycle.
    /// Condition: `env.storage().persistent().get::<_, ContributionRecord>(&contrib_key)` returns `None`.
    /// Error Code: 3004
    ContributionNotFound = 3004,

    /// The cycle deadline has not yet been reached.
    /// Condition: `env.ledger().timestamp() < group.started_at + group.cycle_duration * (group.current_cycle + 1)`.
    /// Error Code: 3005
    DeadlineNotReached = 3005,

    /// The contribution amount is below the configured minimum.
    /// Condition: `amount < group.min_contribution`.
    /// Error Code: 3006
    ContributionTooLow = 3006,

    /// The contribution amount exceeds the configured maximum.
    /// Condition: `amount > group.max_contribution`.
    /// Error Code: 3007
    ContributionTooHigh = 3007,

    /// The member's token balance is insufficient for auto-contribution.
    /// Condition: `token_client.balance(&member) < contribution_amount`.
    /// Error Code: 3008
    InsufficientBalance = 3008,

    /// The cycle deadline has passed; contributions are no longer accepted.
    /// Condition: `env.ledger().timestamp() > group.started_at + group.cycle_duration * (group.current_cycle + 1)`.
    /// Error Code: 3009
    CycleDeadlineExpired = 3009,

    /// The submitted contribution zk proof failed cryptographic verification or was malformed.
    /// Condition: `zk_verify(proof, group_id, cycle, member)` returns `false`.
    /// Error Code: 3010
    InvalidProof = 3010,

    // Payout-related errors (4000-4999)

    /// The payout operation failed due to insufficient funds or transfer error.
    /// Condition: `token_client.transfer(...)` reverts or the contract balance is insufficient.
    /// Error Code: 4001
    PayoutFailed = 4001,

    /// The payout has already been processed for this cycle.
    /// Condition: `env.storage().persistent().has(&payout_key)` returns `true`.
    /// Error Code: 4002
    PayoutAlreadyProcessed = 4002,

    /// The recipient is not eligible for payout in this cycle.
    /// Condition: The member has not contributed for the current cycle or is not in the payout queue.
    /// Error Code: 4003
    InvalidRecipient = 4003,

    // Token-related errors (5000-5999)

    /// The token address failed SEP-41 validation or is not on the allowlist.
    /// Condition: `token_client.decimals()` returns a value > 38 or the token is not on the allowlist.
    /// Error Code: 5001
    InvalidToken = 5001,

    /// The SEP-41 transfer_from or transfer call failed during contribution or payout.
    /// Condition: `token_client.transfer_from(...)` or `token_client.transfer(...)` reverts.
    /// Error Code: 5002
    TokenTransferFailed = 5002,

    // Reward-related errors (6000-6999)

    /// The member has already claimed their completion reward.
    /// Condition: `env.storage().persistent().has(&claimed_key)` returns `true`.
    /// Error Code: 6001
    RewardAlreadyClaimed = 6001,

    /// The member is not eligible to claim a completion reward.
    /// Condition: The member has not contributed in every cycle or `reward_pool / max_members == 0`.
    /// Error Code: 6002
    RewardNotEligible = 6002,

    /// The contribution has already been refunded.
    /// Condition: `env.storage().persistent().has(&refund_key)` returns `true`.
    /// Error Code: 6003
    AlreadyRefunded = 6003,

    /// Refund is not eligible: group is active and payout has already occurred for this cycle.
    /// Condition: `group.status == Active && payout_has_been_processed_for_cycle`.
    /// Error Code: 6004
    RefundNotEligible = 6004,

    // System-related errors (9000-9999)

    /// An internal contract error occurred.
    /// Condition: An unexpected failure that is not covered by other error variants.
    /// Error Code: 9001
    InternalError = 9001,

    /// The contract data is corrupted or invalid.
    /// Condition: A storage read returns unexpected data or a critical storage entry is missing.
    /// Error Code: 9002
    DataCorruption = 9002,

    /// The ID counter has reached its maximum limit or arithmetic overflow.
    /// Condition: `checked_add`, `checked_mul`, or `checked_div` returns `None`.
    /// Error Code: 9003
    Overflow = 9003,

    /// Reentrancy detected during function execution.
    /// Condition: A reentrant call is detected via a temporary storage guard.
    /// Error Code: 9004
    ReentrancyDetected = 9004,
}

impl StellarSaveError {
    /// Returns a human-readable error message for the error type.
    ///
    /// These messages are intended for debugging and logging purposes.
    /// Client applications should use error codes for programmatic handling.
    pub fn message(&self) -> &'static str {
        match self {
            StellarSaveError::GroupNotFound => {
                "The specified group does not exist. Please verify the group ID."
            }
            StellarSaveError::GroupFull => {
                "The group has reached its maximum member capacity. No new members can join."
            }
            StellarSaveError::InvalidState => {
                "The group is not in a valid state for this operation. Check group status."
            }
            StellarSaveError::InvalidMetadata => {
                "Invalid metadata provided. Name must be 3-50 characters, description 0-500 characters."
            }
            StellarSaveError::MaxMembersExceeded => {
                "The requested max_members exceeds the protocol-level limit of 20."
            }
            StellarSaveError::MergeIncompatible => {
                "The two groups are not compatible for merging. Both must have the same contribution amount and cycle duration."
            }
            StellarSaveError::DisputeActive => {
                "A dispute is currently active for this group. Payouts are blocked until the dispute is resolved."
            }
            StellarSaveError::GroupNotArchivable => {
                "The group cannot be archived because it is not in a terminal state (Completed or Cancelled)."
            }
            StellarSaveError::AlreadyMember => {
                "This address is already a member of the group."
            }
            StellarSaveError::NotMember => {
                "This address is not a member of the group. Only members can perform this action."
            }
            StellarSaveError::Unauthorized => {
                "You are not authorized to perform this operation. Check permissions."
            }
            StellarSaveError::NotInvited => {
                "This address has not been invited to join the group. Only invited addresses can join invitation-only groups."
            }
            StellarSaveError::AlreadyVoted => {
                "You have already raised a dispute for this group. Each member may only vote once per dispute round."
            }
            StellarSaveError::InvalidAmount => {
                "The contribution amount is invalid. Must be positive and match group requirements."
            }
            StellarSaveError::AlreadyContributed => {
                "You have already contributed for the current cycle. Wait for the next cycle."
            }
            StellarSaveError::CycleNotComplete => {
                "The current cycle is not complete. All members must contribute before payout."
            }
            StellarSaveError::ContributionNotFound => {
                "The contribution record was not found for the specified member and cycle."
            }
            StellarSaveError::DeadlineNotReached => {
                "The cycle deadline has not yet been reached. Cannot advance cycle until deadline passes."
            }
            StellarSaveError::ContributionTooLow => {
                "The contribution amount is below the configured minimum limit."
            }
            StellarSaveError::ContributionTooHigh => {
                "The contribution amount exceeds the configured maximum limit."
            }
            StellarSaveError::InsufficientBalance => {
                "The member's token balance is insufficient to cover the auto-contribution amount."
            }
            StellarSaveError::InvalidProof => {
                "The submitted contribution proof failed verification or was malformed."
            }
            StellarSaveError::CycleDeadlineExpired => {
                "The cycle deadline has passed. Contributions are no longer accepted for this cycle."
            }
            StellarSaveError::PayoutFailed => {
                "The payout operation failed. This may be due to insufficient contract funds or transfer restrictions."
            }
            StellarSaveError::PayoutAlreadyProcessed => {
                "The payout has already been processed for this cycle."
            }
            StellarSaveError::InvalidRecipient => {
                "The specified recipient is not eligible for payout in this cycle."
            }
            StellarSaveError::InvalidToken => {
                "The token address failed SEP-41 validation or is not on the allowed token list."
            }
            StellarSaveError::TokenTransferFailed => {
                "The token transfer failed. Ensure the member has granted sufficient allowance to the contract."
            }
            StellarSaveError::RewardAlreadyClaimed => {
                "You have already claimed your completion reward for this group."
            }
            StellarSaveError::RewardNotEligible => {
                "You are not eligible to claim a completion reward. Only members who contributed in every cycle are eligible."
            }
            StellarSaveError::AlreadyRefunded => {
                "This contribution has already been refunded."
            }
            StellarSaveError::RefundNotEligible => {
                "Refund is not eligible. The group is active and a payout has already occurred for this cycle."
            }
            StellarSaveError::InternalError => {
                "An internal contract error occurred. Please try again or contact support."
            }
            StellarSaveError::DataCorruption => {
                "Contract data appears to be corrupted. This is a critical error."
            }
            StellarSaveError::Overflow => {
                "The ID counter has reached its maximum. No more IDs can be generated."
            }
            StellarSaveError::ReentrancyDetected => {
                "Reentrancy detected during function execution."
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
pub type ContractResult<T> = Result<T, StellarSaveError>;

/// Error recovery strategies for different error types.
pub struct ErrorRecoveryStrategy;

impl ErrorRecoveryStrategy {
    /// Returns recovery guidance for a given error.
    pub fn recovery_guidance(error: &StellarSaveError) -> &'static str {
        match error {
            StellarSaveError::GroupNotFound => {
                "Verify the group ID is correct. Check if the group has been deleted or if you're using the correct contract instance."
            }
            StellarSaveError::GroupFull => {
                "Wait for a member to leave the group or create a new group with higher max_members capacity."
            }
            StellarSaveError::InvalidState => {
                "Check the group's current status. Some operations are only available in specific states (e.g., Active, Paused)."
            }
            StellarSaveError::InvalidMetadata => {
                "Check that the group name is 3-50 characters and description is 0-500 characters."
            }
            StellarSaveError::MaxMembersExceeded => {
                "Reduce max_members to 20 or less."
            }
            StellarSaveError::MergeIncompatible => {
                "Ensure both groups have the same contribution_amount and cycle_duration before merging."
            }
            StellarSaveError::DisputeActive => {
                "A dispute is active for this group. Wait for the dispute to be resolved before payouts can proceed."
            }
            StellarSaveError::GroupNotArchivable => {
                "Only groups in a terminal state (Completed or Cancelled) can be archived. Wait until the group finishes all cycles or is cancelled."
            }
            StellarSaveError::AlreadyMember => {
                "You are already a member of this group. Leave the group first if you want to rejoin."
            }
            StellarSaveError::NotMember => {
                "Join the group first before attempting member-only operations."
            }
            StellarSaveError::Unauthorized => {
                "Ensure you have the required permissions. Only group creators can pause/resume/cancel groups. Only members can contribute."
            }
            StellarSaveError::NotInvited => {
                "Ask the group creator to invite your address before attempting to join."
            }
            StellarSaveError::AlreadyVoted => {
                "Each member may only vote once per dispute round."
            }
            StellarSaveError::InvalidAmount => {
                "Ensure the contribution amount matches the group's required amount exactly and is positive."
            }
            StellarSaveError::AlreadyContributed => {
                "You have already contributed for this cycle. Wait for the next cycle to contribute again."
            }
            StellarSaveError::CycleNotComplete => {
                "Not all members have contributed yet. Wait for all members to contribute before executing payout."
            }
            StellarSaveError::ContributionNotFound => {
                "The contribution record doesn't exist. Verify the member and cycle number are correct."
            }
            StellarSaveError::DeadlineNotReached => {
                "The cycle deadline has not yet passed. Wait until the deadline is reached before calling tick()."
            }
            StellarSaveError::ContributionTooLow => {
                "Increase the contribution amount to meet the configured minimum."
            }
            StellarSaveError::ContributionTooHigh => {
                "Decrease the contribution amount to stay within the configured maximum."
            }
            StellarSaveError::InsufficientBalance => {
                "Ensure your token balance is sufficient to cover the contribution amount before the cycle starts, or disable auto-contribution."
            }
            StellarSaveError::InvalidProof => {
                "Regenerate the zk proof for the correct group and cycle and resubmit it to verify_contribution_proof."
            }
            StellarSaveError::CycleDeadlineExpired => {
                "The cycle deadline has passed. Contributions are no longer accepted for this cycle."
            }
            StellarSaveError::PayoutFailed => {
                "Ensure the contract has sufficient funds and the recipient's wallet can receive transfers. Check network conditions."
            }
            StellarSaveError::PayoutAlreadyProcessed => {
                "This payout has already been executed. Move to the next cycle for the next payout."
            }
            StellarSaveError::InvalidRecipient => {
                "The recipient is not eligible for payout in this cycle. Check the payout queue order."
            }
            StellarSaveError::InvalidToken => {
                "Ensure the token address refers to a valid SEP-41 token contract. If an allowlist is configured, verify the token has been added by the admin."
            }
            StellarSaveError::TokenTransferFailed => {
                "Ensure you have called `approve` on the token contract granting the StellarSave contract an allowance of at least the contribution amount before calling `contribute`."
            }
            StellarSaveError::RewardAlreadyClaimed => {
                "You have already claimed your reward for this group. Each member can only claim once."
            }
            StellarSaveError::RewardNotEligible => {
                "Only members who contributed in every cycle are eligible. Verify your contribution history."
            }
            StellarSaveError::AlreadyRefunded => {
                "This contribution has already been refunded. Each contribution can only be refunded once."
            }
            StellarSaveError::RefundNotEligible => {
                "Refund is not eligible. The group is active and a payout has already occurred for this cycle."
            }
            StellarSaveError::InternalError => {
                "This is an internal contract error. Try the operation again. If it persists, contact support."
            }
            StellarSaveError::DataCorruption => {
                "Critical data corruption detected. This requires immediate investigation and potential contract upgrade."
            }
            StellarSaveError::Overflow => {
                "The ID counter has reached its maximum. This is extremely rare and requires contract upgrade."
            }
            StellarSaveError::ReentrancyDetected => {
                "Ensure no reentrant calls are performed during execution."
            }
        }
    }

    /// Determines if an error is retryable.
    pub fn is_retryable(error: &StellarSaveError) -> bool {
        matches!(
            error,
            StellarSaveError::PayoutFailed
                | StellarSaveError::InternalError
                | StellarSaveError::CycleNotComplete
                | StellarSaveError::DeadlineNotReached
        )
    }

    /// Determines if an error is a user input error (vs system error).
    pub fn is_user_error(error: &StellarSaveError) -> bool {
        matches!(
            error.category(),
            ErrorCategory::Member | ErrorCategory::Contribution | ErrorCategory::Payout
        )
    }
}

// === Code-to-message table for the frontend ===

/// Returns a static slice of (code, message) pairs for all `StellarSaveError` variants.
///
/// This table is intended for frontend consumption so that clients can display
/// human-readable error messages without needing to call `message()` on-chain.
pub fn code_to_message_table() -> &'static [(u32, &'static str)] {
    &[
        (1001, "The specified group does not exist. Please verify the group ID."),
        (1002, "The group has reached its maximum member capacity. No new members can join."),
        (1003, "The group is not in a valid state for this operation. Check group status."),
        (1004, "Invalid metadata provided. Name must be 3-50 characters, description 0-500 characters."),
        (1005, "The requested max_members exceeds the protocol-level limit of 20."),
        (1006, "A dispute is currently active for this group. Payouts are blocked until the dispute is resolved."),
        (1007, "The group cannot be archived because it is not in a terminal state (Completed or Cancelled)."),
        (1008, "The two groups are not compatible for merging. Both must have the same contribution amount and cycle duration."),
        (2001, "This address is already a member of the group."),
        (2002, "This address is not a member of the group. Only members can perform this action."),
        (2003, "You are not authorized to perform this operation. Check permissions."),
        (2004, "This address has not been invited to join the group. Only invited addresses can join invitation-only groups."),
        (2005, "You have already raised a dispute for this group. Each member may only vote once per dispute round."),
        (3001, "The contribution amount is invalid. Must be positive and match group requirements."),
        (3002, "You have already contributed for the current cycle. Wait for the next cycle."),
        (3003, "The current cycle is not complete. All members must contribute before payout."),
        (3004, "The contribution record was not found for the specified member and cycle."),
        (3005, "The cycle deadline has not yet been reached. Cannot advance cycle until deadline passes."),
        (3006, "The contribution amount is below the configured minimum limit."),
        (3007, "The contribution amount exceeds the configured maximum limit."),
        (3008, "The member's token balance is insufficient to cover the auto-contribution amount."),
        (3009, "The cycle deadline has passed. Contributions are no longer accepted for this cycle."),
        (3010, "The submitted contribution proof failed verification or was malformed."),
        (4001, "The payout operation failed. This may be due to insufficient contract funds or transfer restrictions."),
        (4002, "The payout has already been processed for this cycle."),
        (4003, "The specified recipient is not eligible for payout in this cycle."),
        (5001, "The token address failed SEP-41 validation or is not on the allowed token list."),
        (5002, "The token transfer failed. Ensure the member has granted sufficient allowance to the contract."),
        (6001, "You have already claimed your completion reward for this group."),
        (6002, "You are not eligible to claim a completion reward. Only members who contributed in every cycle are eligible."),
        (6003, "This contribution has already been refunded."),
        (6004, "Refund is not eligible. The group is active and a payout has already occurred for this cycle."),
        (9001, "An internal contract error occurred. Please try again or contact support."),
        (9002, "Contract data appears to be corrupted. This is a critical error."),
        (9003, "The ID counter has reached its maximum. No more IDs can be generated."),
        (9004, "Reentrancy detected during function execution."),
    ]
}

// === Tests ===

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable() {
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
    fn code_to_message_table_matches_enum() {
        let table = code_to_message_table();
        for error in every_error() {
            let code = error.code();
            let entry = table.iter().find(|(c, _)| *c == code);
            assert!(entry.is_some(), "Code {code} missing from code_to_message_table");
            assert_eq!(entry.unwrap().1, error.message());
        }
    }

    #[test]
    fn contract_result_carries_the_canonical_error() {
        let ok: ContractResult<u32> = Ok(7);
        let err: ContractResult<u32> = Err(StellarSaveError::GroupNotFound);
        assert_eq!(ok, Ok(7));
        assert_eq!(err, Err(StellarSaveError::GroupNotFound));
    }

    fn every_error() -> [StellarSaveError; 36] {
        [
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
        ]
    }
}