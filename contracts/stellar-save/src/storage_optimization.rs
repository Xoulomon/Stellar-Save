use crate::error::StellarSaveError;
/// Storage Optimization Module for Stellar-Save
///
/// This module implements storage cost reduction strategies for groups with many members
/// by optimizing data structures and using more efficient key schemes.
///
/// Key optimizations:
/// 1. Bitmap-based contribution tracking instead of individual keys per member per cycle
/// 2. Compact member profile storage using bit-packing
/// 3. Storage cost estimation and analysis functions
/// 4. Benchmarking utilities for measuring improvements
use soroban_sdk::{contracttype, Address, Env};

/// Bitmap for tracking member contributions in a cycle.
///
/// Instead of storing individual CONTRIB_{group_id}_{cycle}_{address} keys,
/// we use a bitmap where each bit represents whether a member has contributed.
/// This reduces storage from O(n) keys to O(1) key per cycle.
///
/// For a group with 256 members, this saves 255 storage entries per cycle.
/// For a group with 1000 members, this saves 999 storage entries per cycle.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionBitmap {
    /// Group ID this bitmap belongs to
    pub group_id: u64,

    /// Cycle number this bitmap tracks
    pub cycle: u32,

    /// Bitmap data: each bit represents one member's contribution status
    /// Bit position corresponds to member index in the group's member list
    /// Bit value: 1 = contributed, 0 = not contributed
    pub bitmap: soroban_sdk::Vec<u64>,

    /// Total number of members in the group (for validation)
    pub member_count: u32,

    /// Number of members who have contributed (cached for O(1) access)
    pub contributors_count: u32,

    /// Total contribution amount (cached for O(1) access)
    pub total_amount: i128,
}

impl ContributionBitmap {
    /// Creates a new empty contribution bitmap for a cycle.
    ///
    /// # Arguments
    /// * `group_id` - The group ID
    /// * `cycle` - The cycle number
    /// * `member_count` - Total members in the group
    ///
    /// # Returns
    /// A new bitmap with all bits set to 0 (no contributions)
    pub fn new(group_id: u64, cycle: u32, member_count: u32) -> Self {
        // Calculate number of u64 chunks needed (each u64 holds 64 bits)
        let chunks_needed = ((member_count as usize + 63) / 64) as u32;
        let mut bitmap = soroban_sdk::Vec::new(&Env::default());

        for _ in 0..chunks_needed {
            bitmap.push_back(0u64);
        }

        Self {
            group_id,
            cycle,
            bitmap,
            member_count,
            contributors_count: 0,
            total_amount: 0,
        }
    }

    /// Sets the contribution bit for a member.
    ///
    /// # Arguments
    /// * `member_index` - Index of the member in the group's member list (0-indexed)
    /// * `amount` - Contribution amount to add
    ///
    /// # Returns
    /// * `Ok(())` if successful
    /// * `Err(StellarSaveError)` if member_index is out of bounds
    pub fn set_contribution(
        &mut self,
        member_index: u32,
        amount: i128,
    ) -> Result<(), StellarSaveError> {
        if member_index >= self.member_count {
            return Err(StellarSaveError::InvalidState);
        }

        let chunk_index = (member_index / 64) as usize;
        let bit_position = member_index % 64;

        // Check if bit is already set (member already contributed)
        let chunk = self
            .bitmap
            .get(chunk_index as u32)
            .ok_or(StellarSaveError::InvalidState)?;

        let bit_set = (chunk & (1u64 << bit_position)) != 0;

        if !bit_set {
            // Set the bit
            let new_chunk = chunk | (1u64 << bit_position);
            self.bitmap.set(chunk_index as u32, new_chunk);

            // Update counters
            self.contributors_count += 1;
            self.total_amount = self
                .total_amount
                .checked_add(amount)
                .ok_or(StellarSaveError::InternalError)?;
        }

        Ok(())
    }

