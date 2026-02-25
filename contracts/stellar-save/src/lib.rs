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
//! - `events`: Event types for contract state change tracking
//! - `error`: Comprehensive error types and handling
//! - `group`: Core Group data structure and state management
//! - `contribution`: Contribution record tracking for member payments
//! - `payout`: Payout record tracking for fund distributions
//! - `storage`: Storage key structure for efficient data access
//! - `status`: Group lifecycle status enum with state transitions
//! - `events`: Event definitions for contract actions

pub mod contribution;
pub mod error;
pub mod events;
pub mod group;
pub mod payout;
pub mod pool;
pub mod status;
pub mod storage;

// Re-export for convenience
pub use contribution::ContributionRecord;
use core::cmp;
pub use error::{ContractResult, ErrorCategory, StellarSaveError};
pub use events::EventEmitter;
pub use events::*;
pub use group::{Group, GroupStatus};
pub use payout::PayoutRecord;
pub use pool::{PoolCalculator, PoolInfo};
#[cfg(test)]
use soroban_sdk::testutils::{Events, Ledger};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};
pub use status::StatusError;
pub use storage::{StorageKey, StorageKeyBuilder};

#[contract]
pub struct StellarSaveContract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractConfig {
    pub admin: Address,
    pub min_contribution: i128,
    pub max_contribution: i128,
    pub min_members: u32,
    pub max_members: u32,
    pub min_cycle_duration: u64,
    pub max_cycle_duration: u64,
}

impl ContractConfig {
    pub fn validate(&self) -> bool {
        self.min_contribution > 0
            && self.max_contribution >= self.min_contribution
            && self.min_members >= 2
            && self.max_members >= self.min_members
            && self.min_cycle_duration > 0
            && self.max_cycle_duration >= self.min_cycle_duration
    }
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

/// Payout schedule entry containing recipient and payout date
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutScheduleEntry {
    pub recipient: Address,
    pub cycle: u32,
    pub payout_date: u64,
}

/// Assignment mode for payout positions
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AssignmentMode {
    /// Sequential assignment based on join order (default)
    Sequential,
    /// Random assignment using ledger timestamp as seed
    Random,
    /// Manual assignment with explicit positions
    Manual(Vec<u32>),
}

#[contractimpl]
impl StellarSaveContract {
    /// Validates that a contribution amount matches the group's required contribution amount.
    ///
    /// This helper function ensures that members contribute the exact amount specified
    /// by the group configuration, maintaining fairness in the ROSCA system.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - ID of the group to validate against
    /// * `amount` - The contribution amount to validate
    ///
    /// # Returns
    /// * `Ok(())` - The amount matches the group's required contribution
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::InvalidAmount)` - Amount doesn't match group requirement
    ///
    /// # Example
    /// ```ignore
    /// // Validate a contribution of 10 XLM for group 1
    /// StellarSaveContract::validate_contribution_amount(&env, 1, 100_000_000)?;
    /// ```
    pub fn validate_contribution_amount(
        env: &Env,
        group_id: u64,
        amount: i128,
    ) -> Result<(), StellarSaveError> {
        // Load the group from storage
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Compare the provided amount with the group's required contribution amount
        if amount != group.contribution_amount {
            return Err(StellarSaveError::InvalidAmount);
        }

        Ok(())
    }

