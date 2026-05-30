use crate::error::StellarSaveError;
use crate::group::{Group, GroupStatus};
use crate::storage::StorageKeyBuilder;
use soroban_sdk::{contracttype, Address, Env};

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
    /// Creates a new PayoutRecord with validation.
    ///
    /// # Arguments
    /// * `recipient` - Address of the member receiving the payout
    /// * `group_id` - ID of the group making the payout
    /// * `cycle_number` - Current cycle number
    /// * `amount` - Payout amount in stroops
    /// * `timestamp` - Payout timestamp
    ///
    /// # Panics
    /// Panics if validation constraints are violated:
    /// - amount must be > 0
    pub fn new(
        recipient: Address,
        group_id: u64,
        cycle_number: u32,
        amount: i128,
        timestamp: u64,
    ) -> Self {
        // Validate amount
        assert!(amount > 0, "amount must be greater than 0");

        Self {
            recipient,
            group_id,
            cycle_number,
            amount,
            timestamp,
        }
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
    /// * `expected_cycle` - The cycle number to verify against
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

/// Returns the address of the next scheduled payout recipient without executing the payout.
///
/// The recipient is derived from the group's `current_cycle` and the payout position
/// reverse-index stored at join/assign time. This is an O(1) read-only view function.
///
/// # Arguments
/// * `env`      - Soroban environment
/// * `group_id` - ID of the group to query
///
/// # Returns
/// * `Ok(Address)` - Address of the member scheduled to receive the next payout
/// * `Err(StellarSaveError::GroupNotFound)` - Group does not exist
/// * `Err(StellarSaveError::InvalidState)` - Group is not Active or no recipient found
pub fn get_next_recipient(env: &Env, group_id: u64) -> Result<Address, StellarSaveError> {
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group: Group = env
        .storage()
        .persistent()
        .get(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    if group.status != GroupStatus::Active {
        return Err(StellarSaveError::InvalidState);
    }

    // O(1) lookup: position → Address via the reverse index written at join/assign time
    let pos_idx_key =
        StorageKeyBuilder::group_payout_position_index(group_id, group.current_cycle);
    env.storage()
        .persistent()
        .get::<_, Address>(&pos_idx_key)
        .ok_or(StellarSaveError::InvalidState)
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
        );

        assert_eq!(payout.recipient, recipient);
        assert_eq!(payout.group_id, 1);
        assert_eq!(payout.cycle_number, 0);
        assert_eq!(payout.amount, 50_000_000);
        assert_eq!(payout.timestamp, 1234567890);
    }

    #[test]
    #[should_panic(expected = "amount must be greater than 0")]
    fn test_invalid_amount() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        PayoutRecord::new(recipient, 1, 0, 0, 1234567890);
    }

    #[test]
    fn test_validate() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(recipient, 1, 0, 50_000_000, 1234567890);

        assert!(payout.validate());
    }

    #[test]
    fn test_matches_group_and_cycle() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(recipient, 1, 2, 50_000_000, 1234567890);

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

        let payout = PayoutRecord::new(recipient1.clone(), 1, 0, 50_000_000, 1234567890);

        assert!(payout.is_for_recipient(&recipient1));
        assert!(!payout.is_for_recipient(&recipient2));
    }

    #[test]
    fn test_belongs_to_group() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout = PayoutRecord::new(recipient, 1, 0, 50_000_000, 1234567890);

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
        );

        assert_eq!(payout.amount_in_xlm(), 5);
    }

    #[test]
    fn test_multiple_payouts_same_group() {
        let env = Env::default();
        let recipient1 = Address::generate(&env);
        let recipient2 = Address::generate(&env);

        let payout1 = PayoutRecord::new(recipient1.clone(), 1, 0, 50_000_000, 1234567890);

        let payout2 = PayoutRecord::new(
            recipient2.clone(),
            1,
            1,
            50_000_000,
            1234567890 + 604800, // 1 week later
        );

        assert_eq!(payout1.group_id, payout2.group_id);
        assert_ne!(payout1.cycle_number, payout2.cycle_number);
        assert_ne!(payout1.recipient, payout2.recipient);
        assert_ne!(payout1.timestamp, payout2.timestamp);
    }

    #[test]
    fn test_payout_sequence() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let payout_cycle_0 = PayoutRecord::new(recipient.clone(), 1, 0, 50_000_000, 1234567890);

        let payout_cycle_1 =
            PayoutRecord::new(recipient.clone(), 1, 1, 50_000_000, 1234567890 + 604800);

        assert_eq!(payout_cycle_0.group_id, payout_cycle_1.group_id);
        assert_eq!(payout_cycle_0.recipient, payout_cycle_1.recipient);
        assert_eq!(payout_cycle_0.cycle_number + 1, payout_cycle_1.cycle_number);
    }
}
