//! Governance logic: group-dissolution voting and dynamic contribution-amount changes.
//!
//! # Module responsibilities
//!
//! | Module      | Single responsibility                                        |
//! |-------------|--------------------------------------------------------------|
//! | `proposal`  | Creating / validating a pending governance proposal          |
//! | `voting`    | Receiving member votes and triggering execution at threshold |
//! | `execution` | Applying the resulting state change (dissolution / amount)   |
//! | `storage`   | All raw `env.storage()` calls for governance-specific keys   |
//!
//! The split ensures that each module can be read, tested, and reasoned about
//! independently.  `voting` orchestrates the other modules but does **not**
//! own any storage or mutation logic itself.

pub mod execution;
pub mod proposal;
pub mod storage;
pub mod voting;
#[cfg(test)]
pub mod tests;

pub use proposal::propose_contribution_change;
pub use voting::{vote_contribution_change, vote_dissolve};

/// Returns the minimum number of votes required to approve a contribution-amount
/// change for a group with `member_count` members.
///
/// Uses the constants [`crate::constants::GOVERNANCE_MAJORITY_NUMERATOR`] and
/// [`crate::constants::GOVERNANCE_MAJORITY_DENOMINATOR`] so that the threshold
/// is defined in exactly one place.
///
/// Formula: `floor(member_count / 2) + 1`  (strict simple majority, > 50 %)
///
/// # Examples
/// ```
/// assert_eq!(stellar_save::governance::majority_threshold(4), 3);
/// assert_eq!(stellar_save::governance::majority_threshold(5), 3);
/// assert_eq!(stellar_save::governance::majority_threshold(1), 1);
/// ```
pub fn majority_threshold(member_count: u32) -> u32 {
    use crate::constants::{GOVERNANCE_MAJORITY_DENOMINATOR, GOVERNANCE_MAJORITY_NUMERATOR};
    member_count * GOVERNANCE_MAJORITY_NUMERATOR / GOVERNANCE_MAJORITY_DENOMINATOR + 1
}
