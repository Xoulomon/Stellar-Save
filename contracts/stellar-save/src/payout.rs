use soroban_sdk::{contracttype, Address};

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

    /// Validates that the payout record is sound.
    /// Returns true if all constraints are met.
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
    /// * `group_id` - The group ID to check
    pub fn belongs_to_group(&self, group_id: u64) -> bool {
        self.group_id == group_id
    }

    /// Returns the payout amount in XLM (converted from stroops).
    /// Note: This is a helper for display purposes; actual amount is in stroops.
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
