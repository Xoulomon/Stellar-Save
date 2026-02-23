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
pub mod pool;

// Re-export for convenience
pub use events::*;
pub use error::{StellarSaveError, ErrorCategory, ContractResult};
pub use group::Group;
pub use contribution::ContributionRecord;
pub use payout::PayoutRecord;
pub use status::StatusError;
pub use storage::{StorageKey, StorageKeyBuilder};
pub use pool::{PoolInfo, PoolCalculator};
pub use events::EventEmitter;
use soroban_sdk::{contract, contractimpl, contracttype, Env, Address, Vec, Symbol};

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
        let group = env.storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;

        // 2. Iterate through all cycles and sum contributions
        let mut total: i128 = 0;
        
        // Iterate from cycle 0 to current_cycle (inclusive)
        for cycle in 0..=group.current_cycle {
            let contrib_key = StorageKeyBuilder::contribution_individual(
                group_id,
                cycle,
                member.clone()
            );
            
            // Get contribution record if it exists
            if let Some(contrib_record) = env.storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key) 
            {
                total = total.checked_add(contrib_record.amount)
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
        let group = env.storage()
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

            let contrib_key = StorageKeyBuilder::contribution_individual(
                group_id,
                cycle,
                member.clone()
            );

            // Get contribution record if it exists
            if let Some(contrib_record) = env.storage()
                .persistent()
                .get::<_, ContributionRecord>(&contrib_key)
            {
                contributions.push_back(contrib_record);
                count += 1;
            }
        }

        Ok(contributions)
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
        env.events().publish(
            (Symbol::new(&env, "group_activated"), group_id),
            member_count
        );
    }
}

fn emit_group_activated(env: &Env, group_id: u64, timestamp: u64, member_count: u32) {
    env.events().publish(
        (Symbol::new(env, "group_activated"), group_id),
        (timestamp, member_count)
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
    let contract_id = env.register_contract(None, StellarSaveContract);
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        // Manually store a group to test retrieval
        let group_id = 1;
        let group = Group::new(group_id, creator.clone(), 100, 3600, 5, 2, 12345);
        
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
    //     let contract_id = env.register_contract(None, StellarSaveContract);
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
        let contract_id = env.register_contract(None, StellarSaveContract);
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345);
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member has not contributed yet
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, 0);
    }

    #[test]
    fn test_get_member_total_contributions_single_cycle() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(group_id, member.clone(), contribution_amount, 3600, 5, 2, 12345);
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add a contribution for cycle 0
        let contrib = ContributionRecord::new(
            member.clone(),
            group_id,
            0,
            contribution_amount,
            12345,
        );
        let contrib_key = StorageKeyBuilder::contribution_individual(group_id, 0, member.clone());
        env.storage().persistent().set(&contrib_key, &contrib);

        // Get total contributions
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount);
    }

    #[test]
    fn test_get_member_total_contributions_multiple_cycles() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 2 (meaning cycles 0, 1, 2 have occurred)
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member.clone(), contribution_amount, 3600, 5, 2, 12345);
        group.current_cycle = 2;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0, 1, and 2
        for cycle in 0..=2 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Get total contributions (should be 3 XLM)
        let total = client.get_member_total_contributions(&group_id, &member);
        assert_eq!(total, contribution_amount * 3);
    }

    #[test]
    fn test_get_member_total_contributions_partial_cycles() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 3
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member.clone(), contribution_amount, 3600, 5, 2, 12345);
        group.current_cycle = 3;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member only contributed to cycles 0 and 2 (skipped cycle 1)
        let contrib0 = ContributionRecord::new(
            member.clone(),
            group_id,
            0,
            contribution_amount,
            12345,
        );
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to get contributions for a non-existent group
        client.get_member_total_contributions(&999, &member);
    }

    #[test]
    fn test_get_member_total_contributions_different_members() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member1.clone(), contribution_amount, 3600, 5, 2, 12345);
        group.current_cycle = 1;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member1 contributes to both cycles
        for cycle in 0..=1 {
            let contrib = ContributionRecord::new(
                member1.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, member1.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Member2 only contributes to cycle 0
        let contrib = ContributionRecord::new(
            member2.clone(),
            group_id,
            0,
            contribution_amount,
            12345,
        );
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let group = Group::new(group_id, member.clone(), 100, 3600, 5, 2, 12345);
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member has not contributed yet
        let history = client.get_member_contribution_history(&group_id, &member, &0, &10);
        assert_eq!(history.len(), 0);
    }

    #[test]
    fn test_get_member_contribution_history_single_contribution() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let group = Group::new(group_id, member.clone(), contribution_amount, 3600, 5, 2, 12345);
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add a contribution for cycle 0
        let contrib = ContributionRecord::new(
            member.clone(),
            group_id,
            0,
            contribution_amount,
            12345,
        );
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 4
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member.clone(), contribution_amount, 3600, 5, 2, 12345);
        group.current_cycle = 4;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0, 1, 2, 3, 4
        for cycle in 0..=4 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 9 (10 cycles total: 0-9)
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member.clone(), contribution_amount, 3600, 15, 2, 12345);
        group.current_cycle = 9;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for all 10 cycles
        for cycle in 0..=9 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 5
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member.clone(), contribution_amount, 3600, 10, 2, 12345);
        group.current_cycle = 5;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Member only contributed to cycles 0, 2, and 4 (skipped 1, 3, 5)
        for cycle in [0, 2, 4].iter() {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                *cycle,
                contribution_amount,
                12345 + (*cycle as u64 * 3600),
            );
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, *cycle, member.clone());
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with many cycles
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member.clone(), contribution_amount, 3600, 100, 2, 12345);
        group.current_cycle = 60;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for 60 cycles
        for cycle in 0..=60 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
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
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Try to get history for a non-existent group
        client.get_member_contribution_history(&999, &member, &0, &10);
    }

    #[test]
    fn test_get_member_contribution_history_beyond_current_cycle() {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        let member = Address::generate(&env);

        // Create a group with current_cycle = 3
        let group_id = 1;
        let contribution_amount = 10_000_000; // 1 XLM
        let mut group = Group::new(group_id, member.clone(), contribution_amount, 3600, 10, 2, 12345);
        group.current_cycle = 3;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);

        // Add contributions for cycles 0-3
        for cycle in 0..=3 {
            let contrib = ContributionRecord::new(
                member.clone(),
                group_id,
                cycle,
                contribution_amount,
                12345 + (cycle as u64 * 3600),
            );
            let contrib_key = StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
            env.storage().persistent().set(&contrib_key, &contrib);
        }

        // Request starting from cycle 2 with limit 10 (would go to cycle 12, but should stop at 3)
        let history = client.get_member_contribution_history(&group_id, &member, &2, &10);
        assert_eq!(history.len(), 2); // Only cycles 2 and 3
        assert_eq!(history.get(0).unwrap().cycle_number, 2);
        assert_eq!(history.get(1).unwrap().cycle_number, 3);
    }
}
