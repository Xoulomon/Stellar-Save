#![no_std]

//! # Stellar-Save Smart Contract
//!
//! A decentralized rotational savings and credit association (ROSCA) built on Stellar Soroban.
//!
//! This contract enables groups to pool funds in a rotating savings system where:
//! - Members contribute a fixed amount each cycle
//! - One member receives the total pool each cycle
//! - The process rotates until all members have received a payout
//!
//! ## Modules
//! - `error`: Comprehensive error types and handling
//! - `group`: Core Group data structure and state management
//! - `contribution`: Contribution record tracking for member payments
//! - `payout`: Payout record tracking for fund distributions
//! - `events`: Event definitions for contract actions

pub mod contribution;
pub mod error;
pub mod events;
pub mod group;
pub mod payout;
pub mod storage;

// Re-export for convenience
pub use contribution::ContributionRecord;
pub use error::{ContractResult, ErrorCategory, StellarSaveError};
pub use events::EventEmitter;
pub use group::{Group, GroupStatus};
pub use payout::PayoutRecord;
pub use storage::StorageKeyBuilder;
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct StellarSaveContract;

#[contractimpl]
impl StellarSaveContract {
    pub fn hello(env: Env) -> soroban_sdk::Symbol {
        soroban_sdk::symbol_short!("hello")
    }

