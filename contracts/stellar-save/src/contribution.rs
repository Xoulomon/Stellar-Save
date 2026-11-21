use soroban_sdk::{contracttype, Address, Vec};

/// Paginated result for contribution history queries.
///
/// Returned by any endpoint that lists contributions with a page size limit,
/// allowing callers to detect whether additional pages exist without a
/// separate count query.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionPage {
    /// The contributions in this page.
    pub items: Vec<ContributionRecord>,
    /// `true` if there are more contributions beyond this page.
    /// Use the last item's `(group_id, cycle_number, member_address)` as the
    /// cursor for the next request.
    pub has_more: bool,
}

/// Contribution Record structure for tracking individual member contributions.
///
/// Each contribution represents a single payment made by a member during a specific
/// cycle of a rotational savings group. This provides an immutable audit trail of
/// all contributions made within the system.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionRecord {
    /// Address of the member making the contribution.
    /// Used to identify who contributed and verify authorization.
    pub member_address: Address,

    /// ID of the group this contribution belongs to.
    /// Links the contribution to a specific savings group.
    pub group_id: u64,

    /// Cycle number when this contribution was made (0-indexed).
    /// Tracks which rotation cycle this contribution is for.
    pub cycle_number: u32,

    /// Amount contributed in stroops (1 XLM = 10^7 stroops).
    /// Must match the group's required contribution_amount.
    /// Must be greater than 0.
    pub amount: i128,

    /// Timestamp when the contribution was made (Unix timestamp in seconds).
    /// Used for tracking contribution timing and enforcing deadlines.
    pub timestamp: u64,
}

impl ContributionRecord {
    /// Creates a new ContributionRecord with validation.
    ///
    /// # Arguments
    /// * `member_address` - Address of the contributing member
    /// * `group_id` - ID of the group receiving the contribution
    /// * `cycle_number` - Current cycle number
    /// * `amount` - Contribution amount in stroops
    /// * `timestamp` - Contribution timestamp
    ///
    /// # Panics
    /// Panics if validation constraints are violated:
    /// - amount must be > 0
    pub fn new(
        member_address: Address,
        group_id: u64,
        cycle_number: u32,
        amount: i128,
        timestamp: u64,
    ) -> Self {
        // Validate amount
        assert!(amount > 0, "amount must be greater than 0");

        Self {
            member_address,
            group_id,
            cycle_number,
            amount,
            timestamp,
        }
    }

    /// Validates that the contribution record is sound.
    /// Returns true if all constraints are met.
    pub fn validate(&self) -> bool {
        self.amount > 0
    }

    /// Checks if this contribution matches the expected group and cycle.
    ///
    /// # Arguments
    /// * `expected_group_id` - The group ID to verify against
    /// * `expected_cycle` - The cycle number to verify against
    pub fn matches_group_and_cycle(&self, expected_group_id: u64, expected_cycle: u32) -> bool {
        self.group_id == expected_group_id && self.cycle_number == expected_cycle
    }

