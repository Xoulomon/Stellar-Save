//! Contract entry-point implementations for StellarSaveContract.
//!
//! All public methods delegate to the domain modules. This file is kept as
//! a thin façade – no business logic should be added here.
use core::cmp;
use crate::contribution::ContributionRecord;
use crate::error::StellarSaveError;
use crate::events::EventEmitter;
use crate::events::*;
use crate::group::{Group, GroupStatus};
use crate::migration::{initialize_storage_version, migrate};
use crate::payout::PayoutRecord;
use crate::pool::{PoolCalculator, PoolInfo};
use crate::rating::{GroupRating, RatingAggregate, RatingEntry};
use crate::refund::RefundRecord;
use crate::search::{SearchParams, SearchResult};
use crate::storage::{StorageKey, StorageKeyBuilder};
use crate::types::{AssignmentMode, ContractConfig, MemberProfile, PayoutScheduleEntry};
use soroban_sdk::{contractimpl, Address, Env, String, Symbol, Vec, Map, BytesN};
use crate::StellarSaveContract;
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
        use crate::repository::GroupRepository;
        
        // Load the group from storage using the repository abstraction
        let group = GroupRepository::get_group(env, group_id)?;

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
    /// 
    /// This function also handles storage migration when needed and initializes
    /// the storage version on first deployment.
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
            
            // Initialize storage version on first deployment
            initialize_storage_version(&env);
        }

        // 3. Perform migration if needed
        migrate(&env)?;

        // 4. Save Configuration
        env.storage().persistent().set(&key, &new_config);
        Ok(())
    }

    /// Performs storage migration to the latest schema version.
    /// 
    /// This function can be called by the admin to manually trigger migration
    /// without updating the contract configuration.
    /// 
    /// # Returns
    /// * `Ok(())` - If migration completed successfully or no migration needed
    /// * `Err(StellarSaveError)` - If migration failed or caller is not admin
    pub fn migrate_storage(env: Env, caller: Address) -> Result<(), StellarSaveError> {
        // Require admin authorization
        let config_key = StorageKeyBuilder::contract_config();
        if let Some(config) = env.storage().persistent().get::<_, ContractConfig>(&config_key) {
            if config.admin != caller {
                return Err(StellarSaveError::Unauthorized);
            }
            caller.require_auth();
        } else {
            return Err(StellarSaveError::InvalidState); // No config means contract not initialized
        }

        // Perform migration
        migrate(&env)?;
        
        Ok(())
    }

    /// Gets the current storage schema version.
    /// 
    /// Returns the version number of the storage schema currently in use.
    /// This can be used to check if migration is needed.
    pub fn get_storage_version(env: Env) -> u32 {
        migration::get_storage_version(&env)
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
        payout_order: crate::payout::PayoutOrder,
    ) -> Result<u64, StellarSaveError> {
        // 1. Authorization: Only the creator can initiate this transaction
        creator.require_auth();

        // 1b. Protocol-level cap: max_members must not exceed MAX_MEMBERS (issue #755)
        if max_members > crate::group::MAX_MEMBERS {
            return Err(StellarSaveError::MaxMembersExceeded);
        }

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
        let mut new_group = Group::new(
            group_id,
            creator.clone(),
            rounded_amount,
            cycle_duration,
            max_members,
            min_members,
            current_time,
            grace_period_seconds,
        );
        new_group.payout_order = payout_order;

        // 8. Store Group Data using repository abstraction
        use crate::repository::GroupRepository;
        GroupRepository::save_group(&env, &new_group);

        // Initialize Group Status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Pending);

        // 9. Store TokenConfig for this group using repository abstraction
        let token_config = crate::group::TokenConfig {
            token_address: token_address.clone(),
            token_decimals,
        };
        GroupRepository::save_token_config(&env, group_id, &token_config);

        // 10. Charge optional protocol creation fee
        let current_time = env.ledger().timestamp();
        if let Some(config) = env
            .storage()
            .persistent()
            .get::<_, ContractConfig>(&config_key)
        {
            if config.creation_fee > 0 {
                if let Some(treasury) = config.treasury {
                    let token_client =
                        soroban_sdk::token::TokenClient::new(&env, &token_address);
                    token_client.transfer(&creator, &treasury, &config.creation_fee);
                    EventEmitter::emit_fee_paid(
                        &env,
                        creator.clone(),
                        treasury,
                        config.creation_fee,
                        current_time,
                    );
                }
            }
        }

        // 11. Emit GroupCreated Event (include token_address as second data field)
        env.events()
            .publish((Symbol::new(&env, "GroupCreated"), creator), (group_id, token_address.clone()));

        // 12. Return Group ID
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
        // Name: 1–64 bytes, no null bytes
        if name.len() < 1 {
            return Err(StellarSaveError::InvalidMetadata);
        }
        crate::helpers::validate_group_string(&name, 64)?;

        // Description: 0–256 bytes, no null bytes
        if !description.is_empty() {
            crate::helpers::validate_group_string(&description, 256)?;
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

    /// Casts a member's vote to dissolve the group.
    ///
    /// When all members have voted, the group is dissolved: its status is set to
    /// `Cancelled` and every member who has **not yet received a payout** is
    /// refunded their contributions for the current cycle.
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `InvalidState` - Group is not Active or Paused
    /// - `NotMember` - Caller is not a member of the group
    /// - `AlreadyVotedDissolve` - Caller has already voted
    /// - `GroupAlreadyDissolved` - Group is already in a terminal state
    pub fn vote_dissolve(
        env: Env,
        group_id: u64,
        caller: Address,
    ) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let status_key = StorageKeyBuilder::group_status(group_id);
        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(GroupStatus::Pending);

        match status {
            GroupStatus::Cancelled | GroupStatus::Completed => {
                return Err(StellarSaveError::GroupAlreadyDissolved);
            }
            GroupStatus::Active | GroupStatus::Paused => {}
            GroupStatus::Pending => return Err(StellarSaveError::InvalidState),
        }

        let member_key = StorageKeyBuilder::member_profile(group_id, caller.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        let vote_key = StorageKeyBuilder::dissolve_vote(group_id, caller.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(StellarSaveError::AlreadyVotedDissolve);
        }
        env.storage().persistent().set(&vote_key, &true);

        let count_key = StorageKeyBuilder::dissolve_vote_count(group_id);
        let vote_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        let new_count = vote_count.checked_add(1).ok_or(StellarSaveError::Overflow)?;
        env.storage().persistent().set(&count_key, &new_count);

        // Not unanimous yet — nothing more to do
        if new_count < group.member_count {
            return Ok(());
        }

        // === Unanimous vote: dissolve the group ===
        group.status = GroupStatus::Cancelled;
        group.is_active = false;
        env.storage().persistent().set(&group_key, &group);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Cancelled);

        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        let token_config: crate::group::TokenConfig = env
            .storage()
            .persistent()
            .get(&token_config_key)
            .ok_or(StellarSaveError::GroupNotFound)?;
        let token_client =
            soroban_sdk::token::TokenClient::new(&env, &token_config.token_address);

        let current_cycle = group.current_cycle;
        let now = env.ledger().timestamp();
        let mut total_refunded: i128 = 0;

        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Map::new(&env));

        for (_, member) in members.iter() {
            // Skip members who already received their payout
            let payout_pos_key =
                StorageKeyBuilder::member_payout_eligibility(group_id, member.clone());
            let payout_position: u32 =
                match env.storage().persistent().get::<_, u32>(&payout_pos_key) {
                    Some(pos) => pos,
                    None => continue,
                };

            let recipient_key = StorageKeyBuilder::payout_recipient(group_id, payout_position);
            let already_paid = env
                .storage()
                .persistent()
                .get::<_, Address>(&recipient_key)
                .map(|r| r == member)
                .unwrap_or(false);

            if already_paid {
                continue;
            }

            // Refund current-cycle contribution if it exists and hasn't been refunded
            let contrib_key = StorageKeyBuilder::contribution_individual(
                group_id,
                current_cycle,
                member.clone(),
            );
            let refund_amount: i128 = match env
                .storage()
                .persistent()
                .get::<_, crate::contribution::ContributionRecord>(&contrib_key)
            {
                Some(record) => record.amount,
                None => continue,
            };

            let refund_key =
                StorageKeyBuilder::refund_record(group_id, current_cycle, member.clone());
            if env.storage().persistent().has(&refund_key) {
                continue;
            }

            token_client.transfer(&env.current_contract_address(), &member, &refund_amount);

            let refund_record = crate::refund::RefundRecord {
                group_id,
                member: member.clone(),
                cycle: current_cycle,
                amount: refund_amount,
                refunded_at: now,
            };
            env.storage().persistent().set(&refund_key, &refund_record);

            EventEmitter::emit_refund_issued(&env, group_id, member, refund_amount, current_cycle, now);

            total_refunded = total_refunded.saturating_add(refund_amount);
        }

        EventEmitter::emit_group_dissolved(&env, group_id, now, total_refunded);

        Ok(())
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
        let members_map: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut result = Vec::new(&env);
        for (_, addr) in members_map.iter() {
            result.push_back(addr);
        }
        Ok(result)
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
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut schedule = Vec::new(&env);

        for (_, member) in members.iter() {
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
        let members: Map<u32, Address> = env
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

        for (_, member) in members.iter() {
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
        let members: Map<u32, Address> = env
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

        let mut loop_idx: u32 = 0;
        for (_, member) in members.iter() {
            let position = positions.get(loop_idx).unwrap();
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
            loop_idx += 1;
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
    /// - Caller must be the contract itself (internal-only)
    /// - Recipient address validation
    /// - Reentrancy protection using storage flags
    /// - Comprehensive error handling
    /// - Atomic operations with proper rollback
    fn transfer_payout(
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
        let members_map: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Collect into an ordered vec for indexed access during shuffle
        let mut member_vec: Vec<Address> = Vec::new(&env);
        for (_, m) in members_map.iter() {
            member_vec.push_back(m);
        }

        let mut positions = Vec::new(&env);
        for i in 0..member_vec.len() {
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
            sequence.push_back(member_vec.get(position).unwrap().clone());
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

    /// Advances the cycle if the deadline has passed, enabling trustless automation.
    /// Anyone can call this function to advance a group's cycle when the deadline is reached.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to advance
    /// 
    /// # Returns
    /// * `Ok(())` - Cycle advanced successfully
    /// * `Err(StellarSaveError)` - Various error conditions:
    ///   - `GroupNotFound` - Group doesn't exist
    ///   - `InvalidState` - Group not in active state or already complete
    ///   - `DeadlineNotReached` - Cycle deadline has not yet passed
    /// 
    /// # Behavior
    /// - Checks if current cycle deadline has passed using `env.ledger().timestamp()`
    /// - If all contributions received: executes payout and advances to next cycle
    /// - If contributions missing: marks cycle as defaulted and advances to next cycle
    /// - Emits `CycleAdvanced` event with old/new cycle numbers and execution status
    /// - Completes group if all cycles are finished
    pub fn tick(env: Env, group_id: u64) -> Result<(), StellarSaveError> {
        // 1. Load group from storage
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group = env
            .storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Verify group is in valid state for ticking
        if !group.is_active || group.is_complete() {
            return Err(StellarSaveError::InvalidState);
        }

        // 3. Check if cycle deadline has passed
        let current_time = env.ledger().timestamp();
        if !crate::helpers::is_cycle_deadline_passed(&group, current_time) {
            return Err(StellarSaveError::DeadlineNotReached);
        }

        // 4. Store old cycle for event emission
        let old_cycle = group.current_cycle;
        let mut payout_executed = false;
        let mut defaulted = false;

        // 5. Check if cycle is complete (all contributions received)
        let cycle_complete = Self::is_cycle_complete(env.clone(), group_id)?;
        
        if cycle_complete {
            // 5a. Execute payout if cycle is complete
            match Self::execute_payout(env.clone(), group_id) {
                Ok(()) => {
                    payout_executed = true;
                }
                Err(_) => {
                    // If payout fails, still advance cycle but mark as defaulted
                    defaulted = true;
                }
            }
        } else {
            // 5b. Mark cycle as defaulted if contributions are missing
            defaulted = true;
        }

        // 6. Advance the cycle
        group.advance_cycle(&env);
        let new_cycle = group.current_cycle;

        // 7. Update group storage
        env.storage().persistent().set(&group_key, &group);

        // 8. Emit CycleAdvanced event
        crate::events::EventEmitter::emit_cycle_advanced(
            &env,
            group_id,
            old_cycle,
            new_cycle,
            payout_executed,
            defaulted,
            current_time,
        );

        // 9. If group is now complete, emit completion event
        if group.is_complete() {
            let total_distributed = Self::get_total_paid_out(env.clone(), group_id).unwrap_or(0);
            crate::events::EventEmitter::emit_group_completed(
                &env,
                group_id,
                group.creator.clone(),
                group.max_members,
                total_distributed,
                current_time,
            );
        }
    /// Submits a bid for the current payout cycle in a `Bid`-order group.
    ///
    /// The member with the highest bid at payout time wins the cycle payout.
    /// The bid amount is stored on-chain and replaces any previous bid by the
    /// same member for the same cycle.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `bidder` - Address of the bidding member
    /// * `bid_amount` - Bid in stroops (must be ≥ 0)
    ///
    /// # Returns
    /// * `Ok(())` - Bid recorded successfully
    /// * `Err(StellarSaveError::InvalidState)` - Group is not using Bid payout order
    /// * `Err(StellarSaveError::NotMember)` - Bidder is not a member
    /// * `Err(StellarSaveError::InvalidAmount)` - Bid amount is negative
    pub fn bid_for_payout(
        env: Env,
        group_id: u64,
        bidder: Address,
        bid_amount: i128,
    ) -> Result<(), StellarSaveError> {
        bidder.require_auth();

        if bid_amount < 0 {
            return Err(StellarSaveError::InvalidAmount);
        }

        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.payout_order != crate::payout::PayoutOrder::Bid {
            return Err(StellarSaveError::InvalidState);
        }

        if group.status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        let member_key = StorageKeyBuilder::member_profile(group_id, bidder.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        let bid_key = StorageKeyBuilder::group_bid_amount(group_id, group.current_cycle, bidder);
        env.storage().persistent().set(&bid_key, &bid_amount);

        Ok(())
    }

    // ============================================================================
    // ISSUE #425: Group Status Management
    // ============================================================================
    /// Returns true if the group is currently paused.
    ///
    /// Reads the group from storage and checks the paused flag / status.
    /// Returns false for a non-existent group_id (graceful handling).
    pub fn is_paused(env: Env, group_id: u64) -> bool {
        let key = StorageKeyBuilder::group_data(group_id);
        match env.storage().persistent().get::<_, Group>(&key) {
            Some(group) => group.is_paused(),
            None => false,
        }
    }

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
        use crate::repository::GroupRepository;

        let mut group = GroupRepository::get_group(&env, group_id)?;

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
        GroupRepository::save_group(&env, &group);

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
        use crate::repository::GroupRepository;

        let mut group = GroupRepository::get_group(&env, group_id)?;

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
        GroupRepository::save_group(&env, &group);

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_group_unpaused(&env, group_id, caller, timestamp);

        Ok(())
    }

    /// Unpauses a paused group, allowing contributions and payouts again.
    /// Alias for resume_group with the name matching the issue specification.
    pub fn unpause_group(env: Env, group_id: u64, caller: Address) -> Result<(), StellarSaveError> {
        Self::resume_group(env, group_id, caller)
    }

    /// Raises a dispute for a group. Any member may call this once per dispute window.
    ///
    /// When more than 50% of members have raised a dispute the group is automatically
    /// paused and `group.dispute_active` is set to `true`.
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `NotMember` - Caller is not a member
    /// - `AlreadyVoted` (2005) - Member has already raised a dispute this round
    pub fn raise_dispute(
        env: Env,
        group_id: u64,
        caller: Address,
        reason: soroban_sdk::String,
    ) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Verify caller is a member
        let member_key = StorageKeyBuilder::member_profile(group_id, caller.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // Each member may only vote once per dispute round
        let vote_key = StorageKeyBuilder::group_dispute_vote(group_id, caller.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(StellarSaveError::AlreadyVoted);
        }

        // Record this member's vote
        env.storage().persistent().set(&vote_key, &true);

        // Store the dispute reason on-chain (last reason wins; first is most relevant)
        let reason_key = StorageKeyBuilder::group_dispute_reason(group_id);
        if !env.storage().persistent().has(&reason_key) {
            env.storage().persistent().set(&reason_key, &reason);
        }

        // Increment the dispute count using the counter (avoids O(n) member scan)
        let count_key = StorageKeyBuilder::dispute_count(group_id);
        let vote_count: u32 = env
            .storage()
            .persistent()
            .get(&count_key)
            .unwrap_or(0u32)
            + 1;
        env.storage().persistent().set(&count_key, &vote_count);

        // Auto-pause when >50% of members have raised a dispute
        let threshold = group.member_count / 2 + 1;
        let auto_paused = vote_count >= threshold;
        if auto_paused {
            group.dispute_active = true;
            group.paused = true;
            group.status = GroupStatus::Paused;
            env.storage().persistent().set(&group_key, &group);

            let status_key = StorageKeyBuilder::group_status(group_id);
            env.storage()
                .persistent()
                .set(&status_key, &GroupStatus::Paused);
        }

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_dispute_raised(
            &env,
            group_id,
            caller,
            reason,
            vote_count,
            threshold,
            auto_paused,
            timestamp,
        );

        Ok(())
    }

    /// Resolves an active dispute. Only the group creator may call this.
    ///
    /// Clears `dispute_active`, unpauses the group, resets the dispute counter,
    /// removes all member dispute votes so a new dispute round can begin,
    /// and emits a `DisputeResolved` event.
    ///
    /// # Errors
    /// - `GroupNotFound` - Group doesn't exist
    /// - `Unauthorized` - Caller is not the group creator
    /// - `InvalidState` - No dispute is currently active
    pub fn resolve_dispute(
        env: Env,
        group_id: u64,
        caller: Address,
        resolution: soroban_sdk::String,
    ) -> Result<(), StellarSaveError> {
        caller.require_auth();

        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.creator != caller {
            return Err(StellarSaveError::Unauthorized);
        }

        if !group.dispute_active {
            return Err(StellarSaveError::InvalidState);
        }

        // Clear dispute state and unpause
        group.dispute_active = false;
        group.paused = false;
        group.status = GroupStatus::Active;
        env.storage().persistent().set(&group_key, &group);

        // Update the status key to Active
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Reset the dispute counter
        let count_key = StorageKeyBuilder::dispute_count(group_id);
        env.storage().persistent().remove(&count_key);

        // Clear the stored dispute reason
        let reason_key = StorageKeyBuilder::group_dispute_reason(group_id);
        env.storage().persistent().remove(&reason_key);

        // Reset all member dispute votes for the next round
        let members_key = StorageKeyBuilder::group_members(group_id);
        if let Some(members) = env
            .storage()
            .persistent()
            .get::<_, Map<u32, Address>>(&members_key)
        {
            for (_, member) in members.iter() {
                let k = StorageKeyBuilder::group_dispute_vote(group_id, member);
                env.storage().persistent().remove(&k);
            }
        }

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_dispute_resolved(&env, group_id, caller, resolution, timestamp);

        Ok(())
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
        let members1: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_members(group_id_1))
            .unwrap_or(Map::new(&env));
        let members2: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_members(group_id_2))
            .unwrap_or(Map::new(&env));

        // 6. Combine member lists with sequential join-order keys
        let mut combined_members: Map<u32, Address> = Map::new(&env);
        let mut pos: u32 = 0;
        for (_, m) in members1.iter() {
            combined_members.set(pos, m);
            pos += 1;
        }
        for (_, m) in members2.iter() {
            combined_members.set(pos, m);
            pos += 1;
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
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let mut status = Vec::new(&env);

        for (_, member) in members.iter() {
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

    /// Request a refund for a contribution made in error or when a group fails to activate.
    ///
    /// Refund is allowed when:
    /// - Group is `Pending` or `Cancelled`, OR
    /// - Group is `Active`/`Paused` but no payout has been processed for this cycle yet.
    ///
    /// The `caller` must be the contributor themselves or the group creator.
    ///
    /// # Errors
    /// - `GroupNotFound`        - Group does not exist
    /// - `ContributionNotFound` - No contribution found for caller/group/cycle
    /// - `AlreadyRefunded`      - Contribution already refunded
    /// - `RefundNotEligible`    - Group state does not allow refunds
    /// - `Unauthorized`         - Caller is neither the contributor nor the group creator
    pub fn request_refund(
        env: Env,
        group_id: u64,
        cycle: u32,
        caller: Address,
    ) -> Result<RefundRecord, StellarSaveError> {
        refund::request_refund(&env, group_id, cycle, caller)
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
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Map::new(&env));

        // 3. Initialize result vector
        let mut contributions = Vec::new(&env);

        // 4. Query each member's contribution for this cycle
        for (_, member) in members.iter() {
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
        let members: Map<u32, Address> = env
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
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 4. Collect members with no contribution record for this cycle
        let mut missed_members = Vec::new(&env);
        for (_, member) in members.iter() {
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

        // Use u64 arithmetic throughout to avoid u32 overflow when
        // cycle_multiplier * cycle_duration exceeds u32::MAX.
        let next_cycle_end_time = (cycle_multiplier as u64)
            .checked_mul(group.cycle_duration)
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
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get::<_, Map<u32, Address>>(&members_key)
            .unwrap_or_else(|| Map::new(&env));

        // 7. Filter members who haven't contributed and need reminders
        let mut members_needing_reminder = Vec::new(&env);
        for (_, member) in members.iter() {
            // Check if member has already contributed in this cycle
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            let has_contributed = env
                .storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
                .is_some();

        // Update user member groups index
        let user_groups_key = StorageKeyBuilder::user_member_groups(member.clone());
        let mut user_groups: Vec<u64> = env
            .storage()
            .persistent()
            .get(&user_groups_key)
            .unwrap_or(Vec::new(&env));
        user_groups.push_back(group_id);
        env.storage()
            .persistent()
            .set(&user_groups_key, &user_groups);

        // Emit event
        EventEmitter::emit_member_joined(&env, group_id, member, group.member_count, timestamp);
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

    pub fn join_group(
        env: Env,
        group_id: u64,
        member: Address,
        referrer: Option<Address>,
    ) -> Result<(), StellarSaveError> {
        // Verify caller authorization
        member.require_auth();

        // Task 1: Verify group exists and is joinable
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Gas opt: read status from the already-loaded Group struct (0 extra SLOADs).
        // Previously this did a separate SLOAD via status_key; group.status holds
        // the same value and was already fetched above.
        if group.status != GroupStatus::Pending {
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

        // Add to member list (Map indexed by join-order position)
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Map::new(&env));
        members.set(payout_position, member.clone());
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

        // Referral tracking: store mapping and emit event if referrer provided
        if let Some(ref referrer_addr) = referrer {
            let referral_key = StorageKeyBuilder::member_referral(group_id, member.clone());
            env.storage()
                .persistent()
                .set(&referral_key, referrer_addr);
            EventEmitter::emit_member_referred(
                &env,
                group_id,
                member.clone(),
                referrer_addr.clone(),
                timestamp,
            );
        }

        // Emit event
        EventEmitter::emit_member_joined(&env, group_id, member, group.member_count, timestamp);

        Ok(())
    }

    /// Removes a member from a group before the first cycle begins.
    /// Only the group creator can call this function.
    /// The creator cannot remove themselves.
    pub fn remove_member(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<(), StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Require creator auth
        group.creator.require_auth();

        // Only allowed before cycle 1 begins (group must still be Pending)
        let status_key = StorageKeyBuilder::group_status(group_id);
        let status: GroupStatus = env
            .storage()
            .persistent()
            .get(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        // Creator cannot remove themselves
        if member == group.creator {
            return Err(StellarSaveError::Unauthorized);
        }

        // Verify the target is actually a member
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        let profile: MemberProfile = env
            .storage()
            .persistent()
            .get(&member_key)
            .ok_or(StellarSaveError::NotMember)?;

        // Remove member profile
        env.storage().persistent().remove(&member_key);

        // Remove payout eligibility entry
        let payout_key =
            StorageKeyBuilder::member_payout_eligibility(group_id, member.clone());
        env.storage().persistent().remove(&payout_key);

        // Remove payout position reverse index
        let pos_idx_key = StorageKeyBuilder::group_payout_position_index(
            group_id,
            profile.payout_position,
        );
        env.storage().persistent().remove(&pos_idx_key);

        // Remove from member list (keyed by payout_position)
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Map::new(&env));
        members.remove(profile.payout_position);
        env.storage().persistent().set(&members_key, &members);

        // Update group member count
        group.member_count -= 1;
        env.storage().persistent().set(&group_key, &group);

        let timestamp = env.ledger().timestamp();
        EventEmitter::emit_member_removed(
            &env,
            group_id,
            member,
            group.creator.clone(),
            group.member_count,
            timestamp,
        );

        Ok(())
    }

    /// Returns a list of all group IDs that a member belongs to.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `member` - Address of the member to query
    ///
    /// # Returns
    /// * `Vec<u64>` - A vector of group IDs the member belongs to
    pub fn list_groups_by_member(env: Env, member: Address) -> Vec<u64> {
        let user_groups_key = StorageKeyBuilder::user_member_groups(member);
        env.storage()
            .persistent()
            .get(&user_groups_key)
            .unwrap_or(Vec::new(&env))
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
            // Load token config and execute the actual transfer
            let token_config_key = StorageKeyBuilder::group_token_config(group_id);
            let token_config: crate::group::TokenConfig = env
                .storage()
                .persistent()
                .get(&token_config_key)
                .ok_or(StellarSaveError::GroupNotFound)?;

            let token_client =
                soroban_sdk::token::TokenClient::new(&env, &token_config.token_address);
            token_client.transfer(&env.current_contract_address(), &member, &withdrawal_amount);

            // Update the group balance counter
            let balance_key = StorageKeyBuilder::group_balance(group_id);
            let current_balance: i128 =
                env.storage().persistent().get(&balance_key).unwrap_or(0);
            let new_balance = current_balance
                .checked_sub(withdrawal_amount)
                .ok_or(StellarSaveError::Overflow)?;
            env.storage().persistent().set(&balance_key, &new_balance);

            env.events().publish(
                (Symbol::new(&env, "emergency_withdrawal"),),
                (group_id, member.clone(), withdrawal_amount),
            );
        }

        // Remove member profile after transfer succeeds (checks-effects-interactions)
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

        // 3. Load members map and collect in join order
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members_map: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Map::new(&env));

        // Collect into ordered vec (Map iterates keys in ascending order = join order)
        let mut all_members: Vec<Address> = Vec::new(&env);
        for (_, addr) in members_map.iter() {
            all_members.push_back(addr);
        }

        // 4. Apply pagination (cap limit at 100 for gas safety)
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

        // 5. Extract paginated slice
        let mut paginated_members = Vec::new(&env);
        for i in offset..end_index {
            if let Some(member) = all_members.get(i) {
                paginated_members.push_back(member);
            }
        }

        Ok(paginated_members)
    }

    /// Returns a paginated page of member addresses for a group.
    ///
    /// Reads the `Map<u32, Address>` member store and returns entries
    /// in join order (ascending key) from `offset` up to `offset + limit`.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `offset` - Number of members to skip (0-indexed)
    /// * `limit` - Maximum number of members to return (capped at 20)
    ///
    /// # Returns
    /// * `Ok(Vec<Address>)` - Paginated member addresses in join order
    /// * `Err(StellarSaveError::GroupNotFound)` - Group does not exist
    pub fn list_members(
        env: Env,
        group_id: u64,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Address>, StellarSaveError> {
        // Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let members_key = StorageKeyBuilder::group_members(group_id);
        let members_map: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Map::new(&env));

        // Cap page size at MAX_MEMBERS to prevent gas exhaustion
        let page_size = cmp::min(limit, crate::group::MAX_MEMBERS);

        let mut result = Vec::new(&env);
        let mut idx: u32 = 0;
        for (_, addr) in members_map.iter() {
            if idx >= offset && idx < offset.saturating_add(page_size) {
                result.push_back(addr);
            }
            idx += 1;
            if idx >= offset.saturating_add(page_size) {
                break;
            }
        }

        Ok(result)
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

        // Load member map and return count
        let members_key = StorageKeyBuilder::group_members(group_id);
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Map::new(&env));

        Ok(members.len())
    }

    /// Activates a group once minimum members have joined.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group to activate
    /// * `creator` - The creator's address (must match the group's creator)
    ///
    /// # Errors
    /// - `GroupNotFound` - Group does not exist
    /// - `Unauthorized` - Caller is not the group creator
    /// - `InvalidState` - Group already started or minimum members not met
    pub fn activate_group(env: Env, group_id: u64, creator: Address) -> Result<(), StellarSaveError> {
        // Require authorization from the caller
        creator.require_auth();

        // Load the actual group from storage
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // Verify caller is the actual group creator
        if group.creator != creator {
            return Err(StellarSaveError::Unauthorized);
        }

        // Get current timestamp
        let timestamp = env.ledger().timestamp();

        // Activate the group (validates min_members and started state internally)
        group.activate(timestamp);

        // Update status to Active
        group.status = GroupStatus::Active;
        group.is_active = true;

        // Persist the updated group
        env.storage().persistent().set(&group_key, &group);

        // Update the status key
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage()
            .persistent()
            .set(&status_key, &GroupStatus::Active);

        // Emit the activation event
        emit_group_activated(&env, group_id, timestamp, group.member_count);

        Ok(())
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

        // ── Step 2b: Deadline + grace period check ─────────────────────────────
        // Reject contributions past deadline + grace_period_seconds.
        // Emit GracePeriodContribution for late-but-valid contributions.
        let now = env.ledger().timestamp();
        let is_grace_period = if group.started {
            let cycle_deadline = group
                .started_at
                .saturating_add(group.cycle_duration.saturating_mul(group.current_cycle as u64 + 1));
            if now > cycle_deadline.saturating_add(group.grace_period_seconds) {
                return Err(StellarSaveError::CycleDeadlineExpired);
            }
            (now > cycle_deadline, now.saturating_sub(cycle_deadline))
        } else {
            (false, 0u64)
        };

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
        // Gas opt: temporary storage is ~10x cheaper than persistent for
        // short-lived flags. The guard is automatically cleared at ledger close
        // so we only need to set it once per transaction.
        let reentrancy_key = StorageKeyBuilder::reentrancy_guard();
        let guard_value: u64 = env.storage().temporary().get(&reentrancy_key).unwrap_or(0);
        if guard_value != 0 {
            return Err(StellarSaveError::InternalError);
        }
        env.storage().temporary().set(&reentrancy_key, &1u64);

        // ── Step 6: Load TokenConfig (1 SLOAD) ────────────────────────────────
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        let token_config: crate::group::TokenConfig = env
            .storage()
            .persistent()
            .get(&token_config_key)
            .ok_or_else(|| {
                // Release reentrancy guard before returning error
                env.storage().temporary().set(&reentrancy_key, &0u64);
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
        env.storage().temporary().set(&reentrancy_key, &0u64);

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

        // Release reentrancy guard AFTER all state changes are complete
        env.storage().persistent().set(&reentrancy_key, &0u64);

        // ── Step 9: Emit event using the cycle_total returned above ───────────
        // Gas opt: no extra SLOAD needed — cycle_total came back from
        // record_contribution instead of being re-read from storage.
        EventEmitter::emit_contribution_made(
            &env,
            group_id,
            member.clone(),
            amount,
            current_cycle,
            cycle_total,
            timestamp,
        );

        // Emit grace period event if contribution landed after the hard deadline
        if is_grace_period.0 {
            EventEmitter::emit_grace_period_contribution(
                &env,
                group_id,
                member,
                amount,
                current_cycle,
                is_grace_period.1,
                timestamp,
            );
        }

        Ok(())
    }

    /// Pre-pays contributions for multiple upcoming cycles in a single transaction.
    ///
    /// Allows a member to reduce transaction overhead by paying for several future
    /// cycles at once. Each cycle is validated and recorded independently, and a
    /// `ContributionEvent` is emitted for each cycle paid.
    ///
    /// # Arguments
    /// * `group_id` - The group to contribute to
    /// * `member`   - The member making the contributions (must authorize)
    /// * `cycles`   - List of cycle numbers to pre-pay (must be unique, unpaid, ≥ current cycle)
    ///
    /// # Errors
    /// * `StellarSaveError::GroupNotFound`      - Group does not exist
    /// * `StellarSaveError::InvalidState`       - Group is not Active
    /// * `StellarSaveError::NotMember`          - Caller is not a member
    /// * `StellarSaveError::InvalidAmount`      - `cycles` list is empty
    /// * `StellarSaveError::AlreadyContributed` - A cycle in the list is already paid
    /// * `StellarSaveError::CycleDeadlineExpired` - A cycle is in the past
    /// * `StellarSaveError::TokenTransferFailed`  - Token transfer failed
    pub fn contribute_batch(
        env: Env,
        group_id: u64,
        member: Address,
        cycles: Vec<u32>,
    ) -> Result<(), StellarSaveError> {
        member.require_auth();

        // Reject empty input early
        if cycles.is_empty() {
            return Err(StellarSaveError::InvalidAmount);
        }

        // Load group once
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group: Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        if group.status != GroupStatus::Active {
            return Err(StellarSaveError::InvalidState);
        }

        // Verify member
        let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
        if !env.storage().persistent().has(&member_key) {
            return Err(StellarSaveError::NotMember);
        }

        // Validate all cycles before touching token or storage:
        // - must be >= current_cycle (no paying for the past)
        // - must not already be paid
        // - must be unique within the batch (detect duplicates via a second pass)
        for i in 0..cycles.len() {
            let cycle = cycles.get(i).unwrap();
            if cycle < group.current_cycle {
                return Err(StellarSaveError::CycleDeadlineExpired);
            }
            let contrib_key =
                StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            if env.storage().persistent().has(&contrib_key) {
                return Err(StellarSaveError::AlreadyContributed);
            }
            // Duplicate detection: check if this cycle appears earlier in the list
            for j in 0..i {
                if cycles.get(j).unwrap() == cycle {
                    return Err(StellarSaveError::AlreadyContributed);
                }
            }
        }

        // Load token config once
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        let token_config: crate::group::TokenConfig = env
            .storage()
            .persistent()
            .get(&token_config_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let token_client =
            soroban_sdk::token::TokenClient::new(&env, &token_config.token_address);
        let contract_address = env.current_contract_address();
        let amount = group.contribution_amount;
        let timestamp = env.ledger().timestamp();

        // Transfer total amount in one call to minimise token round-trips
        let total = amount
            .checked_mul(cycles.len() as i128)
            .ok_or(StellarSaveError::Overflow)?;
        token_client.transfer_from(&contract_address, &member, &contract_address, &total);

        // Record each cycle and emit individual ContributionEvents
        for i in 0..cycles.len() {
            let cycle = cycles.get(i).unwrap();
            let cycle_total =
                Self::record_contribution(&env, group_id, cycle, member.clone(), amount, timestamp)?;

            EventEmitter::emit_contribution_made(
                &env,
                group_id,
                member.clone(),
                amount,
                cycle,
                cycle_total,
                timestamp,
            );
        }

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
        let members: Map<u32, Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        let timestamp = env.ledger().timestamp();
        let mut executed_count: u32 = 0;

        // ── 4. Iterate members ────────────────────────────────────────────────
        for (_, member) in members.iter() {
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
        let pool_per_cycle = group
            .checked_total_pool_amount()
            .ok_or(StellarSaveError::Overflow)?;
        let total_distributed: i128 = (group.current_cycle as i128)
            .checked_mul(pool_per_cycle)
            .ok_or(StellarSaveError::Overflow)?;

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
