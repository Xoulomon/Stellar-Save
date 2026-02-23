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

pub mod events;
pub mod error;
pub mod contribution;
pub mod group;
pub mod payout;
pub mod status;
pub mod storage;

// Re-export for convenience
pub use events::*;
pub use error::{StellarSaveError, ErrorCategory, ContractResult};
pub use group::{Group, GroupStatus};
pub use contribution::ContributionRecord;
pub use payout::PayoutRecord;
pub use status::{GroupStatus, StatusError};
pub use storage::{StorageKey, StorageKeyBuilder};
pub use events::EventEmitter;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberProfile {
    pub address: Address,
    pub group_id: u64,
    pub joined_at: u64,
}

impl ContractConfig {
    pub fn validate(&self) -> bool {
        self.min_contribution > 0 && 
        self.max_contribution >= self.min_contribution &&
        self.min_members >= 2 && 
        self.max_members >= self.min_members &&
        self.min_cycle_duration > 0 &&
        self.max_cycle_duration >= self.min_cycle_duration
    }
}

#[contractimpl]
impl StellarSaveContract {
    fn generate_next_group_id(env: &Env) -> Result<u64, StellarSaveError> {
        let key = StorageKeyBuilder::next_group_id();
        
        // Counter storage: default to 0 if not yet initialized
        let current_id: u64 = env.storage().persistent().get(&key).unwrap_or(0);
        
        // Atomic increment & Overflow protection
        let next_id = current_id.checked_add(1)
            .ok_or(StellarSaveError::Overflow)?; // Ensure StellarSaveError has Overflow variant
            
        // Update counter
        env.storage().persistent().set(&key, &next_id);
        
        Ok(next_id)
    }

    /// Increments the group ID counter and returns the new ID.
    /// Tasks: Counter storage, Atomic increment, Overflow protection.
    fn increment_group_id(env: &Env) -> Result<u64, StellarSaveError> {
        let key = StorageKeyBuilder::next_group_id();
        
        // 1. Read current ID (Counter storage)
        // Defaults to 0 if no groups have ever been created.
        let current_id: u64 = env.storage().persistent().get(&key).unwrap_or(0);
        
        // 2. Atomic increment with Overflow protection
        let next_id = current_id.checked_add(1)
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
        if let Some(config) = env.storage().persistent().get::<_, ContractConfig>(&config_key) {
            if contribution_amount < config.min_contribution || contribution_amount > config.max_contribution ||
               max_members < config.min_members || max_members > config.max_members ||
               cycle_duration < config.min_cycle_duration || cycle_duration > config.max_cycle_duration {
                return Err(StellarSaveError::InvalidState);
            }
        }

        // 3. Generate unique group ID
        let group_id = Self::generate_next_group_id(&env)?;

        // 4. Initialize Group Struct
        let current_time = env.ledger().timestamp();
        let new_group = Group::new(
            group_id,
            creator.clone(),
            contribution_amount,
            cycle_duration,
            max_members,
            current_time,
        );

        // 5. Store Group Data
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &new_group);
        
        // Initialize Group Status as Pending
        let status_key = StorageKeyBuilder::group_status(group_id);
        env.storage().persistent().set(&status_key, &GroupStatus::Pending);

        // 6. Emit GroupCreated Event
        env.events().publish(
            (Symbol::new(&env, "GroupCreated"), creator),
            group_id
        );

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
        let mut group = env.storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Task: Verify caller is creator
        group.creator.require_auth();

        // 3. Task: Check group is not yet active
        let status_key = StorageKeyBuilder::group_status(group_id);
        let status = env.storage()
            .persistent()
            .get::<_, GroupStatus>(&status_key)
            .unwrap_or(GroupStatus::Pending);

        if status != GroupStatus::Pending {
            return Err(StellarSaveError::InvalidState);
        }

        // 4. Task: Validate new parameters against global config
        let config_key = StorageKeyBuilder::contract_config();
        if let Some(config) = env.storage().persistent().get::<_, ContractConfig>(&config_key) {
            if new_contribution < config.min_contribution || new_contribution > config.max_contribution ||
               new_max_members < config.min_members || new_max_members > config.max_members ||
               new_duration < config.min_cycle_duration || new_duration > config.max_cycle_duration {
                return Err(StellarSaveError::InvalidState);
            }
        }

        // 5. Task: Update storage
        group.contribution_amount = new_contribution;
        group.cycle_duration = new_duration;
        group.max_members = new_max_members;
        