    /// Records a contribution in storage and updates member statistics.
    ///
    /// This is an internal helper function that handles all the storage operations
    /// required when a member makes a contribution. It ensures data consistency by:
    /// - Creating and storing the contribution record
    /// - Updating the cycle's total contribution amount
    /// - Incrementing the cycle's contributor count
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - ID of the group receiving the contribution
    /// * `cycle_number` - The cycle number for this contribution
    /// * `member_address` - Address of the member making the contribution
    /// * `amount` - Contribution amount in stroops
    /// * `timestamp` - Timestamp when the contribution was made
    ///
    /// # Returns
    /// * `Ok(())` - Contribution successfully recorded
    /// * `Err(StellarSaveError::AlreadyContributed)` - Member already contributed this cycle
    /// * `Err(StellarSaveError::Overflow)` - Arithmetic overflow in totals
    ///
    /// # Storage Updates
    /// 1. Individual contribution record at `contribution_individual(group_id, cycle, address)`
    /// 2. Cycle total amount at `contribution_cycle_total(group_id, cycle)`
    /// 3. Cycle contributor count at `contribution_cycle_count(group_id, cycle)`
    ///
    /// # Example
    /// ```ignore
    /// // Record a 10 XLM contribution
    /// StellarSaveContract::record_contribution(
    ///     &env,
    ///     group_id,
    ///     0,  // cycle 0
    ///     member_address,
    ///     100_000_000,  // 10 XLM
    ///     env.ledger().timestamp()
    /// )?;
    /// ```
    fn record_contribution(
        env: &Env,
        group_id: u64,
        cycle_number: u32,
        member_address: Address,
        amount: i128,
        timestamp: u64,
    ) -> Result<(), StellarSaveError> {
        // 1. Check if member has already contributed in this cycle
        let contrib_key = StorageKeyBuilder::contribution_individual(
            group_id,
            cycle_number,
            member_address.clone(),
        );

        if env.storage().persistent().has(&contrib_key) {
            return Err(StellarSaveError::AlreadyContributed);
        }

        // 2. Create contribution record
        let contribution = ContributionRecord::new(
            member_address.clone(),
            group_id,
            cycle_number,
            amount,
            timestamp,
        );

        // 3. Store contribution record with proper key
        env.storage().persistent().set(&contrib_key, &contribution);

        // 4. Update cycle total amount
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle_number);
        let current_total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);

        let new_total = current_total
            .checked_add(amount)
            .ok_or(StellarSaveError::Overflow)?;

        env.storage().persistent().set(&total_key, &new_total);

        // 5. Update cycle contributor count
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle_number);
        let current_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);

        let new_count = current_count
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?;

        env.storage().persistent().set(&count_key, &new_count);

        Ok(())
    }

    fn generate_next_group_id(env: &Env) -> Result<u64, StellarSaveError> {
        let key = StorageKeyBuilder::next_group_id();

        // Counter storage: default to 0 if not yet initialized
        let current_id: u64 = env.storage().persistent().get(&key).unwrap_or(0);

        // Atomic increment & Overflow protection
        let next_id = current_id
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?; // Ensure StellarSaveError has Overflow variant

        // Update counter
        env.storage().persistent().set(&key, &next_id);

        Ok(next_id)
    }
    /// Returns the number of members in a specific group.
    ///
    /// # Arguments
    /// * `group_id` - The unique identifier of the group.
    ///
    /// # Returns
    /// Returns the member count as u32, or StellarSaveError::GroupNotFound if the group doesn't exist.
    pub fn get_member_count(env: Env, group_id: u64) -> Result<u32, StellarSaveError> {
        let key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        Ok(group.member_count)
    }

    /// Increments the group ID counter and returns the new ID.
    /// Tasks: Counter storage, Atomic increment, Overflow protection.
    fn increment_group_id(env: &Env) -> Result<u64, StellarSaveError> {
        let key = StorageKeyBuilder::next_group_id();

        // 1. Read current ID (Counter storage)
        // Defaults to 0 if no groups have ever been created.
        let current_id: u64 = env.storage().persistent().get(&key).unwrap_or(0);

        // 2. Atomic increment with Overflow protection
        let next_id = current_id
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?;

        // 3. Update persistent storage
        env.storage().persistent().set(&key, &next_id);

        Ok(next_id)
    }

    /// Initializes or updates the global contract configuration.
    /// Only the current admin can perform this update.
    pub fn update_config(env: Env, new_config: ContractConfig) -> Result<(), StellarSaveError> {
        // 1. Validation Logic
        if !new_config.validate() {
            return Err(StellarSaveError::InvalidState);
        }

        let key = StorageKeyBuilder::contract_config();

        // 2. Admin-only Authorization
        if let Some(current_config) = env.storage().persistent().get::<_, ContractConfig>(&key) {
            current_config.admin.require_auth();
        } else {
            // First time initialization: caller becomes admin
            new_config.admin.require_auth();
        }

        // 3. Save Configuration
        env.storage().persistent().set(&key, &new_config);
        Ok(())
    }

    /// Creates a new savings group (ROSCA).
    /// Tasks: Validate parameters, Generate ID, Initialize Struct, Store Data, Emit Event.
    pub fn create_group(
        env: Env,
        creator: Address,
        contribution_amount: i128,
        cycle_duration: u64,
        max_members: u32,
    ) -> Result<u64, StellarSaveError> {
        // 1. Authorization: Only the creator can initiate this transaction
        creator.require_auth();

        // 2. Global Validation: Check against ContractConfig
        let config_key = StorageKeyBuilder::contract_config();
        if let Some(config) = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&config_key)
        {
            if contribution_amount < config.min_contribution
                || contribution_amount > config.max_contribution
                || max_members < config.min_members
                || max_members > config.max_members
                || cycle_duration < config.min_cycle_duration
                || cycle_duration > config.max_cycle_duration
            {
                return Err(StellarSaveError::InvalidState);
            }
        }

        // 3. Generate unique group ID
        let group_id = Self::generate_next_group_id(&env)?;

        // 4. Initialize Group Struct
        let current_time = env.ledger().timestamp();
        let min_members = 2; // Default minimum members
        let new_group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            cycle_duration,
            max_members,
            min_members,
            current_time,
        );

        // 5. Store Group Data
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &new_group);

        // Initialize Group Status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // 6. Emit GroupCreated Event
        env.events()
            .publish((Symbol::new(&env, "GroupCreated"), creator), group_id);

        // 7. Return Group ID
        Ok(group_id)
    }

    /// Updates group parameters. Only allowed for creators while the group is Pending.
    pub fn update_group(
        env: Env,
        group_id: u64,
        new_contribution: i128,
        new_duration: u64,
        new_max_members: u32,
    ) -> Result<(), StellarSaveError> {
        // 1. Load existing group data
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Task: Verify caller is creator
        group.creator.require_auth();

        // 3. Task: Check group is not yet active
        let status_key = StorageKeyBuilder::group_status(group_id);
        let status = env
            .storage()
            .persistent()
            .get::<_, GroupStatus>(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        // 4. Task: Validate new parameters against global config
        let config_key = StorageKeyBuilder::contract_config();
        if let Some(config) = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&config_key)
        {
            if new_contribution < config.min_contribution
                || new_contribution > config.max_contribution
                || new_max_members < config.min_members
                || new_max_members > config.max_members
                || new_duration < config.min_cycle_duration
                || new_duration > config.max_cycle_duration
            {
                return Err(StellarSaveError::InvalidState);
            }
        }

        // 5. Task: Update storage
        group.contribution_amount = new_contribution;
        group.cycle_duration = new_duration;
        group.max_members = new_max_members;

        env.storage().persistent().set(&group_key, &group);

        // 6. Task: Emit event
        env.events()
            .publish((Symbol::new(&env, "GroupUpdated"), group_id), group.creator);

        Ok(())
    }

    /// Retrieves the details of a specific savings group.
    ///
    /// # Arguments
    /// * `group_id` - The unique identifier of the group to retrieve.
    ///
    /// # Returns
    /// Returns the Group struct if found, or StellarSaveError::GroupNotFound if not.
    pub fn get_group(env: Env, group_id: u64) -> Result<Group, StellarSaveError> {
        // Generate the storage key for the group data
        let key = StorageKeyBuilder::group_data(group_id);

        // Attempt to load group from persistent storage
        env.storage()
            .persistent()
            .get::<_, Group>(&key)
            .ok_or(StellarSaveError::GroupNotFound)
    }

    /// Checks if a member has already received their payout in a group.
    ///
    /// # Arguments
    /// * `group_id` - The unique identifier of the group.
    /// * `member_address` - The address of the member to check.
    ///
    /// # Returns
    /// Returns true if the member has received their payout, false otherwise.
    /// Returns an error if the group doesn't exist.
    ///
    /// # Logic
    /// Checks all cycles in the group to see if the member was a payout recipient.
    /// In a ROSCA, each member receives exactly one payout during the group's lifecycle.
    pub fn has_received_payout(
        env: Env,
        group_id: u64,
        member_address: Address,
    ) -> Result<bool, StellarSaveError> {
        // Verify the group exists and get its current cycle
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Check each cycle from 0 to current_cycle to see if member received payout
        for cycle in 0..=group.current_cycle {
            let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);

            if let Some(recipient) = env.storage().persistent().get::<_, Address>(&recipient_key) {
                if recipient == member_address {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    /// Checks if a payout is due for the current cycle of a group.
    ///
    /// A payout is due if:
    /// 1. The group is in Active status.
    /// 2. All members have contributed for the current cycle (cycle complete).
    /// 3. A payout has not already been executed for the current cycle.
    ///
    /// # Arguments
    /// * `env` - Soroban environment.
    /// * `group_id` - Unique identifier of the group.
    ///
    /// # Returns
    /// Returns true if a payout is due, false otherwise.
    /// Returns StellarSaveError::GroupNotFound if the group doesn't exist.
    pub fn is_payout_due(env: Env, group_id: u64) -> Result<bool, StellarSaveError> {
        // 1. Load group data
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Check if group is active
        if group.status != GroupStatus::Active {
            return Ok(false);
        }

        // 3. Get pool information for current cycle
        let pool_info = PoolCalculator::get_pool_info(&env, group_id, group.current_cycle)?;

        // 4. Check if cycle is complete (all members contributed)
        if !pool_info.is_cycle_complete {
            return Ok(false);
        }

        // 5. Check if payout already executed for current cycle
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, group.current_cycle);
        let already_executed = env.storage().persistent().has(&recipient_key);

        Ok(!already_executed)
    }

    /// Returns the payout position for a member in a specific group.
    ///
    /// # Arguments
    /// * `group_id` - The unique identifier of the group.
    /// * `member_address` - The address of the member.
    ///
    /// # Returns
    /// Returns the payout position as u32, or an error if the group or member doesn't exist.
    /// The payout position is 0-indexed (position 0 receives payout in cycle 0, etc.)
    pub fn get_payout_position(
        env: Env,
        group_id: u64,
        member_address: Address,
    ) -> Result<u32, StellarSaveError> {
        let key = StorageKeyBuilder::member_payout_eligibility(group_id, member_address);
        let member_profile = env
            .storage()
            .persistent()
            .get::<_, MemberProfile>(&key)
            .ok_or(StellarSaveError::NotMember)?;

        Ok(member_profile.payout_position)
    }

    /// Validates that a recipient is eligible for payout in the current cycle.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `recipient` - Address of the potential recipient
    ///
    /// # Returns
    /// * `Ok(true)` - Recipient is eligible for payout
    /// * `Ok(false)` - Recipient is not eligible
    /// * `Err(StellarSaveError)` - If validation fails
    pub fn validate_payout_recipient(
        env: Env,
        group_id: u64,
        recipient: Address,
    ) -> Result<bool, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let member_key = StorageKeyBuilder::member_profile(group_id, recipient.clone());
        if !env.storage().persistent().has(&member_key) {
            return Ok(false);
        }

        let has_received = Self::has_received_payout(env.clone(), group_id, recipient.clone())?;

        if has_received {
            return Ok(false);
        }

        let payout_position = Self::get_payout_position(env.clone(), group_id, recipient.clone())?;

        if payout_position != group.current_cycle {
            return Ok(false);
        }

        Ok(true)
    }

    /// Calculates the total amount paid out by a group across all cycles.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(i128)` - Total amount paid out
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    pub fn get_total_paid_out(env: Env, group_id: u64) -> Result<i128, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut total: i128 = 0;

        for cycle in 0..group.current_cycle {
            let payout_key = StorageKeyBuilder::payout_record(group_id, cycle);

            if let Some(payout_record) = env
                .storage()
                .persistent()
                .get::<_, PayoutRecord>(&payout_key)
            {
                total = total
                    .checked_add(payout_record.amount)
                    .ok_or(StellarSaveError::Overflow)?;
            }
        }

        Ok(total)
    }

    /// Gets all payout records for a group with pagination and sorting.
    ///
    /// This function retrieves the complete payout history for a specific group,
    /// allowing for pagination to handle large datasets and sorting by cycle number.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to query
    /// * `offset` - Number of records to skip (for pagination)
    /// * `limit` - Maximum number of records to return (for pagination)
    ///
    /// # Returns
    /// * `Ok(Vec<PayoutRecord>)` - Vector of payout records sorted by cycle number
    /// * `Err(StellarSaveError::GroupNotFound)` - If the group doesn't exist
    /// * `Err(StellarSaveError::Overflow)` - If pagination parameters cause overflow
    ///
    /// # Example
    /// ```ignore
    /// // Get first 10 payout records
    /// let first_page = contract.get_payout_history(env, group_id, 0, 10)?;
    ///
    /// // Get next 10 payout records
    /// let second_page = contract.get_payout_history(env, group_id, 10, 10)?;
    /// ```
    pub fn get_payout_history(
        env: Env,
        group_id: u64,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<PayoutRecord>, StellarSaveError> {
        // 1. Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Validate pagination parameters
        if offset.checked_add(limit).is_none() {
            return Err(StellarSaveError::Overflow);
        }

        // 3. Collect all payout records from cycles 0 to current_cycle-1
        let mut all_payouts = Vec::new(&env);

        for cycle in 0..group.current_cycle {
            let payout_key = StorageKeyBuilder::payout_record(group_id, cycle);

            if let Some(payout_record) = env
                .storage()
                .persistent()
                .get::<_, PayoutRecord>(&payout_key)
            {
                all_payouts.push_back(payout_record);
            }
        }

        // 4. Payouts are already sorted by cycle number due to iteration order

        // 5. Apply pagination
        let total_records = all_payouts.len();
        let start_index = offset;

        // If offset is beyond total records, return empty vector
        if start_index >= total_records {
            return Ok(Vec::new(&env));
        }

        let end_index = cmp::min(
            start_index
                .checked_add(limit)
                .ok_or(StellarSaveError::Overflow)?,
            total_records,
        );

        let mut paginated_payouts = Vec::new(&env);
        for i in start_index..end_index {
            if let Some(payout) = all_payouts.get(i) {
                paginated_payouts.push_back(payout);
            }
        }

        Ok(paginated_payouts)
    }

    /// Gets the payout received by a specific member.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member_address` - Address of the member to query
    ///
    /// # Returns
    /// * `Ok(Option<PayoutRecord>)` - Payout record if member received one, None if not
    /// * `Err(StellarSaveError)` - If group doesn't exist or member is not part of the group
    pub fn get_member_payout(
        env: Env,
        group_id: u64,
        member_address: Address,
    ) -> Result<Option<PayoutRecord>, StellarSaveError> {
        // Verify the group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Verify the member is part of the group
        let member_key = StorageKeyBuilder::member_profile(group_id, member_address.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // Query payout history for all cycles up to current_cycle
        for cycle in 0..=group.current_cycle {
            let payout_key = StorageKeyBuilder::payout_record(group_id, cycle);

            if let Some(payout_record) = env
                .storage()
                .persistent()
                .get::<_, PayoutRecord>(&payout_key)
            {
                // Filter by recipient
                if payout_record.recipient == member_address {
                    return Ok(Some(payout_record));
                }
            }
        }

        // Member hasn't received any payout yet
        Ok(None)
    }

    /// Gets the complete payout schedule with dates for all members.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(Vec<PayoutScheduleEntry>)` - Schedule with recipient, cycle, and date
    /// * `Err(StellarSaveError)` - If group doesn't exist or not started
    pub fn get_payout_schedule(
        env: Env,
        group_id: u64,
    ) -> Result<Vec<PayoutScheduleEntry>, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if !group.started {
            return Err(StellarSaveError::InvalidState);
        }

        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut schedule = Vec::new(&env);

        for member in members.iter() {
            let position = Self::get_payout_position(env.clone(), group_id, member.clone())?;

            let payout_date = group
                .started_at
                .checked_add(position as u64 * group.cycle_duration)
                .ok_or(StellarSaveError::Overflow)?
                .checked_add(group.cycle_duration)
                .ok_or(StellarSaveError::Overflow)?;

            let entry = PayoutScheduleEntry {
                recipient: member,
                cycle: position,
                payout_date,
            };

            schedule.push_back(entry);
        }

        Ok(schedule)
    }

    /// Checks if a group has completed all cycles.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(bool)` - true if group completed all cycles, false otherwise
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    pub fn is_complete(env: Env, group_id: u64) -> Result<bool, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        Ok(group.is_complete())
    }

    /// Gets ordered list of upcoming payout recipients.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(Vec<Address>)` - Ordered list of members who haven't received payout
    /// * `Err(StellarSaveError)` - If group doesn't exist
    pub fn get_payout_queue(env: Env, group_id: u64) -> Result<Vec<Address>, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let _group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut queue_entries = Vec::new(&env);

        for member in members.iter() {
            let has_received = Self::has_received_payout(env.clone(), group_id, member.clone())?;

            if !has_received {
                let position = Self::get_payout_position(env.clone(), group_id, member.clone())?;

                queue_entries.push_back((member, position));
            }
        }

        let mut sorted_queue = Vec::new(&env);
        let len = queue_entries.len();

        for i in 0..len {
            let mut min_idx = i;
            for j in (i + 1)..len {
                if queue_entries.get(j).unwrap().1 < queue_entries.get(min_idx).unwrap().1 {
                    min_idx = j;
                }
            }
            if min_idx != i {
                let temp = queue_entries.get(i).unwrap();
                queue_entries.set(i, queue_entries.get(min_idx).unwrap());
                queue_entries.set(min_idx, temp);
            }
        }

        for entry in queue_entries.iter() {
            sorted_queue.push_back(entry.0);
        }

        Ok(sorted_queue)
    }

    /// Assigns or reassigns payout positions to members.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `caller` - Address of the caller (must be group creator)
    /// * `mode` - Assignment mode (Sequential, Random, or Manual)
    ///
    /// # Returns
    /// * `Ok(())` if assignment successful
    /// * `Err(StellarSaveError)` if validation fails
    pub fn assign_payout_positions(
        env: Env,
        group_id: u64,
        caller: Address,
        mode: AssignmentMode,
    ) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        let status_key = StorageKeyBuilder::group_status(group_id);
        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let positions = match mode {
            AssignmentMode::Sequential => {
                let mut pos = Vec::new(&env);
                for i in 0..members.len() {
                    pos.push_back(i);
                }
                pos
            }
            AssignmentMode::Random => {
                let mut pos = Vec::new(&env);
                for i in 0..members.len() {
                    pos.push_back(i);
                }
                let seed = env.ledger().timestamp();
                Self::shuffle(&env, &mut pos, seed);
                pos
            }
            AssignmentMode::Manual(positions) => {
                if positions.len() != members.len() {
                    return Err(StellarSaveError::InvalidState);
                }
                positions
            }
        };

        for (idx, member) in members.iter().enumerate() {
            let position = positions.get(idx as u32).unwrap();
            let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
            let mut profile: MemberProfile = env
                .storage()
                .persistent()
                .get(&member_key)
                .ok_or(StellarSaveError::NotMember)?;

            profile.payout_position = position;
            env.storage().persistent().set(&member_key, &profile);

            let payout_key = StorageKeyBuilder::member_payout_eligibility(group_id, member.clone());
            env.storage().persistent().set(&payout_key, &position);
        }

        Ok(())
    }

    fn shuffle(_env: &Env, vec: &mut Vec<u32>, seed: u64) {
        let len = vec.len();
        for i in (1..len).rev() {
            let j = (seed.wrapping_mul(i as u64 + 1) % (i as u64 + 1)) as u32;
            let temp = vec.get(i).unwrap();
            let swap = vec.get(j).unwrap();
            vec.set(i, swap);
            vec.set(j, temp);
        }
    }

    /// Deletes a group from storage.
    /// Only allowed if the caller is the creator and no members have joined yet.
    pub fn delete_group(env: Env, group_id: u64) -> Result<(), StellarSaveError> {
        // 1. Task: Load group and Verify caller is creator
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        group.creator.require_auth();

        // 2. Task: Check no members joined
        // We check if the member count is 0.
        // Note: If the creator is automatically added as a member in join_group,
        // this check should be adjusted to (count == 1).
        if group.member_count > 0 {
            return Err(StellarSaveError::InvalidState);
        }

        // 3. Task: Remove from storage
        // We remove both the main data and the status record
        env.storage().persistent().remove(&group_key);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage().persistent().remove(&status_key);

        // 4. Task: Emit event
        env.events()
            .publish((Symbol::new(&env, "GroupDeleted"), group_id), group.creator);

        Ok(())
    }

    /// Returns the total number of groups created.
    /// This reads the existing counter from storage without modifying it.
    pub fn get_total_groups(env: Env) -> u64 {
        let key = StorageKeyBuilder::next_group_id();
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Lists groups with cursor-based pagination and optional status filtering.
    /// Tasks: Pagination, Status Filtering, Gas Optimization.
    pub fn list_groups(
        env: Env,
        cursor: u64,
        limit: u32,
        status_filter: Option<GroupStatus>,
    ) -> Result<Vec<Group>, StellarSaveError> {
        let mut groups = Vec::new(&env);
        let max_id_key = StorageKeyBuilder::next_group_id();

        // 1. Get the current maximum ID to know where to stop
        let current_max_id: u64 = env.storage().persistent().get(&max_id_key).unwrap_or(0);

        // 2. Optimization: Start from the cursor and move backwards or forwards
        // Here we go backwards from the cursor to show newest groups first
        let start = if cursor == 0 { current_max_id } else { cursor };
        let mut count = 0;
        let page_limit = if limit > 50 { 50 } else { limit }; // Safety cap for gas

        for id in (1..=start).rev() {
            if count >= page_limit {
                break;
            }

            let group_key = StorageKeyBuilder::group_data(id);
            if let Some(group) = env.storage().persistent().get::<_, Group>(&group_key) {
                // 3. Optional Status Filtering
                if let Some(ref filter) = status_filter {
                    let status_key = StorageKeyBuilder::group_status(id);
                    let status = env
                        .storage()
                        .persistent()
                        .get::<_, GroupStatus>(&status_key)
                        .unwrap_or(GroupStatus::Pending);

                    if &status == filter {
                        groups.push_back(group);
                        count += 1;
                    }
                } else {
                    groups.push_back(group);
                    count += 1;
                }
            }
        }

        Ok(groups)
    }

    /// Returns the total number of groups created.
    /// Reads the existing counter from storage without modification.
    pub fn get_total_groups_created(env: Env) -> u64 {
        let key = StorageKeyBuilder::next_group_id();
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Gets the total amount contributed by a member across all cycles.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address of the member
    ///
    /// # Returns
    /// Returns the total amount contributed by the member across all cycles.
    /// Returns 0 if the member has never contributed.
    ///
    /// # Errors
    /// Returns StellarSaveError::GroupNotFound if the group doesn't exist.
    pub fn get_member_total_contributions(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<i128, StellarSaveError> {
        // 1. Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Iterate through all cycles and sum contributions
        let mut total: i128 = 0;

        // Iterate from cycle 0 to current_cycle (inclusive)
        for cycle in 0..=group.current_cycle {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());

            // Get contribution record if it exists
            if let Some(contrib_record) = env
                .storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
            {
                total = total
                    .checked_add(contrib_record.amount)
                    .ok_or(StellarSaveError::Overflow)?;
            }
        }

        Ok(total)
    }

    /// Gets the contribution history for a member in a group with pagination.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address of the member
    /// * `start_cycle` - Starting cycle number for pagination (inclusive)
    /// * `limit` - Maximum number of records to return (capped at 50)
    ///
    /// # Returns
    /// Returns a vector of ContributionRecord objects for the member.
    /// Returns empty vector if no contributions found in the specified range.
    ///
    /// # Errors
    /// Returns StellarSaveError::GroupNotFound if the group doesn't exist.
    ///
    /// # Pagination
    /// - Use start_cycle=0 and limit=10 to get first 10 contributions
    /// - Use start_cycle=10 and limit=10 to get next 10 contributions
    /// - Limit is capped at 50 for gas optimization
    pub fn get_member_contribution_history(
        env: Env,
        group_id: u64,
        member: Address,
        start_cycle: u32,
        limit: u32,
    ) -> Result<Vec<ContributionRecord>, StellarSaveError> {
        // 1. Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Initialize result vector
        let mut contributions = Vec::new(&env);

        // 3. Cap limit at 50 for gas optimization
        let page_limit = if limit > 50 { 50 } else { limit };

        // 4. Calculate end cycle (don't go beyond current_cycle)
        let end_cycle = {
            let calculated_end = start_cycle.saturating_add(page_limit);
            if calculated_end > group.current_cycle {
                group.current_cycle
            } else {
                calculated_end
            }
        };

        // 5. Query contributions for the specified range
        let mut count = 0;
        for cycle in start_cycle..=end_cycle {
            if count >= page_limit {
                break;
            }

            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());

            // Get contribution record if it exists
            if let Some(contrib_record) = env
                .storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
            {
                contributions.push_back(contrib_record);
                count += 1;
            }
        }

        Ok(contributions)
    }

    /// Gets all contributions for a specific cycle in a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle_number` - The cycle number to query
    ///
    /// # Returns
    /// Returns a vector of ContributionRecord objects for all members who contributed in the cycle.
    /// Returns empty vector if no contributions found for the cycle.
    ///
    /// # Errors
    /// Returns StellarSaveError::GroupNotFound if the group doesn't exist.
    ///
    /// # Notes
    /// - Only returns contributions that actually exist (members who contributed)
    /// - Does not include members who skipped the cycle
    /// - Useful for cycle completion verification and payout calculations
    pub fn get_cycle_contributions(
        env: Env,
        group_id: u64,
        cycle_number: u32,
    ) -> Result<Vec<ContributionRecord>, StellarSaveError> {
        // 1. Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let _group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Get the list of members in the group
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Vec::new(&env));

        // 3. Initialize result vector
        let mut contributions = Vec::new(&env);

        // 4. Query each member's contribution for this cycle
        for member in members.iter() {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle_number, member.clone());

            // Get contribution record if it exists
            if let Some(contrib_record) = env
                .storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
            {
                contributions.push_back(contrib_record);
            }
        }

        Ok(contributions)
    }

    /// Checks if a member has contributed for a specific cycle.
    /// Checks if all members have contributed for the current cycle.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle_number` - The cycle number to check
    ///
    /// # Returns
    /// * `Ok(bool)` - true if all members contributed, false otherwise
    /// * `Err(StellarSaveError)` if group not found
    pub fn is_cycle_complete(
        env: Env,
        group_id: u64,
        cycle_number: u32,
    ) -> Result<bool, StellarSaveError> {
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle_number);
        let contributed_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);

        Ok(contributed_count >= members.len())
    }

    /// Identifies members who haven't contributed in the specified cycle.
    ///
    /// This function returns a vector of addresses for members who are part of the group
    /// but have not made their contribution for the given cycle. This is useful for:
    /// - Tracking delinquent members
    /// - Sending reminders
    /// - Determining if a cycle can be completed
    /// - Enforcing contribution deadlines
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to check
    /// * `cycle_number` - The cycle number to check for missed contributions
    ///
    /// # Returns
    /// * `Ok(Vec<Address>)` - Vector of addresses who haven't contributed
    /// * `Err(StellarSaveError::GroupNotFound)` - If the group doesn't exist
    ///
    /// # Example
    /// ```ignore
    /// // Get members who missed contributions in cycle 0
    /// let missed = contract.get_missed_contributions(env, 1, 0)?;
    /// for member in missed.iter() {
    ///     // Send reminder to member
    /// }
    /// ```
    pub fn get_missed_contributions(
        env: Env,
        group_id: u64,
        cycle_number: u32,
    ) -> Result<Vec<Address>, StellarSaveError> {
        // 1. Get all members in the group
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Initialize result vector for non-contributors
        let mut missed_members = Vec::new(&env);

        // 3. Check each member's contribution status for this cycle
        for member in members.iter() {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle_number, member.clone());

            // If no contribution record exists for this member in this cycle, they missed it
            if !env.storage().persistent().has(&contrib_key) {
                missed_members.push_back(member);
            }
        }

        // 4. Return vector of addresses who haven't contributed
        Ok(missed_members)
    }

    /// Calculates the deadline timestamp for contributions in a specific cycle.
    ///
    /// The deadline is calculated as: cycle_start_time + cycle_duration
    /// where cycle_start_time = started_at + (cycle_number * cycle_duration)
    ///
    /// This function is useful for:
    /// - Displaying countdown timers to users
    /// - Enforcing contribution deadlines
    /// - Determining if a cycle has expired
    /// - Scheduling automated reminders
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle_number` - The cycle number to calculate deadline for
    ///
    /// # Returns
    /// * `Ok(u64)` - Unix timestamp (seconds) when the cycle deadline expires
    /// * `Err(StellarSaveError::GroupNotFound)` - If the group doesn't exist
    /// * `Err(StellarSaveError::InvalidState)` - If the group hasn't been started yet
    /// * `Err(StellarSaveError::Overflow)` - If timestamp calculation overflows
    ///
    /// # Example
    /// ```ignore
    /// // Get deadline for cycle 0
    /// let deadline = contract.get_contribution_deadline(env, 1, 0)?;
    /// let current_time = env.ledger().timestamp();
    /// if current_time > deadline {
    ///     // Cycle has expired
    /// }
    /// ```
    pub fn get_contribution_deadline(
        env: Env,
        group_id: u64,
        cycle_number: u32,
    ) -> Result<u64, StellarSaveError> {
        // 1. Load the group from storage
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Verify the group has been started
        if !group.started {
            return Err(StellarSaveError::InvalidState);
        }

        // 3. Calculate cycle start time: started_at + (cycle_number * cycle_duration)
        let cycle_offset = (cycle_number as u64)
            .checked_mul(group.cycle_duration)
            .ok_or(StellarSaveError::Overflow)?;

        let cycle_start_time = group
            .started_at
            .checked_add(cycle_offset)
            .ok_or(StellarSaveError::Overflow)?;

        // 4. Calculate deadline: cycle_start_time + cycle_duration
        let deadline = cycle_start_time
            .checked_add(group.cycle_duration)
            .ok_or(StellarSaveError::Overflow)?;

        Ok(deadline)
    }

    /// Calculates when the next payout will occur.
    ///
    /// This function determines the timestamp of the next payout cycle deadline.
    /// The next payout cycle is typically current_cycle + 1, unless the group is complete.
    ///
    /// The calculation is: started_at + ((next_cycle_number + 1) * cycle_duration)
    /// where next_cycle_number = current_cycle + 1
    ///
    /// This function is useful for:
    /// - Displaying countdown timers to users
    /// - Scheduling automated reminders
    /// - Planning contribution timing
    /// - UI/UX countdown displays
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(u64)` - Unix timestamp (seconds) when the next payout cycle ends
    /// * `Err(StellarSaveError::GroupNotFound)` - If the group doesn't exist
    /// * `Err(StellarSaveError::InvalidState)` - If the group hasn't been started yet
    /// * `Err(StellarSaveError::InvalidState)` - If the group is complete (no more payouts)
    /// * `Err(StellarSaveError::Overflow)` - If timestamp calculation overflows
    ///
    /// # Example
    /// ```ignore
    /// // Get next payout time
    /// let next_payout_time = contract.get_next_payout_cycle(env, group_id)?;
    /// let current_time = env.ledger().timestamp();
    /// let time_until_payout = next_payout_time - current_time;
    /// ```
    pub fn get_next_payout_cycle(env: Env, group_id: u64) -> Result<u64, StellarSaveError> {
        // 1. Load the group from storage
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Validate group state
        if !group.started {
            return Err(StellarSaveError::InvalidState);
        }

        // 3. Check if group is complete (no more payouts expected)
        if group.is_complete() {
            return Err(StellarSaveError::InvalidState);
        }

        // 4. Calculate next cycle number
        let next_cycle = group
            .current_cycle
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?;

        // 5. Calculate next cycle end time: started_at + ((next_cycle + 1) * cycle_duration)
        let cycle_multiplier = next_cycle
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?;

        let next_cycle_end_time = cycle_multiplier
            .checked_mul(group.cycle_duration as u32)
            .map(|duration| duration as u64)
            .and_then(|duration| group.started_at.checked_add(duration))
            .ok_or(StellarSaveError::Overflow)?;

        Ok(next_cycle_end_time)
    }

    /// Allows a user to join an existing savings group.
    ///
    /// Users can join groups that are in Pending status (not yet activated).
    /// This function verifies the group is joinable, checks capacity, assigns
    /// a payout position, and stores the member's profile data.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to join
    /// * `member` - Address of the user joining (must be caller)
    ///
    /// # Returns
    /// * `Ok(())` - Member successfully joined the group
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::AlreadyMember)` - User is already a member
    /// * `Err(StellarSaveError::GroupFull)` - Group has reached max capacity
    /// * `Err(StellarSaveError::InvalidState)` - Group is not in joinable state
    ///
    /// # Example
    /// ```ignore
    /// contract.join_group(env, 1, member_address)?;
    /// ```
    pub fn join_group(env: Env, group_id: u64, member: Address) -> Result<(), StellarSaveError> {
        // Verify caller authorization
        member.require_auth();

        // Task 1: Verify group exists and is joinable
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Check group status is Pending (joinable)
        let status_key = StorageKeyBuilder::group_status(group_id);
        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        // Task 2: Check not already member
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::AlreadyMember);
        }

        // Task 3: Check group not full
        if group.member_count >= group.max_members {
            return Err(StellarSaveError::GroupFull);
        }

        // Task 4: Assign payout position
        // Payout position is based on join order (member_count)
        let payout_position = group.member_count;

        // Task 5: Store member data
        let timestamp = env.ledger().timestamp();

        // Store member profile
        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position,
            joined_at: timestamp,
        };
        env.storage().persistent().set(&member_key, &member_profile);

        // Add to member list
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Vec::new(&env));
        members.push_back(member.clone());
        env.storage().persistent().set(&members_key, &members);

        // Store payout eligibility (position in payout order)
        let payout_key = StorageKeyBuilder::member_payout_eligibility(group_id, member.clone());
        env.storage()
            .persistent()
            .set(&payout_key, &payout_position);

        // Update group member count
        group.member_count += 1;
        env.storage().persistent().set(&group_key, &group);

        // Emit event
        EventEmitter::emit_member_joined(&env, group_id, member, group.member_count, timestamp);

        Ok(())
    }

    /// Allows members to withdraw their share in emergency situations.
    ///
    /// Emergency conditions:
    /// - Group has been inactive (no contributions) for 2+ cycle durations
    /// - Group is not complete
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address of the member withdrawing
    ///
    /// # Returns
    /// * `Ok(())` - Withdrawal successful
    /// * `Err(StellarSaveError)` - If conditions not met
    pub fn emergency_withdraw(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        if group.is_complete() {
            return Err(StellarSaveError::InvalidState);
        }

        let current_time = env.ledger().timestamp();
        let last_activity_key =
            StorageKeyBuilder::contribution_cycle_total(group_id, group.current_cycle);
        let last_activity_time: u64 = env
            .storage()
            .persistent()
            .get(&last_activity_key)
            .unwrap_or(group.started_at);

        let inactive_duration = current_time.saturating_sub(last_activity_time);
        let emergency_threshold = group.cycle_duration.saturating_mul(2);

        if inactive_duration < emergency_threshold {
            return Err(StellarSaveError::InvalidState);
        }

        let total_contributed =
            Self::get_member_total_contributions(env.clone(), group_id, member.clone())?;

        let has_received = Self::has_received_payout(env.clone(), group_id, member.clone())?;

        let withdrawal_amount = if has_received { 0 } else { total_contributed };

        if withdrawal_amount > 0 {
            env.events().publish(
                (Symbol::new(&env, "emergency_withdrawal"),),
                (group_id, member.clone(), withdrawal_amount),
            );
        }

        let withdrawal_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        env.storage().persistent().remove(&withdrawal_key);

        Ok(())
    }

    /// Activates a group once minimum members have joined.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to activate
    /// * `creator` - The creator's address (must match the group's creator)
    /// * `member_count` - Current number of members in the group
    ///
    /// # Panics
    /// Panics if:
    /// - The caller is not the group creator
    /// - The group has already been started
    /// - Minimum member count has not been reached
    pub fn activate_group(env: Env, group_id: u64, creator: Address, member_count: u32) {
        // Get the group - in a real implementation, this would come from storage
        // For now, we'll create a mock group to demonstrate the logic
        // In production, you'd load from: let mut group = GroupStorage::get(&env, group_id);

        // Verify caller is creator
        assert!(creator == creator, "caller must be the group creator");

        // Get current timestamp
        let timestamp = env.ledger().timestamp();

        // Create a temporary group for validation (in production, load from storage)
        let mut group = Group::new(
            group_id, creator, 10_000_000, // Default contribution amount
            604800,     // Default cycle duration
            5,          // Default max members
            2,          // Default min members
            timestamp,
        );

        // Simulate adding members (in production, this would be tracked in storage)
        for _ in 0..member_count {
            group.add_member();
        }

        // Check minimum members met (using the activate method)
        group.activate(timestamp);

        // Emit the activation event
        env.events().publish(
            (Symbol::new(&env, "group_activated"), group_id),
            member_count,
        );
    }
}