    /// Requests a refund for a contribution made in error or when a group fails to activate.
    ///
    /// This function allows members to request refunds for their contributions under specific conditions:
    /// 1. The group is in Pending status (not yet activated)
    /// 2. The group has failed to activate (e.g., insufficient members)
    /// 3. The contribution was made in error
    ///
    /// Refunds can be:
    /// - Automatic: For groups that fail to activate
    /// - Creator-approved: For contributions made in error
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Cycle number for which the contribution was made
    /// * `requester` - Address of the member requesting the refund
    ///
    /// # Returns
    /// * `Ok(())` - Refund request successfully recorded
    /// * `Err(StellarSaveError)` - If validation fails
    ///
    /// # Errors
    /// * `StellarSaveError::GroupNotFound` - Group doesn't exist
    /// * `StellarSaveError::NotMember` - Requester is not a member of the group
    /// * `StellarSaveError::InvalidState` - Group is not in a refundable state
    /// * `StellarSaveError::NotEligibleForRefund` - Contribution is not eligible for refund
    /// * `StellarSaveError::RefundAlreadyProcessed` - Refund already processed for this contribution
    pub fn request_refund(
        env: Env,
        group_id: u64,
        cycle: u32,
        requester: Address,
    ) -> Result<(), StellarSaveError> {
        // Verify caller authorization
        requester.require_auth();

        // 1. Load group data
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Check if requester is a member of the group
        let member_key = StorageKeyBuilder::member_profile(group_id, requester.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // 3. Check group status - only Pending or Cancelled groups are eligible for refunds
        let status_key = StorageKeyBuilder::group_status(group_id);
        let status = env
            .storage()
            .persistent()
            .get::<_, GroupStatus>(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if !matches!(status, GroupStatus::Pending | GroupStatus::Cancelled) {
            return Err(StellarSaveError::InvalidState);
        }

        // 4. Check if contribution exists
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, requester.clone());
        let contribution: ContributionRecord = env
            .storage()
            .persistent()
            .get(&contrib_key)
            .ok_or(StellarSaveError::NotEligibleForRefund)?;

        // 5. Check if refund was already processed
        let refund_key = StorageKeyBuilder::refund_status(group_id, cycle, requester.clone());
        if env.storage().persistent().has(&refund_key) {
            return Err(StellarSaveError::RefundAlreadyProcessed);
        }

        // 6. Store refund request
        let refund_request = RefundRequest {
            group_id,
            cycle,
            requester: requester.clone(),
            amount: contribution.amount,
            requested_at: env.ledger().timestamp(),
            status: RefundStatus::Pending,
            approved_by: None,
        };

        let request_key = StorageKeyBuilder::refund_request(group_id, cycle, requester.clone());
        env.storage().persistent().set(&request_key, &refund_request);

        // 7. Emit event
        EventEmitter::emit_refund_requested(
            &env,
            group_id,
            requester,
            contribution.amount,
            cycle,
            env.ledger().timestamp(),
        );

        Ok(())
    }

    /// Approves a refund request (creator or admin only).
    ///
    /// This function allows the group creator or contract admin to approve refund requests.
    /// Once approved, the refund can be processed immediately or require further action.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Cycle number for the contribution
    /// * `requester` - Address of the member who requested the refund
    /// * `approver` - Address of the approver (must be group creator or admin)
    ///
    /// # Returns
    /// * `Ok(())` - Refund successfully approved
    /// * `Err(StellarSaveError)` - If validation fails
    ///
    /// # Errors
    /// * `StellarSaveError::GroupNotFound` - Group doesn't exist
    /// * `StellarSaveError::Unauthorized` - Approver is not authorized
    /// * `StellarSaveError::NotEligibleForRefund` - Refund request doesn't exist or not eligible
    pub fn approve_refund(
        env: Env,
        group_id: u64,
        cycle: u32,
        requester: Address,
        approver: Address,
    ) -> Result<(), StellarSaveError> {
        // Verify caller authorization
        approver.require_auth();

        // 1. Load group data
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Check if approver is group creator
        if approver != group.creator {
            return Err(StellarSaveError::Unauthorized);
        }

        // 3. Load refund request
        let request_key = StorageKeyBuilder::refund_request(group_id, cycle, requester.clone());
        let mut refund_request: RefundRequest = env
            .storage()
            .persistent()
            .get(&request_key)
            .ok_or(StellarSaveError::NotEligibleForRefund)?;

        // 4. Check if refund is still pending
        if refund_request.status != RefundStatus::Pending {
            return Err(StellarSaveError::NotEligibleForRefund);
        }

        // 5. Update refund request status
        refund_request.status = RefundStatus::Approved;
        refund_request.approved_by = Some(approver.clone());
        refund_request.approved_at = Some(env.ledger().timestamp());

        env.storage().persistent().set(&request_key, &refund_request);

        // 6. Emit event
        EventEmitter::emit_refund_approved(
            &env,
            group_id,
            requester,
            refund_request.amount,
            cycle,
            approver,
            env.ledger().timestamp(),
        );

        Ok(())
    }

    /// Processes an approved refund and transfers funds back to the contributor.
    ///
    /// This function executes the actual refund transfer after approval.
    /// It validates all conditions, updates records, and transfers funds.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Cycle number for the contribution
    /// * `requester` - Address of the member who requested the refund
    ///
    /// # Returns
    /// * `Ok(())` - Refund successfully processed
    /// * `Err(StellarSaveError)` - If validation fails or transfer error
    ///
    /// # Errors
    /// * `StellarSaveError::GroupNotFound` - Group doesn't exist
    /// * `StellarSaveError::NotEligibleForRefund` - Refund not approved or doesn't exist
    /// * `StellarSaveError::RefundFailed` - Transfer failed
    /// * `StellarSaveError::RefundAlreadyProcessed` - Refund already processed
    pub fn process_refund(
        env: Env,
        group_id: u64,
        cycle: u32,
        requester: Address,
    ) -> Result<(), StellarSaveError> {
        // 1. Load group data
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Load refund request
        let request_key = StorageKeyBuilder::refund_request(group_id, cycle, requester.clone());
        let refund_request: RefundRequest = env
            .storage()
            .persistent()
            .get(&request_key)
            .ok_or(StellarSaveError::NotEligibleForRefund)?;

        // 3. Check if refund is approved
        if refund_request.status != RefundStatus::Approved {
            return Err(StellarSaveError::NotEligibleForRefund);
        }

        // 4. Check if refund was already processed
        let refund_key = StorageKeyBuilder::refund_status(group_id, cycle, requester.clone());
        if env.storage().persistent().has(&refund_key) {
            return Err(StellarSaveError::RefundAlreadyProcessed);
        }

        // 5. Check if contribution still exists
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, requester.clone());
        let contribution: ContributionRecord = env
            .storage()
            .persistent()
            .get(&contrib_key)
            .ok_or(StellarSaveError::NotEligibleForRefund)?;

        // 6. Validate amount matches
        if contribution.amount != refund_request.amount {
            return Err(StellarSaveError::DataCorruption);
        }

        // 7. Update group balance (subtract refund amount)
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        
        if current_balance < refund_request.amount {
            return Err(StellarSaveError::RefundFailed);
        }

        let new_balance = current_balance
            .checked_sub(refund_request.amount)
            .ok_or(StellarSaveError::Overflow)?;
        
        env.storage().persistent().set(&balance_key, &new_balance);

        // 8. Update member total contributions (subtract refunded amount)
        let member_total_key = StorageKeyBuilder::member_total_contributions(group_id, requester.clone());
        let member_current: i128 = env.storage().persistent().get(&member_total_key).unwrap_or(0);
        let member_new = member_current
            .checked_sub(refund_request.amount)
            .ok_or(StellarSaveError::Overflow)?;
        
        env.storage().persistent().set(&member_total_key, &member_new);

        // 9. Update cycle total contributions
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let current_total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        let new_total = current_total
            .checked_sub(refund_request.amount)
            .ok_or(StellarSaveError::Overflow)?;
        
        env.storage().persistent().set(&total_key, &new_total);

        // 10. Update cycle contributor count
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let current_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        let new_count = current_count
            .checked_sub(1)
            .ok_or(StellarSaveError::Overflow)?;
        
        env.storage().persistent().set(&count_key, &new_count);

        // 11. Remove contribution record
        env.storage().persistent().remove(&contrib_key);

        // 12. Mark refund as processed
        let refund_status = RefundStatus::Processed;
        env.storage().persistent().set(&refund_key, &refund_status);

        // 13. Update refund request status
        let mut updated_request = refund_request;
        updated_request.status = RefundStatus::Processed;
        updated_request.processed_at = Some(env.ledger().timestamp());
        env.storage().persistent().set(&request_key, &updated_request);

        // 14. Emit RefundIssued event
        let reason = if group.status == GroupStatus::Cancelled {
            1 // Group failed to activate
        } else {
            2 // Creator approved
        };

        EventEmitter::emit_refund_issued(
            &env,
            group_id,
            requester.clone(),
            refund_request.amount,
            cycle,
            reason,
            env.ledger().timestamp(),
        );

        // 15. Transfer funds back to contributor
        // Note: In a real implementation, this would involve actual token transfer
        // For now, we'll emit an event indicating the transfer should happen
        // In production: env.invoke_contract(&token_address, &transfer, &args);

        Ok(())
    }

