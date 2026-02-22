use soroban_sdk::{contracttype, Env};
use crate::error::StellarSaveError;
use crate::storage::StorageKeyBuilder;

/// Pool calculation and management for rotational savings groups.
/// 
/// This module handles all pool-related calculations including:
/// - Total pool amount for the current cycle
/// - Member count validation
/// - Contribution amount aggregation
/// - Pool return amount calculations
/// 
/// The pool represents the total funds available for distribution in a cycle,
/// calculated as: pool_amount = contribution_amount × member_count
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolInfo {
    /// Group ID this pool belongs to
    pub group_id: u64,
    
    /// Current cycle number (0-indexed)
    pub cycle: u32,
    
    /// Total number of members in the group
    pub member_count: u32,
    
    /// Fixed contribution amount per member in stroops
    pub contribution_amount: i128,
    
    /// Total pool amount (contribution_amount × member_count)
    pub total_pool_amount: i128,
    
    /// Total amount contributed so far in this cycle
    pub current_contributions: i128,
    
    /// Number of members who have contributed in this cycle
    pub contributors_count: u32,
    
    /// Whether the cycle is complete (all members have contributed)
    pub is_cycle_complete: bool,
}

impl PoolInfo {
    /// Calculates the return amount each member will receive.
    /// 
    /// In a ROSCA, each member receives the full pool amount once during their cycle.
    /// This is equal to the total pool amount.
    pub fn return_amount(&self) -> i128 {
        self.total_pool_amount
    }
    
    /// Checks if all members have contributed to complete the cycle.
    pub fn is_complete(&self) -> bool {
        self.contributors_count >= self.member_count
    }
    
    /// Calculates remaining contributions needed to complete the cycle.
    pub fn remaining_contributions_needed(&self) -> u32 {
        if self.contributors_count >= self.member_count {
            0
        } else {
            self.member_count - self.contributors_count
        }
    }
    
    /// Calculates the percentage of cycle completion (0-100).
    pub fn completion_percentage(&self) -> u32 {
        if self.member_count == 0 {
            return 0;
        }
        ((self.contributors_count as u64 * 100) / self.member_count as u64) as u32
    }
}

/// Pool calculation functions for the Stellar-Save contract.
pub struct PoolCalculator;

impl PoolCalculator {
    /// Calculates the total pool amount for a given group and cycle.
    /// 
    /// Formula: total_pool = contribution_amount × member_count
    /// 
    /// # Arguments
    /// * `contribution_amount` - Fixed contribution per member in stroops
    /// * `member_count` - Total number of members in the group
    /// 
    /// # Returns
    /// * `Ok(total_pool)` - The calculated pool amount
    /// * `Err(StellarSaveError)` - If calculation fails or values are invalid
    /// 
    /// # Errors
    /// - `InvalidAmount` if contribution_amount is <= 0
    /// - `InvalidState` if member_count is 0
    /// - `InternalError` if multiplication overflows
    pub fn calculate_total_pool(
        contribution_amount: i128,
        member_count: u32,
    ) -> Result<i128, StellarSaveError> {
        // Validate contribution amount
        if contribution_amount <= 0 {
            return Err(StellarSaveError::InvalidAmount);
        }
        
        // Validate member count
        if member_count == 0 {
            return Err(StellarSaveError::InvalidState);
        }
        
        // Calculate pool with overflow protection
        let pool_amount = contribution_amount
            .checked_mul(member_count as i128)
            .ok_or(StellarSaveError::InternalError)?;
        
        Ok(pool_amount)
    }
    
    /// Retrieves the member count for a group from storage.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// 
    /// # Returns
    /// * `Ok(member_count)` - The number of members in the group
    /// * `Err(StellarSaveError)` - If group not found or storage error
    pub fn get_member_count(env: &Env, group_id: u64) -> Result<u32, StellarSaveError> {
        let members_key = StorageKeyBuilder::group_members(group_id);
        
        let members: soroban_sdk::Vec<soroban_sdk::Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .ok_or(StellarSaveError::GroupNotFound)?;
        
        Ok(members.len() as u32)
    }
    
    /// Retrieves the contribution amount for a group from storage.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// 
    /// # Returns
    /// * `Ok(contribution_amount)` - The fixed contribution amount in stroops
    /// * `Err(StellarSaveError)` - If group not found or storage error
    pub fn get_contribution_amount(env: &Env, group_id: u64) -> Result<i128, StellarSaveError> {
        let group_key = StorageKeyBuilder::group_data(group_id);
        
        let group: crate::group::Group = env
            .storage()
            .persistent()
            .get(&group_key)
            .ok_or(StellarSaveError::GroupNotFound)?;
        
        Ok(group.contribution_amount)
    }
    
