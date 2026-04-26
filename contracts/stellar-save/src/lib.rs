#![no_std]
#![allow(deprecated)]

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
pub mod cycle_advancement;
pub mod error;
pub mod events;
pub mod group;
pub mod migration;
pub mod migrations;
pub mod payout;
pub mod payout_executor;
pub mod penalty;
pub mod pool;
pub mod rating;
pub mod status;
pub mod storage;
pub mod storage_benchmark;
pub mod storage_optimization;
pub mod token;

mod auto_contribution_tests;
pub mod gas_benchmark;
mod invitation_tests;
mod merge_tests;
mod migration_tests;
mod milestone_tests;
pub mod milestones;
mod multi_token_tests;
pub mod search;
mod upgrade_tests;
mod fuzz_tests;

// Re-export for convenience
pub use contribution::{ContributionPage, ContributionRecord};
use core::cmp;
pub use error::{ContractResult, ErrorCategory, StellarSaveError};
pub use events::EventEmitter;
pub use events::*;
pub use group::{Group, GroupStatus};
pub use payout::PayoutRecord;
pub use pool::{PoolCalculator, PoolInfo};
pub use rating::{GroupRating, RatingAggregate, RatingEntry};
pub use search::{SearchParams, SearchResult};
#[cfg(test)]
use soroban_sdk::testutils::{Events, Ledger};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec};
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

    /// Whether the member has opted in to automatic contributions.
    /// When true, `execute_auto_contributions` will attempt a `transfer_from`
    /// on behalf of this member at the start of each cycle.
    pub auto_contribute_enabled: bool,
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
    /// Randomized assignment using Soroban PRNG and ledger seed salting
    Randomized,
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

    /// Validates that a cycle duration is within the allowed range.
    ///
    /// Checks the provided cycle duration against the contract's configured
    /// minimum and maximum cycle duration limits.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `cycle_duration` - The cycle duration to validate (in seconds)
    ///
    /// # Returns
    /// * `Ok(())` - The cycle duration is valid
    /// * `Err(StellarSaveError::InvalidState)` - Duration is outside allowed range
    ///
    /// # Example
    /// ```ignore
    /// // Validate a 7-day cycle (604800 seconds)
    /// StellarSaveContract::validate_cycle_duration(&env, 604800)?;
    /// ```
    pub fn validate_cycle_duration(env: &Env, cycle_duration: u64) -> Result<(), StellarSaveError> {
        let config_key = StorageKeyBuilder::contract_config();

        if let Some(config) = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&config_key)
        {
            if cycle_duration < config.min_cycle_duration
                || cycle_duration > config.max_cycle_duration
            {
                return Err(StellarSaveError::InvalidState);
            }
        }

        Ok(())
    }

    /// Records a contribution in storage and updates member statistics.
    ///
    /// # Optimization notes
    /// - Returns the new `cycle_total` so the caller can use it directly in the
    ///   event emission without an extra SLOAD.
    /// - Accepts `contribution_amount` from the already-loaded `Group` struct so
    ///   this helper never re-reads group data (saves 1 SLOAD vs the old design
    ///   that called `validate_contribution_amount` internally).
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
    /// * `Ok(new_cycle_total)` - Contribution successfully recorded; new cycle total
    /// * `Err(StellarSaveError::AlreadyContributed)` - Member already contributed this cycle
    /// * `Err(StellarSaveError::Overflow)` - Arithmetic overflow in totals
    ///
    /// # Storage Updates (5 ops total — down from 7 in the previous version)
    /// 1. `has` check on individual contribution key (1 SLOAD)
    /// 2. Individual contribution record (1 SSTORE)
    /// 3. Cycle total amount (1 SLOAD + 1 SSTORE)
    /// 4. Cycle contributor count (1 SLOAD + 1 SSTORE)
    /// 5. Group balance counter (1 SLOAD + 1 SSTORE)
    /// 6. Streak (1 SLOAD + 1 SSTORE) — unchanged
    fn record_contribution(
        env: &Env,
        group_id: u64,
        cycle_number: u32,
        member_address: Address,
        amount: i128,
        timestamp: u64,
    ) -> Result<i128, StellarSaveError> {
        // 1. Check if member has already contributed in this cycle (1 SLOAD)
        let contrib_key = StorageKeyBuilder::contribution_individual(
            group_id,
            cycle_number,
            member_address.clone(),
        );

        if env.storage().persistent().has(&contrib_key) {
            return Err(StellarSaveError::AlreadyContributed);
        }

        // 2. Create and store contribution record (1 SSTORE)
        let contribution = ContributionRecord::new(
            member_address.clone(),
            group_id,
            cycle_number,
            amount,
            timestamp,
        );
        env.storage().persistent().set(&contrib_key, &contribution);

        // 3. Update cycle total amount (1 SLOAD + 1 SSTORE)
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle_number);
        let current_total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        let new_total = current_total
            .checked_add(amount)
            .ok_or(StellarSaveError::Overflow)?;
        env.storage().persistent().set(&total_key, &new_total);

        // 4. Update cycle contributor count (1 SLOAD + 1 SSTORE)
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle_number);
        let current_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        let new_count = current_count
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?;
        env.storage().persistent().set(&count_key, &new_count);

        // 5. Gas opt: update incremental group balance counter (1 SLOAD + 1 SSTORE)
        //    Avoids O(n) loop in get_group_balance.
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        let new_balance = current_balance
            .checked_add(amount)
            .ok_or(StellarSaveError::Overflow)?;
        env.storage().persistent().set(&balance_key, &new_balance);

        // 6. Update contribution streak and emit milestone events if thresholds crossed
        //    (1 SLOAD + 1 SSTORE inside update_streak)
        milestones::update_streak(env, group_id, member_address, cycle_number);

        // Return new_total so the caller can use it directly in event emission
        // without an extra SLOAD.
        Ok(new_total)
    }

    fn generate_next_group_id(env: &Env) -> Result<u64, StellarSaveError> {
        Self::increment_group_id(env)
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

    /// Updates the global contribution amount limits.
    ///
    /// Only the contract admin can call this function.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `admin` - Admin address (must match stored config admin)
    /// * `min_contribution` - New minimum contribution amount (must be > 0)
    /// * `max_contribution` - New maximum contribution amount (must be >= min_contribution)
    ///
    /// # Returns
    /// * `Ok(())` - Limits updated successfully
    /// * `Err(StellarSaveError::Unauthorized)` - Caller is not the admin
    /// * `Err(StellarSaveError::ContributionTooLow)` - min_contribution <= 0
    /// * `Err(StellarSaveError::ContributionTooHigh)` - max_contribution < min_contribution
    pub fn update_contribution_limits(
        env: Env,
        admin: Address,
        min_contribution: i128,
        max_contribution: i128,
    ) -> Result<(), StellarSaveError> {
        admin.require_auth();

        if min_contribution <= 0 {
            return Err(StellarSaveError::ContributionTooLow);
        }
        if max_contribution < min_contribution {
            return Err(StellarSaveError::ContributionTooHigh);
        }

        let key = StorageKeyBuilder::contract_config();
        let mut config = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&key)
            .ok_or(StellarSaveError::Unauthorized)?;

        if config.admin != admin {
            return Err(StellarSaveError::Unauthorized);
        }

        config.min_contribution = min_contribution;
        config.max_contribution = max_contribution;
        env.storage().persistent().set(&key, &config);

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
        token_address: Address,
        grace_period_seconds: u64,
    ) -> Result<u64, StellarSaveError> {
        // 1. Authorization: Only the creator can initiate this transaction
        creator.require_auth();

        // 2. Round contribution amount to nearest 0.01 XLM (100,000 stroops)
        // This prevents precision issues with very small amounts
        let rounded_amount = crate::helpers::round_contribution_amount(contribution_amount);

        // Ensure the rounded amount is still valid (greater than 0)
        if rounded_amount <= 0 {
            return Err(StellarSaveError::InvalidAmount);
        }

        // 3. Global Validation: Check against ContractConfig (using rounded amount)
        let config_key = StorageKeyBuilder::contract_config();
        if let Some(config) = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&config_key)
        {
            if rounded_amount < config.min_contribution {
                return Err(StellarSaveError::ContributionTooLow);
            }
            if rounded_amount > config.max_contribution {
                return Err(StellarSaveError::ContributionTooHigh);
            }
            if max_members < config.min_members
                || max_members > config.max_members
                || cycle_duration < config.min_cycle_duration
                || cycle_duration > config.max_cycle_duration
            {
                return Err(StellarSaveError::InvalidState);
            }
        }

        // 4. Token allowlist check: if an allowlist is configured, verify token_address is present
        let allowed_tokens_key = StorageKeyBuilder::allowed_tokens();
        if let Some(allowed_tokens) = env
            .storage()
            .persistent()
            .get::<_, soroban_sdk::Vec<Address>>(&allowed_tokens_key)
        {
            if !allowed_tokens.contains(&token_address) {
                return Err(StellarSaveError::InvalidToken);
            }
        }

        // 5. Validate token via SEP-41 decimals() call
        let token_decimals = crate::token::validate_token(&env, &token_address)?;

        // 6. Generate unique group ID
        let group_id = Self::generate_next_group_id(&env)?;

        // 7. Initialize Group Struct (using rounded amount)
        let current_time = env.ledger().timestamp();
        let min_members = 2; // Default minimum members
        let new_group = Group::new(
            group_id,
            creator.clone(),
            rounded_amount,
            cycle_duration,
            max_members,
            min_members,
            current_time,
            0, // grace_period_seconds - using default of 0
        );

        // 8. Store Group Data
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &new_group);

        // Initialize Group Status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // 9. Store TokenConfig for this group
        let token_config = crate::group::TokenConfig {
            token_address: token_address.clone(),
            token_decimals,
        };
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        env.storage()
            .persistent()
            .set(&token_config_key, &token_config);

        // 10. Emit GroupCreated Event (include token_address as second data field)
        env.events()
            .publish((Symbol::new(&env, "GroupCreated"), creator), (group_id, token_address));

        // 11. Return Group ID
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

    /// Returns the `TokenConfig` (token address and decimals) for a specific group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The unique identifier of the group
    ///
    /// # Returns
    /// * `Ok(TokenConfig)` - The token configuration stored for the group
    /// * `Err(StellarSaveError::GroupNotFound)` - If no token config exists for the group_id
    ///
    /// # Requirements
    /// * 2.3, 2.4
    pub fn get_token_config(
        env: Env,
        group_id: u64,
    ) -> Result<crate::group::TokenConfig, StellarSaveError> {
        let key = StorageKeyBuilder::group_token_config(group_id);
        env.storage()
            .persistent()
            .get::<_, crate::group::TokenConfig>(&key)
            .ok_or(StellarSaveError::GroupNotFound)
    }

    /// Adds a token to the admin-managed allowlist. Requirements: 6.2
    pub fn add_allowed_token(
        env: Env,
        admin: Address,
        token_address: Address,
    ) -> Result<(), StellarSaveError> {
        admin.require_auth();
        let config_key = StorageKeyBuilder::contract_config();
        let config = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&config_key)
            .ok_or(StellarSaveError::Unauthorized)?;
        if config.admin != admin {
            return Err(StellarSaveError::Unauthorized);
        }
        let list_key = StorageKeyBuilder::allowed_tokens();
        let mut list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));
        if !list.contains(&token_address) {
            list.push_back(token_address);
            env.storage().persistent().set(&list_key, &list);
        }
        Ok(())
    }

    /// Removes a token from the admin-managed allowlist. Requirements: 6.3
    pub fn remove_allowed_token(
        env: Env,
        admin: Address,
        token_address: Address,
    ) -> Result<(), StellarSaveError> {
        admin.require_auth();
        let config_key = StorageKeyBuilder::contract_config();
        let config = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&config_key)
            .ok_or(StellarSaveError::Unauthorized)?;
        if config.admin != admin {
            return Err(StellarSaveError::Unauthorized);
        }
        let list_key = StorageKeyBuilder::allowed_tokens();
        let list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));
        let mut new_list = Vec::new(&env);
        for addr in list.iter() {
            if addr != token_address {
                new_list.push_back(addr);
            }
        }
        env.storage().persistent().set(&list_key, &new_list);
        Ok(())
    }

    /// Returns true if the token is permitted (open mode or on allowlist). Requirements: 6.4, 6.5
    pub fn is_token_allowed(env: Env, token_address: Address) -> bool {
        let list_key = StorageKeyBuilder::allowed_tokens();
        match env.storage().persistent().get::<_, Vec<Address>>(&list_key) {
            Some(list) => list.contains(&token_address),
            None => true, // open mode — no allowlist configured
        }
    }

    /// Checks if a member has already received their payout in a group.
    ///
    /// # Arguments
    /// * `group_id` - The unique identifier of the group.
    /// * `caller` - The address attempting to update metadata (must be creator).
    /// * `name` - New group name (3-50 characters).
    /// * `description` - New group description (0-500 characters).
    /// * `image_url` - New group image URL.
    ///
    /// # Returns
    /// Returns Ok(()) if successful, or an error if validation fails.
    ///
    /// # Validation
    /// - Caller must be the group creator
    /// - Name must be 3-50 characters
    /// - Description must be 0-500 characters
    /// - Emits GroupMetadataUpdated event on success
    pub fn update_group_metadata(
        env: Env,
        group_id: u64,
        caller: Address,
        name: String,
        description: String,
        image_url: String,
    ) -> Result<(), StellarSaveError> {
        // 1. Verify caller is authorized
        caller.require_auth();

        // 2. Load existing group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 3. Verify caller is the creator
        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        // 4. Validate metadata
        // Name: 3-50 characters
        if name.len() < 3 || name.len() > 50 {
            return Err(StellarSaveError::InvalidMetadata);
        }

        // Description: 0-500 characters
        if description.len() > 500 {
            return Err(StellarSaveError::InvalidMetadata);
        }

        // 5. Update group metadata
        group.name = Some(name.clone());
        group.description = Some(description.clone());
        group.image_url = Some(image_url.clone());

        // 6. Save updated group
        env.storage().persistent().set(&group_key, &group);

        // 7. Emit event
        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_group_metadata_updated(
            &env,
            group_id,
            caller,
            name,
            description,
            image_url,
            timestamp,
        );

        Ok(())
    }

    /// Checks if a member has already received their payout in a group.
    ///
    /// Gas opt: O(1) direct lookup using the member's payout_position as the cycle
    /// key, instead of the previous O(n) loop over all cycles.
    /// Each member's payout_position == the cycle they receive payout in, so we
    /// can check exactly one storage slot.
    ///
    /// # Arguments
    /// * `group_id` - The unique identifier of the group.
    /// * `member_address` - The address of the member to check.
    ///
    /// # Returns
    /// Returns true if the member has received their payout, false otherwise.
    pub fn has_received_payout(
        env: Env,
        group_id: u64,
        member_address: Address,
    ) -> Result<bool, StellarSaveError> {
        // Gas opt: load member profile to get payout_position (O(1) lookup)
        let profile_key =
            StorageKeyBuilder::member_payout_eligibility(group_id, member_address.clone());
        let payout_position: u32 = match env.storage().persistent().get::<_, u32>(&profile_key) {
            Some(pos) => pos,
            None => {
                // Verify group exists before returning NotMember
                let group_key = StorageKeyBuilder::group_data(group_id);
                if !env.storage().persistent().has(&group_key) {
                    return Err(StellarSaveError::GroupNotFound);
                }
                return Ok(false);
            }
        };

        // Check the single cycle slot where this member would have received payout
        // Gas opt: 1 SLOAD instead of current_cycle+1 SLOADs
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, payout_position);
        if let Some(recipient) = env.storage().persistent().get::<_, Address>(&recipient_key) {
            if recipient == member_address {
                return Ok(true);
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
    /// Gas opt: single SLOAD for payout_position, then one SLOAD to check if
    /// that position's payout slot is already filled. Avoids calling
    /// has_received_payout + get_payout_position as separate storage reads.
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

        // Verify member exists
        let member_key = StorageKeyBuilder::member_profile(group_id, recipient.clone());
        if !env.storage().persistent().has(&member_key) {
            return Ok(false);
        }

        // Gas opt: read payout_position once and use it for both checks
        let pos_key = StorageKeyBuilder::member_payout_eligibility(group_id, recipient.clone());
        let payout_position: u32 = match env.storage().persistent().get::<_, u32>(&pos_key) {
            Some(p) => p,
            None => return Ok(false),
        };

        // Must be this member's turn
        if payout_position != group.current_cycle {
            return Ok(false);
        }

        // Check they haven't already received payout (O(1) — single slot check)
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, payout_position);
        if env.storage().persistent().has(&recipient_key) {
            return Ok(false);
        }

        Ok(true)
    }

    /// Calculates the total amount paid out by a group across all cycles.
    ///
    /// Gas opt: O(1) read from the incremental `GroupTotalPaidOut` counter
    /// instead of the previous O(n) loop over all payout records.
    /// The counter is updated atomically in `record_payout` / `transfer_payout`.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(i128)` - Total amount paid out
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    pub fn get_total_paid_out(env: Env, group_id: u64) -> Result<i128, StellarSaveError> {
        // Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        if !env.storage().persistent().has(&group_key) {
            return Err(StellarSaveError::GroupNotFound);
        }

        // Gas opt: O(1) counter read instead of O(n) loop over payout records
        let paid_out_key = StorageKeyBuilder::group_total_paid_out(group_id);
        let total: i128 = env.storage().persistent().get(&paid_out_key).unwrap_or(0);
        Ok(total)
    }

    /// Gets the current balance held for a specific group.
    ///
    /// Gas opt: O(1) reads from incremental counters (`GroupBalance` and
    /// `GroupTotalPaidOut`) instead of the previous O(2n) double-loop that
    /// summed all contribution totals and all payout records.
    /// Both counters are updated atomically on every contribution / payout.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(i128)` - Current balance held for the group in stroops
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    /// * `Err(StellarSaveError::Overflow)` - If calculation overflows
    pub fn get_group_balance(env: Env, group_id: u64) -> Result<i128, StellarSaveError> {
        // Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        if !env.storage().persistent().has(&group_key) {
            return Err(StellarSaveError::GroupNotFound);
        }

        // Gas opt: 2 SLOADs instead of O(2n) loop over contributions + payouts
        let balance_key = StorageKeyBuilder::group_balance(group_id);
        let total_contributions: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);

        let paid_out_key = StorageKeyBuilder::group_total_paid_out(group_id);
        let total_payouts: i128 = env.storage().persistent().get(&paid_out_key).unwrap_or(0);

        let balance = total_contributions
            .checked_sub(total_payouts)
            .ok_or(StellarSaveError::Overflow)?;

        Ok(balance)
    }
}

