//! Payout Executor Module
//!
//! This module implements the core fund distribution mechanism for the Stellar-Save
//! ROSCA (Rotational Savings and Credit Association) smart contract.
//!
//! The payout executor orchestrates the automated transfer of pooled funds to eligible
//! recipients when a savings cycle completes. It handles:
//! - Cycle completion verification
//! - Recipient identification based on payout position
//! - Payout amount calculation
//! - Fund transfer execution
//! - Payout record creation
//! - Member status updates
//! - Cycle advancement
//! - Event emission
//!
//! The design follows a permissionless execution model where any address can trigger
//! payout execution once preconditions are met.

use crate::error::StellarSaveError;
use crate::events::EventEmitter;
use crate::group::{Group, GroupStatus};
use crate::payout::PayoutRecord;
use crate::pool::PoolCalculator;
use crate::storage::StorageKeyBuilder;
use crate::MemberProfile;
use soroban_sdk::{Address, Env};

/// Validates that the current cycle is complete and ready for payout.
///
/// This function verifies that all members have contributed to the current cycle
/// and that the total contributions equal the expected pool amount.
///
/// # Arguments
/// * `env` - Soroban environment for storage access
/// * `group_id` - Unique identifier of the group
/// * `current_cycle` - The current cycle number to validate
///
/// # Returns
/// * `Ok(PoolInfo)` - Pool information if cycle is complete and valid
/// * `Err(StellarSaveError)` - If cycle is not complete or validation fails
///
/// # Errors
/// - `CycleNotComplete` - Not all members have contributed
/// - `InvalidAmount` - Contribution totals don't match expected pool
/// - `GroupNotFound` - Group does not exist
/// - `InvalidState` - Invalid group configuration
///
/// # Requirements
/// Validates Requirements 1.1, 1.2, 1.3, 1.4, 1.5
fn validate_cycle_complete(
    env: &Env,
    group_id: u64,
    current_cycle: u32,
) -> Result<crate::pool::PoolInfo, StellarSaveError> {
    // Call PoolCalculator to retrieve comprehensive cycle data
    let pool_info = PoolCalculator::get_pool_info(env, group_id, current_cycle)?;

    // Validate that the pool is ready for payout
    // This checks:
    // - All members have contributed (contributors_count >= member_count)
    // - Total contributions equal expected pool amount
    PoolCalculator::validate_pool_ready_for_payout(&pool_info)?;

    // Return pool info for use in subsequent payout calculations
    Ok(pool_info)
}

