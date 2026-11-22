//! # Payout Data Types
//!
//! This module owns the payout **data types** only:
//!
//! - [`PayoutOrder`] — the selection strategy enum stored on [`crate::group::Group`].
//! - [`PayoutRecord`] — an immutable, on-chain audit record written once per cycle.
//!
//! ## Responsibility boundary
//!
//! | Concern                        | Module                        |
//! |--------------------------------|-------------------------------|
//! | Payout data types & records    | **`payout`** (this file)      |
//! | Recipient selection & execution| `payout_executor`             |
//!
//! `payout` does **not** execute payouts, select recipients, or touch storage
//! outside of [`PayoutRecord`] construction.  All execution logic lives in
//! [`crate::payout_executor`].
//!
//! ## Call flow summary
//! ```text
//! contract.rs::execute_payout(group_id)
//!   → payout_executor::execute_payout(env, group_id)
//!       (see payout_executor module doc for the full step list)
//! ```

use crate::error::StellarSaveError;
use soroban_sdk::{contracttype, Address};

/// Determines how the payout recipient is selected each cycle.
///
/// Stored in [`crate::group::Group::payout_order`] and evaluated at payout
/// execution time. The default is [`PayoutOrder::Sequential`].
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PayoutOrder {
    /// Members receive payouts in the fixed order they joined the group (default).
    ///
    /// The recipient for cycle `N` is the member at index `N` in the
    /// `GROUP_MEMBERS_{id}` storage list. This order is immutable once the
    /// group is activated.
    Sequential,
    /// Recipient is chosen pseudo-randomly each cycle using ledger entropy.
    ///
    /// Uses the current ledger sequence number as a seed. Not cryptographically
    /// secure — do not use for high-value groups where manipulation is a concern.
    Random,
    /// Each cycle, the member who submits the highest bid wins the payout.
    ///
    /// Bids are denominated in stroops and must be ≥ 0. The winning bid amount
    /// is deducted from the payout and redistributed to the other members.
    Bid,
}

/// Payout Record structure for tracking payout events in rotational savings groups.
///
/// Each payout represents a distribution of pooled funds to a member during their
/// designated cycle. This provides an immutable audit trail of all payouts made
/// within the system.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutRecord {
    /// Address of the member receiving the payout.
    /// This is the beneficiary who receives the pooled contributions for this cycle.
    pub recipient: Address,

    /// ID of the group this payout belongs to.
    /// Links the payout to a specific savings group.
    pub group_id: u64,

    /// Cycle number when this payout was made (0-indexed).
    /// Indicates which rotation cycle this payout corresponds to.
    pub cycle_number: u32,

    /// Amount paid out in stroops (1 XLM = 10^7 stroops).
    /// This should equal the total pool (contribution_amount * max_members).
    /// Must be greater than 0.
    pub amount: i128,

    /// Timestamp when the payout was executed (Unix timestamp in seconds).
    /// Used for tracking payout timing and audit purposes.
    pub timestamp: u64,
}

impl PayoutRecord {
    /// Creates a new `PayoutRecord`, returning an error if `amount <= 0`.
    ///
    /// # Arguments
    /// * `recipient`    - Address of the member receiving the payout
    /// * `group_id`     - ID of the group making the payout
    /// * `cycle_number` - Current cycle number
    /// * `amount`       - Payout amount in stroops (must be > 0)
    /// * `timestamp`    - Payout timestamp
    ///
    /// # Errors
    /// Returns [`StellarSaveError::InvalidAmount`] when `amount <= 0`.
    /// This is the **single enforcement point** for the invariant that every
    /// payout amount must be positive; callers must not add their own duplicate check.
    pub fn new(
        recipient: Address,
        group_id: u64,
        cycle_number: u32,
        amount: i128,
        timestamp: u64,
    ) -> Result<Self, StellarSaveError> {
        if amount <= 0 {
            return Err(StellarSaveError::InvalidAmount);
        }

        Ok(Self {
            recipient,
            group_id,
            cycle_number,
            amount,
            timestamp,
        })
    }

    /// Validates that the payout record is internally consistent.
    ///
    /// Returns `true` when `amount > 0`. A payout record with a zero or
    /// negative amount indicates data corruption and must never be persisted.
    pub fn validate(&self) -> bool {
        self.amount > 0
    }

    /// Checks if this payout matches the expected group and cycle.
    ///
    /// # Arguments
    /// * `expected_group_id` - The group ID to verify against
    /// * `expected_cycle`    - The cycle number to verify against
    pub fn matches_group_and_cycle(&self, expected_group_id: u64, expected_cycle: u32) -> bool {
        self.group_id == expected_group_id && self.cycle_number == expected_cycle
    }