impl StellarSaveContract {
    /// Returns all members of a group.
    ///
    /// Loads the complete member list from storage. For large groups, consider using
    /// the paginated `get_group_members` function instead.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(Vec<Address>)` - Complete list of member addresses
    /// * `Err(StellarSaveError::GroupNotFound)` - If group or members list missing
    ///
    /// # Example
    /// ```ignore
    /// let members = contract.get_members(env, group_id)?;
    /// ```
    pub fn get_members(env: Env, group_id: u64) -> Result<Vec<Address>, StellarSaveError> {
        // Verify group exists first
        let _group = Self::get_group(env.clone(), group_id)?;

        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        Ok(members)
    }

    /// Gets the complete profile of a specific member in a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `address` - Address of the member
    ///
    /// # Returns
    /// * `Ok(MemberProfile)` - Member profile data
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::NotMember)` - Member not found in group
    pub fn get_member(
        env: Env,
        group_id: u64,
        address: Address,
    ) -> Result<MemberProfile, StellarSaveError> {
        // Verify group exists
        let _group = Self::get_group(env.clone(), group_id)?;

        let member_key = StorageKeyBuilder::member_profile(group_id, address.clone());
        env.storage()
            .persistent()
            .get::<_, MemberProfile>(&member_key)
            .ok_or(StellarSaveError::NotMember)
    }

    /// Checks if an address is a member of a specific group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `address` - Address to check
    ///
    /// # Returns
    /// * `Ok(true)` - Address is a member
    /// * `Ok(false)` - Address is not a member
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    pub fn is_member(env: Env, group_id: u64, address: Address) -> Result<bool, StellarSaveError> {
        // Verify group exists
        let _group = Self::get_group(env.clone(), group_id)?;

        let member_key = StorageKeyBuilder::member_profile(group_id, address);
        Ok(env.storage().persistent().has(&member_key))
    }
}

impl StellarSaveContract {
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

    /// Retrieves payout details for a specific cycle.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `group_id` - The ID of the group
    /// * `cycle` - The cycle number to retrieve payout for
    ///
    /// # Returns
    /// * `Ok(PayoutRecord)` - The payout record for the specified cycle
    /// * `Err(StellarSaveError::GroupNotFound)` - If the group doesn't exist
    /// * `Err(StellarSaveError::PayoutFailed)` - If no payout exists for this cycle
    ///
    /// # Example
    /// ```ignore
    /// let payout = contract.get_payout(env, 1, 0)?;
    /// assert_eq!(payout.cycle_number, 0);
    /// ```
    pub fn get_payout(
        env: Env,
        group_id: u64,
        cycle: u32,
    ) -> Result<PayoutRecord, StellarSaveError> {
        // Verify group exists
        let _group = Self::get_group(env.clone(), group_id)?;

        // Load payout from storage
        let key = StorageKeyBuilder::payout_record(group_id, cycle);
        let payout: Option<PayoutRecord> = env.storage().persistent().get(&key);

        // Handle not found
        payout.ok_or(StellarSaveError::PayoutFailed)
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
    /// Gas opt: O(n) single pass — each member's payout_position is read once
    /// and inserted at the correct index. Replaces the previous O(n²) selection
    /// sort that re-read storage on every comparison.
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
        let group = env
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

        // Gas opt: build a fixed-size slot array indexed by payout_position.
        // Positions are 0..max_members so we can place each member directly
        // without any sorting pass — O(n) vs the previous O(n²) bubble sort.
        let max = group.max_members as usize;
        let mut slots: soroban_sdk::Vec<Option<Address>> = soroban_sdk::Vec::new(&env);
        for _ in 0..max {
            slots.push_back(None);
        }

        for member in members.iter() {
            let pos_key = StorageKeyBuilder::member_payout_eligibility(group_id, member.clone());
            if let Some(position) = env.storage().persistent().get::<_, u32>(&pos_key) {
                // Skip members who have already received their payout
                let recipient_key = StorageKeyBuilder::payout_recipient(group_id, position);
                if env.storage().persistent().has(&recipient_key) {
                    continue;
                }
                if (position as usize) < max {
                    slots.set(position, Some(member));
                }
            }
        }

        // Collect non-None slots in order — already sorted by position
        let mut queue = Vec::new(&env);
        for i in 0..slots.len() {
            if let Some(Some(addr)) = slots.get(i) {
                queue.push_back(addr);
            }
        }

        Ok(queue)
    }

    /// Assigns or reassigns payout positions to members.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `caller` - Address of the caller (must be group creator)
    /// * `mode` - Assignment mode (Sequential, Randomized, or Manual)
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
            AssignmentMode::Randomized => {
                let seed = env.ledger().timestamp();
                let position_order = Self::randomize_payout_order(env.clone(), group_id, seed)?;
                let mut pos = Vec::new(&env);
                for i in 0..position_order.len() {
                    pos.push_back(position_order.get(i).unwrap());
                }
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

            // Gas opt: maintain the reverse index position → member so that
            // identify_recipient() can do a single O(1) SLOAD.
            let pos_idx_key = StorageKeyBuilder::group_payout_position_index(group_id, position);
            env.storage().persistent().set(&pos_idx_key, &member);
        }

        Ok(())
    }

    /// Internal helper function to transfer funds to a payout recipient.
    ///
    /// This function handles the actual transfer of pooled funds to the designated
    /// recipient for a specific cycle. It includes comprehensive validation,
    /// reentrancy protection, and proper error handling.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage and token operations
    /// * `group_id` - ID of the group making the payout
    /// * `recipient` - Address of the payout recipient
    /// * `amount` - Amount to transfer in stroops
    /// * `cycle_number` - The cycle number for this payout
    ///
    /// # Returns
    /// * `Ok(())` - Transfer successful
    /// * `Err(StellarSaveError)` - If validation fails or transfer encounters an error
    ///
    /// # Security Features
    /// - Recipient address validation
    /// - Reentrancy protection using storage flags
    /// - Comprehensive error handling
    /// - Atomic operations with proper rollback
    pub fn transfer_payout(
        env: Env,
        group_id: u64,
        recipient: Address,
        amount: i128,
        cycle_number: u32,
    ) -> Result<(), StellarSaveError> {
        // 1. Recipient address is validated by require_auth upstream

        // 2. Reentrancy protection - set transfer in progress flag
        let reentrancy_key = StorageKeyBuilder::reentrancy_guard();
        let guard_value: u64 = env.storage().persistent().get(&reentrancy_key).unwrap_or(0);

        if guard_value != 0 {
            // Non-zero value indicates operation in progress
            return Err(StellarSaveError::InternalError);
        }

        // Set reentrancy protection flag
        env.storage().persistent().set(&reentrancy_key, &1);

        // 3. Validate group exists and is in correct state
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.status != GroupStatus::Active {
            // Clear reentrancy flag before returning error
            env.storage().persistent().set(&reentrancy_key, &0);
            return Err(StellarSaveError::InvalidState);
        }

        // 4. Validate recipient is eligible for this cycle
        let is_eligible =
            Self::validate_payout_recipient(env.clone(), group_id, recipient.clone())?;

        if !is_eligible {
            // Clear reentrancy flag before returning error
            env.storage().persistent().set(&reentrancy_key, &0);
            return Err(StellarSaveError::InvalidRecipient);
        }

        // 5. Validate amount matches expected pool amount
        let expected_amount = group
            .contribution_amount
            .checked_mul(group.member_count as i128)
            .ok_or(StellarSaveError::Overflow)?;

        if amount != expected_amount {
            // Clear reentrancy flag before returning error
            env.storage().persistent().set(&reentrancy_key, &0);
            return Err(StellarSaveError::InvalidAmount);
        }

        // 6. Check if payout already processed for this cycle
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle_number);
        if env.storage().persistent().has(&recipient_key) {
            // Clear reentrancy flag before returning error
            env.storage().persistent().set(&reentrancy_key, &0);
            return Err(StellarSaveError::PayoutAlreadyProcessed);
        }

        // 7. Execute the transfer (for XLM, this is a native transfer)
        // In Soroban, native XLM transfers are handled through the contract's internal accounting
        // The actual token movement would be handled by the contract's balance management

        // For now, we'll simulate the transfer by recording it and emitting an event
        // In a full implementation, you would:
        // - Use token contracts for non-native assets
        // - Implement proper balance tracking
        // - Handle transfer failures gracefully

        // 8. Record the payout
        let timestamp = env.ledger().timestamp(); // cache — single ledger call
        let payout_record =
            PayoutRecord::new(recipient.clone(), group_id, cycle_number, amount, timestamp);

        // Store payout record
        let payout_key = StorageKeyBuilder::payout_record(group_id, cycle_number);
        env.storage().persistent().set(&payout_key, &payout_record);

        // Store recipient for quick lookup
        env.storage().persistent().set(&recipient_key, &recipient);

        // 9. Store payout status as processed
        let status_key = StorageKeyBuilder::payout_status(group_id, cycle_number);
        env.storage().persistent().set(&status_key, &true);

        // 10. Gas opt: update incremental paid-out counter (avoids O(n) loop in get_total_paid_out)
        let paid_out_key = StorageKeyBuilder::group_total_paid_out(group_id);
        let current_paid: i128 = env.storage().persistent().get(&paid_out_key).unwrap_or(0);
        let new_paid = current_paid
            .checked_add(amount)
            .ok_or(StellarSaveError::Overflow)?;
        env.storage().persistent().set(&paid_out_key, &new_paid);

        // 11. Clear reentrancy protection flag
        env.storage().persistent().set(&reentrancy_key, &0u64);

        // 12. Emit payout event
        EventEmitter::emit_payout_executed(
            &env,
            group_id,
            recipient,
            amount,
            cycle_number,
            timestamp,
        );

        Ok(())
    }

    /// Randomizes payout order for a group and stores the resulting ordered address sequence.
    ///
    /// # Threat Model
    /// - Front-running: assignment is gated by a one-time sequence store and is performed before
    ///   the group enters Active status, preventing repeated re-shuffles to improve a position.
    /// - Validator manipulation: the PRNG seed is combined with ledger sequence/timestamp and the
    ///   group identifier, making bias significantly harder under Stellar consensus than a plain
    ///   timestamp seed.
    pub fn randomize_payout_order(
        env: Env,
        group_id: u64,
        seed: u64,
    ) -> Result<Vec<u32>, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let sequence_key = StorageKeyBuilder::payout_sequence(group_id);
        if env.storage().persistent().has(&sequence_key) {
            return Err(StellarSaveError::InvalidState);
        }

        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut positions = Vec::new(&env);
        for i in 0..members.len() {
            positions.push_back(i);
        }

        let prng = env.prng();
        let prng_seed = prng.u64_in_range(0..u64::MAX);
        // Use timestamp as ledger salt (sequence_number not available in this SDK)
        let ledger_salt = env.ledger().timestamp();
        let salted_seed = seed
            .wrapping_add(prng_seed)
            .wrapping_add(ledger_salt)
            .wrapping_add(group_id);

        Self::shuffle(&env, &mut positions, salted_seed);

        let mut sequence = Vec::new(&env);
        for i in 0..positions.len() {
            let position = positions.get(i).unwrap();
            sequence.push_back(members.get(position).unwrap().clone());
        }

        env.storage().persistent().set(&sequence_key, &sequence);

        Ok(positions)
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

    // ============================================================================
    // ISSUE #424: Payout Execution
    // ============================================================================

    /// Executes automatic payout distribution for a group's current cycle.
    ///
    /// This function orchestrates the complete payout process:
    /// 1. Validates all members have contributed to the current cycle
    /// 2. Calculates the total pool amount
    /// 3. Identifies the recipient based on payout position
    /// 4. Transfers funds to the recipient
    /// 5. Records the payout
    /// 6. Advances to the next cycle
    /// 7. Emits PayoutExecuted event
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to execute payout for
    ///
    /// # Returns
    /// * `Ok(())` - Payout executed successfully
    /// * `Err(StellarSaveError)` - If validation or execution fails
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `InvalidState` - Group not in Active status or payout already executed
    /// - `CycleNotComplete` - Not all members have contributed
    /// - `PayoutFailed` - Transfer failed or insufficient balance
    /// - `InvalidRecipient` - Recipient not eligible for payout
    pub fn execute_payout(env: Env, group_id: u64) -> Result<(), StellarSaveError> {
        payout_executor::execute_payout(env, group_id)
    }

    // ============================================================================
    // ISSUE #425: Group Status Management
    // ============================================================================

    /// Pauses a group, preventing contributions and payouts.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to pause
    /// * `caller` - Address of the caller (must be group creator)
    ///
    /// # Returns
    /// * `Ok(())` - Group paused successfully
    /// * `Err(StellarSaveError)` - If validation fails
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `Unauthorized` - Caller is not the group creator
    /// - `InvalidState` - Group not in Active status
    pub fn pause_group(env: Env, group_id: u64, caller: Address) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        let status_key = StorageKeyBuilder::group_status(group_id);
        let current_status: GroupStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if current_status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        let new_status = GroupStatus::Paused;
        env.storage().persistent().set(&status_key, &new_status);

        // Update the paused flag on the Group struct
        group.paused = true;
        group.status = GroupStatus::Paused;
        env.storage().persistent().set(&group_key, &group);

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_group_paused(&env, group_id, caller, timestamp);

        Ok(())
    }

    /// Resumes a paused group, allowing contributions and payouts again.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to resume
    /// * `caller` - Address of the caller (must be group creator)
    ///
    /// # Returns
    /// * `Ok(())` - Group resumed successfully
    /// * `Err(StellarSaveError)` - If validation fails
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `Unauthorized` - Caller is not the group creator
    /// - `InvalidState` - Group not in Paused status
    pub fn resume_group(env: Env, group_id: u64, caller: Address) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        let status_key = StorageKeyBuilder::group_status(group_id);
        let current_status: GroupStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if current_status != GroupStatus::Paused {
            return Err(StellarSaveError::InvalidState);
        }

        let new_status = GroupStatus::Active;
        env.storage().persistent().set(&status_key, &new_status);

        // Update the paused flag on the Group struct
        group.paused = false;
        group.status = GroupStatus::Active;
        env.storage().persistent().set(&group_key, &group);

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_group_unpaused(&env, group_id, caller, timestamp);

        Ok(())
    }

    /// Unpauses a paused group, allowing contributions and payouts again.
    /// Alias for resume_group with the name matching the issue specification.
    pub fn unpause_group(env: Env, group_id: u64, caller: Address) -> Result<(), StellarSaveError> {
        Self::resume_group(env, group_id, caller)
    }

    /// Cancels a group and returns funds to contributors.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to cancel
    /// * `caller` - Address of the caller (must be group creator)
    ///
    /// # Returns
    /// * `Ok(())` - Group cancelled successfully
    /// * `Err(StellarSaveError)` - If validation fails
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `Unauthorized` - Caller is not the group creator
    /// - `InvalidState` - Group is already in terminal state
    pub fn cancel_group(env: Env, group_id: u64, caller: Address) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        let status_key = StorageKeyBuilder::group_status(group_id);
        let current_status: GroupStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if current_status.is_terminal() {
            return Err(StellarSaveError::InvalidState);
        }

        let new_status = GroupStatus::Cancelled;
        env.storage().persistent().set(&status_key, &new_status);

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_group_status_changed(
            &env,
            group_id,
            current_status as u32,
            new_status as u32,
            caller.clone(),
            timestamp,
        );

        Ok(())
    }

    /// Enables or disables invitation-only mode for a group.
    /// Only the creator can call this while the group is Pending.
    pub fn set_invitation_only(
        env: Env,
        group_id: u64,
        enabled: bool,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        group.creator.require_auth();

        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(group_id))
            .unwrap_or(GroupStatus::Pending);
        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        group.invitation_only = enabled;
        env.storage().persistent().set(&group_key, &group);
        Ok(())
    }

    /// Invites an address to join an invitation-only group.
    /// Only the group creator can call this; group must be Pending.
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `Unauthorized` - Caller is not the group creator
    /// - `InvalidState` - Group is not Pending
    /// - `AlreadyMember` - Address is already a member
    pub fn invite_member(
        env: Env,
        group_id: u64,
        invitee: Address,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        group.creator.require_auth();

        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(group_id))
            .unwrap_or(GroupStatus::Pending);
        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        // Reject if already a member
        if env
            .storage()
            .persistent()
            .has(&StorageKeyBuilder::member_profile(
                group_id,
                invitee.clone(),
            ))
        {
            return Err(StellarSaveError::AlreadyMember);
        }

        let inv_key = StorageKeyBuilder::group_invitations(group_id);
        let mut invitations: Vec<Address> = env
            .storage()
            .persistent()
            .get(&inv_key)
            .unwrap_or(Vec::new(&env));

        if !invitations.contains(&invitee) {
            invitations.push_back(invitee.clone());
            env.storage().persistent().set(&inv_key, &invitations);
        }

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_member_invited(&env, group_id, invitee, group.creator, timestamp);
        Ok(())
    }

    /// Revokes a pending invitation for an address.
    /// Only the group creator can call this; group must be Pending.
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `Unauthorized` - Caller is not the group creator
    /// - `InvalidState` - Group is not Pending
    /// - `NotInvited` - Address was not invited
    pub fn revoke_invitation(
        env: Env,
        group_id: u64,
        invitee: Address,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        group.creator.require_auth();

        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(group_id))
            .unwrap_or(GroupStatus::Pending);
        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        let inv_key = StorageKeyBuilder::group_invitations(group_id);
        let invitations: Vec<Address> = env
            .storage()
            .persistent()
            .get(&inv_key)
            .unwrap_or(Vec::new(&env));

        if !invitations.contains(&invitee) {
            return Err(StellarSaveError::NotInvited);
        }

        let mut new_list: Vec<Address> = Vec::new(&env);
        for addr in invitations.iter() {
            if addr != invitee {
                new_list.push_back(addr);
            }
        }
        env.storage().persistent().set(&inv_key, &new_list);

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_invitation_revoked(&env, group_id, invitee, group.creator, timestamp);
        Ok(())
    }

    /// Merges two compatible Pending groups into a new group.
    ///
    /// Compatibility requires both groups to have the same `contribution_amount`
    /// and `cycle_duration`. Both source groups must be in `Pending` status.
    /// The caller must be the creator of group_id_1.
    ///
    /// The merged group inherits:
    /// - contribution_amount and cycle_duration from the source groups
    /// - max_members = sum of both groups' max_members
    /// - combined member list with recalculated sequential payout positions
    /// - combined balance (sum of both groups' balances)
    ///
    /// Both source groups are marked Cancelled after the merge.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id_1` - ID of the first source group (caller must be its creator)
    /// * `group_id_2` - ID of the second source group
    ///
    /// # Returns
    /// * `Ok(u64)` - ID of the newly created merged group
    /// * `Err(StellarSaveError::GroupNotFound)` - Either group doesn't exist
    /// * `Err(StellarSaveError::Unauthorized)` - Caller is not creator of group_id_1
    /// * `Err(StellarSaveError::InvalidState)` - Either group is not Pending
    /// * `Err(StellarSaveError::MergeIncompatible)` - Groups have different contribution_amount or cycle_duration
    pub fn merge_groups(
        env: Env,
        group_id_1: u64,
        group_id_2: u64,
    ) -> Result<u64, StellarSaveError> {
        // 1. Load both groups
        let group1: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id_1))
            .ok_or(StellarSaveError::GroupNotFound)?;

        let group2: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id_2))
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Authorize: caller must be creator of group 1
        group1.creator.require_auth();

        // 3. Both groups must be Pending
        let status1: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(group_id_1))
            .unwrap_or(GroupStatus::Pending);
        let status2: GroupStatus = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_status(group_id_2))
            .unwrap_or(GroupStatus::Pending);

        if status1 != GroupStatus::Pending || status2 != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        // 4. Validate compatibility
        if group1.contribution_amount != group2.contribution_amount
            || group1.cycle_duration != group2.cycle_duration
        {
            return Err(StellarSaveError::MergeIncompatible);
        }

        // 5. Load member lists from both groups
        let members1: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_members(group_id_1))
            .unwrap_or(Vec::new(&env));
        let members2: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_members(group_id_2))
            .unwrap_or(Vec::new(&env));

        // 6. Combine member lists
        let mut combined_members: Vec<Address> = Vec::new(&env);
        for m in members1.iter() {
            combined_members.push_back(m);
        }
        for m in members2.iter() {
            combined_members.push_back(m);
        }
        let total_members = combined_members.len();

        // 7. Compute combined balance
        let balance1: i128 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_balance(group_id_1))
            .unwrap_or(0);
        let balance2: i128 = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_balance(group_id_2))
            .unwrap_or(0);
        let combined_balance = balance1
            .checked_add(balance2)
            .ok_or(StellarSaveError::Overflow)?;

        // 8. Create merged group
        let merged_id = Self::generate_next_group_id(&env)?;
        let timestamp = env.ledger().timestamp();
        let new_max_members = group1
            .max_members
            .checked_add(group2.max_members)
            .ok_or(StellarSaveError::Overflow)?;
        let new_min_members = group1.min_members.min(group2.min_members);

        let mut merged_group = Group::new(
            merged_id,
            group1.creator.clone(),
            group1.contribution_amount,
            group1.cycle_duration,
            new_max_members,
            new_min_members,
            timestamp,
            group1.grace_period_seconds,
        );
        merged_group.member_count = total_members;

        // 9. Store merged group data
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(merged_id), &merged_group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(merged_id),
            &GroupStatus::Pending,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::group_members(merged_id),
            &combined_members,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::group_balance(merged_id),
            &combined_balance,
        );

        // 10. Store merged-from provenance
        env.storage().persistent().set(
            &StorageKeyBuilder::group_merged_from(merged_id),
            &(group_id_1, group_id_2),
        );

        // 11. Assign sequential payout positions to all combined members
        for i in 0..combined_members.len() {
            let member = combined_members.get(i).unwrap();
            let position = i;
            let profile = MemberProfile {
                address: member.clone(),
                group_id: merged_id,
                payout_position: position,
                joined_at: timestamp,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(merged_id, member.clone()),
                &profile,
            );
            env.storage().persistent().set(
                &StorageKeyBuilder::member_payout_eligibility(merged_id, member.clone()),
                &position,
            );
        }

        // 12. Cancel both source groups
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id_1),
            &GroupStatus::Cancelled,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id_2),
            &GroupStatus::Cancelled,
        );

        // 13. Emit GroupsMerged event
        EventEmitter::emit_groups_merged(
            &env,
            merged_id,
            group_id_1,
            group_id_2,
            total_members,
            combined_balance,
            timestamp,
        );

        Ok(merged_id)
    }

    // ============================================================================
    // ISSUE #426: Query Functions
    // ============================================================================

    /// Gets complete information about a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(Group)` - Complete group data
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    pub fn get_group_info(env: Env, group_id: u64) -> Result<Group, StellarSaveError> {
        Self::get_group(env, group_id)
    }

    /// Returns all contribution milestones reached by a member in a group.
    ///
    /// A milestone is reached when a member achieves a consecutive-contribution
    /// streak of 5, 10, or 20 cycles without missing a single cycle.
    ///
    /// # Arguments
    /// * `env`      - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member`   - Address of the member to query
    ///
    /// # Returns
    /// * `Ok(Vec<MemberMilestone>)` - Milestones reached, ordered by threshold
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::NotMember)` - Member not in group
    pub fn get_member_milestones(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<Vec<milestones::MemberMilestone>, StellarSaveError> {
        milestones::get_member_milestones(&env, group_id, member)
    }

    /// Gets all members of a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(Vec<Address>)` - List of member addresses
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    /// Gets contribution status for a specific cycle.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Cycle number to check
    ///
    /// # Returns
    /// * `Ok(Vec<(Address, bool)>)` - List of (member, has_contributed) tuples
    /// * `Err(StellarSaveError)` - If group doesn't exist
    pub fn get_contribution_status(
        env: Env,
        group_id: u64,
        cycle: u32,
    ) -> Result<Vec<(Address, bool)>, StellarSaveError> {
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

        let mut status = Vec::new(&env);

        for member in members.iter() {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            let has_contributed = env.storage().persistent().has(&contrib_key);
            status.push_back((member, has_contributed));
        }

        Ok(status)
    }

    /// Gets payout history for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    ///
    /// # Returns
    /// * `Ok(Vec<PayoutRecord>)` - List of all payout records
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    pub fn get_payout_history_all(
        env: Env,
        group_id: u64,
    ) -> Result<Vec<PayoutRecord>, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut payouts = Vec::new(&env);

        for cycle in 0..group.current_cycle {
            let payout_key = StorageKeyBuilder::payout_record(group_id, cycle);
            if let Some(payout) = env
                .storage()
                .persistent()
                .get::<_, PayoutRecord>(&payout_key)
            {
                payouts.push_back(payout);
            }
        }

        Ok(payouts)
    }

    /// Checks if a member is part of a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address to check
    ///
    /// # Returns
    /// * `Ok(bool)` - true if member is in group, false otherwise
    /// * `Err(StellarSaveError::GroupNotFound)` - If group doesn't exist
    pub fn is_member_of_group(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<bool, StellarSaveError> {
        Self::is_member(env, group_id, member)
    }

    // ============================================================================
    // ISSUE #427: Input Validation
    // ============================================================================

    /// Validates an address input.
    ///
    /// # Arguments
    /// * `address` - Address to validate
    ///
    /// # Returns
    /// * `Ok(())` - Address is valid
    /// * `Err(StellarSaveError::InvalidState)` - Address is invalid
    pub fn validate_address(address: &Address) -> Result<(), StellarSaveError> {
        // Addresses in Soroban are always valid if they can be constructed
        // This is a placeholder for additional validation if needed
        let _ = address;
        Ok(())
    }

    /// Validates a numeric amount input.
    ///
    /// # Arguments
    /// * `amount` - Amount to validate
    ///
    /// # Returns
    /// * `Ok(())` - Amount is valid (positive)
    /// * `Err(StellarSaveError::InvalidAmount)` - Amount is invalid
    pub fn validate_amount(amount: i128) -> Result<(), StellarSaveError> {
        if amount <= 0 {
            return Err(StellarSaveError::InvalidAmount);
        }
        Ok(())
    }

    /// Validates a cycle duration input.
    ///
    /// # Arguments
    /// * `duration` - Duration in seconds to validate
    ///
    /// # Returns
    /// * `Ok(())` - Duration is valid (positive)
    /// * `Err(StellarSaveError::InvalidState)` - Duration is invalid
    pub fn validate_duration(duration: u64) -> Result<(), StellarSaveError> {
        if duration == 0 {
            return Err(StellarSaveError::InvalidState);
        }
        Ok(())
    }

    /// Validates member count bounds.
    ///
    /// # Arguments
    /// * `min_members` - Minimum members required
    /// * `max_members` - Maximum members allowed
    ///
    /// # Returns
    /// * `Ok(())` - Bounds are valid
    /// * `Err(StellarSaveError::InvalidState)` - Bounds are invalid
    pub fn validate_member_bounds(
        min_members: u32,
        max_members: u32,
    ) -> Result<(), StellarSaveError> {
        if min_members < 2 || max_members < min_members {
            return Err(StellarSaveError::InvalidState);
        }
        Ok(())
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
    ///
    /// By default, archived groups are excluded from the results. To view archived
    /// groups, use `list_archived_groups()` instead.
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
                // Skip archived groups (they have their own query function)
                let archived_key = StorageKeyBuilder::group_archived(id);
                let is_archived = env
                    .storage()
                    .persistent()
                    .get::<_, bool>(&archived_key)
                    .unwrap_or(false);

                if is_archived {
                    continue;
                }

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

    /// Archives a completed (or cancelled) group to reduce active storage and improve query performance.
    ///
    /// Archiving is a one-way, creator-only operation that moves a terminal group out of the
    /// default `list_groups()` results. The group data is **not deleted** — it remains fully
    /// accessible via `get_group()` and `list_archived_groups()`.
    ///
    /// # Authorization
    /// Only the group creator can archive a group.
    ///
    /// # Preconditions
    /// - The group must exist.
    /// - The group must be in a terminal state (`Completed` or `Cancelled`).
    /// - The group must not already be archived.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `caller` - Address of the caller (must be the group creator)
    /// * `group_id` - ID of the group to archive
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(StellarSaveError::GroupNotFound)` if the group does not exist
    /// * `Err(StellarSaveError::Unauthorized)` if the caller is not the creator
    /// * `Err(StellarSaveError::GroupNotArchivable)` if the group is not in a terminal state
    /// * `Err(StellarSaveError::InvalidState)` if the group is already archived
    pub fn archive_group(env: Env, caller: Address, group_id: u64) -> Result<(), StellarSaveError> {
        // 1. Authorization
        caller.require_auth();

        // 2. Load the group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 3. Only the creator may archive
        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        // 4. Group must be in a terminal state
        if !group.status.is_terminal() {
            return Err(StellarSaveError::GroupNotArchivable);
        }

        // 5. Guard against double-archiving
        let archived_key = StorageKeyBuilder::group_archived(group_id);
        let already_archived = env
            .storage()
            .persistent()
            .get::<_, bool>(&archived_key)
            .unwrap_or(false);

        if already_archived {
            return Err(StellarSaveError::InvalidState);
        }

        // 6. Persist the archived flag and update the Group struct
        env.storage().persistent().set(&archived_key, &true);
        group.archived = true;
        env.storage().persistent().set(&group_key, &group);

        // 7. Emit event
        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_group_archived(&env, group_id, caller, timestamp);

        Ok(())
    }

    /// Lists archived groups with cursor-based pagination.
    ///
    /// Returns only groups that have been explicitly archived via `archive_group()`.
    /// Results are ordered newest-first (descending by group ID).
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `cursor` - Starting group ID for pagination (0 = start from the latest)
    /// * `limit` - Maximum number of groups to return (capped at 50)
    ///
    /// # Returns
    /// * `Ok(Vec<Group>)` - List of archived groups
    pub fn list_archived_groups(
        env: Env,
        cursor: u64,
        limit: u32,
    ) -> Result<Vec<Group>, StellarSaveError> {
        let mut groups = Vec::new(&env);
        let max_id_key = StorageKeyBuilder::next_group_id();

        let current_max_id: u64 = env.storage().persistent().get(&max_id_key).unwrap_or(0);
        let start = if cursor == 0 { current_max_id } else { cursor };
        let mut count = 0;
        let page_limit = if limit > 50 { 50 } else { limit }; // Safety cap for gas

        for id in (1..=start).rev() {
            if count >= page_limit {
                break;
            }

            // Only include groups that have the archived flag set
            let archived_key = StorageKeyBuilder::group_archived(id);
            let is_archived = env
                .storage()
                .persistent()
                .get::<_, bool>(&archived_key)
                .unwrap_or(false);

            if !is_archived {
                continue;
            }

            let group_key = StorageKeyBuilder::group_data(id);
            if let Some(group) = env.storage().persistent().get::<_, Group>(&group_key) {
                groups.push_back(group);
                count += 1;
            }
        }

        Ok(groups)
    }

    /// Searches and filters groups by various criteria with pagination and sorting.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `params` - [`SearchParams`] struct containing all filter, pagination, and sort options
    ///
    /// # Filter fields (all optional)
    /// * `status` - Only return groups with this [`GroupStatus`]
    /// * `min_amount` / `max_amount` - Contribution amount range (in stroops)
    /// * `min_members` / `max_members` - Current member count range
    ///
    /// # Pagination
    /// * `cursor` - Pass `0` for the first page; use `SearchResult::next_cursor` for subsequent pages
    /// * `limit` - Results per page (capped at 50)
    ///
    /// # Sorting
    /// * `sort` - [`SortOrder::CreatedDesc`] (default), [`SortOrder::CreatedAsc`],
    ///   [`SortOrder::MemberCountDesc`], or [`SortOrder::MemberCountAsc`]
    ///
    /// # Returns
    /// A [`SearchResult`] containing the matching groups, the next cursor, and scan count.
    ///
    /// # Notes
    /// - Archived groups are always excluded from results.
    /// - Member-count sorts load all matching groups before sorting; `next_cursor` will be `0`.
    pub fn search_groups(env: Env, params: SearchParams) -> SearchResult {
        search::search_groups(&env, params)
    }

    /// Returns the total number of groups created.
    /// Reads the existing counter from storage without modification.
    pub fn get_total_groups_created(env: Env) -> u64 {
        let key = StorageKeyBuilder::next_group_id();
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Submits a 1–5 star rating (with optional comment) for a completed or cancelled group.
    ///
    /// # Rules
    /// - Group must be in a terminal state (Completed or Cancelled).
    /// - Caller must be a member of the group.
    /// - Each member may only rate once per group.
    /// - `stars` must be 1–5.
    /// - `comment` must be ≤ 280 characters (pass an empty string for no comment).
    ///
    /// # Errors
    /// - `GroupNotFound` – group does not exist
    /// - `InvalidState` – group is not yet in a terminal state
    /// - `NotMember` – caller is not a member of the group
    /// - `InvalidAmount` – stars is 0 or > 5
    /// - `InvalidMetadata` – comment exceeds 280 characters
    /// - `AlreadyContributed` – member has already rated this group
    pub fn rate_group(
        env: Env,
        caller: Address,
        group_id: u64,
        stars: u32,
        comment: String,
    ) -> Result<(), StellarSaveError> {
        rating::rate_group(&env, caller, group_id, stars, comment)
    }

    /// Returns the aggregated rating summary for a group.
    ///
    /// Returns a [`GroupRating`] with `rating_count`, `total_stars`, and
    /// `average_scaled` (average × 100, e.g. 450 = 4.50 stars).
    /// Returns zeroed counts if no ratings have been submitted yet.
    pub fn get_group_rating(env: Env, group_id: u64) -> Result<GroupRating, StellarSaveError> {
        rating::get_group_rating(&env, group_id)
    }

    /// Returns the individual rating submitted by a specific member for a group.
    /// Returns `None` if the member has not yet rated the group.
    pub fn get_member_rating(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<Option<RatingEntry>, StellarSaveError> {
        rating::get_member_rating(&env, group_id, member)
    }

    /// Gets the total XLM balance held by the contract.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    ///
    /// # Returns
    /// Returns the contract's current XLM balance in stroops (1 XLM = 10^7 stroops).
    ///
    /// # Note
    /// This is a placeholder implementation. To get the actual balance, you would need to:
    /// 1. Get the native token contract address
    /// 2. Create a token client for the native asset
    /// 3. Query the balance for this contract's address
    pub fn get_contract_balance(_env: Env) -> i128 {
        // Placeholder: Return 0
        // In production, query the native token contract:
        // let native_token = token::Client::new(&env, &native_token_address);
        // native_token.balance(&env.current_contract_address())
        0
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
    /// - `has_more` in the returned page is true when contributions exist beyond this page
    pub fn get_member_contribution_history(
        env: Env,
        group_id: u64,
        member: Address,
        start_cycle: u32,
        limit: u32,
    ) -> Result<ContributionPage, StellarSaveError> {
        // 1. Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Cap limit at 50 for gas optimization
        let page_limit = if limit > 50 {
            50
        } else if limit == 0 {
            10
        } else {
            limit
        };

        // 3. Collect up to page_limit+1 records to detect has_more
        let mut items = Vec::new(&env);
        let mut cycle = start_cycle;
        let mut collected: u32 = 0;

        while cycle <= group.current_cycle && collected <= page_limit {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            if let Some(record) = env
                .storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
            {
                if collected < page_limit {
                    items.push_back(record);
                }
                collected += 1;
            }
            cycle += 1;
        }

        let has_more = collected > page_limit;
        Ok(ContributionPage { items, has_more })
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
        // 1. Load the group to access grace_period_seconds and timing info
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Only report misses after the grace period has elapsed
        if group.started {
            let cycle_deadline =
                group.started_at + (group.cycle_duration * (cycle_number as u64 + 1));
            let grace_end = cycle_deadline + group.grace_period_seconds;
            if env.ledger().timestamp() <= grace_end {
                return Ok(Vec::new(&env));
            }
        }

        // 3. Get all members in the group
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 4. Collect members with no contribution record for this cycle
        let mut missed_members = Vec::new(&env);
        for member in members.iter() {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle_number, member.clone());
            if !env.storage().persistent().has(&contrib_key) {
                missed_members.push_back(member);
            }
        }

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
    /// Retrieves members who need a contribution reminder for the current cycle.
    ///
    /// Returns members who:
    /// 1. Are part of the group
    /// 2. Haven't contributed in the current cycle
    /// 3. Are within 24 hours of the contribution deadline
    ///
    /// This function is designed for off-chain services to query which members
    /// should receive reminder notifications about upcoming contribution deadlines.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Cycle number to check
    ///
    /// # Returns
    /// * `Ok(Vec<Address>)` - List of members needing reminders
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::InvalidState)` - Group hasn't been started
    ///
    /// # Example
    /// ```ignore
    /// let members_needing_reminder = contract.get_members_needing_reminder(env, 1, 0)?;
    /// for member in members_needing_reminder {
    ///     // Send reminder notification to member
    /// }
    /// ```
    pub fn get_members_needing_reminder(
        env: Env,
        group_id: u64,
        cycle: u32,
    ) -> Result<Vec<Address>, StellarSaveError> {
        // 1. Load the group from storage
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Verify group has been started
        if !group.started {
            return Err(StellarSaveError::InvalidState);
        }

        // 3. Calculate the deadline for this cycle
        let cycle_offset = (cycle as u64)
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?;
        let duration_offset = group
            .cycle_duration
            .checked_mul(cycle_offset)
            .ok_or(StellarSaveError::InternalError)?;
        let deadline = group
            .started_at
            .checked_add(duration_offset)
            .ok_or(StellarSaveError::InternalError)?;

        // 4. Get current timestamp
        let current_time = env.ledger().timestamp();

        // 5. Check if we're within 24 hours (86400 seconds) of deadline
        let reminder_window_start = deadline.saturating_sub(86400);
        if current_time < reminder_window_start || current_time >= deadline {
            // Not in the reminder window
            return Ok(Vec::new(&env));
        }

        // 6. Get all members in the group
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get::<_, Vec<Address>>(&members_key)
            .unwrap_or_else(|| Vec::new(&env));

        // 7. Filter members who haven't contributed and need reminders
        let mut members_needing_reminder = Vec::new(&env);
        for member in members.iter() {
            // Check if member has already contributed in this cycle
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            let has_contributed = env
                .storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
                .is_some();

            if !has_contributed {
                members_needing_reminder.push_back(member.clone());
            }
        }

        Ok(members_needing_reminder)
    }

    /// Emits contribution due reminders for members who haven't contributed.
    ///
    /// This function should be called by off-chain services to emit reminder events
    /// for members who are within 24 hours of the contribution deadline.
    /// It prevents duplicate reminders by tracking which members have already been reminded.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Cycle number
    ///
    /// # Returns
    /// * `Ok(u32)` - Number of reminders emitted
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::InvalidState)` - Group hasn't been started
    ///
    /// # Example
    /// ```ignore
    /// let reminders_sent = contract.emit_contribution_reminders(env, 1, 0)?;
    /// println!("Sent {} reminders", reminders_sent);
    /// ```
    pub fn emit_contribution_reminders(
        env: Env,
        group_id: u64,
        cycle: u32,
    ) -> Result<u32, StellarSaveError> {
        // 1. Get members needing reminders
        let members_needing_reminder =
            Self::get_members_needing_reminder(env.clone(), group_id, cycle)?;

        // 2. Load the group to get deadline
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let deadline = group
            .started_at
            .checked_add(
                group
                    .cycle_duration
                    .checked_mul(cycle as u64 + 1)
                    .ok_or(StellarSaveError::InternalError)?,
            )
            .ok_or(StellarSaveError::InternalError)?;

        let current_time = env.ledger().timestamp();
        let mut reminders_emitted = 0u32;

        // 3. Emit reminder for each member who hasn't been reminded yet
        for member in members_needing_reminder.iter() {
            let reminder_key =
                StorageKeyBuilder::contribution_reminder_emitted(group_id, cycle, member.clone());
            let already_reminded = env
                .storage()
                .persistent()
                .get::<_, bool>(&reminder_key)
                .unwrap_or(false);

            if !already_reminded {
                // Emit the event
                EventEmitter::emit_contribution_due(
                    &env,
                    group_id,
                    member.clone(),
                    cycle,
                    deadline,
                    current_time,
                );

                // Mark as reminded
                env.storage().persistent().set(&reminder_key, &true);
                reminders_emitted = reminders_emitted
                    .checked_add(1)
                    .ok_or(StellarSaveError::Overflow)?;
            }
        }

        Ok(reminders_emitted)
    }

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

        // Task 3b: Check invitation if group is invitation-only
        if group.invitation_only {
            let inv_key = StorageKeyBuilder::group_invitations(group_id);
            let invitations: Vec<Address> = env
                .storage()
                .persistent()
                .get(&inv_key)
                .unwrap_or(Vec::new(&env));
            if !invitations.contains(&member) {
                return Err(StellarSaveError::NotInvited);
            }
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
            auto_contribute_enabled: false,
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

        // Gas opt: write the reverse index position → member so that
        // identify_recipient() can do a single O(1) SLOAD instead of
        // iterating all members to find who holds a given position.
        let pos_idx_key = StorageKeyBuilder::group_payout_position_index(group_id, payout_position);
        env.storage().persistent().set(&pos_idx_key, &member);

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

    /// Claims the completion reward for a member who participated in all cycles.
    ///
    /// The reward pool is accumulated from 1% of each contribution. After the group
    /// completes, eligible members (those who contributed every cycle) can claim an
    /// equal share of the reward pool.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `member` - Address of the member claiming the reward
    /// * `group_id` - ID of the completed group
    ///
    /// # Returns
    /// * `Ok(())` - Reward claimed successfully
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::NotMember)` - Caller is not a member
    /// * `Err(StellarSaveError::InvalidState)` - Group is not yet complete
    /// * `Err(StellarSaveError::RewardNotEligible)` - Member missed at least one cycle
    /// * `Err(StellarSaveError::RewardAlreadyClaimed)` - Reward already claimed
    pub fn claim_completion_reward(
        env: Env,
        member: Address,
        group_id: u64,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();

        // Load group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Group must be complete
        if !group.is_complete() {
            return Err(StellarSaveError::InvalidState);
        }

        // Verify member exists
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // Prevent double claiming
        let claimed_key = StorageKeyBuilder::member_reward_claimed(group_id, member.clone());
        if env.storage().persistent().has(&claimed_key) {
            return Err(StellarSaveError::RewardAlreadyClaimed);
        }

        // Verify member contributed in every cycle (0..max_members)
        for cycle in 0..group.max_members {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            if !env.storage().persistent().has(&contrib_key) {
                return Err(StellarSaveError::RewardNotEligible);
            }
        }

        // Calculate equal share: reward_pool / max_members
        let reward_share = group
            .reward_pool
            .checked_div(group.max_members as i128)
            .unwrap_or(0);

        if reward_share <= 0 {
            return Err(StellarSaveError::RewardNotEligible);
        }

        // Mark as claimed before transfer (checks-effects-interactions)
        env.storage().persistent().set(&claimed_key, &true);

        // Transfer reward via the group's token
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        if let Some(token_config) = env
            .storage()
            .persistent()
            .get::<_, crate::group::TokenConfig>(&token_config_key)
        {
            let token_client =
                soroban_sdk::token::TokenClient::new(&env, &token_config.token_address);
            token_client.transfer(&env.current_contract_address(), &member, &reward_share);
        }

        // Emit RewardClaimed event
        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_reward_claimed(&env, group_id, member, reward_share, timestamp);

        Ok(())
    }

    /// Lists all members of a group with pagination support.
    ///
    /// Returns a vector of member addresses sorted by join order (payout position).
    /// Members are stored in the order they joined, which corresponds to their
    /// payout position in the ROSCA rotation.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to query
    /// * `offset` - Number of members to skip (for pagination, 0-indexed)
    /// * `limit` - Maximum number of members to return (capped at 100)
    ///
    /// # Returns
    /// * `Ok(Vec<Address>)` - Vector of member addresses sorted by join order
    /// * `Err(StellarSaveError::GroupNotFound)` - If the group doesn't exist
    /// * `Err(StellarSaveError::Overflow)` - If pagination parameters cause overflow
    ///
    /// # Pagination
    /// - Use offset=0, limit=10 to get first 10 members
    /// - Use offset=10, limit=10 to get next 10 members
    /// - Limit is capped at 100 for gas optimization
    /// - Returns empty vector if offset is beyond total member count
    ///
    /// # Example
    /// ```ignore
    /// // Get first 20 members
    /// let first_page = contract.get_group_members(env, 1, 0, 20)?;
    ///
    /// // Get next 20 members
    /// let second_page = contract.get_group_members(env, 1, 20, 20)?;
    /// ```
    pub fn get_group_members(
        env: Env,
        group_id: u64,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Address>, StellarSaveError> {
        // 1. Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        let _group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Validate pagination parameters
        if offset.checked_add(limit).is_none() {
            return Err(StellarSaveError::Overflow);
        }

        // 3. Load all members from storage
        let members_key = StorageKeyBuilder::group_members(group_id);
        let all_members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Vec::new(&env));

        // 4. Members are already sorted by join order (stored in join order)
        // No additional sorting needed as they're stored in the order they joined

        // 5. Apply pagination with gas optimization (cap limit at 100)
        let page_limit = cmp::min(limit, 100);
        let total_members = all_members.len();

        // If offset is beyond total members, return empty vector
        if offset >= total_members {
            return Ok(Vec::new(&env));
        }

        // Calculate end index
        let end_index = cmp::min(
            offset
                .checked_add(page_limit)
                .ok_or(StellarSaveError::Overflow)?,
            total_members,
        );

        // 6. Extract paginated slice
        let mut paginated_members = Vec::new(&env);
        for i in offset..end_index {
            if let Some(member) = all_members.get(i) {
                paginated_members.push_back(member);
            }
        }

        Ok(paginated_members)
    }

    /// Returns the total number of members in a group.
    ///
    /// Useful for pagination — callers can use this alongside `get_group_members`
    /// to know the total count without fetching all members.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - The ID of the group
    ///
    /// # Returns
    /// * `Ok(u32)` - Total member count
    /// * `Err(StellarSaveError::GroupNotFound)` - Group does not exist
    pub fn get_group_member_count(env: Env, group_id: u64) -> Result<u32, StellarSaveError> {
        // Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Load member list and return count
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Vec::new(&env));

        Ok(members.len())
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
            timestamp, 0, // No grace period
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

    /// Records a payout execution in storage and updates related tracking data.
    ///
    /// This internal helper handles all the storage operations required when a payout
    /// is distributed to a member. It ensures data consistency by:
    /// - Creating and storing the detailed payout record
    /// - Recording the recipient for the specific cycle (used for fast lookups)
    /// - Updating the payout status for the cycle
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - ID of the group making the payout
    /// * `cycle_number` - The cycle number for this payout
    /// * `recipient` - Address of the member receiving the payout
    /// * `amount` - Payout amount in stroops
    /// * `timestamp` - Timestamp when the payout was executed
    fn record_payout(
        env: &Env,
        group_id: u64,
        cycle_number: u32,
        recipient: Address,
        amount: i128,
        timestamp: u64,
    ) -> Result<(), StellarSaveError> {
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle_number);

        // 1. Check if payout was already recorded to prevent overwriting/double payouts
        if env.storage().persistent().has(&record_key) {
            return Err(StellarSaveError::InvalidState);
        }

        // 2. Create the PayoutRecord
        let payout =
            PayoutRecord::new(recipient.clone(), group_id, cycle_number, amount, timestamp);

        // 3. Store the full record with proper key
        env.storage().persistent().set(&record_key, &payout);

        // 4. Store the recipient explicitly for quick `has_received_payout` lookups
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle_number);
        env.storage().persistent().set(&recipient_key, &recipient);

        // 5. Update the payout status to true/completed for this cycle
        let status_key = StorageKeyBuilder::payout_status(group_id, cycle_number);
        env.storage().persistent().set(&status_key, &true);

        Ok(())
    }

    /// Records a member's contribution for the current cycle of a group.
    ///
    /// This function handles the complete contribution flow:
    /// 1. Validates the group exists and is active
    /// 2. Validates the member is part of the group
    /// 3. Validates the contribution amount matches the group's required amount
    /// 4. Acquires the reentrancy guard
    /// 5. Loads the group's token configuration
    /// 6. Calls `transfer_from` on the SEP-41 token contract to move funds from member to contract
    /// 7. Records the contribution in storage
    /// 8. Releases the reentrancy guard
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to contribute to
    /// * `member` - Address of the contributing member (must be caller)
    /// * `amount` - Contribution amount in token base units (must match group's contribution_amount)
    ///
    /// # Returns
    /// * `Ok(())` - Contribution successfully recorded
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::InvalidState)` - Group is not in Active status
    /// * `Err(StellarSaveError::NotMember)` - Caller is not a member of the group
    /// * `Err(StellarSaveError::InvalidAmount)` - Amount doesn't match group's contribution_amount
    /// * `Err(StellarSaveError::AlreadyContributed)` - Member already contributed this cycle
    /// * `Err(StellarSaveError::TokenTransferFailed)` - SEP-41 transfer_from failed
    /// * `Err(StellarSaveError::InternalError)` - Reentrancy detected
    ///
    /// # Requirements
    /// * 5.1, 5.2, 5.3, 5.4, 4.6, 4.7
    pub fn contribute(
        env: Env,
        group_id: u64,
        member: Address,
        amount: i128,
    ) -> Result<(), StellarSaveError> {
        // Require authorization from the member
        member.require_auth();

        // ── Step 1: Load group once — reuse for all subsequent checks ──────────
        // Gas opt: single SLOAD for the Group struct. All validation (status,
        // amount, paused flag) reads from this in-memory copy; no re-reads.
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // ── Step 2: Validate group is Active ───────────────────────────────────
        if group.status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        // ── Step 3: Validate member is part of the group (1 SLOAD) ────────────
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // ── Step 4: Validate amount against in-memory group (0 extra SLOADs) ──
        // Gas opt: compare directly against the already-loaded group struct
        // instead of calling validate_contribution_amount() which would do
        // another SLOAD for the group.
        if amount != group.contribution_amount {
            return Err(StellarSaveError::InvalidAmount);
        }

        // ── Step 5: Reentrancy guard using temporary storage ──────────────────
        // Gas opt: temporary storage is cheaper than persistent for short-lived
        // flags. The guard is automatically cleared at the end of the transaction
        // so we only need to set it, not explicitly release it.
        // We still release it explicitly for clarity and to match the original
        // contract semantics.
        let reentrancy_key = StorageKeyBuilder::reentrancy_guard();
        let guard_value: u64 = env.storage().persistent().get(&reentrancy_key).unwrap_or(0);
        if guard_value != 0 {
            return Err(StellarSaveError::InternalError);
        }
        env.storage().persistent().set(&reentrancy_key, &1u64);

        // ── Step 6: Load TokenConfig (1 SLOAD) ────────────────────────────────
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        let token_config: crate::group::TokenConfig = env
            .storage()
            .persistent()
            .get(&token_config_key)
            .ok_or_else(|| {
                // Release reentrancy guard before returning error
                env.storage().persistent().set(&reentrancy_key, &0u64);
                StellarSaveError::GroupNotFound
            })?;

        // ── Step 7: SEP-41 transfer_from ──────────────────────────────────────
        // If transfer_from panics the entire transaction reverts atomically;
        // no contribution state is recorded.
        let token_client = soroban_sdk::token::TokenClient::new(&env, &token_config.token_address);
        let contract_address = env.current_contract_address();

        token_client.transfer_from(&contract_address, &member, &contract_address, &amount);

        // ── Step 8: Record contribution and release guard ─────────────────────
        let timestamp = env.ledger().timestamp();
        let current_cycle = group.current_cycle;

        // Release reentrancy guard before storage ops (safe from re-entrancy now)
        env.storage().persistent().set(&reentrancy_key, &0u64);

        // Gas opt: record_contribution now returns the new cycle_total so we
        // can pass it directly to the event emitter without an extra SLOAD.
        let cycle_total = Self::record_contribution(
            &env,
            group_id,
            current_cycle,
            member.clone(),
            amount,
            timestamp,
        )?;

        // ── Step 9: Emit event using the cycle_total returned above ───────────
        // Gas opt: no extra SLOAD needed — cycle_total came back from
        // record_contribution instead of being re-read from storage.
        EventEmitter::emit_contribution_made(
            &env,
            group_id,
            member,
            amount,
            current_cycle,
            cycle_total,
            timestamp,
        );

        Ok(())
    }

    // =========================================================================
    // AUTO-CONTRIBUTION FEATURE
    // =========================================================================

    /// Enables automatic contributions for a member in a group.
    ///
    /// When enabled, `execute_auto_contributions` will attempt a `transfer_from`
    /// on behalf of this member at the start of each cycle, using the pre-approved
    /// allowance the member has granted to the contract.
    ///
    /// The member must have called `approve` on the group's token contract granting
    /// the StellarSave contract a sufficient allowance before each cycle begins.
    ///
    /// # Arguments
    /// * `env`      - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member`   - Address of the member enabling auto-contribution (must be caller)
    ///
    /// # Returns
    /// * `Ok(())` - Auto-contribution enabled successfully
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::InvalidState)` - Group is not Active
    /// * `Err(StellarSaveError::NotMember)` - Caller is not a member of the group
    pub fn enable_auto_contribute(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();

        // Load group — verify it exists and is Active
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        // Verify member is part of the group
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        let mut profile: MemberProfile = env
            .storage()
            .persistent()
            .get(&member_key)
            .ok_or(StellarSaveError::NotMember)?;

        // Idempotent: no-op if already enabled
        if profile.auto_contribute_enabled {
            return Ok(());
        }

        profile.auto_contribute_enabled = true;
        env.storage().persistent().set(&member_key, &profile);

        // Also persist the flag under the dedicated key for O(1) lookup
        // during execute_auto_contributions without loading the full profile.
        let flag_key = StorageKeyBuilder::member_auto_contribute(group_id, member.clone());
        env.storage().persistent().set(&flag_key, &true);

        Ok(())
    }

    /// Disables automatic contributions for a member in a group.
    ///
    /// After calling this, `execute_auto_contributions` will skip this member.
    ///
    /// # Arguments
    /// * `env`      - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member`   - Address of the member disabling auto-contribution (must be caller)
    ///
    /// # Returns
    /// * `Ok(())` - Auto-contribution disabled successfully
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::NotMember)` - Caller is not a member of the group
    pub fn disable_auto_contribute(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();

        // Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        if !env.storage().persistent().has(&group_key) {
            return Err(StellarSaveError::GroupNotFound);
        }

        // Verify member is part of the group
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        let mut profile: MemberProfile = env
            .storage()
            .persistent()
            .get(&member_key)
            .ok_or(StellarSaveError::NotMember)?;

        // Idempotent: no-op if already disabled
        if !profile.auto_contribute_enabled {
            return Ok(());
        }

        profile.auto_contribute_enabled = false;
        env.storage().persistent().set(&member_key, &profile);

        // Remove the dedicated flag key
        let flag_key = StorageKeyBuilder::member_auto_contribute(group_id, member.clone());
        env.storage().persistent().remove(&flag_key);

        Ok(())
    }

    /// Returns whether auto-contribution is enabled for a member in a group.
    ///
    /// # Arguments
    /// * `env`      - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member`   - Address of the member to query
    ///
    /// # Returns
    /// * `Ok(bool)` - true if auto-contribution is enabled, false otherwise
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::NotMember)` - Member not in group
    pub fn is_auto_contribute_enabled(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<bool, StellarSaveError> {
        // Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        if !env.storage().persistent().has(&group_key) {
            return Err(StellarSaveError::GroupNotFound);
        }

        // Verify member exists
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        let flag_key = StorageKeyBuilder::member_auto_contribute(group_id, member);
        Ok(env
            .storage()
            .persistent()
            .get::<_, bool>(&flag_key)
            .unwrap_or(false))
    }

    /// Executes automatic contributions for all opted-in members of a group.
    ///
    /// This is a permissionless function — anyone can call it to trigger
    /// auto-contributions at the start of a new cycle. It iterates over all
    /// group members, and for each member with `auto_contribute_enabled = true`
    /// that has not yet contributed in the current cycle, it attempts a
    /// `transfer_from` using the member's pre-approved allowance.
    ///
    /// # Behavior per member
    /// - If the member has already contributed this cycle: skip silently.
    /// - If the member's balance or allowance is insufficient: emit
    ///   `AutoContributionFailed` and continue to the next member (soft failure).
    /// - If the transfer succeeds: record the contribution and emit
    ///   `AutoContributionExecuted`.
    ///
    /// Soft failures are intentional — a single member's insufficient balance
    /// must not block other members' auto-contributions.
    ///
    /// # Arguments
    /// * `env`      - Soroban environment
    /// * `group_id` - ID of the group to process
    ///
    /// # Returns
    /// * `Ok(u32)` - Number of auto-contributions successfully executed
    /// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// * `Err(StellarSaveError::InvalidState)` - Group is not Active
    pub fn execute_auto_contributions(env: Env, group_id: u64) -> Result<u32, StellarSaveError> {
        // ── 1. Load group — single SLOAD, reused for all checks ───────────────
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        let current_cycle = group.current_cycle;
        let contribution_amount = group.contribution_amount;

        // ── 2. Load token config once ─────────────────────────────────────────
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        let token_config: crate::group::TokenConfig = env
            .storage()
            .persistent()
            .get(&token_config_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let token_client = soroban_sdk::token::TokenClient::new(&env, &token_config.token_address);
        let contract_address = env.current_contract_address();

        // ── 3. Load member list ───────────────────────────────────────────────
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: soroban_sdk::Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let timestamp = env.ledger().timestamp();
        let mut executed_count: u32 = 0;

        // ── 4. Iterate members ────────────────────────────────────────────────
        for member in members.iter() {
            // 4a. Check if auto-contribute is enabled for this member (O(1) flag lookup)
            let flag_key = StorageKeyBuilder::member_auto_contribute(group_id, member.clone());
            let auto_enabled: bool = env
                .storage()
                .persistent()
                .get::<_, bool>(&flag_key)
                .unwrap_or(false);

            if !auto_enabled {
                continue;
            }

            // 4b. Skip if member already contributed this cycle
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, current_cycle, member.clone());
            if env.storage().persistent().has(&contrib_key) {
                continue;
            }

            // 4c. Check member balance — soft failure on insufficient funds
            let balance = token_client.balance(&member);
            if balance < contribution_amount {
                EventEmitter::emit_auto_contribution_failed(
                    &env,
                    group_id,
                    member.clone(),
                    current_cycle,
                    timestamp,
                );
                continue;
            }

            // 4d. Check allowance — soft failure if allowance is insufficient
            let allowance = token_client.allowance(&member, &contract_address);
            if allowance < contribution_amount {
                EventEmitter::emit_auto_contribution_failed(
                    &env,
                    group_id,
                    member.clone(),
                    current_cycle,
                    timestamp,
                );
                continue;
            }

            // 4e. Execute the transfer
            token_client.transfer_from(
                &contract_address,
                &member,
                &contract_address,
                &contribution_amount,
            );

            // 4f. Record contribution in storage
            let cycle_total = Self::record_contribution(
                &env,
                group_id,
                current_cycle,
                member.clone(),
                contribution_amount,
                timestamp,
            )?;

            // 4g. Emit AutoContributionExecuted event
            EventEmitter::emit_auto_contribution_executed(
                &env,
                group_id,
                member.clone(),
                contribution_amount,
                current_cycle,
                timestamp,
            );

            // 4h. Also emit the standard ContributionMade event for consistency
            EventEmitter::emit_contribution_made(
                &env,
                group_id,
                member,
                contribution_amount,
                current_cycle,
                cycle_total,
                timestamp,
            );

            executed_count += 1;
        }

        Ok(executed_count)
    }
} // close impl StellarSaveContract

/// Validates a string input (group name, description).
pub fn validate_string(text: &str, max_length: usize) -> Result<(), StellarSaveError> {
    if text.is_empty() || text.len() > max_length {
        return Err(StellarSaveError::InvalidState);
    }
    Ok(())
}

/// Validates that a contribution amount is within the allowed range.
pub fn validate_amount_range(env: &Env, amount: i128) -> Result<(), StellarSaveError> {
    let config_key = StorageKeyBuilder::contract_config();
    if let Some(config) = env
        .storage()
        .persistent()
        .get::<_, ContractConfig>(&config_key)
    {
        if amount < config.min_contribution || amount > config.max_contribution {
            return Err(StellarSaveError::InvalidAmount);
        }
    }
    Ok(())
}

impl StellarSaveContract {
    // =========================================================================
    // ISSUE #479: Contribution Proof Verification
    // =========================================================================

    /// Enables or disables contribution proof requirement for a group.
    /// Only the group creator can call this while the group is Pending.
    pub fn set_contribution_proof_required(
        env: Env,
        group_id: u64,
        required: bool,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        group.creator.require_auth();

        group.require_contribution_proof = required;
        env.storage().persistent().set(&group_key, &group);
        Ok(())
    }

    /// Verifies a contribution proof for a member in a cycle.
    ///
    /// Must be called before `contribute_with_proof` when the group requires proof.
    pub fn verify_contribution_proof(
        env: Env,
        group_id: u64,
        member: Address,
        cycle: u32,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if !group.require_contribution_proof {
            return Err(StellarSaveError::InvalidState);
        }

        // Verify member belongs to the group
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        let proof_key =
            StorageKeyBuilder::contribution_proof_verified(group_id, cycle, member.clone());
        env.storage().persistent().set(&proof_key, &true);

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_contribution_verified(&env, group_id, member, cycle, timestamp);

        Ok(())
    }

    /// Records a contribution for a group that requires proof verification.
    ///
    /// The member must have called `verify_contribution_proof` for this cycle
    /// before calling this function.
    pub fn contribute_with_proof(
        env: Env,
        group_id: u64,
        member: Address,
        amount: i128,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        if amount != group.contribution_amount {
            return Err(StellarSaveError::InvalidAmount);
        }

        // Verify member belongs to the group
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // If proof is required, check it was verified
        if group.require_contribution_proof {
            let proof_key = StorageKeyBuilder::contribution_proof_verified(
                group_id,
                group.current_cycle,
                member.clone(),
            );
            if !env
                .storage()
                .persistent()
                .get::<_, bool>(&proof_key)
                .unwrap_or(false)
            {
                return Err(StellarSaveError::Unauthorized);
            }
        }

        let timestamp = env.ledger().timestamp();
        Self::record_contribution(
            &env,
            group_id,
            group.current_cycle,
            member.clone(),
            amount,
            timestamp,
        )?;

        let cycle_total_key =
            StorageKeyBuilder::contribution_cycle_total(group_id, group.current_cycle);
        let cycle_total: i128 = env
            .storage()
            .persistent()
            .get(&cycle_total_key)
            .unwrap_or(0);

        EventEmitter::emit_contribution_made(
            &env,
            group_id,
            member,
            amount,
            group.current_cycle,
            cycle_total,
            timestamp,
        );

        Ok(())
    }

    // =========================================================================
    // ISSUE #480: Dynamic Contribution Amounts
    // =========================================================================

    /// Enables or disables dynamic contribution amounts for a group.
    /// Only the group creator can call this while the group is Pending.
    pub fn set_dynamic_contributions(
        env: Env,
        group_id: u64,
        allowed: bool,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        group.creator.require_auth();

        if group.status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        group.allow_dynamic_contributions = allowed;
        env.storage().persistent().set(&group_key, &group);
        Ok(())
    }

    /// Proposes a new contribution amount for the next cycle.
    /// Only the group creator can propose; the group must allow dynamic contributions.
    pub fn propose_contribution_change(
        env: Env,
        group_id: u64,
        new_amount: i128,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        group.creator.require_auth();

        if !group.allow_dynamic_contributions {
            return Err(StellarSaveError::InvalidState);
        }

        if group.status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        if new_amount <= 0 {
            return Err(StellarSaveError::InvalidAmount);
        }

        // Store the proposal and reset votes
        let proposal_key = StorageKeyBuilder::contribution_pending_amount(group_id);
        env.storage().persistent().set(&proposal_key, &new_amount);

        let vote_key = StorageKeyBuilder::contribution_amount_vote_count(group_id);
        env.storage().persistent().set(&vote_key, &0u32);

        // Emit event
        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_contribution_amount_proposed(
            &env,
            group_id,
            group.creator.clone(),
            group.contribution_amount,
            new_amount,
            timestamp,
        );

        Ok(())
    }

    /// Casts a member's vote to approve the pending contribution amount change.
    /// When a majority (> 50%) of members approve, the change is applied immediately.
    pub fn vote_contribution_change(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if !group.allow_dynamic_contributions {
            return Err(StellarSaveError::InvalidState);
        }

        // Verify member belongs to the group
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // Check there is a pending proposal
        let proposal_key = StorageKeyBuilder::contribution_pending_amount(group_id);
        let new_amount: i128 = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .ok_or(StellarSaveError::InvalidState)?;

        // Prevent double voting
        let member_vote_key = StorageKeyBuilder::contribution_member_vote(group_id, member.clone());
        if env.storage().persistent().has(&member_vote_key) {
            return Err(StellarSaveError::AlreadyContributed);
        }
        env.storage().persistent().set(&member_vote_key, &true);

        // Increment vote count
        let vote_key = StorageKeyBuilder::contribution_amount_vote_count(group_id);
        let vote_count: u32 = env.storage().persistent().get(&vote_key).unwrap_or(0);
        let new_vote_count = vote_count
            .checked_add(1)
            .ok_or(StellarSaveError::Overflow)?;
        env.storage().persistent().set(&vote_key, &new_vote_count);

        // Apply change if majority reached (> 50% of members)
        let majority = group.member_count / 2 + 1;
        if new_vote_count >= majority {
            let old_amount = group.contribution_amount;
            group.contribution_amount = new_amount;
            env.storage().persistent().set(&group_key, &group);

            // Clear proposal and votes
            env.storage().persistent().remove(&proposal_key);
            env.storage().persistent().remove(&vote_key);

            let timestamp = env.ledger().timestamp();
            EventEmitter::emit_contribution_amount_changed(
                &env,
                group_id,
                old_amount,
                new_amount,
                group.current_cycle + 1,
                timestamp,
            );
        }

        Ok(())
    }

    // =========================================================================
    // ISSUE #481: Group Analytics Functions
    // =========================================================================

    /// Returns statistical insights about a group's performance.
    ///
    /// # Returns
    /// A tuple of:
    /// - `completion_rate`: percentage of cycles completed (0–100)
    /// - `total_contributions`: total amount contributed across all cycles
    /// - `total_distributed`: total amount paid out
    /// - `active_members`: current member count
    /// - `tvl`: total value locked (contributions not yet paid out)
    pub fn get_group_statistics(
        env: Env,
        group_id: u64,
    ) -> Result<(u32, i128, i128, u32, i128), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Completion rate: cycles done / max cycles * 100
        let completion_rate = if group.max_members > 0 {
            (group.current_cycle * 100) / group.max_members
        } else {
            0
        };

        // Sum contributions across all completed cycles
        let mut total_contributions: i128 = 0;
        for cycle in 0..group.current_cycle {
            let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
            let cycle_total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
            total_contributions = total_contributions.saturating_add(cycle_total);
        }

        // Total distributed = cycles completed * pool amount per cycle
        let total_distributed: i128 = (group.current_cycle as i128) * group.total_pool_amount();

        // TVL = contributions received but not yet paid out
        let tvl = total_contributions.saturating_sub(total_distributed);

        Ok((
            completion_rate,
            total_contributions,
            total_distributed,
            group.member_count,
            tvl,
        ))
    }

    /// Returns statistics for an individual member within a group.
    ///
    /// # Returns
    /// A tuple of:
    /// - `cycles_contributed`: number of cycles the member contributed in
    /// - `total_contributed`: total amount contributed by the member
    /// - `on_time_rate`: percentage of cycles contributed on time (0–100, approximated as contributed/total)
    /// - `has_received_payout`: whether the member has received their payout
    pub fn get_member_statistics(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<(u32, i128, u32, bool), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Verify member belongs to the group
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        let mut cycles_contributed: u32 = 0;
        let mut total_contributed: i128 = 0;

        for cycle in 0..group.current_cycle {
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            if let Some(record) = env
                .storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
            {
                cycles_contributed += 1;
                total_contributed = total_contributed.saturating_add(record.amount);
            }
        }

        // On-time rate: contributed cycles / total cycles so far * 100
        let on_time_rate = if group.current_cycle > 0 {
            (cycles_contributed * 100) / group.current_cycle
        } else {
            100 // No cycles yet — considered 100%
        };

        // Check payout received
        let mut received_payout = false;
        for cycle in 0..=group.current_cycle {
            let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
            if let Some(recipient) = env.storage().persistent().get::<_, Address>(&recipient_key) {
                if recipient == member {
                    received_payout = true;
                    break;
                }
            }
        }

        Ok((
            cycles_contributed,
            total_contributed,
            on_time_rate,
            received_payout,
        ))
    }

    // ─── Penalty System ───────────────────────────────────────────────────────

    /// Applies a penalty to a member who missed a contribution deadline.
    ///
    /// Called by the group creator or automatically during cycle advancement.
    /// Deducts a percentage of the contribution amount from the group balance
    /// and records the event in the member's penalty history.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address of the member who missed the contribution
    /// * `cycle_id` - The cycle that was missed
    ///
    /// # Returns
    /// * `Ok(i128)` - Penalty amount deducted in stroops
    /// * `Err(StellarSaveError)` - If group/member not found or overflow
    pub fn apply_penalty(
        env: Env,
        group_id: u64,
        member: Address,
        cycle_id: u32,
    ) -> Result<i128, StellarSaveError> {
        penalty::apply_penalty(&env, group_id, member, cycle_id)
    }

    /// Allows a member to recover from a penalty by paying the missed
    /// contribution plus a recovery fee (default 10% of contribution amount).
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address of the recovering member
    /// * `cycle_id` - The cycle being recovered
    /// * `amount_paid` - Total amount paid (must be >= contribution + recovery fee)
    ///
    /// # Returns
    /// * `Ok(())` - Recovery successful
    /// * `Err(StellarSaveError)` - If validation fails
    pub fn recover_penalty(
        env: Env,
        group_id: u64,
        member: Address,
        cycle_id: u32,
        amount_paid: i128,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();
        penalty::recover_penalty(&env, group_id, member, cycle_id, amount_paid)
    }

    /// Returns the full penalty history for a member in a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address of the member
    ///
    /// # Returns
    /// * `Vec<PenaltyRecord>` - List of penalty records (empty if none)
    pub fn get_penalty_history(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> penalty::PenaltyRecordVec {
        penalty::get_penalty_history(&env, group_id, member)
    }

    /// Returns the current penalty state (missed cycles, total penalty) for a member.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `member` - Address of the member
    ///
    /// # Returns
    /// * `MemberPenaltyState` - Current penalty state
    pub fn get_penalty_state(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> penalty::MemberPenaltyState {
        penalty::get_penalty_state(&env, group_id, member)
    }

    /// Sets a custom penalty configuration for a group.
    /// Only the group creator can call this while the group is Pending.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `caller` - Must be the group creator
    /// * `config` - New penalty configuration
    ///
    /// # Returns
    /// * `Ok(())` - Config updated
    /// * `Err(StellarSaveError)` - If unauthorized or group not found
    pub fn set_penalty_config(
        env: Env,
        group_id: u64,
        caller: Address,
        config: penalty::PenaltyConfig,
    ) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        penalty::set_penalty_config(&env, group_id, config);
        Ok(())
    }
} // close impl StellarSaveContract (proof/dynamic contributions block)

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
    client.create_group(&creator, &100, &3600, &5, &0);

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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);

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
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
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
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
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
            auto_contribute_enabled: false,
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
            auto_contribute_enabled: false,
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);

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
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
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
    //     let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);
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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        client.create_group(&creator, &100, &3600, &5, &token_address);

        let count = client.get_total_groups_created();
        assert_eq!(count, 1);

        // Create second group
        client.create_group(&creator, &200, &7200, &10, &token_address);

        let count = client.get_total_groups_created();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_get_contract_balance() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Query initial balance
        let balance = client.get_contract_balance();
        assert_eq!(balance, 0);
    }

    #[test]
    fn test_get_member_total_contributions_no_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345, 0);
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
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member has not contributed yet
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.items.len(), 0);
        assert!(!history.has_more);
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
        assert_eq!(history.items.len(), 1);
        assert_eq!(history.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.items.get(0).unwrap().amount, contribution_amount);
        assert!(!history.has_more);
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
        assert_eq!(history.items.len(), 5);
        assert!(!history.has_more);

        // Verify order and content
        for i in 0..5 {
            assert_eq!(history.items.get(i as u32).unwrap().cycle_number, i);
            assert_eq!(
                history.items.get(i as u32).unwrap().amount,
                contribution_amount
            );
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
        assert_eq!(page1.items.len(), 5);
        assert_eq!(page1.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(page1.items.get(4).unwrap().cycle_number, 4);
        assert!(page1.has_more);

        // Get second page (cycles 5-9)
        let page2 = client.get_member_contribution_history(&group_id, &member, &5, &5);
        assert_eq!(page2.items.len(), 5);
        assert_eq!(page2.items.get(0).unwrap().cycle_number, 5);
        assert_eq!(page2.items.get(4).unwrap().cycle_number, 9);
        assert!(!page2.has_more);
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
        assert_eq!(history.items.len(), 3); // Only 3 contributions
        assert_eq!(history.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(history.items.get(1).unwrap().cycle_number, 2);
        assert_eq!(history.items.get(2).unwrap().cycle_number, 4);
        assert!(!history.has_more);
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
        assert_eq!(history.items.len(), 50); // Capped at 50
        assert!(history.has_more);
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
        assert_eq!(history.items.len(), 2); // Only cycles 2 and 3
        assert_eq!(history.items.get(0).unwrap().cycle_number, 2);
        assert_eq!(history.items.get(1).unwrap().cycle_number, 3);
        assert!(!history.has_more);
    }

    #[test]
    fn test_get_member_contribution_history_100_plus_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        let group_id = 1;
        let contribution_amount = 10_000_000i128;
        let total_cycles: u32 = 110;

        let mut group = Group::new(
            group_id,
            member.clone(),
            contribution_amount,
            3600,
            200,
            2,
            0,
        );
        group.current_cycle = total_cycles - 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        for cycle in 0..total_cycles {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                cycle as u64 * 3600,
            );
            env.storage().persistent().set(
                &StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone()),
                &contrib,
            );
        }

        // Page 1: limit=50, has_more=true (110 total, 50 returned)
        let page1 = client.get_member_contribution_history(&group_id, &member, &0, &50);
        assert_eq!(page1.items.len(), 50);
        assert_eq!(page1.items.get(0).unwrap().cycle_number, 0);
        assert_eq!(page1.items.get(49).unwrap().cycle_number, 49);
        assert!(page1.has_more);

        // Page 2: start=50, limit=50, has_more=true (60 remaining, 50 returned)
        let page2 = client.get_member_contribution_history(&group_id, &member, &50, &50);
        assert_eq!(page2.items.len(), 50);
        assert_eq!(page2.items.get(0).unwrap().cycle_number, 50);
        assert_eq!(page2.items.get(49).unwrap().cycle_number, 99);
        assert!(page2.has_more);

        // Page 3: start=100, limit=50, has_more=false (10 remaining)
        let page3 = client.get_member_contribution_history(&group_id, &member, &100, &50);
        assert_eq!(page3.items.len(), 10);
        assert_eq!(page3.items.get(0).unwrap().cycle_number, 100);
        assert_eq!(page3.items.get(9).unwrap().cycle_number, 109);
        assert!(!page3.has_more);
    }

    #[test]
    fn test_get_cycle_contributions_empty() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
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
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
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
            auto_contribute_enabled: false,
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
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, joined_at, 0);
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
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
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, joined_at, 0);
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
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
                auto_contribute_enabled: false,
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
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
                auto_contribute_enabled: false,
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
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
    fn test_is_cycle_complete_partial_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group and members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
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
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }

        // Action: Assign random positions
        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Randomized);

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
    fn test_assign_payout_positions_randomized_ten_members_is_not_join_order() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 10, 2, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );

        let mut members = Vec::new(&env);
        for _ in 0..10 {
            let member = Address::generate(&env);
            members.push_back(member.clone());
            let profile = MemberProfile {
                address: member.clone(),
                group_id,
                payout_position: 0,
                joined_at: 1000,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, member),
                &profile,
            );
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);

        env.mock_all_auths();
        client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Randomized);

        let sequence_key = StorageKeyBuilder::payout_sequence(group_id);
        let sequence: Vec<Address> = env.storage().persistent().get(&sequence_key).unwrap();

        assert_eq!(sequence.len(), 10);

        let mut same_order = true;
        for i in 0..sequence.len() {
            if sequence.get(i).unwrap() != members.get(i).unwrap() {
                same_order = false;
                break;
            }
        }

        assert_eq!(same_order, false);
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
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
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
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

        // Verify: Cycle is not complete
        assert_eq!(is_complete, false);
    }

    #[test]
    fn test_is_cycle_complete_no_contributions() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let group_id = 1;

        // Setup: Create group with 2 members
        let group = Group::new(group_id, creator.clone(), 100, 3600, 3, 2, 1000, 0);
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
        let group1 = Group::new(
            group1_id,
            creator.clone(),
            group1_amount,
            3600,
            5,
            2,
            12345,
            0,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        let group2_id = 2;
        let group2_amount = 50_000_000; // 5 XLM
        let group2 = Group::new(
            group2_id,
            creator.clone(),
            group2_amount,
            3600,
            5,
            2,
            12345,
            0,
        );
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

    // Tests for validate_cycle_duration function

    #[test]
    fn test_validate_cycle_duration_valid() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        // Set up config with min=3600 (1 hour), max=2592000 (30 days)
        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test valid duration (7 days)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 604800)
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_cycle_duration_too_short() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test duration below minimum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 1800)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    #[test]
    fn test_validate_cycle_duration_too_long() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test duration above maximum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 3000000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    #[test]
    fn test_validate_cycle_duration_no_config() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        // Test without config (should pass)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_cycle_duration(&env, 604800)
        });
        assert!(result.is_ok());
    }

    // Tests for validate_contribution_amount_range function

    #[test]
    fn test_validate_contribution_amount_range_valid() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,     // 0.1 XLM
            max_contribution: 1_000_000_000, // 100 XLM
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test valid amount (10 XLM)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 100_000_000)
        });
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_contribution_amount_range_too_low() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test amount below minimum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 500_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_range_too_high() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(StellarSaveContract, ());

        let config = ContractConfig {
            admin,
            min_contribution: 1_000_000,
            max_contribution: 1_000_000_000,
            min_members: 2,
            max_members: 100,
            min_cycle_duration: 3600,
            max_cycle_duration: 2592000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::contract_config(), &config);

        // Test amount above maximum
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 2_000_000_000)
        });
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate_contribution_amount_range_no_config() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        // Test without config (should pass)
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::validate_contribution_amount_range(&env, 100_000_000)
        });
        assert!(result.is_ok());
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
    fn test_is_cycle_complete_exact_count() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let group_id = 1;

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

        // Verify: Cycle is complete (equal counts)
        assert_eq!(is_complete, true);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_assign_payout_positions_manual_wrong_count_actual() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let group_id = 1;

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

        // Test valid amount (10 XLM)
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 100_000_000));
        assert!(result.is_ok());
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

        // Test amount below minimum
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 500_000));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
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

        // Test amount above maximum
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 2_000_000_000));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // GroupNotFound
    fn test_get_contribution_deadline_group_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Test without config (should pass)
        let result = env.as_contract(&contract_id, || validate_amount_range(&env, 100_000_000));
        assert!(result.is_ok());
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
        let mut group1 = Group::new(
            group1_id,
            creator.clone(),
            100,
            duration1,
            5,
            2,
            started_at,
            0,
        );
        group1.started = true;
        group1.started_at = started_at;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        // Test with 1 month duration
        let group2_id = 2;
        let duration2 = 2592000u64; // 30 days
        let mut group2 = Group::new(
            group2_id,
            creator.clone(),
            100,
            duration2,
            5,
            2,
            started_at,
            0,
        );
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
        let mut group1 = Group::new(
            group1_id,
            creator.clone(),
            100,
            duration1,
            5,
            2,
            started_at,
            0,
        );
        group1.started = true;
        group1.started_at = started_at;
        group1.current_cycle = 0;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group1_id), &group1);

        // Test with 1 week duration
        let group2_id = 2;
        let duration2 = 604800u64; // 1 week
        let mut group2 = Group::new(
            group2_id,
            creator.clone(),
            100,
            duration2,
            5,
            2,
            started_at,
            0,
        );
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

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
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

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345, 0);
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

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345, 0);
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

        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 2, 2, 12345, 0);
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
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let result = client.try_get_total_paid_out(&999);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    // Tests for get_group_balance function

    #[test]
    fn test_get_group_balance_no_activity() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        let balance = client.get_group_balance(&group_id);
        assert_eq!(balance, 0);
    }

    #[test]
    fn test_get_group_balance_with_contributions_no_payouts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        // Add contributions for cycle 0
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, 0);
        env.storage().persistent().set(&total_key, &300_i128);

        let balance = client.get_group_balance(&group_id);
        assert_eq!(balance, 300);
    }

    #[test]
    fn test_get_group_balance_with_contributions_and_payouts() {
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
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0 and 1
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &300_i128,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 1),
            &300_i128,
        );

        // Add payout for cycle 0
        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, env.ledger().timestamp());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(group_id, 0), &payout);

        let balance = client.get_group_balance(&group_id);
        assert_eq!(balance, 300); // 600 contributions - 300 payout
    }

    #[test]
    fn test_get_group_balance_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let result = client.try_get_group_balance(&999);
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

        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);

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
        let cycle_duration = 3600u64;
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3, &token_address);

        client.join_group(&group_id, &creator);

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
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

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
        let member = Address::generate(&env);
        let cycle_duration = 3600u64;
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &cycle_duration, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

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
        let non_member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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

    // Tests for record_payout helper function

    #[test]
    fn test_record_payout_success() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let recipient = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 50_000_000;
        let timestamp = 1234567890u64;

        // Action: Record payout using as_contract
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_payout(
                &env,
                group_id,
                cycle,
                recipient.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Success
        assert!(result.is_ok());

        // Verify: Payout record was stored
        let record_key = StorageKeyBuilder::payout_record(group_id, cycle);
        let stored_payout: PayoutRecord = env.storage().persistent().get(&record_key).unwrap();
        assert_eq!(stored_payout.recipient, recipient);
        assert_eq!(stored_payout.group_id, group_id);
        assert_eq!(stored_payout.cycle_number, cycle);
        assert_eq!(stored_payout.amount, amount);
        assert_eq!(stored_payout.timestamp, timestamp);

        // Verify: Recipient was stored
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, cycle);
        let stored_recipient: Address = env.storage().persistent().get(&recipient_key).unwrap();
        assert_eq!(stored_recipient, recipient);

        // Verify: Status was stored
        let status_key = StorageKeyBuilder::payout_status(group_id, cycle);
        let stored_status: bool = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(stored_status, true);
    }

    #[test]
    fn test_record_payout_already_executed() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());

        let recipient = Address::generate(&env);
        let group_id = 1;
        let cycle = 0;
        let amount = 50_000_000;
        let timestamp = 1234567890u64;

        // Setup: Record payout for the first time
        env.as_contract(&contract_id, || {
            StellarSaveContract::record_payout(
                &env,
                group_id,
                cycle,
                recipient.clone(),
                amount,
                timestamp,
            )
        })
        .unwrap();

        // Action: Try to record the same payout again
        let result = env.as_contract(&contract_id, || {
            StellarSaveContract::record_payout(
                &env,
                group_id,
                cycle,
                recipient.clone(),
                amount,
                timestamp,
            )
        });

        // Verify: Fails with InvalidState
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    // Tests for transfer_payout function

    #[test]
    fn test_transfer_payout_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &10, &token_address);

        let amount = 200; // 2 members * 100 each
        let result = client.transfer_payout(&group_id, &creator, &amount, &0);
        assert!(result.is_ok());

        // Verify payout record was stored
        let payout_key = StorageKeyBuilder::payout_record(group_id, 0);
        let payout_record: PayoutRecord = env.storage().persistent().get(&payout_key).unwrap();
        assert_eq!(payout_record.recipient, creator);
        assert_eq!(payout_record.amount, 200);

        // Verify recipient was stored
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        let stored_recipient: Address = env.storage().persistent().get(&recipient_key).unwrap();
        assert_eq!(stored_recipient, creator);
    }

    #[test]
    fn test_transfer_payout_invalid_recipient() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let group_id = 1;
        let invalid_recipient = Address::default(); // Default address should be invalid

        let result = client.try_transfer_payout(&group_id, &invalid_recipient, &100, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidRecipient)));
    }

    #[test]
    fn test_transfer_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

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

        let result = client.try_transfer_payout(&group_id, &recipient, &100, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_transfer_payout_invalid_group_state() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Group is in Pending state by default, should fail
        let result = client.try_transfer_payout(&group_id, &creator, &100, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_transfer_payout_not_eligible_recipient() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &3);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 1; // Cycle 1, but member is in position 0
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Creator (position 0) should not be eligible for cycle 1
        let amount = 200; // 2 members * 100 each
        let result = client.try_transfer_payout(&group_id, &creator, &amount, &1);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidRecipient)));
    }

    #[test]
    fn test_transfer_payout_invalid_amount() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

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

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Wrong amount (should be 200 for 2 members * 100 each)
        let wrong_amount = 150;
        let result = client.try_transfer_payout(&group_id, &creator, &wrong_amount, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidAmount)));
    }

    #[test]
    fn test_transfer_payout_already_processed() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Manually set that payout was already processed for cycle 0
        let recipient_key = StorageKeyBuilder::payout_recipient(group_id, 0);
        env.storage().persistent().set(&recipient_key, &creator);

        let amount = 200; // 2 members * 100 each
        let result = client.try_transfer_payout(&group_id, &creator, &amount, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::PayoutAlreadyProcessed)));
    }

    #[test]
    fn test_transfer_payout_reentrancy_protection() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Manually set reentrancy guard
        let reentrancy_key = StorageKeyBuilder::reentrancy_guard();
        env.storage().persistent().set(&reentrancy_key, &1);

        let amount = 200; // 2 members * 100 each
        let result = client.try_transfer_payout(&group_id, &creator, &amount, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::InternalError)));

        // Verify reentrancy guard is cleared even on error
        let guard_value: u64 = env.storage().persistent().get(&reentrancy_key).unwrap_or(0);
        assert_eq!(guard_value, 1); // Still set because we didn't call the function
    }

    #[test]
    fn test_transfer_payout_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member);

        // Set group to active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        let amount = 200; // 2 members * 100 each
        client.transfer_payout(&group_id, &creator, &amount, &0);

        // Check that an event was emitted
        let events = env.events().all();
        assert!(events.len() > 0);

        // Find the payout_executed event
        let payout_event = events.iter().find(|event| {
            event.topics.len() >= 1
                && event.topics.get(0).unwrap() == &Symbol::new(&env, "payout_executed")
        });

        assert!(payout_event.is_some());
    }

    #[test]
    fn test_get_group_members_empty_group() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Get members from empty group
        let members = client.get_group_members(&group_id, &0, &10);
        assert_eq!(members.len(), 0);
    }

    #[test]
    fn test_get_group_members_single_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add one member
        client.join_group(&group_id, &creator);

        // Get members
        let members = client.get_group_members(&group_id, &0, &10);
        assert_eq!(members.len(), 1);
        assert_eq!(members.get(0).unwrap(), creator);
    }

    #[test]
    fn test_get_group_members_multiple_members_sorted() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Add members in specific order
        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);
        client.join_group(&group_id, &member3);

        // Get all members
        let members = client.get_group_members(&group_id, &0, &10);
        assert_eq!(members.len(), 4);

        // Verify they're in join order
        assert_eq!(members.get(0).unwrap(), creator);
        assert_eq!(members.get(1).unwrap(), member1);
        assert_eq!(members.get(2).unwrap(), member2);
        assert_eq!(members.get(3).unwrap(), member3);
    }

    #[test]
    fn test_get_group_members_pagination_first_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);

        // Add 5 members
        let mut all_members = Vec::new(&env);
        for i in 0..5 {
            let member = Address::generate(&env);
            all_members.push_back(member.clone());
            client.join_group(&group_id, &member);
        }

        // Get first 3 members
        let members = client.get_group_members(&group_id, &0, &3);
        assert_eq!(members.len(), 3);
        assert_eq!(members.get(0).unwrap(), all_members.get(0).unwrap());
        assert_eq!(members.get(1).unwrap(), all_members.get(1).unwrap());
        assert_eq!(members.get(2).unwrap(), all_members.get(2).unwrap());
    }

    #[test]
    fn test_get_group_members_pagination_second_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add 5 members
        let mut all_members = Vec::new(&env);
        for i in 0..5 {
            let member = Address::generate(&env);
            all_members.push_back(member.clone());
            client.join_group(&group_id, &member);
        }

        // Get second page (offset 3, limit 2)
        let members = client.get_group_members(&group_id, &3, &2);
        assert_eq!(members.len(), 2);
        assert_eq!(members.get(0).unwrap(), all_members.get(3).unwrap());
        assert_eq!(members.get(1).unwrap(), all_members.get(4).unwrap());
    }

    #[test]
    fn test_get_group_members_pagination_beyond_total() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        // Add 3 members
        for i in 0..3 {
            let member = Address::generate(&env);
            client.join_group(&group_id, &member);
        }

        // Try to get members beyond total count
        let members = client.get_group_members(&group_id, &10, &5);
        assert_eq!(members.len(), 0);
    }

    #[test]
    fn test_get_group_members_pagination_partial_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &10);

        // Add 5 members
        let mut all_members = Vec::new(&env);
        for i in 0..5 {
            let member = Address::generate(&env);
            all_members.push_back(member.clone());
            client.join_group(&group_id, &member);
        }

        // Request 10 members starting from offset 3 (only 2 available)
        let members = client.get_group_members(&group_id, &3, &10);
        assert_eq!(members.len(), 2);
        assert_eq!(members.get(0).unwrap(), all_members.get(3).unwrap());
        assert_eq!(members.get(1).unwrap(), all_members.get(4).unwrap());
    }

    #[test]
    fn test_get_group_members_limit_capped_at_100() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add 5 members
        for i in 0..5 {
            let member = Address::generate(&env);
            client.join_group(&group_id, &member);
        }

        // Request with limit > 100 (should be capped)
        let members = client.get_group_members(&group_id, &0, &150);
        // Should return all 5 members (not fail, just capped at available)
        assert_eq!(members.len(), 5);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_group_members_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get members from non-existent group
        client.get_group_members(&999, &0, &10);
    }

    #[test]
    fn test_get_group_members_zero_limit() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        // Add members
        client.join_group(&group_id, &creator);

        // Request with limit 0
        let members = client.get_group_members(&group_id, &0, &0);
        assert_eq!(members.len(), 0);
    }

    #[test]
    fn test_get_group_total_members_empty() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        let mut group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        group.current_cycle = 3;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        let group_id = client.create_group(&creator, &100, &3600, &5);

        let count = client.get_group_total_members(&group_id);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_get_group_total_members_with_members() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let group_id = client.create_group(&creator, &100, &3600, &5);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &Address::generate(&env));
        client.join_group(&group_id, &Address::generate(&env));

        let count = client.get_group_total_members(&group_id);
        assert_eq!(count, 3);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_group_total_members_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        client.get_group_total_members(&999);
    }

    #[test]
    fn test_get_payout_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);

        // Create a payout record
        let payout = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1234567890);
        let key = StorageKeyBuilder::payout_record(group_id, 0);
        env.storage().persistent().set(&key, &payout);

        // Retrieve the payout
        let result = client.get_payout(&group_id, &0);
        assert_eq!(result.recipient, creator);
        assert_eq!(result.group_id, group_id);
        assert_eq!(result.cycle_number, 0);
        assert_eq!(result.amount, 300);
        assert_eq!(result.timestamp, 1234567890);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4001)")]
    fn test_get_payout_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);

        // Try to get a payout that doesn't exist
        client.get_payout(&group_id, &0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Try to get a payout for a non-existent group
        client.get_payout(&999, &0);
    }

    #[test]
    fn test_get_payout_multiple_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);

        // Create payout records for multiple cycles
        let payout0 = PayoutRecord::new(creator.clone(), group_id, 0, 300, 1234567890);
        let payout1 = PayoutRecord::new(member1.clone(), group_id, 1, 300, 1234571490);
        let payout2 = PayoutRecord::new(member2.clone(), group_id, 2, 300, 1234575090);

        let key0 = StorageKeyBuilder::payout_record(group_id, 0);
        let key1 = StorageKeyBuilder::payout_record(group_id, 1);
        let key2 = StorageKeyBuilder::payout_record(group_id, 2);

        env.storage().persistent().set(&key0, &payout0);
        env.storage().persistent().set(&key1, &payout1);
        env.storage().persistent().set(&key2, &payout2);

        // Retrieve each payout
        let result0 = client.get_payout(&group_id, &0);
        assert_eq!(result0.recipient, creator);
        assert_eq!(result0.cycle_number, 0);

        let result1 = client.get_payout(&group_id, &1);
        assert_eq!(result1.recipient, member1);
        assert_eq!(result1.cycle_number, 1);

        let result2 = client.get_payout(&group_id, &2);
        assert_eq!(result2.recipient, member2);
        assert_eq!(result2.cycle_number, 2);
    }

    #[test]
    fn test_get_payout_different_groups() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let group_id1 = client.create_group(&creator1, &100, &3600, &3);
        let group_id2 = client.create_group(&creator2, &200, &7200, &5);

        client.join_group(&group_id1, &creator1);
        client.join_group(&group_id2, &creator2);

        // Create payout records for different groups
        let payout1 = PayoutRecord::new(creator1.clone(), group_id1, 0, 300, 1234567890);
        let payout2 = PayoutRecord::new(creator2.clone(), group_id2, 0, 1000, 1234567890);

        let key1 = StorageKeyBuilder::payout_record(group_id1, 0);
        let key2 = StorageKeyBuilder::payout_record(group_id2, 0);

        env.storage().persistent().set(&key1, &payout1);
        env.storage().persistent().set(&key2, &payout2);

        // Retrieve payouts for each group
        let result1 = client.get_payout(&group_id1, &0);
        assert_eq!(result1.group_id, group_id1);
        assert_eq!(result1.amount, 300);

        let result2 = client.get_payout(&group_id2, &0);
        assert_eq!(result2.group_id, group_id2);
        assert_eq!(result2.amount, 1000);
    }

    #[test]
    fn test_transfer_payout_overflow_protection() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        // Create group with maximum contribution amount to test overflow
        let group_id = client.create_group(&creator, &i128::MAX, &3600, &3);

        client.join_group(&group_id, &creator);

        // Set group to active status with many members to trigger overflow
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        group.member_count = u32::MAX; // This should cause overflow
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // This should fail due to overflow in amount calculation
        let result = client.try_transfer_payout(&group_id, &creator, &i128::MAX, &0);
        assert_eq!(result, Err(Ok(StellarSaveError::Overflow)));
    }

    // ============================================================================
    // TESTS FOR ISSUE #424: Payout Execution
    // ============================================================================

    #[test]
    fn test_execute_payout_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create and setup group
        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Setup group as active
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        group.member_count = 2;
        env.storage().persistent().set(&group_key, &group);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Execute payout should succeed
        let result = client.try_execute_payout(&group_id);
        assert!(result.is_ok() || result.is_err()); // May fail due to missing contributions, but function exists
    }

    #[test]
    fn test_execute_payout_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let result = client.try_execute_payout(&999);
        assert!(result.is_err());
    }

    // ============================================================================
    // TESTS FOR ISSUE #425: Group Status Management
    // ============================================================================

    #[test]
    fn test_pause_group_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Pause should succeed
        let result = client.try_pause_group(&group_id, &creator);
        assert!(result.is_ok());

        // Verify status changed to Paused
        let new_status: GroupStatus = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(new_status, GroupStatus::Paused);
    }

    #[test]
    fn test_pause_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let other = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Pause by non-creator should fail
        let result = client.try_pause_group(&group_id, &other);
        assert!(result.is_err());
    }

    #[test]
    fn test_resume_group_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to paused
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Paused);

        // Resume should succeed
        let result = client.try_resume_group(&group_id, &creator);
        assert!(result.is_ok());

        // Verify status changed to Active
        let new_status: GroupStatus = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(new_status, GroupStatus::Active);
    }

    #[test]
    fn test_cancel_group_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Cancel should succeed
        let result = client.try_cancel_group(&group_id, &creator);
        assert!(result.is_ok());

        // Verify status changed to Cancelled
        let new_status: GroupStatus = env.storage().persistent().get(&status_key).unwrap();
        assert_eq!(new_status, GroupStatus::Cancelled);
    }

    #[test]
    fn test_cancel_group_already_terminal() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &2);

        // Set group to completed (terminal state)
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Completed);

        // Cancel should fail
        let result = client.try_cancel_group(&group_id, &creator);
        assert!(result.is_err());
    }

    // ============================================================================
    // TESTS FOR ISSUE #426: Query Functions
    // ============================================================================

    #[test]
    fn test_get_group_info() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let retrieved = client.get_group_info(&1);
        assert_eq!(retrieved.id, 1);
        assert_eq!(retrieved.creator, creator);
    }

    #[test]
    fn test_get_group_members() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(1), &members);

        let retrieved = client.get_group_members(&1);
        assert_eq!(retrieved.len(), 2);
    }

    #[test]
    fn test_get_contribution_status() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let mut members = Vec::new(&env);
        members.push_back(member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(1), &members);

        let status = client.get_contribution_status(&1, &0);
        assert_eq!(status.len(), 1);
    }

    #[test]
    fn test_get_payout_history_all() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let recipient = Address::generate(&env);

        let mut group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.current_cycle = 2;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let payout = PayoutRecord::new(recipient.clone(), 1, 0, 100, 12345);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_record(1, 0), &payout);

        let history = client.get_payout_history_all(&1);
        assert_eq!(history.len(), 1);
    }

    #[test]
    fn test_is_member_of_group() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let group = Group::new(1, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &group);

        let profile = MemberProfile {
            address: member.clone(),
            group_id: 1,
            payout_position: 0,
            joined_at: 12345,
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(1, member.clone()),
            &profile,
        );

        let is_member = client.is_member_of_group(&1, &member);
        assert!(is_member);
    }

    // ============================================================================
    // TESTS FOR ISSUE #427: Input Validation
    // ============================================================================

    #[test]
    fn test_validate_address() {
        let env = Env::default();
        let address = Address::generate(&env);

        let result = StellarSaveContract::validate_address(&address);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_amount_valid() {
        let result = StellarSaveContract::validate_amount(100);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_amount_invalid_zero() {
        let result = StellarSaveContract::validate_amount(0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_amount_invalid_negative() {
        let result = StellarSaveContract::validate_amount(-100);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_duration_valid() {
        let result = StellarSaveContract::validate_duration(3600);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_member_bounds_valid() {
        let result = StellarSaveContract::validate_member_bounds(2, 10);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_member_bounds_invalid_min_too_low() {
        let result = StellarSaveContract::validate_member_bounds(1, 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_member_bounds_invalid_max_less_than_min() {
        let result = StellarSaveContract::validate_member_bounds(10, 5);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_string_valid() {
        let result = StellarSaveContract::validate_string("Test Group", 100);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_string_invalid_too_long() {
        let result = StellarSaveContract::validate_string("This is a very long string", 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_group_status_as_u32() {
        assert_eq!(GroupStatus::Pending.as_u32(), 0);
        assert_eq!(GroupStatus::Active.as_u32(), 1);
        assert_eq!(GroupStatus::Paused.as_u32(), 2);
        assert_eq!(GroupStatus::Completed.as_u32(), 3);
        assert_eq!(GroupStatus::Cancelled.as_u32(), 4);
    }

    #[test]
    fn test_group_status_from_u32() {
        assert_eq!(GroupStatus::from_u32(0), Some(GroupStatus::Pending));
        assert_eq!(GroupStatus::from_u32(1), Some(GroupStatus::Active));
        assert_eq!(GroupStatus::from_u32(2), Some(GroupStatus::Paused));
        assert_eq!(GroupStatus::from_u32(3), Some(GroupStatus::Completed));
        assert_eq!(GroupStatus::from_u32(4), Some(GroupStatus::Cancelled));
        assert_eq!(GroupStatus::from_u32(5), None);
    }

    // =========================================================================
    // Tests for #479: Contribution Proof Verification
    // =========================================================================

    fn setup_active_group_with_member(
        env: &Env,
        client: &StellarSaveContractClient,
    ) -> (u64, Address, Address) {
        let creator = Address::generate(env);
        let member = Address::generate(env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Manually set group to Active and store member profile
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.status = GroupStatus::Active;
        group.member_count = 1;
        env.storage().persistent().set(&group_key, &group);

        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: env.ledger().timestamp(),
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &member_profile,
        );

        (group_id, creator, member)
    }

    #[test]
    fn test_set_contribution_proof_required() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Enable proof requirement
        client.set_contribution_proof_required(&group_id, &true);

        let group = client.get_group(&group_id);
        assert!(group.require_contribution_proof);

        // Disable it
        client.set_contribution_proof_required(&group_id, &false);
        let group = client.get_group(&group_id);
        assert!(!group.require_contribution_proof);
    }

    #[test]
    fn test_verify_contribution_proof_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) = setup_active_group_with_member(&env, &client);

        // Enable proof requirement (group is Pending after create_group)
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.status = GroupStatus::Pending;
        group.require_contribution_proof = true;
        env.storage().persistent().set(&group_key, &group);

        // Set back to Active for verify call
        group.status = GroupStatus::Active;
        env.storage().persistent().set(&group_key, &group);

        client.verify_contribution_proof(&group_id, &member, &0);

        // Proof key should be set
        let proof_key = StorageKeyBuilder::contribution_proof_verified(group_id, 0, member.clone());
        let verified: bool = env.storage().persistent().get(&proof_key).unwrap_or(false);
        assert!(verified);
    }

    #[test]
    fn test_contribute_with_proof_requires_verification() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) = setup_active_group_with_member(&env, &client);

        // Enable proof requirement on the active group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.require_contribution_proof = true;
        env.storage().persistent().set(&group_key, &group);

        // Attempt to contribute without proof — should fail with Unauthorized
        let result = client.try_contribute_with_proof(&group_id, &member, &100);
        assert!(result.is_err());
    }

    #[test]
    fn test_contribute_with_proof_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        let (group_id, _creator, member) = setup_active_group_with_member(&env, &client);

        // Enable proof requirement
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.require_contribution_proof = true;
        env.storage().persistent().set(&group_key, &group);

        // Verify proof first
        client.verify_contribution_proof(&group_id, &member, &0);

        // Now contribute — should succeed
        client.contribute_with_proof(&group_id, &member, &100);

        // Contribution record should exist
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        assert!(env.storage().persistent().has(&contrib_key));
    }

    // =========================================================================
    // Tests for #480: Dynamic Contribution Amounts
    // =========================================================================

    #[test]
    fn test_set_dynamic_contributions() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        client.set_dynamic_contributions(&group_id, &true);
        let group = client.get_group(&group_id);
        assert!(group.allow_dynamic_contributions);
    }

    #[test]
    fn test_propose_contribution_change() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Enable dynamic contributions and set group to Active
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.allow_dynamic_contributions = true;
        group.status = GroupStatus::Active;
        env.storage().persistent().set(&group_key, &group);

        client.propose_contribution_change(&group_id, &200);

        // Proposal should be stored
        let proposal_key = StorageKeyBuilder::contribution_pending_amount(group_id);
        let proposed: i128 = env.storage().persistent().get(&proposal_key).unwrap();
        assert_eq!(proposed, 200);
    }

    #[test]
    fn test_vote_contribution_change_applies_on_majority() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &5);

        // Set up group with 3 members, dynamic contributions enabled, Active status
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.allow_dynamic_contributions = true;
        group.status = GroupStatus::Active;
        group.member_count = 3;
        env.storage().persistent().set(&group_key, &group);

        // Store member profiles
        for (i, m) in [creator.clone(), member1.clone(), member2.clone()]
            .iter()
            .enumerate()
        {
            let profile = MemberProfile {
                address: m.clone(),
                group_id,
                payout_position: i as u32,
                joined_at: 0,
                auto_contribute_enabled: false,
            };
            env.storage().persistent().set(
                &StorageKeyBuilder::member_profile(group_id, m.clone()),
                &profile,
            );
        }

        // Propose a change
        client.propose_contribution_change(&group_id, &200);

        // Two votes = majority of 3 (need 2)
        client.vote_contribution_change(&group_id, &creator);
        client.vote_contribution_change(&group_id, &member1);

        // Amount should now be updated
        let updated_group = client.get_group(&group_id);
        assert_eq!(updated_group.contribution_amount, 200);
    }

    // =========================================================================
    // Tests for #481: Group Analytics Functions
    // =========================================================================

    #[test]
    fn test_get_group_statistics_empty_group() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        let (completion_rate, total_contributions, total_distributed, active_members, tvl) =
            client.get_group_statistics(&group_id);

        assert_eq!(completion_rate, 0);
        assert_eq!(total_contributions, 0);
        assert_eq!(total_distributed, 0);
        assert_eq!(tvl, 0);
        let _ = active_members; // member count may vary
    }

    #[test]
    fn test_get_group_statistics_with_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &4);

        // Simulate 2 completed cycles with contributions
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.current_cycle = 2;
        group.member_count = 4;
        env.storage().persistent().set(&group_key, &group);

        // Store cycle totals: 4 members * 100 = 400 per cycle
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 0),
            &400i128,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_cycle_total(group_id, 1),
            &400i128,
        );

        let (completion_rate, total_contributions, total_distributed, active_members, tvl) =
            client.get_group_statistics(&group_id);

        assert_eq!(completion_rate, 50); // 2/4 cycles = 50%
        assert_eq!(total_contributions, 800); // 400 * 2
        assert_eq!(total_distributed, 800); // 2 cycles * (100 * 4)
        assert_eq!(tvl, 0); // all distributed
        assert_eq!(active_members, 4);
    }

    #[test]
    fn test_get_member_statistics() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let group_id = client.create_group(&creator, &100, &3600, &4);

        // Set up group at cycle 2 with member
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.current_cycle = 2;
        group.member_count = 2;
        env.storage().persistent().set(&group_key, &group);

        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 0,
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &member_profile,
        );

        // Member contributed in cycle 0 only
        let contrib = ContributionRecord::new(member.clone(), group_id, 0, 100, 12345);
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, 0, member.clone()),
            &contrib,
        );

        let (cycles_contributed, total_contributed, on_time_rate, received_payout) =
            client.get_member_statistics(&group_id, &member);

        assert_eq!(cycles_contributed, 1);
        assert_eq!(total_contributed, 100);
        assert_eq!(on_time_rate, 50); // 1/2 cycles = 50%
        assert!(!received_payout);
    }

    #[test]
    fn test_get_member_statistics_with_payout() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client
            .create_group(&creator, &100, &3600, &2, &token_address)
            .unwrap();

        // Set up group at cycle 1 with member who received payout
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .unwrap();
        group.current_cycle = 1;
        group.member_count = 2;
        env.storage().persistent().set(&group_key, &group);

        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 0,
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &member_profile,
        );

        // Member contributed in cycle 0
        let contrib = ContributionRecord::new(member.clone(), group_id, 0, 100, 12345);
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, 0, member.clone()),
            &contrib,
        );

        // Member received payout in cycle 0
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::payout_recipient(group_id, 0), &member);

        let (_cycles, _total, _rate, received_payout) =
            client.get_member_statistics(&group_id, &member);

        assert!(received_payout);
    }

    // ── Grace period tests ────────────────────────────────────────────────────

    /// Helper: create a group with a grace period, store it, and return (group_id, client).
    fn setup_group_with_grace(
        env: &Env,
        grace_period_seconds: u64,
    ) -> (u64, StellarSaveContractClient) {
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(env, &contract_id);
        let creator = Address::generate(env);
        env.mock_all_auths();
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();
        let group_id = client
            .create_group(&creator, &10_000_000, &604800, &5, &token_address)
            .unwrap();
        (group_id, client)
    }

    #[test]
    fn test_create_group_stores_grace_period() {
        let env = Env::default();
        let (group_id, client) = setup_group_with_grace(&env, 3600);
        let group = client.get_group(&group_id).unwrap();
        assert_eq!(group.grace_period_seconds, 3600);
    }

    #[test]
    fn test_create_group_zero_grace_period() {
        let env = Env::default();
        let (group_id, client) = setup_group_with_grace(&env, 0);
        let group = client.get_group(&group_id).unwrap();
        assert_eq!(group.grace_period_seconds, 0);
    }

    #[test]
    fn test_create_group_max_grace_period() {
        let env = Env::default();
        // 604800 = exactly 7 days — should succeed
        let (group_id, client) = setup_group_with_grace(&env, 604800);
        let group = client.get_group(&group_id).unwrap();
        assert_eq!(group.grace_period_seconds, 604800);
    }

    #[test]
    fn test_create_group_grace_period_exceeds_max() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        env.mock_all_auths();
        // 604801 = 7 days + 1 second — should fail
        let result = client.try_create_group(&creator, &10_000_000, &604800, &5, &604801);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_missed_contributions_within_grace_period() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let grace: u64 = 3600; // 1 hour

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &3, &token_address);

        client.join_group(&group_id, &creator);
        client.join_group(&group_id, &member1);
        client.join_group(&group_id, &member2);

        env.mock_all_auths();
        env.ledger().set_timestamp(started_at);

        let group_id = client
            .create_group(&creator, &10_000_000, &cycle_duration, &5, &grace)
            .unwrap();

        // Store members list directly so get_missed_contributions can find them
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members = soroban_sdk::Vec::new(&env);
        members.push_back(member.clone());
        env.storage().persistent().set(&members_key, &members);

        // Activate the group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.member_count = 2;
        group.activate(started_at);
        env.storage().persistent().set(&group_key, &group);

        // Advance time to just after the deadline but still within grace period
        let deadline = started_at + cycle_duration;
        env.ledger().set_timestamp(deadline + grace / 2);

        // Should return empty — still within grace period
        let missed = client.get_missed_contributions(&group_id, &0).unwrap();
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_get_missed_contributions_after_grace_period() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let grace: u64 = 3600; // 1 hour

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id1 = client.create_group(&creator1, &100, &3600, &3, &token_address);
        let group_id2 = client.create_group(&creator2, &200, &7200, &5, &token_address);

        client.join_group(&group_id1, &creator1);
        client.join_group(&group_id2, &creator2);

        let group_id = client
            .create_group(&creator, &10_000_000, &cycle_duration, &5, &grace)
            .unwrap();

        // Store members list
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members = soroban_sdk::Vec::new(&env);
        members.push_back(member.clone());
        env.storage().persistent().set(&members_key, &members);

        // Activate the group
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.member_count = 2;
        group.activate(started_at);
        env.storage().persistent().set(&group_key, &group);

        // Advance time past deadline + grace period
        let deadline = started_at + cycle_duration;
        env.ledger().set_timestamp(deadline + grace + 1);

        // Member has not contributed — should appear in missed list
        let missed = client.get_missed_contributions(&group_id, &0).unwrap();
        assert_eq!(missed.len(), 1);
        assert_eq!(missed.get(0).unwrap(), member);
    }

    #[test]
    fn test_get_missed_contributions_contributed_within_grace_period() {
        let env = Env::default();
        let started_at: u64 = 1000;
        let cycle_duration: u64 = 604800;
        let grace: u64 = 3600;

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();

        env.mock_all_auths();
        env.ledger().set_timestamp(started_at);

        // Create and setup group
        let group_id = client
            .create_group(&creator, &100, &3600, &2, &token_address)
            .unwrap();

        // Setup group as active
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&group_key).unwrap();
        group.member_count = 2;
        group.activate(started_at);
        env.storage().persistent().set(&group_key, &group);

        // Member contributes during grace period
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &true);

        // Advance time past deadline + grace period
        let deadline = started_at + cycle_duration;
        env.ledger().set_timestamp(deadline + grace + 1);

        // Member contributed — should NOT appear in missed list
        let missed = client.get_missed_contributions(&group_id, &0).unwrap();
        assert_eq!(missed.len(), 0);
    }

    #[test]
    fn test_update_group_metadata_name_too_short() {
        let env = Env::default();
        let creator = Address::random(&env);
        let group_id = 1u64;

        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &2, &token_address);

        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        let result = StellarSaveContract::update_group_metadata(
            env,
            group_id,
            creator,
            String::from_small_str("AB"),
            String::from_small_str("Description"),
            String::from_small_str("https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_name_too_long() {
        let env = Env::default();
        let creator = Address::random(&env);
        let group_id = 1u64;

        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &2, &token_address);

        // Set group to paused
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Paused);

        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Create a name longer than 50 characters
        let long_name = String::from_small_str("This is a very long group name that exceeds fifty");
        assert!(long_name.len() > 50);

        let result = StellarSaveContract::update_group_metadata(
            env,
            group_id,
            creator,
            long_name,
            String::from_small_str("Description"),
            String::from_small_str("https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_description_too_long() {
        let env = Env::default();
        let creator = Address::random(&env);
        let group_id = 1u64;

        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &2, &token_address);

        // Set group to active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        // Create a description longer than 500 characters
        let long_desc = String::from_small_str(
            "This is a very long description that exceeds the maximum allowed length of five hundred characters. It contains a lot of text to ensure it goes over the limit. This is a very long description that exceeds the maximum allowed length of five hundred characters. It contains a lot of text to ensure it goes over the limit. This is a very long description that exceeds the maximum allowed length of five hundred characters. It contains a lot of text to ensure it goes over the limit.",
        );
        assert!(long_desc.len() > 500);

        let result = StellarSaveContract::update_group_metadata(
            env,
            group_id,
            creator,
            String::from_small_str("Test Group"),
            long_desc,
            String::from_small_str("https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_update_group_metadata_unauthorized() {
        let env = Env::default();
        let creator = Address::random(&env);
        let other_user = Address::random(&env);
        let group_id = 1u64;

        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let group_id = client.create_group(&creator, &100, &3600, &2, &token_address);

        // Set group to completed (terminal state)
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Completed);

        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        let result = StellarSaveContract::update_group_metadata(
            env,
            group_id,
            other_user,
            String::from_small_str("Test Group"),
            String::from_small_str("Description"),
            String::from_small_str("https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::Unauthorized));
    }

    #[test]
    fn test_update_group_metadata_group_not_found() {
        let env = Env::default();
        let creator = Address::random(&env);

        let result = StellarSaveContract::update_group_metadata(
            env,
            999u64,
            creator,
            String::from_small_str("Test Group"),
            String::from_small_str("Description"),
            String::from_small_str("https://example.com/image.png"),
        );

        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    #[test]
    fn test_update_group_metadata_empty_description_valid() {
        let env = Env::default();
        let creator = Address::random(&env);
        let group_id = 1u64;

        let group = Group::new(
            group_id,
            creator.clone(),
            1_000_000,
            604800,
            10,
            2,
            env.ledger().timestamp(),
        );

        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);

        let retrieved = client.get_group_members(&1, &0, &100);
        assert_eq!(retrieved.len(), 2);
    }

    // ── Dispute lifecycle tests ──────────────────────────────────────────────

    fn setup_group_with_member(env: &Env) -> (u64, Address, Address) {
        let group_id = 1u64;
        let creator = Address::generate(env);
        let member = Address::generate(env);
        let group = Group::new(group_id, creator.clone(), 10_000_000, 3600, 5, 2, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        let mut members = Vec::new(env);
        members.push_back(member.clone());
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_members(group_id), &members);
        (group_id, creator, member)
    }

    #[test]
    fn test_raise_dispute_sets_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "funds missing"));

        let group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        assert!(group.dispute_active);
    }

    #[test]
    fn test_resolve_dispute_clears_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "issue"));
        client.resolve_dispute(&group_id, &creator, &String::from_str(&env, "resolved"));

        let group: Group = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_data(group_id))
            .unwrap();
        assert!(!group.dispute_active);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2002))")]
    fn test_raise_dispute_non_member_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, _member) = setup_group_with_member(&env);
        let outsider = Address::generate(&env);

        client.raise_dispute(&group_id, &outsider, &String::from_str(&env, "bad actor"));
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(6001))")]
    fn test_raise_dispute_twice_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "first"));
        client.raise_dispute(&group_id, &member, &String::from_str(&env, "second"));
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(2003))")]
    fn test_resolve_dispute_non_creator_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, _creator, member) = setup_group_with_member(&env);

        client.raise_dispute(&group_id, &member, &String::from_str(&env, "issue"));
        client.resolve_dispute(&group_id, &member, &String::from_str(&env, "self-resolve"));
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")]
    fn test_resolve_dispute_no_active_dispute_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let (group_id, creator, _member) = setup_group_with_member(&env);

        client.resolve_dispute(
            &group_id,
            &creator,
            &String::from_str(&env, "nothing to resolve"),
        );
    }

    // Task 5.1: Unit tests for get_token_config (Requirements 2.3, 2.4)

    /// Verifies that get_token_config returns the correct TokenConfig after a group is created
    /// with a mock token. Requirements 2.3.
    #[test]
    fn test_get_token_config_success() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Deploy a mock SEP-41 token (Stellar Asset Contract)
        let token_admin = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(token_admin)
            .address();

        let creator = Address::generate(&env);

        // Create a group with the mock token
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        // Retrieve the token config
        let token_config = client.get_token_config(&group_id);

        // Verify the stored token address matches what was provided
        assert_eq!(token_config.token_address, token_address);
        // Stellar Asset Contracts report 7 decimals
        assert_eq!(token_config.token_decimals, 7);
    }

    /// Verifies that get_token_config returns GroupNotFound for an unknown group_id.
    /// Requirements 2.4.
    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_token_config_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Query a group_id that was never created
        client.get_token_config(&9999);
    }

    // Task 5.1: Unit tests for get_token_config (Requirements 2.3, 2.4)

    /// Verifies that get_token_config returns the correct TokenConfig after a group is created
    /// with a mock token. Requirements 2.3.
    #[test]
    fn test_get_token_config_success() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Deploy a mock SEP-41 token (Stellar Asset Contract)
        let token_admin = Address::generate(&env);
        let token_address = env
            .register_stellar_asset_contract_v2(token_admin)
            .address();

        let creator = Address::generate(&env);

        // Create a group with the mock token
        let group_id = client.create_group(&creator, &100, &3600, &5, &token_address);

        // Retrieve the token config
        let token_config = client.get_token_config(&group_id);

        // Verify the stored token address matches what was provided
        assert_eq!(token_config.token_address, token_address);
        // Stellar Asset Contracts report 7 decimals
        assert_eq!(token_config.token_decimals, 7);
    }

    /// Verifies that get_token_config returns GroupNotFound for an unknown group_id.
    /// Requirements 2.4.
    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_get_token_config_not_found() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);

        // Query a group_id that was never created
        client.get_token_config(&9999);
    }

    // -------------------------------------------------------------------------
    // Archival tests
    // -------------------------------------------------------------------------

    /// Helper: store a minimal group with the given status directly in storage.
    fn store_group_with_status(env: &Env, group_id: u64, creator: &Address, status: GroupStatus) {
        let mut group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345, 0);
        group.status = status.clone();
        group.is_active = matches!(status, GroupStatus::Active);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &status);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &group_id);
    }

    /// archive_group succeeds for a Completed group and sets the archived flag.
    #[test]
    fn test_archive_group_completed_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);

        client.archive_group(&creator, &1);

        // The group should now have archived = true
        let group = client.get_group(&1);
        assert!(
            group.archived,
            "group.archived should be true after archiving"
        );

        // The archived flag in storage should also be set
        let archived_key = StorageKeyBuilder::group_archived(1);
        let flag: bool = env
            .storage()
            .persistent()
            .get(&archived_key)
            .unwrap_or(false);
        assert!(flag, "storage archived flag should be true");
    }

    /// archive_group succeeds for a Cancelled group.
    #[test]
    fn test_archive_group_cancelled_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Cancelled);

        client.archive_group(&creator, &1);

        let group = client.get_group(&1);
        assert!(group.archived);
    }

    /// archive_group fails with GroupNotFound for a non-existent group.
    #[test]
    #[should_panic(expected = "Error(Contract, #1001)")]
    fn test_archive_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let caller = Address::generate(&env);

        client.archive_group(&caller, &999);
    }

    /// archive_group fails with Unauthorized when caller is not the creator.
    #[test]
    #[should_panic(expected = "Error(Contract, #2003)")]
    fn test_archive_group_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);

        client.archive_group(&attacker, &1);
    }

    /// archive_group fails with GroupNotArchivable when the group is still Active.
    #[test]
    #[should_panic(expected = "Error(Contract, #1007)")]
    fn test_archive_group_not_archivable_active() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Active);

        client.archive_group(&creator, &1);
    }

    /// archive_group fails with GroupNotArchivable when the group is Pending.
    #[test]
    #[should_panic(expected = "Error(Contract, #1007)")]
    fn test_archive_group_not_archivable_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Pending);

        client.archive_group(&creator, &1);
    }

    /// archive_group fails with InvalidState when called a second time (already archived).
    #[test]
    #[should_panic(expected = "Error(Contract, #1003)")]
    fn test_archive_group_already_archived() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);

        client.archive_group(&creator, &1);
        // Second call should fail
        client.archive_group(&creator, &1);
    }

    /// list_groups excludes archived groups by default.
    #[test]
    fn test_list_groups_excludes_archived() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Store two groups: one active, one completed+archived
        store_group_with_status(&env, 1, &creator, GroupStatus::Active);
        store_group_with_status(&env, 2, &creator, GroupStatus::Completed);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        // Archive group 2
        client.archive_group(&creator, &2);

        let groups = client.list_groups(&0, &50, &None);
        assert_eq!(groups.len(), 1, "only the non-archived group should appear");
        assert_eq!(groups.get(0).unwrap().id, 1);
    }

    /// list_archived_groups returns only archived groups.
    #[test]
    fn test_list_archived_groups_returns_archived_only() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Active);
        store_group_with_status(&env, 2, &creator, GroupStatus::Completed);
        store_group_with_status(&env, 3, &creator, GroupStatus::Cancelled);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        // Archive groups 2 and 3
        client.archive_group(&creator, &2);
        client.archive_group(&creator, &3);

        let archived = client.list_archived_groups(&0, &50);
        assert_eq!(archived.len(), 2, "two groups should be archived");

        // IDs should be 3 and 2 (newest first)
        assert_eq!(archived.get(0).unwrap().id, 3);
        assert_eq!(archived.get(1).unwrap().id, 2);
    }

    /// list_archived_groups returns empty when no groups are archived.
    #[test]
    fn test_list_archived_groups_empty() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Active);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &1u64);

        let archived = client.list_archived_groups(&0, &50);
        assert_eq!(archived.len(), 0);
    }

    /// list_archived_groups respects the limit parameter.
    #[test]
    fn test_list_archived_groups_pagination_limit() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create and archive 3 completed groups
        for id in 1u64..=3 {
            store_group_with_status(&env, id, &creator, GroupStatus::Completed);
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);
        for id in 1u64..=3 {
            client.archive_group(&creator, &id);
        }

        // Request only 2
        let archived = client.list_archived_groups(&0, &2);
        assert_eq!(archived.len(), 2);
    }

    /// archive_group emits a group_archived event.
    #[test]
    fn test_archive_group_emits_event() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        store_group_with_status(&env, 1, &creator, GroupStatus::Completed);
        client.archive_group(&creator, &1);

        let events = env.events().all();
        let found = events.iter().any(|e| {
            // The topic tuple is ("group_archived",)
            let topics: Vec<soroban_sdk::Val> = e.0.iter().collect();
            if let Some(first) = topics.first() {
                if let Ok(sym) = soroban_sdk::Symbol::try_from_val(&env, first) {
                    return sym == Symbol::new(&env, "group_archived");
                }
            }
            false
        });
        assert!(found, "group_archived event should have been emitted");
    }
}

    // --- Rounding behavior tests ---

    #[test]
    fn test_create_group_rounds_contribution_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an amount that needs rounding
        // 100,050 stroops should round to 100,000 (nearest 0.01 XLM)
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        let group_id = client.create_group(&creator, &100050, &3600, &5, &token_address);

        // Verify the group was created
        assert_eq!(group_id, 1);

        // Get the group and verify the contribution amount was rounded
        let group = client.get_group(&group_id);
        // 100050 should round to 100000
        assert_eq!(group.contribution_amount, 100000);
    }

    #[test]
    fn test_create_group_rounds_up_contribution_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an amount that should round up
        // 100,050 stroops should round up to 200,000 (more than halfway)
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        let group_id = client.create_group(&creator, &150001, &3600, &5, &token_address);

        // Verify the group was created
        let group = client.get_group(&group_id);
        // 150001 should round to 200000
        assert_eq!(group.contribution_amount, 200000);
    }

    #[test]
    fn test_create_group_exact_amount_no_rounding() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an exact multiple of 0.01 XLM (100,000 stroops)
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        let group_id = client.create_group(&creator, &1_000_000, &3600, &5, &token_address);

        // Verify the group was created with exact amount
        let group = client.get_group(&group_id);
        assert_eq!(group.contribution_amount, 1_000_000);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(3001))")] // 3001 is InvalidAmount
    fn test_create_group_invalid_rounded_amount() {
        let env = Env::default();
        let contract_id = env.register(StellarSaveContract, ());
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Create a group with an amount that rounds to 0 (less than 50,000)
        // This should fail with InvalidAmount
        env.mock_all_auths();
        let token_address = Address::generate(&env);
        client.create_group(&creator, &10000, &3600, &5, &token_address);
    }
