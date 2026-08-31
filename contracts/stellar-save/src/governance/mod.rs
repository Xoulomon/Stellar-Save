//! Governance logic: group-dissolution voting and dynamic contribution-amount changes.
//!
//! Split into `proposal` (creating a pending change), `voting` (casting votes
//! and checking thresholds), and `execution` (applying the resulting state
//! change) so each concern stays independently readable and testable.
pub mod execution;
pub mod proposal;
pub mod voting;

pub use proposal::propose_contribution_change;
pub use voting::{vote_contribution_change, vote_dissolve};
