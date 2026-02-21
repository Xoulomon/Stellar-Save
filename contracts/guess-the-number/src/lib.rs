#![no_std]

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env, String};

pub use error::Error;
pub use types::{Group, GroupStatus};

#[contract]
pub struct StellarSave;

#[contractimpl]
impl StellarSave {
    /// Check if a group is currently active
    ///
    /// A group is considered active if:
    /// 1. The group exists in storage
    /// 2. The group status is Active
    /// 3. The group has at least one member
    /// 4. The member count does not exceed max_members
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `group_id` - The unique identifier of the group
    ///
    /// # Returns
    /// * `Result<bool, Error>` - True if group is active, false otherwise
    ///
    /// # Errors
    /// * `Error::GroupNotFound` - If the group does not exist
    ///
    /// # Security Considerations
    /// - Read-only function, no state modifications
    /// - No authentication required (public query)
    /// - Input validation on group_id bounds
    pub fn is_group_active(env: Env, group_id: u64) -> Result<bool, Error> {
        // Load the group from storage
        let group = storage::load_group(&env, group_id).ok_or(Error::GroupNotFound)?;

        // Check if status is Active
        let status_is_active = group.status == GroupStatus::Active;

        // Check if member count is valid (at least 1 member and within max)
        let member_count_valid = group.member_count > 0 && group.member_count <= group.max_members;

        // Group is active if both conditions are met
        Ok(status_is_active && member_count_valid)
    }

    /// Create a new savings group
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `admin` - The group administrator
    /// * `name` - The group name
    /// * `contribution_amount` - Amount each member contributes per cycle
    /// * `cycle_duration` - Duration of each cycle in seconds
    /// * `max_members` - Maximum number of members allowed
    ///
    /// # Returns
    /// * `Result<u64, Error>` - The newly created group ID
    pub fn create_group(
        env: Env,
        admin: Address,
        name: String,
        contribution_amount: i128,
        cycle_duration: u64,
        max_members: u32,
    ) -> Result<u64, Error> {
        // Require authentication from admin
        admin.require_auth();

        // Increment group counter and use as group ID
        storage::increment_group_count(&env);
        let group_id = storage::get_group_count(&env);

        let group = Group {
            id: group_id,
            name,
            admin,
            contribution_amount,
            cycle_duration,
            max_members,
            member_count: 0,
            status: GroupStatus::Forming,
            members: soroban_sdk::Vec::new(&env),
            current_cycle: 0,
            start_time: 0,
        };

        storage::save_group(&env, &group);

        Ok(group_id)
    }

    /// Activate a group (transition from Forming to Active)
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `group_id` - The group to activate
    ///
    /// # Returns
    /// * `Result<(), Error>` - Success or error
    pub fn activate_group(env: Env, group_id: u64) -> Result<(), Error> {
        let mut group = storage::load_group(&env, group_id).ok_or(Error::GroupNotFound)?;

        // Require admin authentication
        group.admin.require_auth();

        // Validate group can be activated
        if group.status != GroupStatus::Forming {
            return Err(Error::InvalidGroupStatus);
        }

        if group.member_count == 0 {
            return Err(Error::GroupNotActive);
        }

        // Update status and start time
        group.status = GroupStatus::Active;
        group.start_time = env.ledger().timestamp();

        storage::save_group(&env, &group);

        Ok(())
    }

    /// Get group details
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `group_id` - The group identifier
    ///
    /// # Returns
    /// * `Result<Group, Error>` - The group data
    pub fn get_group(env: Env, group_id: u64) -> Result<Group, Error> {
        storage::load_group(&env, group_id).ok_or(Error::GroupNotFound)
    }

    /// Get the total number of groups created
    ///
    /// Returns the total count of groups that have been created in the contract.
    /// This is a monotonically increasing counter that tracks all groups ever created,
    /// regardless of their current status (Forming, Active, Completed, or Cancelled).
    ///
    /// # Arguments
    /// * `env` - The contract environment
    ///
    /// # Returns
    /// * `u64` - The total number of groups created (0 if no groups exist)
    ///
    /// # Security Considerations
    /// - Read-only function, no state modifications
    /// - No authentication required (public query)
    /// - Returns 0 for uninitialized state (safe default)
    ///
    /// # Example
    /// ```ignore
    /// let total_groups = contract.get_total_groups_created(&env);
    /// ```
    pub fn get_total_groups_created(env: Env) -> u64 {
        storage::get_group_count(&env)
    }
}