    /// Automatically processes refunds for groups that failed to activate.
    ///
    /// This function is called when a group is cancelled due to failure to activate
    /// (e.g., insufficient members before deadline). It automatically processes
    /// refunds for all contributions in the group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group that failed to activate
    ///
    /// # Returns
    /// * `Ok(u32)` - Number of refunds processed
    /// * `Err(StellarSaveError)` - If validation fails
    ///
    /// # Errors
    /// * `StellarSaveError::GroupNotFound` - Group doesn't exist
    /// * `StellarSaveError::InvalidState` - Group is not in Cancelled status
    pub fn process_automatic_refunds(
        env: Env,
        group_id: u64,
    ) -> Result<u32, StellarSaveError> {
        // 1. Load group data
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Check group status - must be Cancelled for automatic refunds
        let status_key = StorageKeyBuilder::group_status(group_id);
        let status = env
            .storage()
            .persistent()
            .get::<_, GroupStatus>(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if status != GroupStatus::Cancelled {
            return Err(StellarSaveError::InvalidState);
        }

        // 3. Get all members
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Vec::new(&env));

        let mut refunds_processed = 0;

        // 4. Process refunds for each member
        for member in members.iter() {
            // Check contributions for cycle 0 (groups that fail to activate only have cycle 0 contributions)
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
            
            if let Some(contribution) = env.storage().persistent().get::<_, ContributionRecord>(&contrib_key) {
                // Create automatic refund request
                let refund_request = RefundRequest {
                    group_id,
                    cycle: 0,
                    requester: member.clone(),
                    amount: contribution.amount,
                    requested_at: env.ledger().timestamp(),
                    status: RefundStatus::Approved, // Auto-approved for failed groups
                    approved_by: Some(group.creator.clone()),
                    approved_at: Some(env.ledger().timestamp()),
                    processed_at: None,
                };

                let request_key = StorageKeyBuilder::refund_request(group_id, 0, member.clone());
                env.storage().persistent().set(&request_key, &refund_request);

                // Process the refund
                if let Ok(()) = Self::process_refund(env.clone(), group_id, 0, member.clone()) {
                    refunds_processed += 1;
                }
            }
        }

        Ok(refunds_processed)
    }