    /// Checks if this payout was made to a specific recipient.
    ///
    /// # Arguments
    /// * `address` - The recipient address to check
    pub fn is_for_recipient(&self, address: &Address) -> bool {
        &self.recipient == address
    }

    /// Checks if this payout belongs to a specific group.
    ///
    /// # Arguments
    /// * `group_id` - The group ID to check against `self.group_id`
    pub fn belongs_to_group(&self, group_id: u64) -> bool {
        self.group_id == group_id
    }

    /// Returns the payout amount converted from stroops to whole XLM units.
    ///
    /// This is a display helper only — all on-chain arithmetic uses stroops.
    /// Fractional XLM is truncated (integer division by 10 000 000).
    ///
    /// # Example
    /// ```
    /// // 50_000_000 stroops → 5 XLM
    /// assert_eq!(payout.amount_in_xlm(), 5);
    /// ```
    pub fn amount_in_xlm(&self) -> i128 {
        self.amount / 10_000_000
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_payout_record_creation() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(
            recipient.clone(),
            1,          // group_id
            0,          // cycle_number
            50_000_000, // 5 XLM (5 members * 1 XLM each)
            1234567890, // timestamp
        )
        .unwrap();

        assert_eq!(payout.recipient, recipient);
        assert_eq!(payout.group_id, 1);
        assert_eq!(payout.cycle_number, 0);
        assert_eq!(payout.amount, 50_000_000);
        assert_eq!(payout.timestamp, 1234567890);
    }

    #[test]
    fn test_invalid_amount_returns_error() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let result = PayoutRecord::new(recipient.clone(), 1, 0, 0, 1234567890);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::InvalidAmount);

        let result_neg = PayoutRecord::new(recipient, 1, 0, -1, 1234567890);
        assert!(result_neg.is_err());
        assert_eq!(result_neg.unwrap_err(), StellarSaveError::InvalidAmount);
    }

    #[test]
    fn test_validate() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(recipient, 1, 0, 50_000_000, 1234567890).unwrap();

        assert!(payout.validate());
    }

    #[test]
    fn test_matches_group_and_cycle() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(recipient, 1, 2, 50_000_000, 1234567890).unwrap();

        assert!(payout.matches_group_and_cycle(1, 2));
        assert!(!payout.matches_group_and_cycle(1, 3));
        assert!(!payout.matches_group_and_cycle(2, 2));
        assert!(!payout.matches_group_and_cycle(2, 3));
    }

    #[test]
    fn test_is_for_recipient() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);

        let payout = PayoutRecord::new(recipient1.clone(), 1, 0, 50_000_000, 1234567890).unwrap();

        assert!(payout.is_for_recipient(&recipient1));
        assert!(!payout.is_for_recipient(&recipient2));
    }

    #[test]
    fn test_belongs_to_group() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(recipient, 1, 0, 50_000_000, 1234567890).unwrap();

        assert!(payout.belongs_to_group(1));
        assert!(!payout.belongs_to_group(2));
    }

    #[test]
    fn test_amount_in_xlm() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(
            recipient, 1, 0, 50_000_000, // 5 XLM in stroops
            1234567890,
        )
        .unwrap();

        assert_eq!(payout.amount_in_xlm(), 5);
    }

    #[test]
    fn test_multiple_payouts_same_group() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);

        let payout1 =
            PayoutRecord::new(recipient1.clone(), 1, 0, 50_000_000, 1234567890).unwrap();

        let payout2 = PayoutRecord::new(
            recipient2.clone(),
            1,
            1,
            50_000_000,
            1234567890 + 604800, // 1 week later
        )
        .unwrap();

        assert_eq!(payout1.group_id, payout2.group_id);
        assert_ne!(payout1.cycle_number, payout2.cycle_number);
        assert_ne!(payout1.recipient, payout2.recipient);
        assert_ne!(payout1.timestamp, payout2.timestamp);
    }

    #[test]
    fn test_payout_sequence() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout_cycle_0 =
            PayoutRecord::new(recipient.clone(), 1, 0, 50_000_000, 1234567890).unwrap();

        let payout_cycle_1 =
            PayoutRecord::new(recipient.clone(), 1, 1, 50_000_000, 1234567890 + 604800).unwrap();

        assert_eq!(payout_cycle_0.group_id, payout_cycle_1.group_id);
        assert_eq!(payout_cycle_0.recipient, payout_cycle_1.recipient);
        assert_eq!(payout_cycle_0.cycle_number + 1, payout_cycle_1.cycle_number);
    }
}