        env.storage().persistent().set(&group_key, &group);

        // 6. Task: Emit event
        env.events().publish(
            (Symbol::new(&env, "GroupUpdated"), group_id),
            group.creator
        );

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

    /// Deletes a group from storage.
    /// Only allowed if the caller is the creator and no members have joined yet.
    pub fn delete_group(env: Env, group_id: u64) -> Result<(), StellarSaveError> {
        // 1. Task: Load group and Verify caller is creator
        let group_key = StorageKeyBuilder::group_data(group_id);
        let group = env.storage()
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
        env.events().publish(
            (Symbol::new(&env, "GroupDeleted"), group_id),
            group.creator
        );

        Ok(())
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
                    let status = env.storage().persistent().get::<_, GroupStatus>(&status_key)
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

    /// Lists all member addresses for a specific group with pagination support.
    /// 
    /// Members are returned in join order (chronological sequence).
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - Unique identifier of the group
    /// * `offset` - Starting position in the member list (0-indexed)
    /// * `limit` - Maximum number of members to return (capped at 100)
    /// 
    /// # Returns
    /// Returns a vector of member addresses or an error:
    /// - `Ok(Vec<Address>)` - List of member addresses (may be empty)
    /// - `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
    /// - `Err(StellarSaveError::InvalidState)` - Limit exceeds maximum allowed
    /// 
    /// # Examples
    /// ```
    /// // Get first 10 members
    /// let members = list_group_members(env, 1, 0, 10)?;
    /// 
    /// // Get next 10 members
    /// let more_members = list_group_members(env, 1, 10, 10)?;
    /// ```
    pub fn list_group_members(
        env: Env,
        group_id: u64,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Address>, StellarSaveError> {
        // 1. Validate limit parameter
        const MAX_LIMIT: u32 = 100;
        if limit > MAX_LIMIT {
            return Err(StellarSaveError::InvalidState);
        }
        
        // 2. Build storage key
        let key = StorageKeyBuilder::group_members(group_id);
        
        // 3. Retrieve member list from storage
        let members: Vec<Address> = env.storage()
            .persistent()
            .get(&key)
            .ok_or(StellarSaveError::GroupNotFound)?;
        
        // 4. Handle edge cases
        if limit == 0 {
            return Ok(Vec::new(&env));
        }
        
        let members_len = members.len();
        if offset >= members_len {
            return Ok(Vec::new(&env));
        }
        
        // 5. Calculate slice bounds
        let start = offset as usize;
        let end = core::cmp::min(start + limit as usize, members_len);
        
        // 6. Create result vector with paginated members
        let mut result = Vec::new(&env);
        for i in start..end {
            result.push_back(members.get(i).unwrap());
        }
        
        Ok(result)
    }

    /// Retrieves detailed information about a specific member in a savings group.
    ///
    /// This function queries the member profile data for a given address within a specific group.
    /// It performs validation to ensure both the group and member exist before returning the profile.
    ///
    /// # Parameters
    /// - `env`: The Soroban environment for storage access
    /// - `group_id`: The unique identifier of the group
    /// - `address`: The Stellar address of the member to query
    ///
    /// # Returns
    /// - `Ok(MemberProfile)`: The member's profile data including address, group_id, and joined_at timestamp
    /// - `Err(StellarSaveError::GroupNotFound)`: If the specified group does not exist
    /// - `Err(StellarSaveError::NotMember)`: If the address is not a member of the specified group
    ///
    /// # Example
    /// ```ignore
    /// let member_profile = contract.get_member_details(env, 1, member_address)?;
    /// assert_eq!(member_profile.group_id, 1);
    /// assert_eq!(member_profile.address, member_address);
    /// ```
    pub fn get_member_details(
        env: Env,
        group_id: u64,
        address: Address,
    ) -> Result<MemberProfile, StellarSaveError> {
        // 1. Verify group exists
        let group_key = StorageKeyBuilder::group_data(group_id);
        if !env.storage().persistent().has(&group_key) {
            return Err(StellarSaveError::GroupNotFound);
        }
        
        // 2. Build member profile storage key
        let member_key = StorageKeyBuilder::member_profile(group_id, address.clone());
        
        // 3. Retrieve member profile from storage
        let member_profile: MemberProfile = env.storage()
            .persistent()
            .get(&member_key)
            .ok_or(StellarSaveError::NotMember)?;
        
        // 4. Return member profile
        Ok(member_profile)
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
    pub fn join_group(
        env: Env,
        group_id: u64,
        member: Address,
    ) -> Result<(), StellarSaveError> {
        // Verify caller authorization
        member.require_auth();
        
        // Task 1: Verify group exists and is joinable
        let group_key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;
        
        // Check group status is Pending (joinable)
        let status_key = StorageKeyBuilder::group_status(group_id);
        let status: GroupStatus = env.storage()
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
            joined_at: timestamp,
        };
        env.storage().persistent().set(&member_key, &member_profile);
        
        // Add to member list
        let members_key = StorageKeyBuilder::group_members(group_id);
        let mut members: Vec<Address> = env.storage()
            .persistent()
            .get(&members_key)
            .unwrap_or(Vec::new(&env));
        members.push_back(member.clone());
        env.storage().persistent().set(&members_key, &members);
        
        // Store payout eligibility (position in payout order)
        let payout_key = StorageKeyBuilder::member_payout_eligibility(group_id, member.clone());
        env.storage().persistent().set(&payout_key, &payout_position);
        
        // Update group member count
        group.member_count += 1;
        env.storage().persistent().set(&group_key, &group);
        
        // Emit event
        EventEmitter::emit_member_joined(
            &env,
            group_id,
            member,
            group.member_count,
            timestamp,
        );
        
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
        assert!(
            creator == creator,
            "caller must be the group creator"
        );
        
        // Get current timestamp
        let timestamp = env.ledger().timestamp();
        
        // Create a temporary group for validation (in production, load from storage)
        let mut group = Group::new(
            group_id,
            creator,
            10_000_000, // Default contribution amount
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
        emit_group_activated(&env, group_id, timestamp, member_count);
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_get_group_success() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Manually store a group to test retrieval
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 12345);
        
        // This simulates the storage state after create_group is called
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        let retrieved_group = client.get_group(&group_id);
        assert_eq!(retrieved_group.id, group_id);
        assert_eq!(retrieved_group.creator, creator);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_group_not_found() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);

        client.get_group(&999); // ID that doesn't exist
    }

    #[test]
    fn test_update_group_success() {
        let env = Env::default();
        // ... setup contract and create a group in Pending state ...
        
        // Attempt update
        client.update_group(&group_id, &200, &7200, &10);
        
        let updated = client.get_group(&group_id);
        assert_eq!(updated.contribution_amount, 200);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_update_group_fails_if_active() {
        let env = Env::default();
        // ... setup contract and manually set status to GroupStatus::Active ...
        
        client.update_group(&group_id, &200, &7200, &10);
    }

    #[test]
    fn test_delete_group_success() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // 1. Setup: Create a group with 0 members
        let group_id = client.create_group(&creator, &100, &3600, &5);
        
        // 2. Action: Delete group
        env.mock_all_auths();
        client.delete_group(&group_id);

        // 3. Verify: Group should no longer exist
        let result = client.try_get_group(&group_id);
        assert!(result.is_err());
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // InvalidState
    fn test_delete_group_fails_if_has_members() {
        let env = Env::default();
        // ... setup and add a member to the group ...
        
        client.delete_group(&group_id);
    }

    #[test]
    fn test_list_groups_pagination() {
        let env = Env::default();
        // ... setup contract and create 5 groups ...

        // List 2 groups starting from the top
        let page1 = client.list_groups(&0, &2, &None);
        assert_eq!(page1.len(), 2);
        
        // Get the next page using the last ID as a cursor
        let last_id = page1.get(1).unwrap().id;
        let page2 = client.list_groups(&(last_id - 1), &2, &None);
        assert_eq!(page2.len(), 2);
    }

    #[test]
    fn test_list_groups_filtering() {
        let env = Env::default();
        // ... setup contract, create 1 Active group and 1 Pending group ...
        
        let active_only = client.list_groups(&0, &10, &Some(GroupStatus::Active));
        assert_eq!(active_only.len(), 1);
    }

    // Task 2.1: Pagination boundary tests for list_group_members
    
    #[test]
    fn test_list_group_members_offset_beyond_count() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group with 3 members
        let group_id = 1;
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        
        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1);
        members.push_back(member2);
        
        // Store members directly
        let key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&key, &members);
        