    /// Gets the refund status for a specific contribution.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Cycle number
    /// * `member` - Member address
    ///
    /// # Returns
    /// * `Ok(Option<RefundRequest>)` - Refund request if exists, None otherwise
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    pub fn get_refund_status(
        env: Env,
        group_id: u64,
        cycle: u32,
        member: Address,
    ) -> Result<Option<RefundRequest>, StellarSaveError> {
        // Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let _group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let request_key = StorageKeyBuilder::refund_request(group_id, cycle, member);
        let refund_request: Option<RefundRequest> = env.storage().persistent().get(&request_key);

        Ok(refund_request)
    }
}

/// Refund request status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RefundStatus {
    /// Refund request is pending approval
    Pending,
    /// Refund has been approved
    Approved,
    /// Refund has been processed and funds transferred
    Processed,
    /// Refund request was denied
    Denied,
}

/// Refund request structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefundRequest {
    /// Group ID
    pub group_id: u64,
    /// Cycle number
    pub cycle: u32,
    /// Member requesting refund
    pub requester: Address,
    /// Amount to refund
    pub amount: i128,
    /// When the refund was requested
    pub requested_at: u64,
    /// Current status
    pub status: RefundStatus,
    /// Who approved the refund (if any)
    pub approved_by: Option<Address>,
    /// When the refund was approved (if any)
    pub approved_at: Option<u64>,
    /// When the refund was processed (if any)
    pub processed_at: Option<u64>,
}

/// Member profile structure for tracking member data in a group.
/// Stores the member's payout position (turn order) in the rotation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberProfile {
    /// Address of the member
    pub address: Address,

    /// Group ID this member belongs to
    pub group_id: u64,

    /// Payout position (0-indexed) - determines when member receives payout
    /// Position 0 receives payout in cycle 0, position 1 in cycle 1, etc.
    pub payout_position: u32,

    /// Timestamp when member joined the group
    pub joined_at: u64,
}