    /// Checks if a member has contributed.
    ///
    /// # Arguments
    /// * `member_index` - Index of the member in the group's member list
    ///
    /// # Returns
    /// * `Ok(true)` if member has contributed
    /// * `Ok(false)` if member has not contributed
    /// * `Err(StellarSaveError)` if member_index is out of bounds
    pub fn has_contributed(&self, member_index: u32) -> Result<bool, StellarSaveError> {
        if member_index >= self.member_count {
            return Err(StellarSaveError::InvalidState);
        }

        let chunk_index = (member_index / 64) as usize;
        let bit_position = member_index % 64;

        let chunk = self
            .bitmap
            .get(chunk_index as u32)
            .ok_or(StellarSaveError::InvalidState)?;

        Ok((chunk & (1u64 << bit_position)) != 0)
    }

    /// Checks if all members have contributed.
    pub fn is_complete(&self) -> bool {
        self.contributors_count >= self.member_count
    }

    /// Gets the number of remaining contributions needed.
    pub fn remaining_contributions(&self) -> u32 {
        self.member_count.saturating_sub(self.contributors_count)
    }
}

/// Compact member profile using bit-packing for efficient storage.
///
/// Instead of storing full MemberProfile structs with padding, we pack
/// multiple fields into fewer storage entries.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompactMemberProfile {
    /// Member address
    pub address: Address,

    /// Group ID (u64)
    pub group_id: u64,

    /// Payout position (u32) - packed with other fields
    pub payout_position: u32,

    /// Join timestamp (u64)
    pub joined_at: u64,

    /// Contribution status flags (packed into u32)
    /// Bit 0: has_contributed_current_cycle
    /// Bit 1: is_eligible_for_payout
    /// Bit 2: is_active
    /// Bits 3-31: reserved for future use
    pub status_flags: u32,
}

impl CompactMemberProfile {
    /// Creates a new compact member profile.
    pub fn new(address: Address, group_id: u64, payout_position: u32, joined_at: u64) -> Self {
        Self {
            address,
            group_id,
            payout_position,
            joined_at,
            status_flags: 0b100, // Default: active, not contributed, not eligible
        }
    }

    /// Sets the "has contributed" flag.
    pub fn set_contributed(&mut self, contributed: bool) {
        if contributed {
            self.status_flags |= 0b001;
        } else {
            self.status_flags &= !0b001;
        }
    }

    /// Gets the "has contributed" flag.
    pub fn has_contributed(&self) -> bool {
        (self.status_flags & 0b001) != 0
    }

    /// Sets the "eligible for payout" flag.
    pub fn set_eligible_for_payout(&mut self, eligible: bool) {
        if eligible {
            self.status_flags |= 0b010;
        } else {
            self.status_flags &= !0b010;
        }
    }

    /// Gets the "eligible for payout" flag.
    pub fn is_eligible_for_payout(&self) -> bool {
        (self.status_flags & 0b010) != 0
    }

    /// Sets the "is active" flag.
    pub fn set_active(&mut self, active: bool) {
        if active {
            self.status_flags |= 0b100;
        } else {
            self.status_flags &= !0b100;
        }
    }

    /// Gets the "is active" flag.
    pub fn is_active(&self) -> bool {
        (self.status_flags & 0b100) != 0
    }
}

/// Storage cost estimation and analysis.
///
/// Provides functions to estimate and measure storage costs for different
/// data structures and optimization strategies.
pub struct StorageCostAnalyzer;

impl StorageCostAnalyzer {
    /// Estimates storage cost for traditional contribution tracking.
    ///
    /// Traditional approach: One storage entry per member per cycle
    /// Cost per member per cycle: ~1 entry (CONTRIB_{group_id}_{cycle}_{address})
    ///
    /// # Arguments
    /// * `member_count` - Number of members in the group
    /// * `cycle_count` - Number of cycles to estimate
    ///
    /// # Returns
    /// Estimated number of storage entries
    pub fn estimate_traditional_contribution_storage(member_count: u32, cycle_count: u32) -> u64 {
        (member_count as u64) * (cycle_count as u64)
    }