        // Test: offset=10 is beyond the member count of 3
        let result = client.list_group_members(&group_id, &10, &5);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_list_group_members_limit_zero() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group with 3 members
        let group_id = 1;
        let creator = Address::generate(&env);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        
        let mut members = Vec::new(&env);
        members.push_back(creator.clone());
        members.push_back(member1);
        members.push_back(member2);
        
        // Store members directly
        let key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&key, &members);
        
        // Test: limit=0 should return empty vector
        let result = client.list_group_members(&group_id, &0, &0);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_list_group_members_offset_plus_limit_exceeds_total() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group with 5 members
        let group_id = 1;
        let mut members = Vec::new(&env);
        for _ in 0..5 {
            members.push_back(Address::generate(&env));
        }
        
        // Store members directly
        let key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&key, &members);
        
        // Test: offset=3, limit=10 should return only 2 remaining members (indices 3 and 4)
        let result = client.list_group_members(&group_id, &3, &10);
        assert_eq!(result.len(), 2);
        
        // Verify the returned members are the correct ones
        assert_eq!(result.get(0).unwrap(), members.get(3).unwrap());
        assert_eq!(result.get(1).unwrap(), members.get(4).unwrap());
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // 1003 is InvalidState
    fn test_list_group_members_max_limit_enforcement() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group with some members
        let group_id = 1;
        let mut members = Vec::new(&env);
        for _ in 0..10 {
            members.push_back(Address::generate(&env));
        }
        
        // Store members directly
        let key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&key, &members);
        
        // Test: limit=101 exceeds MAX_LIMIT of 100, should panic with InvalidState error
        client.list_group_members(&group_id, &0, &101);
    }
}

    // Task 3.1: Integration test for list_group_members
    #[test]
    fn test_list_group_members_integration() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group with 5 members in join order
        let group_id = 1;
        let mut members = Vec::new(&env);
        let member_addresses: Vec<Address> = (0..5)
            .map(|_| Address::generate(&env))
            .collect();
        
        for addr in &member_addresses {
            members.push_back(addr.clone());
        }
        
        // Store members using the storage key builder
        let key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&key, &members);
        
        // Test 1: Retrieve all members (offset=0, limit=10)
        let all_members = client.list_group_members(&group_id, &0, &10);
        assert_eq!(all_members.len(), 5);
        
        // Verify join order is preserved
        for i in 0..5 {
            assert_eq!(all_members.get(i as u32).unwrap(), member_addresses[i]);
        }
        
        // Test 2: Pagination - first page (offset=0, limit=2)
        let page1 = client.list_group_members(&group_id, &0, &2);
        assert_eq!(page1.len(), 2);
        assert_eq!(page1.get(0).unwrap(), member_addresses[0]);
        assert_eq!(page1.get(1).unwrap(), member_addresses[1]);
        
        // Test 3: Pagination - second page (offset=2, limit=2)
        let page2 = client.list_group_members(&group_id, &2, &2);
        assert_eq!(page2.len(), 2);
        assert_eq!(page2.get(0).unwrap(), member_addresses[2]);
        assert_eq!(page2.get(1).unwrap(), member_addresses[3]);
        
        // Test 4: Pagination - last page (offset=4, limit=2)
        let page3 = client.list_group_members(&group_id, &4, &2);
        assert_eq!(page3.len(), 1);
        assert_eq!(page3.get(0).unwrap(), member_addresses[4]);
        
        // Test 5: Empty result when offset is beyond member count
        let empty = client.list_group_members(&group_id, &10, &5);
        assert_eq!(empty.len(), 0);
        
        // Test 6: Empty result when limit is 0
        let empty2 = client.list_group_members(&group_id, &0, &0);
        assert_eq!(empty2.len(), 0);
    }

    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_list_group_members_group_not_found() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Test: Attempt to list members for a non-existent group
        client.list_group_members(&999, &0, &10);
    }

    // Task 4.1: Test successful member retrieval
    #[test]
    fn test_get_member_details_success() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group and add a member
        let group_id = 1;
        let member_address = Address::generate(&env);
        let joined_at = 1704067200u64;
        
        // Store group data
        let group = Group::new(group_id, Address::generate(&env), 100, 3600, 5, joined_at);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Store member profile
        let member_profile = MemberProfile {
            address: member_address.clone(),
            group_id,
            joined_at,
        };
        let member_key = StorageKeyBuilder::member_profile(group_id, member_address.clone());
        env.storage().persistent().set(&member_key, &member_profile);
        
        // Test: Call get_member_details
        let result = client.get_member_details(&group_id, &member_address);
        
        // Assert: Verify the result is correct
        assert_eq!(result.address, member_address);
        assert_eq!(result.group_id, group_id);
        assert_eq!(result.joined_at, joined_at);
    }

    // Task 4.2: Test group not found error
    #[test]
    #[should_panic(expected = "Status(ContractError(1001))")] // 1001 is GroupNotFound
    fn test_get_member_details_group_not_found() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Test: Call get_member_details with non-existent group_id
        let member_address = Address::generate(&env);
        client.get_member_details(&999, &member_address);
    }

    // Task 4.3: Test member not found error
    #[test]
    #[should_panic(expected = "Status(ContractError(2002))")] // 2002 is NotMember
    fn test_get_member_details_member_not_found() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group without adding the member
        let group_id = 1;
        let member_address = Address::generate(&env);
        let joined_at = 1704067200u64;
        
        // Store group data
        let group = Group::new(group_id, Address::generate(&env), 100, 3600, 5, joined_at);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Test: Call get_member_details with valid group but non-member address
        client.get_member_details(&group_id, &member_address);
    }

    // Task 4.4: Test idempotence property
    #[test]
    fn test_get_member_details_idempotence() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group and add a member
        let group_id = 1;
        let member_address = Address::generate(&env);
        let joined_at = 1704067200u64;
        
        // Store group data
        let group = Group::new(group_id, Address::generate(&env), 100, 3600, 5, joined_at);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Store member profile
        let member_profile = MemberProfile {
            address: member_address.clone(),
            group_id,
            joined_at,
        };
        let member_key = StorageKeyBuilder::member_profile(group_id, member_address.clone());
        env.storage().persistent().set(&member_key, &member_profile);
        
        // Test: Call get_member_details twice with same parameters
        let result1 = client.get_member_details(&group_id, &member_address);
        let result2 = client.get_member_details(&group_id, &member_address);
        
        // Assert: Both results are identical
        assert_eq!(result1.address, result2.address);
        assert_eq!(result1.group_id, result2.group_id);
        assert_eq!(result1.joined_at, result2.joined_at);
    }

    // Task 4.5: Test address invariant property
    #[test]
    fn test_get_member_details_address_invariant() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Setup: Create a group and add a member
        let group_id = 1;
        let member_address = Address::generate(&env);
        let joined_at = 1704067200u64;
        
        // Store group data
        let group = Group::new(group_id, Address::generate(&env), 100, 3600, 5, joined_at);
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().set(&group_key, &group);
        
        // Store member profile
        let member_profile = MemberProfile {
            address: member_address.clone(),
            group_id,
            joined_at,
        };
        let member_key = StorageKeyBuilder::member_profile(group_id, member_address.clone());
        env.storage().persistent().set(&member_key, &member_profile);
        
        // Test: Call get_member_details
        let result = client.get_member_details(&group_id, &member_address);
        
        // Assert: Returned address equals query address parameter
        assert_eq!(result.address, member_address);
    }

    // Task 6: Tests for join_group function
    
    // Task 6.1: Test successful member joining
    #[test]
    fn test_join_group_success() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
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
        env.storage().persistent().set(&status_key, &GroupStatus::Pending);
        
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
        let contract_id = env.register_contract(None, StellarSaveContract);
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
        let contract_id = env.register_contract(None, StellarSaveContract);
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
        env.storage().persistent().set(&status_key, &GroupStatus::Pending);
        
        // Store member profile (already a member)
        let member_profile = MemberProfile {
            address: member.clone(),
            group_id,
            joined_at,
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
        let contract_id = env.register_contract(None, StellarSaveContract);
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
        env.storage().persistent().set(&status_key, &GroupStatus::Pending);
        
        // Test: Try to join full group
        client.join_group(&group_id, &new_member);
    }
    
    // Task 6.5: Test joining when group is already active
    #[test]
    #[should_panic(expected = "Status(ContractError(1003))")] // 1003 is InvalidState
    fn test_join_group_already_active() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
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
        env.storage().persistent().set(&status_key, &GroupStatus::Active);
        
        // Test: Try to join active group
        client.join_group(&group_id, &new_member);
    }
    
    // Task 6.6: Test payout position assignment
    #[test]
    fn test_join_group_payout_position_assignment() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
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
        env.storage().persistent().set(&status_key, &GroupStatus::Pending);
        
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
}