#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

    #[test]
    fn test_request_refund_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1;
        
        // Create a group in Pending status
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000, // 1 XLM
            604800,     // 1 week
            5,          // max members
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage().persistent().set(&status_key, &GroupStatus::Pending);
        
        // Add member
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 1234567890,
        };
        env.storage().persistent().set(&member_key, &member_profile);
        
        // Add contribution
        let contribution = ContributionRecord::new(
            member.clone(),
            group_id,
            0, // cycle 0
            10_000_000,
            1234567890,
        );
        
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contribution);
        
        // Set up group balance
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        env.storage().persistent().set(&balance_key, &10_000_000);
        
        // Mock auth
        env.mock_all_auths();
        
        // Request refund
        let result = client.request_refund(&group_id, &0, &member);
        assert!(result.is_ok());
        
        // Check refund request was created
        let request_key = StorageKeyBuilder::refund_request(group_id, 0, member.clone());
        let refund_request: Option<RefundRequest> = env.storage().persistent().get(&request_key);
        assert!(refund_request.is_some());
        
        let refund = refund_request.unwrap();
        assert_eq!(refund.group_id, group_id);
        assert_eq!(refund.cycle, 0);
        assert_eq!(refund.requester, member);
        assert_eq!(refund.amount, 10_000_000);
        assert_eq!(refund.status, RefundStatus::Pending);
    }

    #[test]
    fn test_request_refund_not_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let non_member = Address::generate(&env);
        let group_id = 1;
        
        // Create a group
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            2,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Mock auth
        env.mock_all_auths();
        
        // Try to request refund as non-member
        let result = client.request_refund(&group_id, &0, &non_member);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), StellarSaveError::NotMember);
    }

    #[test]
    fn test_request_refund_group_not_pending() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1;
        
        // Create a group in Active status
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            2,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage().persistent().set(&status_key, &GroupStatus::Active);
        
        // Add member
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 1234567890,
        };
        env.storage().persistent().set(&member_key, &member_profile);
        
        // Mock auth
        env.mock_all_auths();
        
        // Try to request refund for active group
        let result = client.request_refund(&group_id, &0, &member);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), StellarSaveError::InvalidState);
    }

    #[test]
    fn test_approve_refund_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1;
        
        // Create a group
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            2,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Create refund request
        let refund_request = RefundRequest {
            group_id,
            cycle: 0,
            requester: member.clone(),
            amount: 10_000_000,
            requested_at: 1234567890,
            status: RefundStatus::Pending,
            approved_by: None,
            approved_at: None,
            processed_at: None,
        };
        
        let request_key = StorageKeyBuilder::refund_request(group_id, 0, member.clone());
        env.storage().persistent().set(&request_key, &refund_request);
        
        // Mock auth
        env.mock_all_auths();
        
        // Approve refund
        let result = client.approve_refund(&group_id, &0, &member, &creator);
        assert!(result.is_ok());
        
        // Check refund request was updated
        let updated_request: RefundRequest = env.storage().persistent().get(&request_key).unwrap();
        assert_eq!(updated_request.status, RefundStatus::Approved);
        assert_eq!(updated_request.approved_by, Some(creator));
        assert!(updated_request.approved_at.is_some());
    }

    #[test]
    fn test_approve_refund_unauthorized() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let non_creator = Address::generate(&env);
        let group_id = 1;
        
        // Create a group
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            2,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Mock auth
        env.mock_all_auths();
        
        // Try to approve refund as non-creator
        let result = client.approve_refund(&group_id, &0, &member, &non_creator);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), StellarSaveError::Unauthorized);
    }

    #[test]
    fn test_process_refund_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1;
        
        // Create a group
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            2,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Add contribution
        let contribution = ContributionRecord::new(
            member.clone(),
            group_id,
            0,
            10_000_000,
            1234567890,
        );
        
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contribution);
        
        // Set up initial balances
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        env.storage().persistent().set(&balance_key, &10_000_000);
        
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, 0);
        env.storage().persistent().set(&total_key, &10_000_000);
        
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, 0);
        env.storage().persistent().set(&count_key, &1);
        
        let member_total_key = StorageKeyBuilder::member_total_contributions(group_id, member.clone());
        env.storage().persistent().set(&member_total_key, &10_000_000);
        
        // Create approved refund request
        let refund_request = RefundRequest {
            group_id,
            cycle: 0,
            requester: member.clone(),
            amount: 10_000_000,
            requested_at: 1234567890,
            status: RefundStatus::Approved,
            approved_by: Some(creator.clone()),
            approved_at: Some(1234567891),
            processed_at: None,
        };
        
        let request_key = StorageKeyBuilder::refund_request(group_id, 0, member.clone());
        env.storage().persistent().set(&request_key, &refund_request);
        
        // Process refund
        let result = client.process_refund(&group_id, &0, &member);
        assert!(result.is_ok());
        
        // Check contribution was removed
        assert!(!env.storage().persistent().has(&contrib_key));
        
        // Check balances were updated
        let new_balance: i128 = env.storage().persistent().get(&balance_key).unwrap();
        assert_eq!(new_balance, 0);
        
        let new_total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(new_total, 0);
        
        let new_count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(new_count, 0);
        
        let new_member_total: i128 = env.storage().persistent().get(&member_total_key).unwrap();
        assert_eq!(new_member_total, 0);
        
        // Check refund status was marked as processed
        let refund_key = StorageKeyBuilder::refund_status(group_id, 0, member.clone());
        let refund_status: RefundStatus = env.storage().persistent().get(&refund_key).unwrap();
        assert_eq!(refund_status, RefundStatus::Processed);
        
        // Check refund request was updated
        let updated_request: RefundRequest = env.storage().persistent().get(&request_key).unwrap();
        assert_eq!(updated_request.status, RefundStatus::Processed);
        assert!(updated_request.processed_at.is_some());
    }

    #[test]
    fn test_process_automatic_refunds() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        
        // Create a cancelled group
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage().persistent().set(&status_key, &GroupStatus::Cancelled);
        
        // Add members
        let members = vec![member1.clone(), member2.clone()];
        let members_key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&members_key, &members);
        
        // Add contributions
        for member in [&member1, &member2] {
            let contribution = ContributionRecord::new(
                member.clone(),
                group_id,
                0,
                10_000_000,
                1234567890,
            );
            
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
            env.storage().persistent().set(&contrib_key, &contribution);
        }
        
        // Set up initial balances
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        env.storage().persistent().set(&balance_key, &20_000_000);
        
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, 0);
        env.storage().persistent().set(&total_key, &20_000_000);
        
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, 0);
        env.storage().persistent().set(&count_key, &2);
        
        // Process automatic refunds
        let result = client.process_automatic_refunds(&group_id);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 2);
        
        // Check contributions were removed
        for member in [&member1, &member2] {
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
            assert!(!env.storage().persistent().has(&contrib_key));
        }
        
        // Check final balance
        let final_balance: i128 = env.storage().persistent().get(&balance_key).unwrap();
        assert_eq!(final_balance, 0);
    }

    #[test]
    fn test_get_refund_status() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1;
        
        // Create a group
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            2,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Create refund request
        let refund_request = RefundRequest {
            group_id,
            cycle: 0,
            requester: member.clone(),
            amount: 10_000_000,
            requested_at: 1234567890,
            status: RefundStatus::Pending,
            approved_by: None,
            approved_at: None,
            processed_at: None,
        };
        
        let request_key = StorageKeyBuilder::refund_request(group_id, 0, member.clone());
        env.storage().persistent().set(&request_key, &refund_request);
        
        // Get refund status
        let result = client.get_refund_status(&group_id, &0, &member);
        assert!(result.is_ok());
        
        let status = result.unwrap();
        assert!(status.is_some());
        
        let refund = status.unwrap();
        assert_eq!(refund.group_id, group_id);
        assert_eq!(refund.cycle, 0);
        assert_eq!(refund.requester, member);
        assert_eq!(refund.amount, 10_000_000);
        assert_eq!(refund.status, RefundStatus::Pending);
    }

    #[test]
    fn test_get_refund_status_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = 1;
        
        // Create a group
        let group = Group::new(
            group_id,
            creator.clone(),
            10_000_000,
            604800,
            5,
            2,
            1234567890,
        );
        
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Get refund status for non-existent request
        let result = client.get_refund_status(&group_id, &0, &member);
        assert!(result.is_ok());
        
        let status = result.unwrap();
        assert!(status.is_none());
    }
}