    /// Estimates storage cost for bitmap-based contribution tracking.
    ///
    /// Bitmap approach: One storage entry per cycle (bitmap holds all members)
    /// Cost per cycle: ~1 entry (CONTRIB_BITMAP_{group_id}_{cycle})
    /// Plus: Cycle total and count entries (same as traditional)
    ///
    /// # Arguments
    /// * `member_count` - Number of members in the group
    /// * `cycle_count` - Number of cycles to estimate
    ///
    /// # Returns
    /// Estimated number of storage entries
    pub fn estimate_bitmap_contribution_storage(_member_count: u32, cycle_count: u32) -> u64 {
        // One bitmap per cycle + cycle total + cycle count
        (cycle_count as u64) * 3
    }

    /// Calculates storage savings from bitmap optimization.
    ///
    /// # Arguments
    /// * `member_count` - Number of members in the group
    /// * `cycle_count` - Number of cycles
    ///
    /// # Returns
    /// Tuple of (traditional_cost, bitmap_cost, savings_percentage)
    pub fn calculate_bitmap_savings(member_count: u32, cycle_count: u32) -> (u64, u64, u32) {
        let traditional =
            Self::estimate_traditional_contribution_storage(member_count, cycle_count);
        let bitmap = Self::estimate_bitmap_contribution_storage(member_count, cycle_count);

        let savings = if traditional > 0 {
            (((traditional - bitmap) as f64 / traditional as f64) * 100.0) as u32
        } else {
            0
        };

        (traditional, bitmap, savings)
    }

    /// Estimates storage cost per member for a group.
    ///
    /// Includes:
    /// - Member profile: 1 entry
    /// - Contribution status: 1 entry (or packed in bitmap)
    /// - Payout eligibility: 1 entry
    /// - Total contributions: 1 entry
    ///
    /// # Arguments
    /// * `member_count` - Number of members
    /// * `use_compact_profiles` - Whether to use compact profiles
    ///
    /// # Returns
    /// Estimated storage entries per member
    pub fn estimate_member_storage_per_member(
        _member_count: u32,
        use_compact_profiles: bool,
    ) -> u32 {
        if use_compact_profiles {
            // Compact: profile + total contributions = 2 entries
            2
        } else {
            // Traditional: profile + contrib status + payout + total = 4 entries
            4
        }
    }

    /// Estimates total storage cost for a group.
    ///
    /// # Arguments
    /// * `member_count` - Number of members
    /// * `cycle_count` - Number of cycles
    /// * `use_bitmap` - Whether to use bitmap for contributions
    /// * `use_compact_profiles` - Whether to use compact profiles
    ///
    /// # Returns
    /// Estimated total storage entries
    pub fn estimate_total_group_storage(
        member_count: u32,
        cycle_count: u32,
        use_bitmap: bool,
        use_compact_profiles: bool,
    ) -> u64 {
        // Group overhead: ~5 entries (data, members, status, balance, paid_out)
        let group_overhead = 5u64;

        // Member storage
        let per_member =
            Self::estimate_member_storage_per_member(member_count, use_compact_profiles);
        let member_storage = (member_count as u64) * (per_member as u64);

        // Contribution storage
        let contribution_storage = if use_bitmap {
            Self::estimate_bitmap_contribution_storage(member_count, cycle_count)
        } else {
            Self::estimate_traditional_contribution_storage(member_count, cycle_count)
        };

        // Payout storage: ~3 entries per cycle (record, recipient, status)
        let payout_storage = (cycle_count as u64) * 3;

        group_overhead + member_storage + contribution_storage + payout_storage
    }

    /// Generates a detailed storage report for a group configuration.
    ///
    /// Returns storage savings as `(traditional_entries, optimized_entries, savings_pct)`.
    pub fn generate_storage_report(member_count: u32, cycle_count: u32) -> (u64, u64, u32) {
        let traditional_total =
            Self::estimate_total_group_storage(member_count, cycle_count, false, false);
        let optimized_total =
            Self::estimate_total_group_storage(member_count, cycle_count, true, true);
        let savings_percentage = if traditional_total > 0 {
            (((traditional_total - optimized_total) * 100) / traditional_total) as u32
        } else {
            0
        };
        (traditional_total, optimized_total, savings_percentage)
    }
}

