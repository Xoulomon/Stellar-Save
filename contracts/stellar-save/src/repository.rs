/// GroupRepository - Abstraction for group storage operations
///
/// This module provides a centralized repository pattern for all group-related storage reads and writes.
/// It encapsulates all direct env.storage() calls related to group state, improving testability and
/// reducing duplication across the codebase.

use crate::error::StellarSaveError;
use crate::group::{Group, TokenConfig};
use crate::storage::{StorageKey, StorageKeyBuilder};
use soroban_sdk::{Address, Env, Vec};

/// Repository for managing group storage operations.
///
/// Provides a clean abstraction layer over Soroban storage for group-related data,
/// including groups, members, token configurations, and payout sequences.
pub struct GroupRepository;

impl GroupRepository {
    /// Retrieves a group by ID from persistent storage.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group to retrieve
    ///
    /// # Returns
    /// * `Ok(Group)` - The group if it exists
    /// * `Err(StellarSaveError::GroupNotFound)` - If the group does not exist
    pub fn get_group(env: &Env, group_id: u64) -> Result<Group, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage()
            .persistent()
            .get::<_, Group>(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)
    }

    /// Saves a group to persistent storage.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group` - The group to save
    pub fn save_group(env: &Env, group: &Group) {
        let group_key = StorageKeyBuilder::group_data(group.id);
        env.storage().persistent().set(&group_key, group);
    }

    /// Retrieves the token configuration for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    ///
    /// # Returns
    /// * `Ok(TokenConfig)` - The token configuration if it exists
    /// * `Err(StellarSaveError::InvalidToken)` - If the configuration does not exist
    pub fn get_token_config(env: &Env, group_id: u64) -> Result<TokenConfig, StellarSaveError> {
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        env.storage()
            .persistent()
            .get::<_, TokenConfig>(&token_config_key)
            .ok_or(StellarSaveError::InvalidToken)
    }

    /// Saves the token configuration for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    /// * `token_config` - The token configuration to save
    pub fn save_token_config(env: &Env, group_id: u64, token_config: &TokenConfig) {
        let token_config_key = StorageKeyBuilder::group_token_config(group_id);
        env.storage()
            .persistent()
            .set(&token_config_key, token_config);
    }

    /// Retrieves the list of members for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    ///
    /// # Returns
    /// * `Some(Vec<Address>)` - The list of members if it exists
    /// * `None` - If the member list does not exist
    pub fn get_members(env: &Env, group_id: u64) -> Option<Vec<Address>> {
        let members_key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().get::<_, Vec<Address>>(&members_key)
    }

    /// Saves the list of members for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    /// * `members` - The list of members to save
    pub fn save_members(env: &Env, group_id: u64, members: &Vec<Address>) {
        let members_key = StorageKeyBuilder::group_members(group_id);
        env.storage().persistent().set(&members_key, members);
    }

    /// Retrieves the payout sequence for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    ///
    /// # Returns
    /// * `Some(Vec<Address>)` - The payout sequence if it exists
    /// * `None` - If the payout sequence does not exist
    pub fn get_payout_sequence(env: &Env, group_id: u64) -> Option<Vec<Address>> {
        let payout_seq_key = StorageKeyBuilder::group_payout_sequence(group_id);
        env.storage()
            .persistent()
            .get::<_, Vec<Address>>(&payout_seq_key)
    }

    /// Saves the payout sequence for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    /// * `payout_sequence` - The payout sequence to save
    pub fn save_payout_sequence(env: &Env, group_id: u64, payout_sequence: &Vec<Address>) {
        let payout_seq_key = StorageKeyBuilder::group_payout_sequence(group_id);
        env.storage()
            .persistent()
            .set(&payout_seq_key, payout_sequence);
    }

    /// Checks if a group exists in storage.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group to check
    ///
    /// # Returns
    /// * `true` - If the group exists
    /// * `false` - If the group does not exist
    pub fn group_exists(env: &Env, group_id: u64) -> bool {
        let group_key = StorageKeyBuilder::group_data(group_id);
        env.storage().persistent().has(&group_key)
    }

    /// Retrieves the dispute reason for a group if a dispute is active.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    ///
    /// # Returns
    /// * `Some(String)` - The dispute reason if a dispute is active
    /// * `None` - If no dispute is active
    pub fn get_dispute_reason(env: &Env, group_id: u64) -> Option<soroban_sdk::String> {
        let dispute_key = StorageKeyBuilder::group_dispute_reason(group_id);
        env.storage()
            .persistent()
            .get::<_, soroban_sdk::String>(&dispute_key)
    }

    /// Saves the dispute reason for a group.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the group
    /// * `reason` - The dispute reason
    pub fn save_dispute_reason(env: &Env, group_id: u64, reason: &soroban_sdk::String) {
        let dispute_key = StorageKeyBuilder::group_dispute_reason(group_id);
        env.storage().persistent().set(&dispute_key, reason);
    }

    /// Retrieves the merged-from group IDs for a group created by merging.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the merged group
    ///
    /// # Returns
    /// * `Some((u64, u64))` - The tuple of source group IDs if available
    /// * `None` - If this group was not created by merging
    pub fn get_merged_from(env: &Env, group_id: u64) -> Option<(u64, u64)> {
        let merged_key = StorageKeyBuilder::group_merged_from(group_id);
        env.storage()
            .persistent()
            .get::<_, (u64, u64)>(&merged_key)
    }

    /// Saves the merged-from group IDs for a group created by merging.
    ///
    /// # Arguments
    /// * `env` - Soroban environment for storage access
    /// * `group_id` - The ID of the merged group
    /// * `source_ids` - The tuple of source group IDs
    pub fn save_merged_from(env: &Env, group_id: u64, source_ids: &(u64, u64)) {
        let merged_key = StorageKeyBuilder::group_merged_from(group_id);
        env.storage().persistent().set(&merged_key, source_ids);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_group_repository_get_nonexistent_group() {
        let env = Env::default();
        let result = GroupRepository::get_group(&env, 999);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::GroupNotFound);
    }

    #[test]
    fn test_group_repository_save_and_retrieve() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        let group = Group::new(
            &env,
            1,
            creator,
            1_000_000,
            604800,
            5,
            2,
            1234567890,
            0,
        );

        // Save the group
        GroupRepository::save_group(&env, &group);

        // Retrieve it
        let retrieved = GroupRepository::get_group(&env, 1);
        assert!(retrieved.is_ok());
        assert_eq!(retrieved.unwrap().id, 1);
    }

    #[test]
    fn test_group_repository_exists() {
        let env = Env::default();
        let creator = Address::generate(&env);
        
        // Group doesn't exist initially
        assert!(!GroupRepository::group_exists(&env, 1));

        let group = Group::new(
            &env,
            1,
            creator,
            1_000_000,
            604800,
            5,
            2,
            1234567890,
            0,
        );

        // Save and check
        GroupRepository::save_group(&env, &group);
        assert!(GroupRepository::group_exists(&env, 1));
    }

    #[test]
    fn test_group_repository_members() {
        let env = Env::default();
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);
        
        let mut members = Vec::new(&env);
        members.push_back(member1.clone());
        members.push_back(member2.clone());

        GroupRepository::save_members(&env, 1, &members);

        let retrieved = GroupRepository::get_members(&env, 1);
        assert!(retrieved.is_some());
        let retrieved_members = retrieved.unwrap();
        assert_eq!(retrieved_members.len(), 2);
    }
}