    /// Retrieves the current cycle contributions total from storage.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Current cycle number
    /// 
    /// # Returns
    /// * `Ok(total)` - The total contributions for the cycle (0 if not set)
    pub fn get_cycle_contributions_total(
        env: &Env,
        group_id: u64,
        cycle: u32,
    ) -> Result<i128, StellarSaveError> {
        let total_key = StorageKeyBuilder::contribution_cycle_total(group_id, cycle);
        
        let total: i128 = env
            .storage()
            .persistent()
            .get(&total_key)
            .unwrap_or(0);
        
        Ok(total)
    }
    
    /// Retrieves the number of contributors for the current cycle from storage.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Current cycle number
    /// 
    /// # Returns
    /// * `Ok(count)` - The number of members who have contributed (0 if not set)
    pub fn get_cycle_contributor_count(
        env: &Env,
        group_id: u64,
        cycle: u32,
    ) -> Result<u32, StellarSaveError> {
        let count_key = StorageKeyBuilder::contribution_cycle_count(group_id, cycle);
        
        let count: u32 = env
            .storage()
            .persistent()
            .get(&count_key)
            .unwrap_or(0);
        
        Ok(count)
    }
    
    /// Builds complete pool information for a group and cycle.
    /// 
    /// This is the primary function for getting comprehensive pool data.
    /// It aggregates member count, contribution amount, and current cycle status.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `group_id` - ID of the group
    /// * `cycle` - Current cycle number
    /// 
    /// # Returns
    /// * `Ok(PoolInfo)` - Complete pool information
    /// * `Err(StellarSaveError)` - If any required data is missing or invalid
    pub fn get_pool_info(
        env: &Env,
        group_id: u64,
        cycle: u32,
    ) -> Result<PoolInfo, StellarSaveError> {
        // Get member count
        let member_count = Self::get_member_count(env, group_id)?;
        
        // Get contribution amount
        let contribution_amount = Self::get_contribution_amount(env, group_id)?;
        
        // Calculate total pool
        let total_pool_amount = Self::calculate_total_pool(contribution_amount, member_count)?;
        
        // Get current cycle contributions
        let current_contributions = Self::get_cycle_contributions_total(env, group_id, cycle)?;
        
        // Get contributor count
        let contributors_count = Self::get_cycle_contributor_count(env, group_id, cycle)?;
        
        // Determine if cycle is complete
        let is_cycle_complete = contributors_count >= member_count;
        
        Ok(PoolInfo {
            group_id,
            cycle,
            member_count,
            contribution_amount,
            total_pool_amount,
            current_contributions,
            contributors_count,
            is_cycle_complete,
        })
    }
    
    /// Validates that a pool is ready for payout.
    /// 
    /// A pool is ready when:
    /// - All members have contributed
    /// - Total contributions equal the expected pool amount
    /// 
    /// # Arguments
    /// * `pool_info` - The pool information to validate
    /// 
    /// # Returns
    /// * `Ok(())` if pool is ready for payout
    /// * `Err(StellarSaveError)` if pool is not ready
    pub fn validate_pool_ready_for_payout(pool_info: &PoolInfo) -> Result<(), StellarSaveError> {
        // Check if all members have contributed
        if !pool_info.is_cycle_complete {
            return Err(StellarSaveError::CycleNotComplete);
        }
        
        // Verify total contributions match expected pool amount
        if pool_info.current_contributions != pool_info.total_pool_amount {
            return Err(StellarSaveError::InvalidAmount);
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_total_pool_valid() {
        let contribution = 1_000_000i128; // 0.1 XLM in stroops
        let member_count = 10u32;
        
        let result = PoolCalculator::calculate_total_pool(contribution, member_count);
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 10_000_000i128);
    }

    #[test]
    fn test_calculate_total_pool_single_member() {
        let contribution = 5_000_000i128;
        let member_count = 1u32;
        
        let result = PoolCalculator::calculate_total_pool(contribution, member_count);
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 5_000_000i128);
    }