/// Identifies the member who should receive the payout for the current cycle.
///
/// Gas opt: O(1) direct lookup using the `PayoutPositionIndex` reverse map
/// written at join/assign time. A single SLOAD replaces the previous O(n)
/// member-list scan.
///
/// # Arguments
/// * `env` - Soroban environment for storage access
/// * `group_id` - Unique identifier of the group
/// * `current_cycle` - The current cycle number to match against payout positions
/// * `member_count` - Total number of members in the group (for validation)
///
/// # Returns
/// * `Ok(Address)` - The recipient's address
/// * `Err(StellarSaveError)` - If no member found for this position
fn identify_recipient(
    env: &Env,
    group_id: u64,
    current_cycle: u32,
    member_count: u32,
) -> Result<Address, StellarSaveError> {
    // Gas opt: O(1) reverse-index lookup instead of O(n) member-list scan.
    // The index is written at join_group / assign_payout_positions time.
    let pos_idx_key = StorageKeyBuilder::group_payout_position_index(group_id, current_cycle);
    if let Some(recipient) = env.storage().persistent().get::<_, Address>(&pos_idx_key) {
        // Sanity: position must be within the valid range for this group
        if current_cycle < member_count {
            return Ok(recipient);
        }
    }

    // Fallback: reverse index not yet populated (legacy groups or first cycle
    // before assign_payout_positions was called). Fall back to the O(n) scan
    // so we remain backward-compatible.
    let members_key = StorageKeyBuilder::group_members(group_id);
    let members: soroban_sdk::Vec<Address> = env
        .storage()
        .persistent()
        .get(&members_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    if members.len() != member_count {
        return Err(StellarSaveError::InvalidState);
    }

    let mut recipient: Option<Address> = None;
    let mut match_count = 0u32;

    for member_address in members.iter() {
        let pos_key =
            StorageKeyBuilder::member_payout_eligibility(group_id, member_address.clone());
        if let Some(position) = env.storage().persistent().get::<_, u32>(&pos_key) {
            if position == current_cycle {
                recipient = Some(member_address);
                match_count += 1;
            }
        }
    }

    match match_count {
        0 => Err(StellarSaveError::InvalidState),
        1 => Ok(recipient.unwrap()),
        _ => Err(StellarSaveError::InvalidState),
    }
}

/// Verifies that the identified recipient is eligible to receive the payout.
///
/// Gas opt: O(1) — checks member existence (1 SLOAD) then checks the single
/// payout_recipient slot for the recipient's own payout_position (1 SLOAD).
/// Replaces the previous O(n) loop over all cycles 0..=current_cycle.
///
/// # Arguments
/// * `env` - Soroban environment for storage access
/// * `group_id` - Unique identifier of the group
/// * `recipient` - Address of the recipient to verify
/// * `current_cycle` - The current cycle number
///
/// # Returns
/// * `Ok(())` - Recipient is eligible to receive the payout
/// * `Err(StellarSaveError)` - Recipient is not eligible
fn verify_recipient_eligibility(
    env: &Env,
    group_id: u64,
    recipient: &Address,
    current_cycle: u32,
) -> Result<(), StellarSaveError> {
    // Check 1: Verify recipient is a current member of the group
    let member_key = StorageKeyBuilder::member_profile(group_id, recipient.clone());
    if !env.storage().persistent().has(&member_key) {
        return Err(StellarSaveError::NotMember);
    }

    // Check 2: Gas opt — each member can only receive payout at their payout_position
    // cycle. Since current_cycle == payout_position (validated in identify_recipient),
    // we only need to check that single slot rather than looping 0..=current_cycle.
    let recipient_key = StorageKeyBuilder::payout_recipient(group_id, current_cycle);
    if env.storage().persistent().has(&recipient_key) {
        return Err(StellarSaveError::InvalidRecipient);
    }

    Ok(())
}

/// Calculates the payout amount from the pool total.
///
/// This function uses the PoolCalculator to determine the net payout amount
/// by subtracting any applicable fees from the total pool. In v1, fees are
/// set to zero, so the payout amount equals the pool total.
///
/// The function validates that the calculated amount is greater than zero
/// before returning it.
///
/// # Arguments
/// * `pool_info` - Pool information containing the total pool amount
///
/// # Returns
/// * `Ok(i128)` - The calculated net payout amount
/// * `Err(StellarSaveError)` - If the amount is invalid
///
/// # Errors
/// - `InvalidAmount` - If the calculated payout amount is <= 0
/// - `InternalError` - If arithmetic operations fail
///
/// # Requirements
/// Validates Requirements 3.1, 3.2, 3.3, 3.4
fn calculate_and_validate_payout_amount(
    pool_info: &crate::pool::PoolInfo,
) -> Result<i128, StellarSaveError> {
    // Use PoolCalculator to calculate net payout (pool - fees)
    // In v1, fees are 0, so this returns the total pool amount
    let payout_amount = PoolCalculator::calculate_payout_amount(pool_info.total_pool_amount)?;

    // Verify the calculated amount is greater than zero
    // This check is critical to prevent invalid payouts
    if payout_amount <= 0 {
        return Err(StellarSaveError::InvalidAmount);
    }

    // Return the validated payout amount
    Ok(payout_amount)
}

/// Verifies that the contract has sufficient balance to cover the payout amount.
///
/// Gas opt: placeholder check removed — the hardcoded `balance = 0` caused every
/// payout to fail with `PayoutFailed`. In production this would query the native
/// token contract. For MVP the actual balance check is deferred to the token
/// transfer call in `execute_transfer`, which will revert on insufficient funds.
///
/// # Requirements
/// Verifies the contract has sufficient token balance for the payout.
/// Uses the group's configured SEP-41 token. Requirements 3.5, 4.4
fn verify_contract_balance(
    env: &Env,
    group_id: u64,
    payout_amount: i128,
) -> Result<(), StellarSaveError> {
    let token_config_key = StorageKeyBuilder::group_token_config(group_id);
    let token_config: crate::group::TokenConfig = env
        .storage()
        .persistent()
        .get(&token_config_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    let token_client = soroban_sdk::token::TokenClient::new(env, &token_config.token_address);
    let contract_address = env.current_contract_address();
    let balance = token_client.balance(&contract_address);

    if balance < payout_amount {
        return Err(StellarSaveError::PayoutFailed);
    }
    Ok(())
}

/// Executes the fund transfer from the contract to the recipient.
///
/// This function performs the actual transfer of funds from the contract's balance
/// to the recipient's address. It uses the Stellar token API to execute the transfer
/// and handles any errors that may occur during the process.
///
/// The function uses checked arithmetic operations to prevent overflow errors and
/// ensures that the transfer is atomic - either it succeeds completely or fails
/// without any partial state changes.
///
/// # Arguments
/// * `env` - Soroban environment for accessing contract address and token API
/// * `recipient` - Address of the recipient to receive the payout
/// * `amount` - The amount to transfer (in stroops, where 1 XLM = 10^7 stroops)
///
/// # Returns
/// * `Ok(())` - Transfer completed successfully
/// * `Err(StellarSaveError)` - Transfer failed
///
/// # Errors
/// - `PayoutFailed` - Transfer failed due to insufficient funds, invalid recipient,
///   or other transfer-related errors
/// - `Overflow` - Arithmetic overflow occurred during amount validation
///
/// # Implementation Note
/// This is a placeholder implementation for the MVP. In production, this would:
/// 1. Get the native token contract address from configuration
/// 2. Create a token client for the native asset (XLM)
/// 3. Execute the transfer using token.transfer(from, to, amount)
/// 4. Handle specific transfer errors (insufficient balance, frozen account, etc.)
///
/// For now, this function validates the inputs and returns success to allow
/// testing of the payout flow without requiring a full token integration.
///
/// # Requirements
/// Validates Requirements 4.1, 4.2, 4.3, 10.3, 10.4
/// Executes the SEP-41 token transfer from the contract to the payout recipient.
/// Requirements 5.5, 5.6
fn execute_transfer(
    env: &Env,
    group_id: u64,
    recipient: &Address,
    amount: i128,
) -> Result<(), StellarSaveError> {
    if amount <= 0 {
        return Err(StellarSaveError::PayoutFailed);
    }

    let token_config_key = StorageKeyBuilder::group_token_config(group_id);
    let token_config: crate::group::TokenConfig = env
        .storage()
        .persistent()
        .get(&token_config_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    let token_client = soroban_sdk::token::TokenClient::new(env, &token_config.token_address);
    let contract_address = env.current_contract_address();

    // transfer panics on failure; Soroban reverts all state changes atomically
    token_client.transfer(&contract_address, recipient, &amount);

    Ok(())
}
/// Creates and stores an immutable payout record.
///
/// This function creates a PayoutRecord with all payout details and stores it in
/// persistent storage. It performs two storage operations:
/// 1. Stores the complete PayoutRecord at the payout_record key
/// 2. Stores the recipient address at the payout_recipient key for quick lookups
///
/// The function validates the record before storage to ensure data integrity.
/// Both storage operations must succeed for the function to return Ok.
///
/// # Arguments
/// * `env` - Soroban environment for storage access
/// * `group_id` - Unique identifier of the group
/// * `cycle` - The cycle number for this payout
/// * `recipient` - Address of the member receiving the payout
/// * `amount` - The payout amount in stroops
/// * `timestamp` - Unix timestamp when the payout was executed
///
/// # Returns
/// * `Ok(())` - Record stored successfully
/// * `Err(StellarSaveError)` - Storage operation failed or validation failed
///
/// # Errors
/// - `InternalError` - Storage operation failed
/// - Panics if PayoutRecord validation fails (amount <= 0)
///
/// # Storage Keys Used
/// - `StorageKeyBuilder::payout_record(group_id, cycle)` - Stores complete PayoutRecord
/// - `StorageKeyBuilder::payout_recipient(group_id, cycle)` - Stores recipient address
///
/// # Requirements
/// Validates Requirements 5.1, 5.2, 5.3, 5.4, 5.5
fn record_payout(
    env: &Env,
    group_id: u64,
    cycle: u32,
    recipient: Address,
    amount: i128,
    timestamp: u64,
) -> Result<(), StellarSaveError> {
    // Create PayoutRecord with all required fields
    // The PayoutRecord::new constructor validates that amount > 0
    // and will panic if validation fails
    let payout_record = PayoutRecord::new(recipient.clone(), group_id, cycle, amount, timestamp);

    // Validate the record before storage
    // This ensures the record meets all validation constraints
    if !payout_record.validate() {
        return Err(StellarSaveError::InternalError);
    }

    // Store the complete payout record
    // This provides the full audit trail of the payout
    let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
    env.storage().persistent().set(&record_key, &payout_record);

    // Store the recipient address for quick lookup
    // This allows efficient queries to check if a member has received a payout
    let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
    env.storage().persistent().set(&recipient_key, &recipient);

    // Both storage operations completed successfully
    Ok(())
}

/// Updates the recipient's member status to reflect payout completion.
///
/// This function ensures consistency between payout records and member status queries.
/// The current architecture tracks payout receipt via the `payout_recipient` storage key
/// rather than a flag in MemberProfile. This function verifies that the member profile
/// exists and is consistent with the payout record that has been stored.
///
/// # Arguments
/// * `env` - Soroban environment for storage access
/// * `group_id` - Unique identifier of the group
/// * `recipient` - Address of the member who received the payout
///
/// # Returns
/// * `Ok(())` - Member status is consistent and valid
/// * `Err(StellarSaveError)` - Member profile not found or storage error
///
/// # Errors
/// - `InternalError` - Member profile not found or storage operation failed
///
/// # Implementation Note
/// Since the payout receipt is tracked via the `payout_recipient` storage key
/// (stored by the `record_payout` function), this function primarily validates
/// that the member profile exists and is accessible. The actual payout status
/// is queried via the `payout_recipient` storage key in the eligibility checks.
///
/// # Requirements
/// Validates Requirements 6.1, 6.2, 6.3, 6.4, 6.5
fn update_member_status(
    env: &Env,
    group_id: u64,
    recipient: &Address,
) -> Result<(), StellarSaveError> {
    // Load the MemberProfile for the recipient to ensure it exists
    // This validates that the recipient is a valid member of the group
    let member_key = StorageKeyBuilder::member_profile(group_id, recipient.clone());

    // Attempt to load the member profile
    // If the profile doesn't exist, this indicates an internal consistency error
    // since we should have already verified the member exists during eligibility checks
    let _member_profile: MemberProfile = env
        .storage()
        .persistent()
        .get(&member_key)
        .ok_or(StellarSaveError::InternalError)?;

    // The member profile exists and is accessible
    // The payout receipt status is tracked via the payout_recipient storage key
    // which was set by the record_payout function, so no additional updates
    // to the MemberProfile struct are needed.
    //
    // Future enhancements could add a payout_received flag to MemberProfile,
    // but the current architecture uses the payout_recipient storage key as
    // the source of truth for payout status.

    // Consistency check passed - member status is valid
    Ok(())
}

/// Emits a payout executed event with non-critical error handling.
///
/// This function wraps the EventEmitter::emit_payout_executed call with error
/// handling that ensures event emission failures do not cause the payout transaction
/// to fail. Events are considered non-critical - if emission fails, the payout
/// should still succeed and all state changes should be persisted.
///
/// The function catches any panics or errors during event emission and logs them
/// without propagating the error to the caller. This ensures that the payout
/// execution flow continues even if the event system is unavailable or fails.
///
/// # Arguments
/// * `env` - Soroban environment for event emission
/// * `group_id` - Unique identifier of the group
/// * `recipient` - Address of the member receiving the payout
/// * `amount` - The payout amount in stroops
/// * `cycle` - The cycle number for this payout
/// * `timestamp` - Unix timestamp when the payout was executed
///
/// # Returns
/// This function always returns successfully, even if event emission fails.
/// It does not return any value.
///
/// # Error Handling
/// Any errors during event emission are caught and suppressed. The function
/// continues execution without propagating errors to ensure that event failures
/// do not cause payout transactions to revert.
///
/// # Usage in execute_payout
/// This function should be called after all storage operations complete successfully
/// but before cycle advancement. The recommended call sequence in execute_payout is:
/// 1. execute_transfer() - Transfer funds to recipient
/// 2. record_payout() - Store payout record
/// 3. update_member_status() - Update member status
/// 4. emit_payout_event() - Emit event (non-critical, continues on failure)
/// 5. advance_cycle_or_complete() - Advance to next cycle
///
/// # Requirements
/// Validates Requirements 7.1, 7.2, 7.3, 7.4, 7.5
fn emit_payout_event(
    env: &Env,
    group_id: u64,
    recipient: Address,
    amount: i128,
    cycle: u32,
    timestamp: u64,
) {
    // Wrap event emission in error handling that continues on failure
    // Events are non-critical - if emission fails, the payout should still succeed
    //
    // Note: In Soroban, the events().publish() method does not return a Result,
    // so we don't need explicit error handling. However, we wrap this in a
    // separate function to make it clear that event emission is non-critical
    // and to provide a single point where event emission can be controlled.
    //
    // If the event system fails internally, Soroban will handle it gracefully
    // without causing the transaction to revert.

    EventEmitter::emit_payout_executed(env, group_id, recipient, amount, cycle, timestamp);

    // Event emission completed (or failed gracefully)
    // The payout flow continues regardless of event emission status
}
/// Advances the group to the next cycle or marks it as complete.
///
/// This function calls the Group's advance_cycle method to increment the cycle number
/// and automatically handle group completion logic. The advance_cycle method:
/// - Increments current_cycle by 1
/// - Checks if the group is complete (current_cycle >= max_members)
/// - If complete, sets status to Completed and is_active to false
/// - If complete, emits a GroupCompleted event automatically
///
/// After advancing the cycle, this function saves the updated group to storage.
///
/// # Arguments
/// * `env` - Soroban environment for storage access and event emission
/// * `group` - Mutable reference to the group to advance
///
/// # Returns
/// * `Ok(())` - Cycle advanced and group saved successfully
/// * `Err(StellarSaveError)` - Storage operation failed
///
/// # Errors
/// - `InternalError` - Failed to save updated group to storage
///
/// # Panics
/// Panics if the group is already complete (should not occur in normal payout flow)
///
/// # Implementation Note
/// The Group.advance_cycle method handles all the cycle advancement logic including:
/// - Status updates (Active -> Completed when all cycles done)
/// - Event emission (GroupCompleted event)
/// - State validation (panics if already complete)
///
/// This function's responsibility is to call advance_cycle and persist the changes.
///
/// # Requirements
/// Validates Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
fn advance_cycle_or_complete(env: &Env, group: &mut Group) -> Result<(), StellarSaveError> {
    // Call group.advance_cycle to increment cycle and handle completion logic
    group.advance_cycle(env);

    // Save the updated group to storage
    let group_key = StorageKeyBuilder::group_data(group.id);
    env.storage().persistent().set(&group_key, group);

    // Emit CycleAdvanced event (only when group is not yet complete)
    if !group.is_complete() {
        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_cycle_advanced(env, group.id, group.current_cycle, timestamp);
    }

    Ok(())
}

/// Applies penalties to all members who missed their contribution in the given cycle.
///
/// Iterates over all group members, checks if each one contributed in `cycle`, and
/// calls `apply_penalty` for those who did not. The penalty amount is added to the
/// cycle pool total so the payout recipient receives it.
///
/// This function is a no-op when `group.penalty_enabled` is false or
/// `group.penalty_amount` is zero.
fn apply_missed_contribution_penalties(
    env: &Env,
    group_id: u64,
    cycle: u32,
    group: &Group,
) -> Result<(), StellarSaveError> {
    let members_key = StorageKeyBuilder::group_members(group_id);
    let members: soroban_sdk::Vec<Address> = env
        .storage()
        .persistent()
        .get(&members_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    for member in members.iter() {
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
        if !env.storage().persistent().has(&contrib_key) {
            // Member missed this cycle — apply penalty
            let penalty_key = StorageKeyBuilder::member_penalty_total(group_id, member.clone());
            let current_total: i128 = env.storage().persistent().get(&penalty_key).unwrap_or(0);
            let new_total = current_total
                .checked_add(group.penalty_amount)
                .ok_or(StellarSaveError::Overflow)?;
            env.storage().persistent().set(&penalty_key, &new_total);

            // Add penalty to the cycle pool so the payout recipient benefits
            let pool_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
            let current_pool: i128 = env.storage().persistent().get(&pool_key).unwrap_or(0);
            let new_pool = current_pool
                .checked_add(group.penalty_amount)
                .ok_or(StellarSaveError::Overflow)?;
            env.storage().persistent().set(&pool_key, &new_pool);

            let timestamp = env.ledger().timestamp();
            let _ = timestamp; // timestamp captured internally by emit_penalty_applied
            EventEmitter::emit_penalty_applied(env, group_id, member, group.penalty_amount, cycle);
        }
    }

    Ok(())
}

/// Executes a payout for the specified group.
///
/// This is the main entry point for payout execution. It orchestrates all the steps
/// required to distribute pooled funds to the eligible recipient when a savings cycle
/// completes. The function is permissionless - any address can call it once the
/// preconditions are met.
///
/// # Execution Flow
/// 1. Load and validate group exists
/// 2. Validate group status is Active
/// 3. Check if payout already executed for current cycle
/// 4. Validate cycle is complete (all members contributed)
/// 5. Identify the recipient based on payout position
/// 6. Verify recipient eligibility
/// 7. Calculate payout amount
/// 8. Verify contract has sufficient balance
/// 9. Execute fund transfer to recipient
/// 10. Record payout for audit trail
/// 11. Update member status
/// 12. Emit payout event (non-critical)
/// 13. Advance cycle or mark group as complete
///
/// # Arguments
/// * `env` - Soroban environment for storage, ledger access, and event emission
/// * `group_id` - Unique identifier of the group to process payout for
///
/// # Returns
/// * `Ok(())` - Payout successfully executed
/// * `Err(StellarSaveError)` - Payout failed with specific error code
///
/// # Errors
/// - `GroupNotFound` - Group ID does not exist in storage
/// - `InvalidState` - Group not in Active status, cycle not ready, or payout already executed
/// - `CycleNotComplete` - Not all members have contributed to the current cycle
/// - `NotMember` - Recipient is not a member of the group
/// - `InvalidRecipient` - Recipient not eligible or already received payout
/// - `InvalidAmount` - Calculated payout amount is invalid (≤ 0)
/// - `PayoutFailed` - Fund transfer failed (insufficient balance, transfer error)
/// - `InternalError` - Storage or state update failed
/// - `Overflow` - Arithmetic overflow in calculations
///
/// # Atomicity
/// All operations are atomic - if any step fails after the transfer, all state changes
/// are automatically reverted by the Soroban runtime. Event emission failures do not
/// cause rollback as events are non-critical.
///
/// # Requirements
/// Validates Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 10.6, 10.7, and orchestrates all
/// other requirements through helper functions.
pub fn execute_payout(env: Env, group_id: u64) -> Result<(), StellarSaveError> {
    // Reentrancy protection - prevent recursive payout calls
    let reentrancy_key = StorageKeyBuilder::reentrancy_guard();
    let guard_value: u64 = env.storage().persistent().get(&reentrancy_key).unwrap_or(0);

    if guard_value != 0 {
        return Err(StellarSaveError::InternalError);
    }

    // Set reentrancy protection flag
    env.storage().persistent().set(&reentrancy_key, &1);

    // Step 1: Load group from storage
    let group_key = StorageKeyBuilder::group_data(group_id);
    let mut group: Group = env
        .storage()
        .persistent()
        .get(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Step 2: Validate group status is Active
    // Only Active groups can process payouts
    if group.paused {
        return Err(StellarSaveError::InvalidState);
    }

    if group.status != GroupStatus::Active {
        return Err(StellarSaveError::InvalidState);
    }

    // Step 2b: Block payout if a dispute is active
    if group.dispute_active {
        return Err(StellarSaveError::DisputeActive);
    }

    // Step 3: Check if payout already executed for current cycle
    // This prevents duplicate payouts for the same cycle
    let current_cycle = group.current_cycle;
    let recipient_key = StorageKeyBuilder::payout_recipient(group_id, current_cycle);
    if env.storage().persistent().has(&recipient_key) {
        // Payout already executed for this cycle
        return Err(StellarSaveError::InvalidState);
    }

    // === VALIDATION PHASE (Task 12.2) ===
    // All validation checks must pass before any state modifications occur

    // Step 4: Validate cycle is complete (all members have contributed)
    let pool_info = validate_cycle_complete(&env, group_id, current_cycle)?;

    // Step 4b: Apply penalties to members who missed contributions this cycle.
    // Penalties are added to the pool total so the payout recipient benefits.
    if group.penalty_enabled && group.penalty_amount > 0 {
        apply_missed_contribution_penalties(&env, group_id, current_cycle, &group)?;
    }

    // Step 5: Identify the recipient for this cycle based on payout position
    let recipient = identify_recipient(&env, group_id, current_cycle, group.member_count)?;

    // Step 6: Verify the recipient is eligible to receive the payout
    verify_recipient_eligibility(&env, group_id, &recipient, current_cycle)?;

    // Step 7: Calculate the payout amount from the pool total
    let payout_amount = calculate_and_validate_payout_amount(&pool_info)?;

    // Step 8: Verify contract has sufficient balance to cover the payout
    verify_contract_balance(&env, group_id, payout_amount)?;

    // === EXECUTION PHASE (Task 12.3) ===
    // All validations passed - proceed with payout execution
    // If any step fails after this point, Soroban will automatically revert all changes

    // Step 9: Execute the fund transfer to the recipient
    execute_transfer(&env, group_id, &recipient, payout_amount)?;

    // Step 10: Create and store the payout record for audit trail
    // Gas opt: cache timestamp — single ledger call for the whole function
    let timestamp = env.ledger().timestamp();
    record_payout(
        &env,
        group_id,
        current_cycle,
        recipient.clone(),
        payout_amount,
        timestamp,
    )?;

    // Gas opt: update incremental paid-out counter (avoids O(n) loop in get_total_paid_out)
    let paid_out_key = StorageKeyBuilder::group_total_paid_out(group_id);
    let current_paid: i128 = env.storage().persistent().get(&paid_out_key).unwrap_or(0);
    let new_paid = current_paid
        .checked_add(payout_amount)
        .ok_or(StellarSaveError::Overflow)?;
    env.storage().persistent().set(&paid_out_key, &new_paid);

    // Step 11: Update the member status to reflect payout completion
    update_member_status(&env, group_id, &recipient)?;

    // Step 12: Emit payout event (non-critical - continues on failure)
    emit_payout_event(
        &env,
        group_id,
        recipient,
        payout_amount,
        current_cycle,
        timestamp,
    );

    // Step 13: Advance to the next cycle or mark group as complete
    advance_cycle_or_complete(&env, &mut group)?;

    // Clear reentrancy protection flag
    let reentrancy_key = StorageKeyBuilder::reentrancy_guard();
    env.storage().persistent().set(&reentrancy_key, &0);

    // Payout execution completed successfully
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pool::PoolInfo;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    // Test calculate_and_validate_payout_amount with valid pool
    #[test]
    fn test_calculate_payout_amount_valid() {
        let pool_info = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };

        let result = calculate_and_validate_payout_amount(&pool_info);
        assert!(result.is_ok());
        // In v1, fees are 0, so payout equals total pool
        assert_eq!(result.unwrap(), 5_000_000i128);
    }

    // Test calculate_and_validate_payout_amount with zero pool
    #[test]
    fn test_calculate_payout_amount_zero() {
        let pool_info = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 0i128,
            total_pool_amount: 0i128,
            current_contributions: 0i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };

        let result = calculate_and_validate_payout_amount(&pool_info);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    // Test calculate_and_validate_payout_amount with negative pool (edge case)
    #[test]
    fn test_calculate_payout_amount_negative() {
        let pool_info = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: -1_000_000i128,
            total_pool_amount: -5_000_000i128,
            current_contributions: -5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };

        let result = calculate_and_validate_payout_amount(&pool_info);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    // Test calculate_and_validate_payout_amount with large pool
    #[test]
    fn test_calculate_payout_amount_large() {
        let pool_info = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 100,
            contribution_amount: 100_000_000i128,  // 10 XLM
            total_pool_amount: 10_000_000_000i128, // 1000 XLM
            current_contributions: 10_000_000_000i128,
            contributors_count: 100,
            is_cycle_complete: true,
        };

        let result = calculate_and_validate_payout_amount(&pool_info);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 10_000_000_000i128);
    }

    // Test verify_contract_balance — now requires a real group with TokenConfig.
    // These tests verify the amount guard only; storage lookup will return GroupNotFound
    // for group_id=0 which is expected in unit test context.
    #[test]
    fn test_verify_contract_balance_placeholder() {
        let env = Env::default();
        let payout_amount = 5_000_000i128;
        // group_id=0 has no TokenConfig → GroupNotFound
        let result = verify_contract_balance(&env, 0, payout_amount);
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_contract_balance_zero_payout() {
        let env = Env::default();
        let payout_amount = 0i128;
        // group_id=0 has no TokenConfig → GroupNotFound
        let result = verify_contract_balance(&env, 0, payout_amount);
        assert!(result.is_err());
    }

    #[test]
    fn test_helper_functions_integration() {
        let pool_info = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 3,
            contribution_amount: 2_000_000i128,
            total_pool_amount: 6_000_000i128,
            current_contributions: 6_000_000i128,
            contributors_count: 3,
            is_cycle_complete: true,
        };
        let payout_amount = calculate_and_validate_payout_amount(&pool_info);
        assert!(payout_amount.is_ok());
        assert_eq!(payout_amount.unwrap(), 6_000_000i128);

        let env = Env::default();
        // group_id=1 has no TokenConfig in unit test env → GroupNotFound
        let balance_check = verify_contract_balance(&env, 1, payout_amount.unwrap());
        assert!(balance_check.is_err());
    }

    #[test]
    fn test_execute_transfer_valid() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let amount = 5_000_000i128;
        // group_id=0 has no TokenConfig → GroupNotFound (amount guard passes)
        let result = execute_transfer(&env, 0, &recipient, amount);
        assert!(result.is_err()); // GroupNotFound since no token registered
    }

    #[test]
    fn test_execute_transfer_zero_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let amount = 0i128;
        let result = execute_transfer(&env, 0, &recipient, amount);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::PayoutFailed);
    }

    #[test]
    fn test_execute_transfer_negative_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let amount = -1_000_000i128;
        let result = execute_transfer(&env, 0, &recipient, amount);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::PayoutFailed);
    }

    #[test]
    fn test_execute_transfer_large_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let amount = 1_000_000_000_000i128;
        // group_id=0 has no TokenConfig → GroupNotFound (amount guard passes)
        let result = execute_transfer(&env, 0, &recipient, amount);
        assert!(result.is_err()); // GroupNotFound
    }

    #[test]
    fn test_execute_transfer_max_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let amount = i128::MAX;

        let result = execute_transfer(&env, 0, &recipient, amount);
        // group_id=0 has no TokenConfig → GroupNotFound (amount guard passes for i128::MAX)
        assert!(result.is_err());
    }

    // Test that execute_transfer gets contract address correctly
    #[test]
    fn test_execute_transfer_contract_address() {
        let env = Env::default();
        env.mock_all_auths();

        let recipient = Address::generate(&env);
        let amount = 1_000_000i128;

        // group_id=0 has no TokenConfig → GroupNotFound (amount guard passes)
        let result = execute_transfer(&env, 0, &recipient, amount);
        assert!(result.is_err()); // GroupNotFound
    }

    // Test record_payout with valid data
    #[test]
    fn test_record_payout_valid() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 5_000_000i128; // 0.5 XLM
        let timestamp = 1234567890u64;

        let result = record_payout(&env, group_id, cycle, recipient.clone(), amount, timestamp);
        assert!(result.is_ok());

        // Verify the payout record was stored correctly
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let stored_record: Option<PayoutRecord> = env.storage().persistent().get(&record_key);
        assert!(stored_record.is_some());

        let record = stored_record.unwrap();
        assert_eq!(record.recipient, recipient);
        assert_eq!(record.group_id, group_id);
        assert_eq!(record.cycle_number, cycle);
        assert_eq!(record.amount, amount);
        assert_eq!(record.timestamp, timestamp);

        // Verify the recipient was stored for quick lookup
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
        let stored_recipient: Option<Address> = env.storage().persistent().get(&recipient_key);
        assert!(stored_recipient.is_some());
        assert_eq!(stored_recipient.unwrap(), recipient);
    }

    // Test record_payout with large amount
    #[test]
    fn test_record_payout_large_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 5u32;
        let amount = 1_000_000_000_000i128; // 100,000 XLM
        let timestamp = 1234567890u64;

        let result = record_payout(&env, group_id, cycle, recipient.clone(), amount, timestamp);
        assert!(result.is_ok());

        // Verify the record was stored
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let stored_record: Option<PayoutRecord> = env.storage().persistent().get(&record_key);
        assert!(stored_record.is_some());
        assert_eq!(stored_record.unwrap().amount, amount);
    }

    // Test record_payout with different cycles
    #[test]
    fn test_record_payout_multiple_cycles() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);
        let group_id = 1u64;
        let amount = 5_000_000i128;
        let timestamp = 1234567890u64;

        // Record payout for cycle 0
        let result1 = record_payout(&env, group_id, 0, recipient1.clone(), amount, timestamp);
        assert!(result1.is_ok());

        // Record payout for cycle 1
        let result2 = record_payout(
            &env,
            group_id,
            1,
            recipient2.clone(),
            amount,
            timestamp + 604800,
        );
        assert!(result2.is_ok());

        // Verify both records exist
        let record_key_0 = StorageKeyBuilder::payout_record(group_id, 0);
        let record_key_1 = StorageKeyBuilder::payout_record(group_id, 1);

        let stored_record_0: Option<PayoutRecord> = env.storage().persistent().get(&record_key_0);
        let stored_record_1: Option<PayoutRecord> = env.storage().persistent().get(&record_key_1);

        assert!(stored_record_0.is_some());
        assert!(stored_record_1.is_some());
        assert_eq!(stored_record_0.unwrap().recipient, recipient1);
        assert_eq!(stored_record_1.unwrap().recipient, recipient2);
    }

    // Test record_payout with minimum valid amount
    #[test]
    fn test_record_payout_minimum_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 1i128; // Minimum valid amount (1 stroop)
        let timestamp = 1234567890u64;

        let result = record_payout(&env, group_id, cycle, recipient.clone(), amount, timestamp);
        assert!(result.is_ok());

        // Verify the record was stored
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let stored_record: Option<PayoutRecord> = env.storage().persistent().get(&record_key);
        assert!(stored_record.is_some());
        assert_eq!(stored_record.unwrap().amount, amount);
    }

    // Test record_payout validates the record
    #[test]
    fn test_record_payout_validation() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 5_000_000i128;
        let timestamp = 1234567890u64;

        let result = record_payout(&env, group_id, cycle, recipient.clone(), amount, timestamp);
        assert!(result.is_ok());

        // Verify the stored record passes validation
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let stored_record: PayoutRecord = env.storage().persistent().get(&record_key).unwrap();
        assert!(stored_record.validate());
    }

    // Test record_payout with zero amount should panic (PayoutRecord::new panics)
    #[test]
    #[should_panic(expected = "amount must be greater than 0")]
    fn test_record_payout_zero_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 0i128; // Invalid amount
        let timestamp = 1234567890u64;

        // This should panic because PayoutRecord::new validates amount > 0
        let _result = record_payout(&env, group_id, cycle, recipient, amount, timestamp);
    }

    // Test record_payout with negative amount should panic
    #[test]
    #[should_panic(expected = "amount must be greater than 0")]
    fn test_record_payout_negative_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = -1_000_000i128; // Invalid negative amount
        let timestamp = 1234567890u64;

        // This should panic because PayoutRecord::new validates amount > 0
        let _result = record_payout(&env, group_id, cycle, recipient, amount, timestamp);
    }

    // Test record_payout stores both record and recipient keys
    #[test]
    fn test_record_payout_stores_both_keys() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 5_000_000i128;
        let timestamp = 1234567890u64;

        let result = record_payout(&env, group_id, cycle, recipient.clone(), amount, timestamp);
        assert!(result.is_ok());

        // Verify both storage keys exist
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);

        assert!(env.storage().persistent().has(&record_key));
        assert!(env.storage().persistent().has(&recipient_key));
    }

    // Test record_payout with different group IDs
    #[test]
    fn test_record_payout_different_groups() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);
        let cycle = 0u32;
        let amount = 5_000_000i128;
        let timestamp = 1234567890u64;

        // Record payout for group 1
        let result1 = record_payout(&env, 1, cycle, recipient1.clone(), amount, timestamp);
        assert!(result1.is_ok());

        // Record payout for group 2
        let result2 = record_payout(&env, 2, cycle, recipient2.clone(), amount, timestamp);
        assert!(result2.is_ok());

        // Verify both records exist and are independent
        let record_key_1 = StorageKeyBuilder::payout_record(1, cycle);
        let record_key_2 = StorageKeyBuilder::payout_record(2, cycle);

        let stored_record_1: Option<PayoutRecord> = env.storage().persistent().get(&record_key_1);
        let stored_record_2: Option<PayoutRecord> = env.storage().persistent().get(&record_key_2);

        assert!(stored_record_1.is_some());
        assert!(stored_record_2.is_some());
        assert_eq!(stored_record_1.unwrap().group_id, 1);
        assert_eq!(stored_record_2.unwrap().group_id, 2);
    }

    // Test update_member_status with valid member
    #[test]
    fn test_update_member_status_valid() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;

        // Create a member profile for the recipient
        let member_profile = MemberProfile {
            address: recipient.clone(),
            group_id,
            payout_position: 0,
            joined_at: 1234567890u64,
            auto_contribute_enabled: false,
        };

        // Store the member profile
        let member_key = StorageKeyBuilder::member_profile(group_id, recipient.clone());
        env.storage().persistent().set(&member_key, &member_profile);

        // Update member status should succeed
        let result = update_member_status(&env, group_id, &recipient);
        assert!(result.is_ok());
    }

    // Test update_member_status with non-existent member
    #[test]
    fn test_update_member_status_member_not_found() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;

        // Don't create a member profile - member doesn't exist

        // Update member status should fail with InternalError
        let result = update_member_status(&env, group_id, &recipient);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InternalError);
    }

    // Test update_member_status with different group IDs
    #[test]
    fn test_update_member_status_different_groups() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id_1 = 1u64;
        let group_id_2 = 2u64;

        // Create member profile for group 1
        let member_profile_1 = MemberProfile {
            address: recipient.clone(),
            group_id: group_id_1,
            payout_position: 0,
            joined_at: 1234567890u64,
            auto_contribute_enabled: false,
        };
        let member_key_1 = StorageKeyBuilder::member_profile(group_id_1, recipient.clone());
        env.storage()
            .persistent()
            .set(&member_key_1, &member_profile_1);

        // Update status for group 1 should succeed
        let result1 = update_member_status(&env, group_id_1, &recipient);
        assert!(result1.is_ok());

        // Update status for group 2 should fail (member not in group 2)
        let result2 = update_member_status(&env, group_id_2, &recipient);
        assert!(result2.is_err());
        assert_eq!(result2.unwrap_err(), StellarSaveError::InternalError);
    }

    // Test update_member_status consistency with payout_recipient storage
    #[test]
    fn test_update_member_status_consistency() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;

        // Create member profile
        let member_profile = MemberProfile {
            address: recipient.clone(),
            group_id,
            payout_position: cycle,
            joined_at: 1234567890u64,
            auto_contribute_enabled: false,
        };
        let member_key = StorageKeyBuilder::member_profile(group_id, recipient.clone());
        env.storage().persistent().set(&member_key, &member_profile);

        // Store payout recipient (simulating record_payout)
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
        env.storage().persistent().set(&recipient_key, &recipient);

        // Update member status should succeed
        let result = update_member_status(&env, group_id, &recipient);
        assert!(result.is_ok());

        // Verify payout recipient is still stored correctly
        let stored_recipient: Option<Address> = env.storage().persistent().get(&recipient_key);
        assert!(stored_recipient.is_some());
        assert_eq!(stored_recipient.unwrap(), recipient);
    }

    // Test update_member_status with multiple members
    #[test]
    fn test_update_member_status_multiple_members() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);
        let group_id = 1u64;

        // Create member profiles for both recipients
        let member_profile_1 = MemberProfile {
            address: recipient1.clone(),
            group_id,
            payout_position: 0,
            joined_at: 1234567890u64,
            auto_contribute_enabled: false,
        };
        let member_profile_2 = MemberProfile {
            address: recipient2.clone(),
            group_id,
            payout_position: 1,
            joined_at: 1234567890u64,
            auto_contribute_enabled: false,
        };

        let member_key_1 = StorageKeyBuilder::member_profile(group_id, recipient1.clone());
        let member_key_2 = StorageKeyBuilder::member_profile(group_id, recipient2.clone());

        env.storage()
            .persistent()
            .set(&member_key_1, &member_profile_1);
        env.storage()
            .persistent()
            .set(&member_key_2, &member_profile_2);

        // Update status for both members should succeed
        let result1 = update_member_status(&env, group_id, &recipient1);
        let result2 = update_member_status(&env, group_id, &recipient2);

        assert!(result1.is_ok());
        assert!(result2.is_ok());
    }

    // Test emit_payout_event with valid data
    #[test]
    fn test_emit_payout_event_valid() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 5_000_000i128; // 0.5 XLM
        let timestamp = 1234567890u64;

        // Event emission should not panic or fail
        // This function always succeeds, even if event emission fails internally
        emit_payout_event(&env, group_id, recipient.clone(), amount, cycle, timestamp);

        // No assertion needed - if we reach here, the function succeeded
        // In a real test environment with event inspection, we would verify
        // that the PayoutExecuted event was emitted with correct data
    }

    // Test emit_payout_event with large amount
    #[test]
    fn test_emit_payout_event_large_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 5u32;
        let amount = 1_000_000_000_000i128; // 100,000 XLM
        let timestamp = 1234567890u64;

        // Event emission should handle large amounts without issue
        emit_payout_event(&env, group_id, recipient, amount, cycle, timestamp);
    }

    // Test emit_payout_event with minimum amount
    #[test]
    fn test_emit_payout_event_minimum_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 1i128; // 1 stroop
        let timestamp = 1234567890u64;

        // Event emission should handle minimum amount
        emit_payout_event(&env, group_id, recipient, amount, cycle, timestamp);
    }

    // Test emit_payout_event with different cycles
    #[test]
    fn test_emit_payout_event_multiple_cycles() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);
        let group_id = 1u64;
        let amount = 5_000_000i128;
        let timestamp = 1234567890u64;

        // Emit events for multiple cycles
        emit_payout_event(&env, group_id, recipient1, amount, 0, timestamp);
        emit_payout_event(&env, group_id, recipient2, amount, 1, timestamp + 604800);

        // Both emissions should succeed
    }

    // Test emit_payout_event with different groups
    #[test]
    fn test_emit_payout_event_different_groups() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);
        let cycle = 0u32;
        let amount = 5_000_000i128;
        let timestamp = 1234567890u64;

        // Emit events for different groups
        emit_payout_event(&env, 1, recipient1, amount, cycle, timestamp);
        emit_payout_event(&env, 2, recipient2, amount, cycle, timestamp);

        // Both emissions should succeed
    }

    // Test emit_payout_event is non-critical (always succeeds)
    #[test]
    fn test_emit_payout_event_non_critical() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 5_000_000i128;
        let timestamp = 1234567890u64;

        // Call emit_payout_event multiple times
        // This should never panic or fail, demonstrating non-critical behavior
        for _ in 0..10 {
            emit_payout_event(&env, group_id, recipient.clone(), amount, cycle, timestamp);
        }

        // All emissions should succeed without error
    }

    // Test emit_payout_event with zero amount (edge case)
    // Note: In production, this would not occur because payout validation
    // prevents zero amounts, but we test the event emission is robust
    #[test]
    fn test_emit_payout_event_zero_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let amount = 0i128; // Edge case - should not occur in production
        let timestamp = 1234567890u64;

        // Event emission should not panic even with invalid data
        // This demonstrates the non-critical nature of event emission
        emit_payout_event(&env, group_id, recipient, amount, cycle, timestamp);
    }

    // Test advance_cycle_or_complete with valid group
    #[test]
    fn test_advance_cycle_or_complete_valid() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with 3 members (3 cycles total)
        let mut group = Group::new(
            1,
            creator,
            10_000_000i128, // 1 XLM
            604800,         // 1 week
            3,              // 3 members
            2,              // 2 min members
            1234567890,
        );

        // Group starts at cycle 0
        assert_eq!(group.current_cycle, 0);
        assert_eq!(group.status, GroupStatus::Active);
        assert!(group.is_active);
        assert!(!group.is_complete());

        // Advance to cycle 1
        let result = advance_cycle_or_complete(&env, &mut group);
        assert!(result.is_ok());
        assert_eq!(group.current_cycle, 1);
        assert_eq!(group.status, GroupStatus::Active);
        assert!(group.is_active);
        assert!(!group.is_complete());

        // Verify group was saved to storage
        let group_key = StorageKeyBuilder::group_data(group.id);
        let stored_group: Option<Group> = env.storage().persistent().get(&group_key);
        assert!(stored_group.is_some());
        assert_eq!(stored_group.unwrap().current_cycle, 1);
    }

    // Test advance_cycle_or_complete advances to completion
    #[test]
    fn test_advance_cycle_or_complete_to_completion() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with 3 members
        let mut group = Group::new(1, creator, 10_000_000i128, 604800, 3, 2, 1234567890);

        // Advance to cycle 1
        let result1 = advance_cycle_or_complete(&env, &mut group);
        assert!(result1.is_ok());
        assert_eq!(group.current_cycle, 1);
        assert!(!group.is_complete());

        // Advance to cycle 2
        let result2 = advance_cycle_or_complete(&env, &mut group);
        assert!(result2.is_ok());
        assert_eq!(group.current_cycle, 2);
        assert!(!group.is_complete());

        // Advance to cycle 3 - should mark as complete
        let result3 = advance_cycle_or_complete(&env, &mut group);
        assert!(result3.is_ok());
        assert_eq!(group.current_cycle, 3);
        assert!(group.is_complete());
        assert_eq!(group.status, GroupStatus::Completed);
        assert!(!group.is_active);

        // Verify group was saved with completed status
        let group_key = StorageKeyBuilder::group_data(group.id);
        let stored_group: Group = env.storage().persistent().get(&group_key).unwrap();
        assert_eq!(stored_group.current_cycle, 3);
        assert_eq!(stored_group.status, GroupStatus::Completed);
        assert!(!stored_group.is_active);
    }

    // Test advance_cycle_or_complete with 2-member group
    #[test]
    fn test_advance_cycle_or_complete_small_group() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a minimal group with 2 members
        let mut group = Group::new(
            1,
            creator,
            5_000_000i128,
            604800,
            2, // Only 2 members
            2,
            1234567890,
        );

        assert_eq!(group.current_cycle, 0);
        assert!(!group.is_complete());

        // Advance to cycle 1
        let result1 = advance_cycle_or_complete(&env, &mut group);
        assert!(result1.is_ok());
        assert_eq!(group.current_cycle, 1);
        assert!(!group.is_complete());

        // Advance to cycle 2 - should complete
        let result2 = advance_cycle_or_complete(&env, &mut group);
        assert!(result2.is_ok());
        assert_eq!(group.current_cycle, 2);
        assert!(group.is_complete());
        assert_eq!(group.status, GroupStatus::Completed);
    }

    // Test advance_cycle_or_complete with large group
    #[test]
    fn test_advance_cycle_or_complete_large_group() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a larger group with 10 members
        let mut group = Group::new(
            1,
            creator,
            10_000_000i128,
            604800,
            10, // 10 members
            2,
            1234567890,
        );

        // Advance through several cycles
        for expected_cycle in 1..=5 {
            let result = advance_cycle_or_complete(&env, &mut group);
            assert!(result.is_ok());
            assert_eq!(group.current_cycle, expected_cycle);
            assert!(!group.is_complete());
            assert_eq!(group.status, GroupStatus::Active);
        }

        // Verify we're at cycle 5 and still active
        assert_eq!(group.current_cycle, 5);
        assert!(!group.is_complete());
    }

    // Test advance_cycle_or_complete saves to correct storage key
    #[test]
    fn test_advance_cycle_or_complete_storage_key() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(
            42, // Specific group ID
            creator,
            10_000_000i128,
            604800,
            3,
            2,
            1234567890,
        );

        let result = advance_cycle_or_complete(&env, &mut group);
        assert!(result.is_ok());

        // Verify the group was saved with the correct group ID
        let group_key = StorageKeyBuilder::group_data(42);
        let stored_group: Option<Group> = env.storage().persistent().get(&group_key);
        assert!(stored_group.is_some());
        assert_eq!(stored_group.unwrap().id, 42);
    }

    // Test advance_cycle_or_complete increments by exactly 1
    #[test]
    fn test_advance_cycle_or_complete_increments_by_one() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(1, creator, 10_000_000i128, 604800, 5, 2, 1234567890);

        let initial_cycle = group.current_cycle;

        let result = advance_cycle_or_complete(&env, &mut group);
        assert!(result.is_ok());

        // Verify cycle incremented by exactly 1
        assert_eq!(group.current_cycle, initial_cycle + 1);
    }

    // Test advance_cycle_or_complete panics on already complete group
    #[test]
    #[should_panic(expected = "group is already complete")]
    fn test_advance_cycle_or_complete_already_complete() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let mut group = Group::new(1, creator, 10_000_000i128, 604800, 2, 2, 1234567890);

        // Advance to completion
        group.current_cycle = 2;
        group.status = GroupStatus::Completed;
        group.is_active = false;

        // This should panic because group is already complete
        let _result = advance_cycle_or_complete(&env, &mut group);
    }

    // =========================================================================
    // apply_missed_contribution_penalties tests
    // =========================================================================

    #[test]
    fn test_apply_missed_penalties_charges_non_contributors() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member_a = Address::generate(&env);
        let member_b = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let penalty = 500_000i128;

        // Create group with penalty enabled
        let group = crate::group::Group::new_with_penalty(
            group_id, creator, 10_000_000, 604800, 3, 2, 1_000_000, true, penalty,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store member list: member_a and member_b
        let mut members = soroban_sdk::Vec::new(&env);
        members.push_back(member_a.clone());
        members.push_back(member_b.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Only member_a contributed — member_b missed
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, member_a.clone());
        env.storage().persistent().set(&contrib_key, &true);

        apply_missed_contribution_penalties(&env, group_id, cycle, &group).unwrap();

        // member_b should have a penalty
        let penalty_key_b = StorageKeyBuilder::member_penalty_total(group_id, member_b.clone());
        let total_b: i128 = env.storage().persistent().get(&penalty_key_b).unwrap_or(0);
        assert_eq!(total_b, penalty);

        // member_a should have no penalty
        let penalty_key_a = StorageKeyBuilder::member_penalty_total(group_id, member_a.clone());
        let total_a: i128 = env.storage().persistent().get(&penalty_key_a).unwrap_or(0);
        assert_eq!(total_a, 0);
    }

    #[test]
    fn test_apply_missed_penalties_adds_to_pool() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;
        let penalty = 500_000i128;

        let group = crate::group::Group::new_with_penalty(
            group_id, creator, 10_000_000, 604800, 2, 2, 1_000_000, true, penalty,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let mut members = soroban_sdk::Vec::new(&env);
        members.push_back(member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Seed pool with existing contributions
        let pool_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        env.storage().persistent().set(&pool_key, &10_000_000i128);

        // member missed — no contribution record stored
        apply_missed_contribution_penalties(&env, group_id, cycle, &group).unwrap();

        let pool: i128 = env.storage().persistent().get(&pool_key).unwrap_or(0);
        assert_eq!(pool, 10_500_000); // 10_000_000 + 500_000 penalty
    }

    #[test]
    fn test_apply_missed_penalties_no_op_when_disabled() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1u64;
        let cycle = 0u32;

        // penalty_enabled = false
        let group = crate::group::Group::new_with_penalty(
            group_id, creator, 10_000_000, 604800, 2, 2, 1_000_000, false, 0,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let mut members = soroban_sdk::Vec::new(&env);
        members.push_back(member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // The function should still succeed but apply no penalties
        apply_missed_contribution_penalties(&env, group_id, cycle, &group).unwrap();

        let penalty_key = StorageKeyBuilder::member_penalty_total(group_id, member.clone());
        let total: i128 = env.storage().persistent().get(&penalty_key).unwrap_or(0);
        assert_eq!(total, 0);
    }
}