    /// Checks if this contribution was made by a specific member.
    ///
    /// # Arguments
    /// * `address` - The member address to check
    pub fn is_from_member(&self, address: &Address) -> bool {
        &self.member_address == address
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::{ARBITRARY_TEST_TIMESTAMP, ONE_WEEK_SECONDS, STROOPS_PER_XLM};
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_contribution_record_creation() {
        let env = Env::default();
        let member = Address::generate(&env);

        let contribution = ContributionRecord::new(
            member.clone(),
            1,                        // group_id
            0,                        // cycle_number
            STROOPS_PER_XLM,          // 1 XLM in stroops
            ARBITRARY_TEST_TIMESTAMP, // timestamp
        );

        assert_eq!(contribution.member_address, member);
        assert_eq!(contribution.group_id, 1);
        assert_eq!(contribution.cycle_number, 0);
        assert_eq!(contribution.amount, STROOPS_PER_XLM);
        assert_eq!(contribution.timestamp, ARBITRARY_TEST_TIMESTAMP);
    }

    #[test]
    #[should_panic(expected = "amount must be greater than 0")]
    fn test_invalid_amount() {
        let env = Env::default();
        let member = Address::generate(&env);

        ContributionRecord::new(member, 1, 0, 0, ARBITRARY_TEST_TIMESTAMP);
    }

    #[test]
    fn test_validate() {
        let env = Env::default();
        let member = Address::generate(&env);

        let contribution = ContributionRecord::new(
            member,
            1,
            0,
            STROOPS_PER_XLM,
            ARBITRARY_TEST_TIMESTAMP,
        );

        assert!(contribution.validate());
    }

    #[test]
    fn test_matches_group_and_cycle() {
        let env = Env::default();
        let member = Address::generate(&env);

        let contribution = ContributionRecord::new(
            member,
            1,
            2,
            STROOPS_PER_XLM,
            ARBITRARY_TEST_TIMESTAMP,
        );

        assert!(contribution.matches_group_and_cycle(1, 2));
        assert!(!contribution.matches_group_and_cycle(1, 3));
        assert!(!contribution.matches_group_and_cycle(2, 2));
        assert!(!contribution.matches_group_and_cycle(2, 3));
    }

    #[test]
    fn test_is_from_member() {
        let env = Env::default();
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        let contribution = ContributionRecord::new(
            member1.clone(),
            1,
            0,
            STROOPS_PER_XLM,
            ARBITRARY_TEST_TIMESTAMP,
        );

        assert!(contribution.is_from_member(&member1));
        assert!(!contribution.is_from_member(&member2));
    }

    #[test]
    fn test_multiple_contributions_same_group() {
        let env = Env::default();
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        let contribution1 = ContributionRecord::new(
            member1.clone(),
            1,
            0,
            STROOPS_PER_XLM,
            ARBITRARY_TEST_TIMESTAMP,
        );

        let contribution2 = ContributionRecord::new(
            member2.clone(),
            1,
            0,
            STROOPS_PER_XLM,
            ARBITRARY_TEST_TIMESTAMP + 1,
        );

        assert_eq!(contribution1.group_id, contribution2.group_id);
        assert_eq!(contribution1.cycle_number, contribution2.cycle_number);
        assert_ne!(contribution1.member_address, contribution2.member_address);
        assert_ne!(contribution1.timestamp, contribution2.timestamp);
    }

    #[test]
    fn test_contribution_across_cycles() {
        let env = Env::default();
        let member = Address::generate(&env);

        let contribution_cycle_0 = ContributionRecord::new(
            member.clone(),
            1,
            0,
            STROOPS_PER_XLM,
            ARBITRARY_TEST_TIMESTAMP,
        );

        let contribution_cycle_1 = ContributionRecord::new(
            member.clone(),
            1,
            1,
            STROOPS_PER_XLM,
            ARBITRARY_TEST_TIMESTAMP + ONE_WEEK_SECONDS,
        );

        assert_eq!(
            contribution_cycle_0.member_address,
            contribution_cycle_1.member_address
        );
        assert_eq!(contribution_cycle_0.group_id, contribution_cycle_1.group_id);
        assert_ne!(
            contribution_cycle_0.cycle_number,
            contribution_cycle_1.cycle_number
        );
    }

    // ── Boundary / overflow regression tests (issue #1718) ────────────────────
    //
    // These tests verify that boundary values are handled safely. Overflow-checks
    // are enabled in the release profile (see root Cargo.toml [profile.release]).
    // Any arithmetic that would overflow at these boundary values must use
    // checked_add / checked_sub instead of raw operators.

    /// Maximum valid i128 amount should be accepted without overflow.
    #[test]
    fn test_amount_i128_max() {
        let env = Env::default();
        let member = Address::generate(&env);
        let amount = i128::MAX;
        let contribution = ContributionRecord::new(member, 1, 0, amount, 0);
        assert_eq!(contribution.amount, i128::MAX);
        assert!(contribution.validate());
    }

    /// amount = 1 (minimum valid positive value) is accepted.
    #[test]
    fn test_amount_minimum_valid() {
        let env = Env::default();
        let member = Address::generate(&env);
        let contribution = ContributionRecord::new(member, 1, 0, 1, 0);
        assert_eq!(contribution.amount, 1);
        assert!(contribution.validate());
    }

    /// amount = -1 must be rejected (below zero).
    #[test]
    #[should_panic(expected = "amount must be greater than 0")]
    fn test_amount_negative_rejected() {
        let env = Env::default();
        let member = Address::generate(&env);
        ContributionRecord::new(member, 1, 0, -1, 0);
    }

    /// amount = i128::MIN must be rejected.
    #[test]
    #[should_panic(expected = "amount must be greater than 0")]
    fn test_amount_i128_min_rejected() {
        let env = Env::default();
        let member = Address::generate(&env);
        ContributionRecord::new(member, 1, 0, i128::MIN, 0);
    }

    /// group_id = u64::MAX is a valid boundary — group IDs are plain keys and
    /// require no arithmetic, so this must not panic.
    #[test]
    fn test_group_id_u64_max() {
        let env = Env::default();
        let member = Address::generate(&env);
        let contribution = ContributionRecord::new(member, u64::MAX, 0, 10_000_000, 0);
        assert_eq!(contribution.group_id, u64::MAX);
        assert!(contribution.validate());
    }

    /// cycle_number = u32::MAX is a valid boundary.
    #[test]
    fn test_cycle_number_u32_max() {
        let env = Env::default();
        let member = Address::generate(&env);
        let contribution = ContributionRecord::new(member, 1, u32::MAX, 10_000_000, 0);
        assert_eq!(contribution.cycle_number, u32::MAX);
        assert!(contribution.validate());
    }

    /// timestamp = u64::MAX is a valid boundary.
    #[test]
    fn test_timestamp_u64_max() {
        let env = Env::default();
        let member = Address::generate(&env);
        let contribution = ContributionRecord::new(member, 1, 0, 10_000_000, u64::MAX);
        assert_eq!(contribution.timestamp, u64::MAX);
        assert!(contribution.validate());
    }

    /// Validate that two maximum-amount contributions can be stored independently
    /// without any inter-record arithmetic overflow.
    #[test]
    fn test_two_max_amount_contributions_independent() {
        let env = Env::default();
        let member1 = Address::generate(&env);
        let member2 = Address::generate(&env);

        let c1 = ContributionRecord::new(member1, 1, 0, i128::MAX, 0);
        let c2 = ContributionRecord::new(member2, 1, 0, i128::MAX, 0);

        // Each record is independently valid; no cross-record addition is performed.
        assert!(c1.validate());
        assert!(c2.validate());
        assert_ne!(c1.member_address, c2.member_address);
    }
}