    #[test]
    fn test_calculate_total_pool_large_numbers() {
        let contribution = 1_000_000_000i128; // 100 XLM
        let member_count = 100u32;
        
        let result = PoolCalculator::calculate_total_pool(contribution, member_count);
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 100_000_000_000i128);
    }

    #[test]
    fn test_calculate_total_pool_zero_contribution() {
        let contribution = 0i128;
        let member_count = 10u32;
        
        let result = PoolCalculator::calculate_total_pool(contribution, member_count);
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_calculate_total_pool_negative_contribution() {
        let contribution = -1_000_000i128;
        let member_count = 10u32;
        
        let result = PoolCalculator::calculate_total_pool(contribution, member_count);
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_calculate_total_pool_zero_members() {
        let contribution = 1_000_000i128;
        let member_count = 0u32;
        
        let result = PoolCalculator::calculate_total_pool(contribution, member_count);
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidState);
    }

    #[test]
    fn test_calculate_total_pool_overflow() {
        let contribution = i128::MAX;
        let member_count = 2u32;
        
        let result = PoolCalculator::calculate_total_pool(contribution, member_count);
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InternalError);
    }

    #[test]
    fn test_pool_info_return_amount() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        assert_eq!(pool.return_amount(), 5_000_000i128);
    }

    #[test]
    fn test_pool_info_is_complete_true() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        assert!(pool.is_complete());
    }

    #[test]
    fn test_pool_info_is_complete_false() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 3_000_000i128,
            contributors_count: 3,
            is_cycle_complete: false,
        };
        
        assert!(!pool.is_complete());
    }

    #[test]
    fn test_pool_info_remaining_contributions_needed() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 3_000_000i128,
            contributors_count: 3,
            is_cycle_complete: false,
        };
        
        assert_eq!(pool.remaining_contributions_needed(), 2);
    }

    #[test]
    fn test_pool_info_remaining_contributions_zero() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        assert_eq!(pool.remaining_contributions_needed(), 0);
    }

    #[test]
    fn test_pool_info_completion_percentage_zero() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 0i128,
            contributors_count: 0,
            is_cycle_complete: false,
        };
        
        assert_eq!(pool.completion_percentage(), 0);
    }

    #[test]
    fn test_pool_info_completion_percentage_fifty() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 10,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 10_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: false,
        };
        
        assert_eq!(pool.completion_percentage(), 50);
    }

    #[test]
    fn test_pool_info_completion_percentage_hundred() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        assert_eq!(pool.completion_percentage(), 100);
    }

    #[test]
    fn test_pool_info_completion_percentage_rounding() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 3,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 3_000_000i128,
            current_contributions: 1_000_000i128,
            contributors_count: 1,
            is_cycle_complete: false,
        };
        
        // 1/3 = 33.33%, should round down to 33
        assert_eq!(pool.completion_percentage(), 33);
    }

    #[test]
    fn test_validate_pool_ready_for_payout_success() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        let result = PoolCalculator::validate_pool_ready_for_payout(&pool);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_pool_ready_for_payout_incomplete_cycle() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 3_000_000i128,
            contributors_count: 3,
            is_cycle_complete: false,
        };
        
        let result = PoolCalculator::validate_pool_ready_for_payout(&pool);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::CycleNotComplete);
    }

    #[test]
    fn test_validate_pool_ready_for_payout_mismatched_total() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 4_500_000i128, // Mismatch!
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        let result = PoolCalculator::validate_pool_ready_for_payout(&pool);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_pool_info_clone() {
        let pool = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        let cloned = pool.clone();
        assert_eq!(pool, cloned);
    }

    #[test]
    fn test_pool_info_equality() {
        let pool1 = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        let pool2 = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        assert_eq!(pool1, pool2);
    }

    #[test]
    fn test_pool_info_inequality() {
        let pool1 = PoolInfo {
            group_id: 1,
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        let pool2 = PoolInfo {
            group_id: 2, // Different group
            cycle: 0,
            member_count: 5,
            contribution_amount: 1_000_000i128,
            total_pool_amount: 5_000_000i128,
            current_contributions: 5_000_000i128,
            contributors_count: 5,
            is_cycle_complete: true,
        };
        
        assert_ne!(pool1, pool2);
    }

    #[test]
    fn test_calculate_total_pool_various_sizes() {
        let test_cases: [(i128, u32, i128); 4] = [
            (1_000_000i128, 2u32, 2_000_000i128),
            (5_000_000i128, 5u32, 25_000_000i128),
            (10_000_000i128, 20u32, 200_000_000i128),
            (100_000i128, 100u32, 10_000_000i128),
        ];
        
        for (contribution, members, expected) in test_cases.iter() {
            let result = PoolCalculator::calculate_total_pool(*contribution, *members);
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), *expected);
        }
    }
}