/// Storage key for bitmap-based contribution tracking.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum OptimizedStorageKey {
    /// Bitmap for contribution tracking: CONTRIB_BITMAP_{group_id}_{cycle}
    ContributionBitmap(u64, u32),

    /// Compact member profile: MEMBER_COMPACT_{group_id}_{address}
    CompactMemberProfile(u64, Address),
}

/// Builder for optimized storage keys.
pub struct OptimizedStorageKeyBuilder;

impl OptimizedStorageKeyBuilder {
    /// Creates a key for bitmap-based contribution tracking.
    pub fn contribution_bitmap(group_id: u64, cycle: u32) -> OptimizedStorageKey {
        OptimizedStorageKey::ContributionBitmap(group_id, cycle)
    }

    /// Creates a key for compact member profile.
    pub fn compact_member_profile(group_id: u64, address: Address) -> OptimizedStorageKey {
        OptimizedStorageKey::CompactMemberProfile(group_id, address)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_contribution_bitmap_new() {
        let bitmap = ContributionBitmap::new(1, 0, 100);
        assert_eq!(bitmap.group_id, 1);
        assert_eq!(bitmap.cycle, 0);
        assert_eq!(bitmap.member_count, 100);
        assert_eq!(bitmap.contributors_count, 0);
        assert_eq!(bitmap.total_amount, 0);
    }

    #[test]
    fn test_contribution_bitmap_set_and_check() {
        let env = Env::default();
        let mut bitmap = ContributionBitmap::new(1, 0, 10);

        let result = bitmap.set_contribution(0, 1_000_000);
        assert!(result.is_ok());
        assert_eq!(bitmap.contributors_count, 1);
        assert_eq!(bitmap.total_amount, 1_000_000);

        let has_contrib = bitmap.has_contributed(0);
        assert!(has_contrib.is_ok());
        assert!(has_contrib.unwrap());
    }

    #[test]
    fn test_contribution_bitmap_out_of_bounds() {
        let mut bitmap = ContributionBitmap::new(1, 0, 10);

        let result = bitmap.set_contribution(10, 1_000_000);
        assert!(result.is_err());
    }

    #[test]
    fn test_contribution_bitmap_is_complete() {
        let mut bitmap = ContributionBitmap::new(1, 0, 3);

        assert!(!bitmap.is_complete());

        let _ = bitmap.set_contribution(0, 1_000_000);
        let _ = bitmap.set_contribution(1, 1_000_000);
        let _ = bitmap.set_contribution(2, 1_000_000);

        assert!(bitmap.is_complete());
    }

    #[test]
    fn test_compact_member_profile_flags() {
        let env = Env::default();
        let addr = Address::generate(&env);
        let mut profile = CompactMemberProfile::new(addr, 1, 0, 1000);

        assert!(!profile.has_contributed());
        assert!(!profile.is_eligible_for_payout());
        assert!(profile.is_active());

        profile.set_contributed(true);
        assert!(profile.has_contributed());

        profile.set_eligible_for_payout(true);
        assert!(profile.is_eligible_for_payout());

        profile.set_active(false);
        assert!(!profile.is_active());
    }

    #[test]
    fn test_storage_cost_analyzer_bitmap_savings() {
        let (traditional, bitmap, savings) = StorageCostAnalyzer::calculate_bitmap_savings(100, 10);

        assert_eq!(traditional, 1000); // 100 members * 10 cycles
        assert_eq!(bitmap, 30); // 10 cycles * 3 entries
        assert!(savings > 95); // Should be ~97% savings
    }

    #[test]
    fn test_storage_cost_analyzer_large_group() {
        let (traditional, bitmap, savings) =
            StorageCostAnalyzer::calculate_bitmap_savings(1000, 50);

        assert_eq!(traditional, 50000);
        assert_eq!(bitmap, 150);
        assert!(savings > 99);
    }

    #[test]
    fn test_storage_cost_analyzer_total_group_storage() {
        let traditional = StorageCostAnalyzer::estimate_total_group_storage(100, 10, false, false);
        let optimized = StorageCostAnalyzer::estimate_total_group_storage(100, 10, true, true);

        assert!(optimized < traditional);
    }
}