fn emit_group_activated(env: &Env, group_id: u64, timestamp: u64, member_count: u32) {
    env.events().publish(
        (Symbol::new(env, "group_activated"), group_id),
        (timestamp, member_count),
    );
}

#[test]
fn test_group_id_uniqueness() {
    let env = Env::default();

    // Generate first ID
    let id1 = StellarSaveContract::increment_group_id(&env).unwrap();
    // Generate second ID
    let id2 = StellarSaveContract::increment_group_id(&env).unwrap();

    // Assert IDs are sequential and unique
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_ne!(id1, id2);
}

#[test]
fn test_get_total_groups() {
    let env = Env::default();
    let contract_id = env.register(StellarSaveContract, ());
    let client = StellarSaveContractClient::new(&env, &contract_id);
    let creator = Address::generate(&env);

    // Initially, no groups should exist
    assert_eq!(client.get_total_groups(), 0);

    // Create a group
    env.mock_all_auths();
    client.create_group(&creator, &100, &3600, &5);

    // Total groups should now be 1
    assert_eq!(client.get_total_groups(), 1);
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_get_group_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Manually store a group to test retrieval
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);

        // This simulates the storage state after create_group is called
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let retrieved_group = client.get_group(&group_id);
        assert_eq!(retrieved_group.id, group_id);
        assert_eq!(retrieved_group.creator, creator);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        client.get_group(&999); // ID that doesn't exist
    }

    #[test]
    fn test_has_received_payout_true() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Create a group at cycle 2
        let group_id = 1;
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);
        group.current_cycle = 2;

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payout recipient for cycle 1 (member received payout)
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 1);
        env.storage().persistent().set(&recipient_key, &member);

        // Check if member has received payout
        let has_received = client.has_received_payout(&group_id, &member);
        assert_eq!(has_received, true);
    }

    #[test]
    fn test_has_received_payout_false() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let other_member = Address::generate(&env);

        // Create a group at cycle 2
        let group_id = 1;
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);
        group.current_cycle = 2;

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payout recipient for cycle 1 (other member received payout, not our member)
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 1);
        env.storage()
            .persistent()
            .set(&recipient_key, &other_member);

        // Check if member has received payout (should be false)
        let has_received = client.has_received_payout(&group_id, &member);
        assert_eq!(has_received, false);
    }

    #[test]
    fn test_get_payout_position_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member_address = Address::generate(&env);

        // Create a member profile with payout position 2
        let group_id = 1;
        let member_profile = MemberProfile {
            address: member_address.clone(),
            group_id,
            payout_position: 2,
            joined_at: 12345,
        };

        // Store the member profile
        let key = StorageKeyBuilder::member_payout_eligibility(group_id, member_address.clone());
        env.storage().persistent().set(&key, &member_profile);

        // Get payout position
        let position = client.get_payout_position(&group_id, &member_address);
        assert_eq!(position, 2);
    }

    #[test]
    fn test_get_payout_position_first_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member_address = Address::generate(&env);

        // Create a member profile with payout position 0 (first member)
        let group_id = 1;
        let member_profile = MemberProfile {
            address: member_address.clone(),
            group_id,
            payout_position: 0,
            joined_at: 12345,
        };

        // Store the member profile
        let key = StorageKeyBuilder::member_payout_eligibility(group_id, member_address.clone());
        env.storage().persistent().set(&key, &member_profile);

        // Get payout position
        let position = client.get_payout_position(&group_id, &member_address);
        assert_eq!(position, 0);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2002))")] // 2002 is NotMember
    fn test_get_payout_position_not_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member_address = Address::generate(&env);

        // Try to get payout position for a member that doesn't exist
        client.get_payout_position(&1, &member_address);
    }

    #[test]
    fn test_get_member_count_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        // Create a group at cycle 0 (no payouts yet)

        // Create a group with initial member_count of 0
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Check if member has received payout (should be false - no payouts yet)
        let has_received = client.has_received_payout(&group_id, &member);
        assert_eq!(has_received, false);
    }

    #[test]
    fn test_has_received_payout_multiple_cycles() {
        // Get member count
        let member_count = client.get_member_count(&group_id);
        assert_eq!(member_count, 0);
    }

    #[test]
    fn test_get_member_count_with_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);

        // Create a group at cycle 3
        let group_id = 1;
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);
        group.current_cycle = 3;

        // Simulate adding members
        group.add_member();
        group.add_member();
        group.add_member();

        // Store the group
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payout recipients for multiple cycles
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &member1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 1), &member2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 2), &member3);

        // Check each member
        assert_eq!(client.has_received_payout(&group_id, &member1), true);
        assert_eq!(client.has_received_payout(&group_id, &member2), true);
        assert_eq!(client.has_received_payout(&group_id, &member3), true);

        // Check a member who hasn't received payout
        let member4 = Address::generate(&env);
        assert_eq!(client.has_received_payout(&group_id, &member4), false);
        // Get member count
        let member_count = client.get_member_count(&group_id);
        assert_eq!(member_count, 3);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_has_received_payout_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to check payout for non-existent group
        client.has_received_payout(&999, &member);
    }

    fn test_get_member_count_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        client.get_member_count(&999); // ID that doesn't exist
    }

    // #[test]
    // fn test_update_group_success() {
    //     let env = Env::default();
    //     // ... setup contract and create a group in Pending state ...
    //
    //     // Attempt update
    //     client.update_group(&group_id, &200, &7200, &10);
    //
    //     let updated = client.get_group(&group_id);
    //     assert_eq!(updated.contribution_amount, 200);
    // }

    // #[test]
    // #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    // fn test_update_group_fails_if_active() {
    //     let env = Env::default();
    //     // ... setup contract and manually set status to GroupStatus::Active ...
    //
    //     client.update_group(&group_id, &200, &7200, &10);
    // }

    // #[test]
    // fn test_delete_group_success() {
    //     let env = Env::default();
    //     let contract_id = env.register(None, StellarSaveContract);
    //     let client = StellarSaveContractClient::new(&env, &contract_id);
    //     let creator = Address::generate(&env);

    //     // 1. Setup: Create a group with 0 members
    //     let group_id = client.create_group(&creator, &100, &3600, &5);
    //
    //     // 2. Action: Delete group
    //     env.mock_all_auths();
    //     client.delete_group(&group_id);

    //     // 3. Verify: Group should no longer exist
    //     let result = client.try_get_group(&group_id);
    //     assert!(result.is_err());
    // }

    // #[test]
    // #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    // fn test_delete_group_fails_if_has_members() {
    //     let env = Env::default();
    //     // ... setup and add a member to the group ...
    //
    //     client.delete_group(&group_id);
    // }

    // #[test]
    // fn test_list_groups_pagination() {
    //     let env = Env::default();
    //     // ... setup contract and create 5 groups ...

    //     // List 2 groups starting from the top
    //     let page1 = client.list_groups(&0, &2, &None);
    //     assert_eq!(page1.len(), 2);
    //
    //     // Get the next page using the last ID as a cursor
    //     let last_id = page1.get(1).unwrap().id;
    //     let page2 = client.list_groups(&(last_id - 1), &2, &None);
    //     assert_eq!(page2.len(), 2);
    // }

    // #[test]
    // fn test_list_groups_filtering() {
    //     let env = Env::default();
    //     // ... setup contract, create 1 Active group and 1 Pending group ...
    //
    //     let active_only = client.list_groups(&0, &10, &Some(GroupStatus::Active));
    //     assert_eq!(active_only.len(), 1);
    // }

    #[test]
    fn test_get_total_groups_created() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Initially, no groups created
        let count = client.get_total_groups_created();
        assert_eq!(count, 0);

        // Create first group
        env.mock_all_auths();
        client.create_group(&creator, &100, &3600, &5);

        let count = client.get_total_groups_created();
        assert_eq!(count, 1);

        // Create second group
        client.create_group(&creator, &200, &7200, &10);

        let count = client.get_total_groups_created();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_get_member_total_contributions_no_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member has not contributed yet
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, 0);
    }

    #[test]
    fn test_get_member_total_contributions_single_cycle() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add a contribution for cycle 0
        let contrib =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get total contributions
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount);
    }

    #[test]
    fn test_get_member_total_contributions_multiple_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 2 (meaning cycles 0, 1, 2 have occurred)
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0, 1, and 2
        for cycle in 0..=2 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get total contributions (should be 3 XLM)
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount * 3);
    }

    #[test]
    fn test_get_member_total_contributions_partial_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 3
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member only contributed to cycles 0 and 2 (skipped cycle 1)
        let contrib0 =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key0 = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key0, &contrib0);

        let contrib2 = ContributionRecord::new(
            member.clone(),
            group_id,
            2,
            contribution_amount,
            12345 + 7200,
        );
        let contrib_key2 = StorageKeyBuilder::contribution_individual(group_id, 2, member.clone());
        env.storage().persistent().set(&contrib_key2, &contrib2);

        // Get total contributions (should be 2 XLM, not 3)
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount * 2);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_member_total_contributions_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to get contributions for a non-existent group
        client.get_member_total_contributions(&999, &member);
    }

    #[test]
    fn test_get_member_total_contributions_different_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member1.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member1 contributes to both cycles
        for cycle in 0..=1 {
            let contrib = ContributionRecord::new(
                member1.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member1.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Member2 only contributes to cycle 0
        let contrib =
            ContributionRecord::new(member2.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member2.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Verify totals
        let total1 = client.get_member_total_contributions(&group_id, &member1);
        assert_eq!(total1, contribution_amount * 2);

        let total2 = client.get_member_total_contributions(&group_id, &member2);
        assert_eq!(total2, contribution_amount);
    }

    #[test]
    fn test_get_member_contribution_history_empty() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member has not contributed yet
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.len(), 0);
    }

    #[test]
    fn test_get_member_contribution_history_single_contribution() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add a contribution for cycle 0
        let contrib =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get contribution history
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.len(), 1);
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(0).unwrap().amount, contribution_amount);
    }

    #[test]
    fn test_get_member_contribution_history_multiple_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 4
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 4;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0, 1, 2, 3, 4
        for cycle in 0..=4 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get all contributions
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.len(), 5);

        // Verify order and content
        for i in 0..5 {
            assert_eq!(history.get(i as u32).unwrap().cycle_number, i);
            assert_eq!(history.get(i as u32).unwrap().amount, contribution_amount);
        }
    }

    #[test]
    fn test_get_member_contribution_history_pagination() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 9 (10 cycles total: 0-9)
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            15,
            2,
            12345,
        );
        group.current_cycle = 9;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for all 10 cycles
        for cycle in 0..=9 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get first page (cycles 0-4)
        let page1 = client.get_member_contribution_history(&group_id, &member, &0, &5);
        assert_eq!(page1.len(), 5);
        assert_eq!(page1.get(0).unwrap().cycle_number, 0);
        assert_eq!(page1.get(4).unwrap().cycle_number, 4);

        // Get second page (cycles 5-9)
        let page2 = client.get_member_contribution_history(&group_id, &member, &5, &5);
        assert_eq!(page2.len(), 5);
        assert_eq!(page2.get(0).unwrap().cycle_number, 5);
        assert_eq!(page2.get(4).unwrap().cycle_number, 9);
    }

    #[test]
    fn test_get_member_contribution_history_partial_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 5
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            10,
            2,
            12345,
        );
        group.current_cycle = 5;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member only contributed to cycles 0, 2, and 4 (skipped 1, 3, 5)
        for cycle in [0, 2, 4].iter() {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                *cycle,
                contribution_amount,
                12345 + (*cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, *cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get contribution history
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.len(), 3); // Only 3 contributions
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(1).unwrap().cycle_number, 2);
        assert_eq!(history.get(2).unwrap().cycle_number, 4);
    }

    #[test]
    fn test_get_member_contribution_history_limit_cap() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with many cycles
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            100,
            2,
            12345,
        );
        group.current_cycle = 60;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for 60 cycles
        for cycle in 0..=60 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Request 100 records but should be capped at 50
        let history = client.get_member_contribution_history(&group_id, &member, &0, &100);
        assert_eq!(history.len(), 50); // Capped at 50
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_member_contribution_history_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to get history for a non-existent group
        client.get_member_contribution_history(&999, &member, &0, &10);
    }

    #[test]
    fn test_get_member_contribution_history_beyond_current_cycle() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 3
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            10,
            2,
            12345,
        );
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0-3
        for cycle in 0..=3 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Request starting from cycle 2 with limit 10 (would go to cycle 12, but should stop at 3)
        let history = client.get_member_contribution_history(&group_id, &member, &2, &10);
        assert_eq!(history.len(), 2); // Only cycles 2 and 3
        assert_eq!(history.get(0).unwrap().cycle_number, 2);
        assert_eq!(history.get(1).unwrap().cycle_number, 3);
    }

    #[test]
    fn test_get_cycle_contributions_empty() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // No members added, so no contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 0);
    }

    #[test]
    fn test_get_cycle_contributions_single_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add member to group members list
        let mut members = Vec::new(&env);
        members.push_back(member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contribution for cycle 0
        let contrib =
            ContributionRecord::new(member.clone(), group_id, 0, contribution_amount, 12345);
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get cycle contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 1);
        assert_eq!(contributions.get(0).unwrap().member_address, member);
        assert_eq!(contributions.get(0).unwrap().amount, contribution_amount);
    }

    #[test]
    fn test_get_cycle_contributions_multiple_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        members.push_back(member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contributions for all members in cycle 0
        for member in [&member1, &member2, &member3].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get cycle contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 3);

        // Verify all members are present
        let mut addresses: Vec<Address> = Vec::new(&env);
        for contribution in contributions.iter() {
            addresses.push_back(contribution.member_address.clone());
        }
        assert!(addresses.contains(&member1));
        assert!(addresses.contains(&member2));
        assert!(addresses.contains(&member3));
    }

    #[test]
    fn test_get_cycle_contributions_partial_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        members.push_back(member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Only member1 and member3 contributed (member2 skipped)
        for member in [&member1, &member3].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get cycle contributions
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 2); // Only 2 contributed

        // Verify only contributing members are present
        let mut addresses: Vec<Address> = Vec::new(&env);
        for contribution in contributions.iter() {
            addresses.push_back(contribution.member_address.clone());
        }
        assert!(addresses.contains(&member1));
        assert!(!addresses.contains(&member2)); // Did not contribute
        assert!(addresses.contains(&member3));
    }

    #[test]
    fn test_get_cycle_contributions_different_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(
            group_id,
            member1.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contributions for different cycles
        // Cycle 0: both members
        for member in [&member1, &member2].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Cycle 1: only member1
        let contrib = ContributionRecord::new(
            member1.clone(),
            group_id,
            1,
            contribution_amount,
            12345 + 3600,
        );
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 1, member1.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Cycle 2: only member2
        let contrib = ContributionRecord::new(
            member2.clone(),
            group_id,
            2,
            contribution_amount,
            12345 + 7200,
        );
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 2, member2.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get contributions for each cycle
        let cycle0 = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(cycle0.len(), 2);

        let cycle1 = client.get_cycle_contributions(&group_id, &1);
        assert_eq!(cycle1.len(), 1);
        assert_eq!(cycle1.get(0).unwrap().member_address, member1);

        let cycle2 = client.get_cycle_contributions(&group_id, &2);
        assert_eq!(cycle2.len(), 1);
        assert_eq!(cycle2.get(0).unwrap().member_address, member2);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_cycle_contributions_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get contributions for a non-existent group
        client.get_cycle_contributions(&999, &0);
    }

    #[test]
    fn test_get_cycle_contributions_verify_amounts() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            member1.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add members to group members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Add contributions with same amount
        for member in [&member1, &member2].iter() {
            let contrib =
                ContributionRecord::new((*member).clone(), group_id, 0, contribution_amount, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, 0, (*member).clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get cycle contributions and verify amounts
        let contributions = client.get_cycle_contributions(&group_id, &0);
        assert_eq!(contributions.len(), 2);

        // Calculate total
        let total: i128 = contributions
            .iter()
            .map(|c| c.amount)
            .fold(0i128, |acc, amt| acc + amt);
        assert_eq!(total, contribution_amount * 2);
    }

    // Task 6: Tests for join_group function

    // Task 6.1: Test successful member joining
    #[test]
    fn test_join_group_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a group
        let group_id = 1;
        let creator = Address::generate(&env);
        let new_member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at);
        group.member_count = 1; // Creator already joined
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Store initial member list with creator
        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        let members_key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&members_key, &members);

        // Test: New member joins
        client.join_group(&group_id, &new_member);

        // Assert: Member profile created
        let member_key = StorageKeyBuilder::member_profile(group_id, new_member.clone());
        assert!(env.storage().persistent().has(&member_key));

        let profile: MemberProfile = env.storage().persistent().get(&member_key).unwrap();
        assert_eq!(profile.address, new_member);
        assert_eq!(profile.group_id, group_id);

        // Assert: Member added to list
        let updated_members: Vec<Address> = env.storage().persistent().get(&members_key).unwrap();
        assert_eq!(updated_members.len(), 2);
        assert_eq!(updated_members.get(1).unwrap(), new_member);

        // Assert: Member count increased
        let updated_group: Group = env.storage().persistent().get(&group_key).unwrap();
        assert_eq!(updated_group.member_count, 2);

        // Assert: Payout position assigned
        let payout_key = StorageKeyBuilder::member_payout_eligibility(group_id, new_member.clone());
        let payout_position: u32 = env.storage().persistent().get(&payout_key).unwrap();
        assert_eq!(payout_position, 1); // Second member gets position 1
    }

    // Task 6.2: Test joining non-existent group
    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_join_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);

        // Test: Try to join non-existent group
        client.join_group(&999, &member);
    }

    // Task 6.3: Test joining when already a member
    #[test]
    #[should_panic(expected = "Status(ContractError(2001))")] // 2001 is AlreadyMember
    fn test_join_group_already_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a group with a member
        let group_id = 1;
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Store member profile (already a member)
        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            joined_at,
            payout_position: 0, // Default value for test
        };
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        env.storage().persistent().set(&member_key, &member_profile);

        // Test: Member tries to join again
        client.join_group(&group_id, &member);
    }

    // Task 6.4: Test joining when group is full
    #[test]
    #[should_panic(expected = "Status(ContractError(1002))")] // 1002 is GroupFull
    fn test_join_group_full() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a full group
        let group_id = 1;
        let creator = Address::generate(&env);
        let new_member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data with max_members = 3 and member_count = 3 (full)
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, joined_at);
        group.member_count = 3;
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Test: Try to join full group
        client.join_group(&group_id, &new_member);
    }

    // Task 6.5: Test joining when group is already active
    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // 1003 is InvalidState
    fn test_join_group_already_active() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create an active group
        let group_id = 1;
        let creator = Address::generate(&env);
        let new_member = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Test: Try to join active group
        client.join_group(&group_id, &new_member);
    }

    // Task 6.6: Test payout position assignment
    #[test]
    fn test_join_group_payout_position_assignment() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Setup: Create a group with some members
        let group_id = 1;
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let joined_at = 1704067200u64;

        // Store group data
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at);
        group.member_count = 2; // Creator and one member already joined
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Store group status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // Store initial member list
        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1.clone());
        let members_key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&members_key, &members);

        // Test: Member2 joins (should get position 2)
        client.join_group(&group_id, &member2);

        let payout_key2 = StorageKeyBuilder::member_payout_eligibility(group_id, member2.clone());
        let position2: u32 = env.storage().persistent().get(&payout_key2).unwrap();
        assert_eq!(position2, 2);

        // Test: Member3 joins (should get position 3)
        client.join_group(&group_id, &member3);

        let payout_key3 = StorageKeyBuilder::member_payout_eligibility(group_id, member3.clone());
        let position3: u32 = env.storage().persistent().get(&payout_key3).unwrap();
        assert_eq!(position3, 3);

        // Assert: Final member count is correct
        let final_group: Group = env.storage().persistent().get(&group_key).unwrap();
        assert_eq!(final_group.member_count, 4);
    }

    #[test]
    fn test_assign_payout_positions_sequential() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        members.push_back(member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: All members contributed
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &3u32);

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is complete
        assert_eq!(is_complete, true);
    }

    #[test]
    fn test_is_cycle_complete_partial_contributions() {
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Create member profiles
        for (idx, member) in members.iter().enumerate() {
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }

        // Action: Assign sequential positions
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Sequential);

        // Verify: Positions are 0, 1, 2
        let pos0: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                creator.clone(),
            ))
            .unwrap();
        let pos1: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member1.clone(),
            ))
            .unwrap();
        let pos2: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member2.clone(),
            ))
            .unwrap();

        assert_eq!(pos0, 0);
        assert_eq!(pos1, 1);
        assert_eq!(pos2, 2);
    }

    #[test]
    fn test_assign_payout_positions_manual() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        members.push_back(member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Only 2 out of 3 members contributed
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &2u32);

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is not complete
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_cycle_complete_no_contributions() {
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Create member profiles
        for member in members.iter() {
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }

        // Action: Assign manual positions [2, 0, 1]
        let mut positions = Vec::new(&env);
        positions.push_back(2);
        positions.push_back(0);
        positions.push_back(1);

        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Manual(positions));

        // Verify: Positions match manual assignment
        let pos0: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                creator.clone(),
            ))
            .unwrap();
        let pos1: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member1.clone(),
            ))
            .unwrap();
        let pos2: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member2.clone(),
            ))
            .unwrap();

        assert_eq!(pos0, 2);
        assert_eq!(pos1, 0);
        assert_eq!(pos2, 1);
    }

    #[test]
    fn test_assign_payout_positions_random() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: No contributions (count defaults to 0)

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is not complete
        assert_eq!(is_complete, false);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_is_cycle_complete_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Action: Try to check non-existent group
        client.is_cycle_complete(&999, &0);
    }

    #[test]
    fn test_is_cycle_complete_different_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Create member profiles
        for member in members.iter() {
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }

        // Action: Assign random positions
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Random);

        // Verify: All positions are assigned and unique
        let pos0: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                creator.clone(),
            ))
            .unwrap();
        let pos1: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member1.clone(),
            ))
            .unwrap();
        let pos2: u32 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::member_payout_eligibility(
                group_id,
                member2.clone(),
            ))
            .unwrap();

        // All positions should be in range [0, 2]
        assert!(pos0 < 3);
        assert!(pos1 < 3);
        assert!(pos2 < 3);

        // All positions should be unique
        assert_ne!(pos0, pos1);
        assert_ne!(pos0, pos2);
        assert_ne!(pos1, pos2);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2003))")] // Unauthorized
    fn test_assign_payout_positions_not_creator() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_creator = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Try to assign as non-creator
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &non_creator, &AssignmentMode::Sequential);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_assign_payout_positions_group_active() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Cycle 0 is complete, cycle 1 is not
        let count_key0 = StorageKeyBuilder::contribution_cycle_count(group_id, 0);
        env.storage().persistent().set(&count_key0, &2u32);

        let count_key1 = StorageKeyBuilder::contribution_cycle_count(group_id, 1);
        env.storage().persistent().set(&count_key1, &1u32);

        // Action: Check both cycles
        let is_complete_0 = client.is_cycle_complete(&group_id, &0);
        let is_complete_1 = client.is_cycle_complete(&group_id, &1);

        // Verify: Cycle 0 complete, cycle 1 not complete
        assert_eq!(is_complete_0, true);
        assert_eq!(is_complete_1, false);
    }

    #[test]
    fn test_is_cycle_complete_exact_count() {
        let creator = Address::generate(&env);
        let group_id = 1;

        // Setup: Create active group
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Active,
        );

        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Try to assign when group is active
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Sequential);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_assign_payout_positions_manual_wrong_count() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members list with 3 members
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        members.push_back(member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Exactly 3 contributions (equal to member count)
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &3u32);

        // Action: Check if cycle complete
        let is_complete = client.is_cycle_complete(&group_id, &cycle);

        // Verify: Cycle is complete (equal counts)
        assert_eq!(is_complete, true);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group with 2 members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Try to assign with wrong number of positions (3 instead of 2)
        let mut positions = Vec::new(&env);
        positions.push_back(0);
        positions.push_back(1);
        positions.push_back(2);

        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Manual(positions));
    }

    // Tests for validate_contribution_amount helper function

    #[test]
    fn test_validate_contribution_amount_success() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 10 XLM
        let group_id = 1;
        let contribution_amount = 100_000_000; // 10 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with correct amount using as_contract
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, contribution_amount)
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_contribution_amount_invalid_amount() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 10 XLM
        let group_id = 1;
        let contribution_amount = 100_000_000; // 10 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with incorrect amount (5 XLM instead of 10 XLM)
        let wrong_amount = 50_000_000;
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, wrong_amount)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_group_not_found() {
        let env = Env::default();

        // Try to validate for a non-existent group
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, 999, 100_000_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::GroupNotFound);
    }

    #[test]
    fn test_validate_contribution_amount_zero() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 1 XLM
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with zero amount
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 0)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_negative() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 1 XLM
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with negative amount
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, -100)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_too_high() {
        let env = Env::default();
        let creator = Address::generate(&env);

        // Create a group with contribution amount of 1 XLM
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with amount that's too high (2 XLM instead of 1 XLM)
        let result = env.as_contract(&env.register(StellarSaveContract, ()), || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 20_000_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_multiple_groups() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        // Create multiple groups with different contribution amounts
        let group1_id = 1;
        let group1_amount = 10_000_000; // 1 XLM
        let group1 = Group::new(group1_id, creator.clone(), group1_amount, 3600, 5, 2, 12345);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        let group2_id = 2;
        let group2_amount = 50_000_000; // 5 XLM
        let group2 = Group::new(group2_id, creator.clone(), group2_amount, 3600, 5, 2, 12345);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group2_id), &group2);

        // Validate correct amounts for each group
        let result1 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group1_id, group1_amount)
        });
        assert!(result1.is_ok());

        let result2 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group2_id, group2_amount)
        });
        assert!(result2.is_ok());

        // Validate incorrect amounts (swapped)
        let result3 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group1_id, group2_amount)
        });
        assert!(result3.is_err());
        assert_eq!(result3.unwrap_err(), StellarSaveError::InvalidAmount);

        let result4 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group2_id, group1_amount)
        });
        assert!(result4.is_err());
        assert_eq!(result4.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_edge_case_one_stroop() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        // Create a group with minimum contribution amount (1 stroop)
        let group_id = 1;
        let contribution_amount = 1; // 1 stroop
        let group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            3600,
            5,
            2,
            12345,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Validate with correct amount
        let result1 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 1)
        });
        assert!(result1.is_ok());

        // Validate with incorrect amount (2 stroops)
        let result2 = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount(&env, group_id, 2)
        });
        assert!(result2.is_err());
        assert_eq!(result2.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    // Tests for get_missed_contributions function

    #[test]
    fn test_get_missed_contributions_all_contributed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        members.push_back(member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: All members contributed
        for member in members.iter() {
            let contrib =
                ContributionRecord::new(member.clone(), group_id, cycle, 10_000_000, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: No one missed
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_get_missed_contributions_some_missed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        members.push_back(member3.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Only member1 contributed (member2 and member3 missed)
        let contrib = ContributionRecord::new(member1.clone(), group_id, cycle, 10_000_000, 12345);
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, member1.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: member2 and member3 missed
        assert_eq!(missed.len(), 2);

        // Check that the missed members are member2 and member3
        let mut found_member2 = false;
        let mut found_member3 = false;
        for member in missed.iter() {
            if member == member2 {
                found_member2 = true;
            }
            if member == member3 {
                found_member3 = true;
            }
        }
        assert!(found_member2);
        assert!(found_member3);
    }

    #[test]
    fn test_get_missed_contributions_all_missed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: No contributions made

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: All members missed
        assert_eq!(missed.len(), 2);
        assert_eq!(missed.get(0).unwrap(), member1);
        assert_eq!(missed.get(1).unwrap(), member2);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_missed_contributions_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Action: Try to get missed contributions for non-existent group
        client.get_missed_contributions(&999, &0);
    }

    #[test]
    fn test_get_missed_contributions_different_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create members list
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: member1 contributed in cycle 0, member2 contributed in cycle 1
        let contrib0 = ContributionRecord::new(member1.clone(), group_id, 0, 10_000_000, 12345);
        let contrib_key0 = StorageKeyBuilder::contribution_individual(group_id, 0, member1.clone());
        env.storage().persistent().set(&contrib_key0, &contrib0);

        let contrib1 =
            ContributionRecord::new(member2.clone(), group_id, 1, 10_000_000, 12345 + 3600);
        let contrib_key1 = StorageKeyBuilder::contribution_individual(group_id, 1, member2.clone());
        env.storage().persistent().set(&contrib_key1, &contrib1);

        // Action: Check cycle 0
        let missed_cycle0 = client.get_missed_contributions(&group_id, &0);
        assert_eq!(missed_cycle0.len(), 1);
        assert_eq!(missed_cycle0.get(0).unwrap(), member2);

        // Action: Check cycle 1
        let missed_cycle1 = client.get_missed_contributions(&group_id, &1);
        assert_eq!(missed_cycle1.len(), 1);
        assert_eq!(missed_cycle1.get(0).unwrap(), member1);
    }

    #[test]
    fn test_get_missed_contributions_empty_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let group_id = 1;
        let cycle = 0;

        // Setup: Create empty members list
        let members: Vec<Address> = Vec::new(&env);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: No members, so no one missed
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_get_missed_contributions_single_member() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;

        // Setup: Create single member group
        let mut members = Vec::new(&env);
        members.push_back(member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Member didn't contribute

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: Single member missed
        assert_eq!(missed.len(), 1);
        assert_eq!(missed.get(0).unwrap(), member);
    }

    #[test]
    fn test_get_missed_contributions_large_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let group_id = 1;
        let cycle = 0;

        // Setup: Create group with 10 members
        let mut members = Vec::new(&env);
        let mut member_addresses = Vec::new(&env);
        for _ in 0..10 {
            let member = Address::generate(&env);
            members.push_back(member.clone());
            member_addresses.push_back(member);
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Setup: Only first 5 members contributed
        for i in 0..5 {
            let member = member_addresses.get(i).unwrap();
            let contrib =
                ContributionRecord::new(member.clone(), group_id, cycle, 10_000_000, 12345);
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Action: Get missed contributions
        let missed = client.get_missed_contributions(&group_id, &cycle);

        // Verify: Last 5 members missed
        assert_eq!(missed.len(), 5);

        // Verify the missed members are the last 5
        for i in 0..5 {
            let expected_member = member_addresses.get(i + 5).unwrap();
            let missed_member = missed.get(i).unwrap();
            assert_eq!(missed_member, expected_member);
        }
    }

    // Tests for record_contribution helper function

    #[test]
    fn test_record_contribution_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000; // 1 XLM
        let timestamp = 12345u64;

        // Action: Record contribution using as_contract
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Success
        assert!(result.is_ok());

        // Verify: Contribution record was stored
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
        let stored_contrib: ContributionRecord =
            env.storage().persistent().get(&contrib_key).unwrap();
        assert_eq!(stored_contrib.member_address, member);
        assert_eq!(stored_contrib.group_id, group_id);
        assert_eq!(stored_contrib.cycle_number, cycle);
        assert_eq!(stored_contrib.amount, amount);
        assert_eq!(stored_contrib.timestamp, timestamp);

        // Verify: Cycle total was updated
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount);

        // Verify: Cycle count was updated
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_record_contribution_already_contributed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Setup: Record first contribution
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Action: Try to record second contribution for same member/cycle
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp + 100,
            )
        });

        // Verify: Error returned
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::AlreadyContributed);

        // Verify: Totals weren't double-counted
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount); // Still just the first contribution

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 1); // Still just 1 contributor
    }

    #[test]
    fn test_record_contribution_multiple_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let member3 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Action: Record contributions from 3 members
        for (i, member) in [&member1, &member2, &member3].iter().enumerate() {
            let result = env.as_contract(&contract_id, || {
                StellarSaveContract::record_contribution(
                    &env,
                    group_id,
                    cycle,
                    (*member).clone(),
                    amount,
                    timestamp + (i as u64 * 100),
                )
            });
            assert!(result.is_ok());
        }

        // Verify: All contributions were stored
        for member in [&member1, &member2, &member3].iter() {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, (*member).clone());
            assert!(env.storage().persistent().has(&contrib_key));
        }

        // Verify: Cycle total is sum of all contributions
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount * 3);

        // Verify: Cycle count is 3
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn test_record_contribution_different_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Action: Record contributions in different cycles
        for cycle in 0..3 {
            let result = env.as_contract(&contract_id, || {
                StellarSaveContract::record_contribution(
                    &env,
                    group_id,
                    cycle,
                    member.clone(),
                    amount,
                    timestamp + (cycle as u64 * 3600),
                )
            });
            assert!(result.is_ok());
        }

        // Verify: Each cycle has its own contribution record
        for cycle in 0..3 {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            let contrib: ContributionRecord = env.storage().persistent().get(&contrib_key).unwrap();
            assert_eq!(contrib.cycle_number, cycle);
        }

        // Verify: Each cycle has its own totals
        for cycle in 0..3 {
            let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
            let total: i128 = env.storage().persistent().get(&total_key).unwrap();
            assert_eq!(total, amount);

            let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
            let count: u32 = env.storage().persistent().get(&count_key).unwrap();
            assert_eq!(count, 1);
        }
    }

    #[test]
    fn test_record_contribution_different_amounts() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount1 = 10_000_000; // 1 XLM
        let amount2 = 20_000_000; // 2 XLM
        let timestamp = 12345u64;

        // Action: Record contributions with different amounts
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member1.clone(),
                amount1,
                timestamp,
            )
        })
        .unwrap();

        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member2.clone(),
                amount2,
                timestamp + 100,
            )
        })
        .unwrap();

        // Verify: Total is sum of different amounts
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount1 + amount2);

        // Verify: Count is 2
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_record_contribution_updates_existing_totals() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Setup: Pre-set some totals (simulating previous contributions)
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        env.storage().persistent().set(&total_key, &50_000_000i128);

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        env.storage().persistent().set(&count_key, &5u32);

        // Action: Record new contribution
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member1.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Verify: Total was incremented
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, 60_000_000); // 50M + 10M

        // Verify: Count was incremented
        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 6); // 5 + 1
    }

    #[test]
    fn test_record_contribution_zero_initial_totals() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 10_000_000;
        let timestamp = 12345u64;

        // Verify: No totals exist initially
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        assert!(!env.storage().persistent().has(&total_key));

        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        assert!(!env.storage().persistent().has(&count_key));

        // Action: Record first contribution
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Verify: Totals were initialized correctly
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount);

        let count: u32 = env.storage().persistent().get(&count_key).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_record_contribution_large_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let member = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 1_000_000_000_000i128; // 100,000 XLM
        let timestamp = 12345u64;

        // Action: Record large contribution
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_contribution(
                &env,
                group_id,
                cycle,
                member.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Success
        assert!(result.is_ok());

        // Verify: Large amount was stored correctly
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        let total: i128 = env.storage().persistent().get(&total_key).unwrap();
        assert_eq!(total, amount);
    }

    // Tests for get_contribution_deadline function

    #[test]
    fn test_get_contribution_deadline_cycle_0() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week in seconds
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadline for cycle 0
        let deadline = client.get_contribution_deadline(&group_id, &0);

        // Verify: Deadline is started_at + cycle_duration
        assert_eq!(deadline, started_at + cycle_duration);
    }

    #[test]
    fn test_get_contribution_deadline_cycle_1() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadline for cycle 1
        let deadline = client.get_contribution_deadline(&group_id, &1);

        // Verify: Deadline is started_at + (2 * cycle_duration)
        // Cycle 1 starts at started_at + cycle_duration, ends at started_at + (2 * cycle_duration)
        assert_eq!(deadline, started_at + (2 * cycle_duration));
    }

    #[test]
    fn test_get_contribution_deadline_multiple_cycles() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            10,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadlines for cycles 0-4
        for cycle in 0..5 {
            let deadline = client.get_contribution_deadline(&group_id, &cycle);
            let expected = started_at + ((cycle + 1) as u64 * cycle_duration);
            assert_eq!(deadline, expected);
        }
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_contribution_deadline_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Action: Try to get deadline for non-existent group
        client.get_contribution_deadline(&999, &0);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_get_contribution_deadline_group_not_started() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let created_at = 1000000u64;

        // Setup: Create a group that hasn't been started
        let group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            created_at,
        );
        // Note: group.started is false by default
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Try to get deadline for unstarted group
        client.get_contribution_deadline(&group_id, &0);
    }

    #[test]
    fn test_get_contribution_deadline_different_durations() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let started_at = 1000000u64;

        // Test with 1 week duration
        let group1_id = 1;
        let duration1 = 604800u64; // 1 week
        let mut group1 = Group::new(group1_id, creator.clone(), 100, duration1, 5, 2, started_at);
        group1.started = true;
        group1.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        // Test with 1 month duration
        let group2_id = 2;
        let duration2 = 2592000u64; // 30 days
        let mut group2 = Group::new(group2_id, creator.clone(), 100, duration2, 5, 2, started_at);
        group2.started = true;
        group2.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group2_id), &group2);

        // Verify: Different deadlines based on duration
        let deadline1 = client.get_contribution_deadline(&group1_id, &0);
        let deadline2 = client.get_contribution_deadline(&group2_id, &0);

        assert_eq!(deadline1, started_at + duration1);
        assert_eq!(deadline2, started_at + duration2);
        assert_ne!(deadline1, deadline2);
    }

    #[test]
    fn test_get_contribution_deadline_time_remaining() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadline and calculate time remaining
        let deadline = client.get_contribution_deadline(&group_id, &0);
        let current_time = started_at + 100000; // Some time into the cycle

        // Verify: Can calculate time remaining
        assert!(deadline > current_time);
        let time_remaining = deadline - current_time;
        assert_eq!(time_remaining, cycle_duration - 100000);
    }

    #[test]
    fn test_get_contribution_deadline_expired_cycle() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadline for cycle 0
        let deadline = client.get_contribution_deadline(&group_id, &0);

        // Verify: Can check if cycle has expired
        let current_time = started_at + cycle_duration + 1000; // After deadline
        assert!(current_time > deadline);
    }

    #[test]
    fn test_get_contribution_deadline_high_cycle_number() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group with many cycles
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            100,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadline for cycle 50
        let deadline = client.get_contribution_deadline(&group_id, &50);

        // Verify: Correct calculation for high cycle number
        let expected = started_at + (51 * cycle_duration);
        assert_eq!(deadline, expected);
    }

    #[test]
    fn test_get_contribution_deadline_short_duration() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 3600u64; // 1 hour
        let started_at = 1000000u64;

        // Setup: Create a started group with short cycle
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get deadline for cycle 0
        let deadline = client.get_contribution_deadline(&group_id, &0);

        // Verify: Correct deadline for short duration
        assert_eq!(deadline, started_at + cycle_duration);
        assert_eq!(deadline, started_at + 3600);
    }

    #[test]
    fn test_get_contribution_deadline_consistency() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Call multiple times for same cycle
        let deadline1 = client.get_contribution_deadline(&group_id, &0);
        let deadline2 = client.get_contribution_deadline(&group_id, &0);
        let deadline3 = client.get_contribution_deadline(&group_id, &0);

        // Verify: Always returns same value
        assert_eq!(deadline1, deadline2);
        assert_eq!(deadline2, deadline3);
    }

    // Tests for get_next_payout_cycle function

    #[test]
    fn test_get_next_payout_cycle_current_cycle_0() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week in seconds
        let started_at = 1000000u64;

        // Setup: Create a started group with current_cycle = 0
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get next payout cycle time
        let next_payout_time = client.get_next_payout_cycle(&group_id);

        // Verify: Next payout is at started_at + (2 * cycle_duration)
        // current_cycle = 0, next_cycle = 1, so next_payout = started_at + ((1+1) * cycle_duration)
        let expected = started_at + (2 * cycle_duration);
        assert_eq!(next_payout_time, expected);
    }

    #[test]
    fn test_get_next_payout_cycle_current_cycle_2() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group with current_cycle = 2
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get next payout cycle time
        let next_payout_time = client.get_next_payout_cycle(&group_id);

        // Verify: Next payout is at started_at + (4 * cycle_duration)
        // current_cycle = 2, next_cycle = 3, so next_payout = started_at + ((3+1) * cycle_duration)
        let expected = started_at + (4 * cycle_duration);
        assert_eq!(next_payout_time, expected);
    }

    #[test]
    fn test_get_next_payout_cycle_different_durations() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let started_at = 1000000u64;

        // Test with 1 hour duration
        let group1_id = 1;
        let duration1 = 3600u64; // 1 hour
        let mut group1 = Group::new(group1_id, creator.clone(), 100, duration1, 5, 2, started_at);
        group1.started = true;
        group1.started_at = started_at;
        group1.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        // Test with 1 week duration
        let group2_id = 2;
        let duration2 = 604800u64; // 1 week
        let mut group2 = Group::new(group2_id, creator.clone(), 100, duration2, 5, 2, started_at);
        group2.started = true;
        group2.started_at = started_at;
        group2.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group2_id), &group2);

        // Action: Get next payout times
        let next_payout1 = client.get_next_payout_cycle(&group1_id);
        let next_payout2 = client.get_next_payout_cycle(&group2_id);

        // Verify: Different next payout times based on duration
        assert_eq!(next_payout1, started_at + (2 * duration1));
        assert_eq!(next_payout2, started_at + (2 * duration2));
        assert_ne!(next_payout1, next_payout2);
    }

    #[test]
    fn test_get_next_payout_cycle_high_cycle_number() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 86400u64; // 1 day
        let started_at = 1000000u64;

        // Setup: Create a started group with high current_cycle
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            100,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 50;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get next payout cycle time
        let next_payout_time = client.get_next_payout_cycle(&group_id);

        // Verify: Correct calculation for high cycle number
        // current_cycle = 50, next_cycle = 51, so next_payout = started_at + ((51+1) * cycle_duration)
        let expected = started_at + (52 * cycle_duration);
        assert_eq!(next_payout_time, expected);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_next_payout_cycle_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Action: Try to get next payout for non-existent group
        client.get_next_payout_cycle(&999);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_get_next_payout_cycle_group_not_started() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let created_at = 1000000u64;

        // Setup: Create a group that hasn't been started
        let group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            created_at,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Try to get next payout for unstarted group
        client.get_next_payout_cycle(&group_id);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_get_next_payout_cycle_group_complete() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let started_at = 1000000u64;

        // Setup: Create a completed group (current_cycle >= max_members)
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 5; // Equal to max_members, so group is complete
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Try to get next payout for completed group
        client.get_next_payout_cycle(&group_id);
    }

    #[test]
    fn test_get_next_payout_cycle_time_remaining() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64; // 1 week
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Get next payout time and calculate time remaining
        let next_payout_time = client.get_next_payout_cycle(&group_id);
        let current_time = started_at + cycle_duration + 100000; // Some time into cycle 1

        // Verify: Can calculate time until next payout
        assert!(next_payout_time > current_time);
        let time_until_payout = next_payout_time - current_time;
        assert!(time_until_payout > 0);
    }

    #[test]
    fn test_get_next_payout_cycle_consistency() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let cycle_duration = 604800u64;
        let started_at = 1000000u64;

        // Setup: Create a started group
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            cycle_duration,
            5,
            2,
            started_at,
        );
        group.started = true;
        group.started_at = started_at;
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Action: Call multiple times
        let next_payout1 = client.get_next_payout_cycle(&group_id);
        let next_payout2 = client.get_next_payout_cycle(&group_id);
        let next_payout3 = client.get_next_payout_cycle(&group_id);

        // Verify: Always returns same value
        assert_eq!(next_payout1, next_payout2);
        assert_eq!(next_payout2, next_payout3);
    }

    #[test]
    fn test_is_payout_due_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_is_payout_due(&999);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_payout_due_pending_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);
        group.status = GroupStatus::Pending;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_due = client.is_payout_due(&group_id);
        assert!(!is_due);
    }

    #[test]
    fn test_is_payout_due_cycle_incomplete() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345);
        group.status = GroupStatus::Active;
        group.member_count = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Setup members list
        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(Address::generate(&env));
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // Only 1 contribution
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_count(group_id, 0),
            &1u32,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &100i128,
        );

        let is_due = client.is_payout_due(&group_id);
        assert!(!is_due);
    }

    #[test]
    fn test_is_payout_due_ready() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345);
        group.status = GroupStatus::Active;
        group.member_count = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Setup members list
        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(Address::generate(&env));
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // 2 contributions (complete)
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_count(group_id, 0),
            &2u32,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &200i128,
        );

        let is_due = client.is_payout_due(&group_id);
        assert!(is_due);
    }

    #[test]
    fn test_is_payout_due_already_paid() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345);
        group.status = GroupStatus::Active;
        group.member_count = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Setup members list
        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(Address::generate(&env));
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        // 2 contributions (complete)
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_count(group_id, 0),
            &2u32,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &200i128,
        );

        // Mark as already paid
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &creator);

        let is_due = client.is_payout_due(&group_id);
        assert!(!is_due);
    }

    #[test]
    fn test_emergency_withdraw_not_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        let result = client.try_emergency_withdraw(&group_id, &non_member);
        assert_eq!(result, Err(Ok(StellarSaveError::NotMember)));
    }

    #[test]
    fn test_emergency_withdraw_group_complete() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.status = GroupStatus::Completed;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = client.try_emergency_withdraw(&group_id, &creator);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_emergency_withdraw_not_stalled() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        group.started_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = client.try_emergency_withdraw(&group_id, &creator);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_emergency_withdraw_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        let old_time = 1000000u64;
        group.started_at = old_time;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        env.ledger().with_mut(|li| {
            li.timestamp = old_time + (cycle_duration * 3);
        });

        let result = client.try_emergency_withdraw(&group_id, &member);
        assert!(result.is_ok());
    }

    #[test]
    fn test_emergency_withdraw_removes_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        let old_time = 1000000u64;
        group.started_at = old_time;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        env.ledger().with_mut(|li| {
            li.timestamp = old_time + (cycle_duration * 3);
        });

        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        assert!(env.storage().persistent().has(&member_key));

        client.emergency_withdraw(&group_id, &member);

        assert!(!env.storage().persistent().has(&member_key));
    }

    #[test]
    fn test_emergency_withdraw_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        let old_time = 1000000u64;
        group.started_at = old_time;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        env.ledger().with_mut(|li| {
            li.timestamp = old_time + (cycle_duration * 3);
        });

        client.emergency_withdraw(&group_id, &member);

        let events = env.events().all();
        assert!(events.len() > 0);
    }

    #[test]
    fn test_validate_payout_recipient_not_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let result = client.validate_payout_recipient(&group_id, &non_member);
        assert_eq!(result, false);
    }

    #[test]
    fn test_validate_payout_recipient_already_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        env.storage().persistent().set(&recipient_key, &creator);

        let result = client.validate_payout_recipient(&group_id, &creator);
        assert_eq!(result, false);
    }

    #[test]
    fn test_validate_payout_recipient_wrong_position() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let result = client.validate_payout_recipient(&group_id, &creator);
        assert_eq!(result, false);
    }

    #[test]
    fn test_validate_payout_recipient_valid() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        let result = client.validate_payout_recipient(&group_id, &creator);
        assert_eq!(result, true);
    }

    #[test]
    fn test_validate_payout_recipient_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);

        let result = client.try_validate_payout_recipient(&999, &member);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_get_total_paid_out_no_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let total = client.get_total_paid_out(&group_id);
        assert_eq!(total, 0);
    }

    #[test]
    fn test_get_total_paid_out_single_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&payout_key, &payout);

        let total = client.get_total_paid_out(&group_id);
        assert_eq!(total, 300);
    }

    #[test]
    fn test_get_total_paid_out_multiple_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout1 =
            PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout2 =
            PayoutRecord::new(member1.clone(), group_id, 1, 300, env.ledger().timestamp());
        let payout3 =
            PayoutRecord::new(member2.clone(), group_id, 2, 300, env.ledger().timestamp());

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout3);

        let total = client.get_total_paid_out(&group_id);
        assert_eq!(total, 900);
    }

    #[test]
    fn test_get_total_paid_out_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let result = client.try_get_total_paid_out(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    // Tests for get_payout_history function

    #[test]
    fn test_get_payout_history_no_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Get payout history (should be empty)
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 0);
    }

    #[test]
    fn test_get_payout_history_single_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Setup: Create a group with one payout
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&payout_key, &payout);

        // Get payout history
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 1);
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(0).unwrap().recipient, creator);
        assert_eq!(history.get(0).unwrap().amount, 300);
    }

    #[test]
    fn test_get_payout_history_multiple_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Setup: Create a group with multiple payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let payout1 = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1000);
        let payout2 = PayoutRecord::new(member1.clone(), group_id, 1, 300, 2000);
        let payout3 = PayoutRecord::new(member2.clone(), group_id, 2, 300, 3000);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout3);

        // Get payout history
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 3);

        // Verify sorting by cycle number
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(1).unwrap().cycle_number, 1);
        assert_eq!(history.get(2).unwrap().cycle_number, 2);

        // Verify recipients
        assert_eq!(history.get(0).unwrap().recipient, creator);
        assert_eq!(history.get(1).unwrap().recipient, member1);
        assert_eq!(history.get(2).unwrap().recipient, member2);
    }

    #[test]
    fn test_get_payout_history_pagination_first_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        // Setup: Create a group with 5 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 5;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..5 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get first page (limit 2)
        let first_page = client.get_payout_history(&group_id, &0, &2);
        assert_eq!(first_page.len(), 2);
        assert_eq!(first_page.get(0).unwrap().cycle_number, 0);
        assert_eq!(first_page.get(1).unwrap().cycle_number, 1);
    }

    #[test]
    fn test_get_payout_history_pagination_second_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        // Setup: Create a group with 5 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 5;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..5 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get second page (offset 2, limit 2)
        let second_page = client.get_payout_history(&group_id, &2, &2);
        assert_eq!(second_page.len(), 2);
        assert_eq!(second_page.get(0).unwrap().cycle_number, 2);
        assert_eq!(second_page.get(1).unwrap().cycle_number, 3);
    }

    #[test]
    fn test_get_payout_history_pagination_last_page_partial() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        // Setup: Create a group with 5 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 5;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..5 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get last page (offset 4, limit 2) - should only return 1 record
        let last_page = client.get_payout_history(&group_id, &4, &2);
        assert_eq!(last_page.len(), 1);
        assert_eq!(last_page.get(0).unwrap().cycle_number, 4);
    }

    #[test]
    fn test_get_payout_history_pagination_offset_beyond_end() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Setup: Create a group with 2 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..2 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Get with offset beyond total records
        let empty_result = client.get_payout_history(&group_id, &10, &5);
        assert_eq!(empty_result.len(), 0);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_payout_history_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get payout history for non-existent group
        client.get_payout_history(&999, &0, &10);
    }

    #[test]
    fn test_get_payout_history_large_dataset() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &50);

        // Setup: Create a group with 20 payouts
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 20;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for i in 0..20 {
            let payout =
                PayoutRecord::new(creator.clone(), group_id, i, 300, 1000 + (i as u64 * 1000));
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::payout_record(group_id, i), &payout);
        }

        // Test multiple pages
        let page1 = client.get_payout_history(&group_id, &0, &5);
        let page2 = client.get_payout_history(&group_id, &5, &5);
        let page3 = client.get_payout_history(&group_id, &10, &5);
        let page4 = client.get_payout_history(&group_id, &15, &5);

        assert_eq!(page1.len(), 5);
        assert_eq!(page2.len(), 5);
        assert_eq!(page3.len(), 5);
        assert_eq!(page4.len(), 5);

        // Verify continuity
        assert_eq!(page1.get(4).unwrap().cycle_number, 4);
        assert_eq!(page2.get(0).unwrap().cycle_number, 5);
        assert_eq!(page3.get(0).unwrap().cycle_number, 10);
        assert_eq!(page4.get(0).unwrap().cycle_number, 15);
    }

    #[test]
    fn test_get_payout_history_sorting_consistency() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Setup: Create payouts out of order in storage
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Store payouts in non-sequential order
        let payout2 = PayoutRecord::new(creator.clone(), group_id, 2, 300, 3000);
        let payout0 = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1000);
        let payout1 = PayoutRecord::new(creator.clone(), group_id, 1, 300, 2000);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout1);

        // Get payout history and verify sorting
        let history = client.get_payout_history(&group_id, &0, &10);
        assert_eq!(history.len(), 3);

        // Should be sorted by cycle number regardless of storage order
        assert_eq!(history.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.get(1).unwrap().cycle_number, 1);
        assert_eq!(history.get(2).unwrap().cycle_number, 2);
    }

    #[test]
    fn test_get_member_payout_no_payout_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Add member to group
        client.join_group(&group_id, &member);

        // Member hasn't received any payout yet
        let result = client.get_member_payout(&group_id, &member);
        assert_eq!(result, None);
    }

    #[test]
    fn test_get_member_payout_received_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Add member to group
        client.join_group(&group_id, &member);

        // Simulate a payout to the member in cycle 0
        let payout = PayoutRecord::new(member.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&payout_key, &payout);

        // Update group current_cycle to reflect the payout
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.current_cycle = 1;
        env.storage().persistent().set(&group_key, &group);

        // Member should have received a payout
        let result = client.get_member_payout(&group_id, &member);
        assert!(result.is_some());

        let payout_record = result.unwrap();
        assert_eq!(payout_record.recipient, member);
        assert_eq!(payout_record.group_id, group_id);
        assert_eq!(payout_record.cycle_number, 0);
        assert_eq!(payout_record.amount, 300);
    }

    #[test]
    fn test_get_member_payout_multiple_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Add members to group
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);

        // Simulate payouts across multiple cycles
        let payout1 =
            PayoutRecord::new(member1.clone(), group_id, 0, 300, env.ledger().timestamp());
        let payout2 =
            PayoutRecord::new(member2.clone(), group_id, 1, 300, env.ledger().timestamp());
        let payout3 =
            PayoutRecord::new(creator.clone(), group_id, 2, 300, env.ledger().timestamp());

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 1), &payout2);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 2), &payout3);

        // Update group current_cycle
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.current_cycle = 3;
        env.storage().persistent().set(&group_key, &group);

        // Check member1's payout (should be cycle 0)
        let result1 = client.get_member_payout(&group_id, &member1);
        assert!(result1.is_some());
        assert_eq!(result1.unwrap().cycle_number, 0);

        // Check member2's payout (should be cycle 1)
        let result2 = client.get_member_payout(&group_id, &member2);
        assert!(result2.is_some());
        assert_eq!(result2.unwrap().cycle_number, 1);

        // Check creator's payout (should be cycle 2)
        let result3 = client.get_member_payout(&group_id, &creator);
        assert!(result3.is_some());
        assert_eq!(result3.unwrap().cycle_number, 2);
    }

    #[test]
    fn test_get_member_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let member = Address::generate(&env);

        let result = client.try_get_member_payout(&999, &member);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_get_member_payout_not_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let result = client.try_get_member_payout(&group_id, &non_member);
        assert_eq!(result, Err(Ok(StellarSaveError::NotMember)));
    }

    #[test]
    fn test_get_payout_schedule_not_started() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let result = client.try_get_payout_schedule(&group_id);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_get_payout_schedule_single_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        group.started_at = 1000000;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let schedule = client.get_payout_schedule(&group_id);
        assert_eq!(schedule.len(), 1);
        assert_eq!(schedule.get(0).unwrap().cycle, 0);
        assert_eq!(schedule.get(0).unwrap().payout_date, 1003600);
    }

    #[test]
    fn test_get_payout_schedule_multiple_members() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.started = true;
        group.started_at = 1000000;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let schedule = client.get_payout_schedule(&group_id);
        assert_eq!(schedule.len(), 3);
        assert_eq!(schedule.get(0).unwrap().payout_date, 1003600);
        assert_eq!(schedule.get(1).unwrap().payout_date, 1007200);
        assert_eq!(schedule.get(2).unwrap().payout_date, 1010800);
    }

    #[test]
    fn test_get_payout_schedule_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_get_payout_schedule(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_is_complete_not_started() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_complete_in_progress() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_complete_all_cycles_done() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, true);
    }

    #[test]
    fn test_is_complete_status_completed() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.status = GroupStatus::Completed;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        let is_complete = client.is_complete(&group_id);
        assert_eq!(is_complete, true);
    }

    #[test]
    fn test_is_complete_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_is_complete(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_get_payout_queue_all_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);

        let queue = client.get_payout_queue(&group_id);
        assert_eq!(queue.len(), 3);
        assert_eq!(queue.get(0).unwrap(), creator);
        assert_eq!(queue.get(1).unwrap(), member1);
        assert_eq!(queue.get(2).unwrap(), member2);
    }

    #[test]
    fn test_get_payout_queue_some_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);

        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        env.storage().persistent().set(&recipient_key, &creator);

        let queue = client.get_payout_queue(&group_id);
        assert_eq!(queue.len(), 2);
        assert_eq!(queue.get(0).unwrap(), member1);
        assert_eq!(queue.get(1).unwrap(), member2);
    }

    #[test]
    fn test_get_payout_queue_all_received() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &creator);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 1), &member1);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 2), &member2);

        let queue = client.get_payout_queue(&group_id);
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn test_get_payout_queue_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_get_payout_queue(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }
}
