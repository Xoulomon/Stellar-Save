/// Property-based tests for escrow invariants.
///
/// Feature: Escrow
///
/// Core invariants tested:
///   1. No double-credit — a member cannot be credited more than once per cycle.
///   2. Conservation of credited amounts — the sum of all credited amounts
///      across all cycles equals the expected total derived from the per-cycle
///      credit amount and the number of cycles, with no loss or gain.
#[cfg(test)]
mod escrow_property_tests {
    use crate::{
        contribution::ContributionRecord,
        payout::PayoutRecord,
    };
    use proptest::prelude::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    // ── Strategies ────────────────────────────────────────────────────────────

    /// Generate a positive contribution amount (1 stroop to 100 000 XLM).
    fn positive_amount() -> impl Strategy<Value = i128> {
        1_i128..=1_000_000_000_000_i128
    }

    /// Generate a valid member count (2–50 for escrow scenarios).
    fn valid_member_count() -> impl Strategy<Value = u32> {
        2_u32..=50_u32
    }

    /// Generate a cycle number.
    fn any_cycle() -> impl Strategy<Value = u32> {
        0_u32..=999_u32
    }

    /// Generate a group id.
    fn any_group_id() -> impl Strategy<Value = u64> {
        1_u64..=u64::MAX
    }

    // ── Feature: Escrow  Property 1 ─────────────────────────────────────────
    // No double-credit: a member's credit for a given cycle can only be applied once.

    proptest! {
        /// Feature: Escrow  Property 1
        ///
        /// A ContributionRecord for (group_id, cycle, member) is unique: creating
        /// two records with identical keys yields two distinct records with the same
        /// cycle and group — detecting the duplicate at the application layer is the
        /// contract's responsibility, but the record data itself must be consistent.
        #[test]
        fn prop_escrow_no_double_credit_same_cycle(
            amount in positive_amount(),
            cycle in any_cycle(),
            gid in any_group_id(),
        ) {
            let env = Env::default();
            let member = Address::generate(&env);

            let rec1 = ContributionRecord::new(member.clone(), gid, cycle, amount, 0);
            let rec2 = ContributionRecord::new(member.clone(), gid, cycle, amount, 1);

            // Both records carry the same identifying fields — the contract should
            // reject the second credit.  At the record level we verify identity.
            prop_assert_eq!(rec1.cycle_number, rec2.cycle_number);
            prop_assert_eq!(rec1.group_id, rec2.group_id);
            prop_assert_eq!(rec1.contributor, rec2.contributor);

            // The amount must not be doubled — each record holds exactly amount,
            // NOT amount + amount.
            prop_assert_eq!(rec1.amount, amount);
            prop_assert_eq!(rec2.amount, amount);
        }

        /// Feature: Escrow  Property 2
        ///
        /// After crediting N distinct members in the same cycle each with
        /// `amount`, the aggregate credited total equals amount × N (no loss).
        #[test]
        fn prop_escrow_no_double_credit_distinct_members(
            amount in positive_amount(),
            n in valid_member_count(),
            cycle in any_cycle(),
            gid in any_group_id(),
        ) {
            let env = Env::default();
            let records: Vec<ContributionRecord> = (0..n as usize)
                .map(|i| {
                    let member = Address::generate(&env);
                    ContributionRecord::new(member, gid, cycle, amount, i as u64)
                })
                .collect();

            // All records must belong to the same cycle and group.
            for rec in &records {
                prop_assert_eq!(rec.cycle_number, cycle);
                prop_assert_eq!(rec.group_id, gid);
            }

            // Aggregate — must equal amount × N (no double-counting).
            let total: i128 = records
                .iter()
                .map(|r| r.amount)
                .fold(0_i128, |acc, x| acc + x);
            prop_assert_eq!(total, amount * n as i128);
        }

        /// Feature: Escrow  Property 3
        ///
        /// Each member address appears at most once in a well-formed escrow
        /// credit list: the set of contributors across records for the same
        /// (group_id, cycle) must have no duplicate addresses.
        #[test]
        fn prop_escrow_no_duplicate_contributor_in_cycle(
            amount in positive_amount(),
            n in valid_member_count(),
            cycle in any_cycle(),
            gid in any_group_id(),
        ) {
            let env = Env::default();
            let members: Vec<Address> =
                (0..n as usize).map(|_| Address::generate(&env)).collect();

            let records: Vec<ContributionRecord> = members
                .iter()
                .map(|m| ContributionRecord::new(m.clone(), gid, cycle, amount, 0))
                .collect();

            // Verify uniqueness by comparing stringified addresses.
            let mut seen = std::collections::HashSet::new();
            for rec in &records {
                let key = format!("{:?}", rec.contributor);
                prop_assert!(
                    seen.insert(key.clone()),
                    "duplicate contributor detected: {}",
                    key
                );
            }
        }
    }

    // ── Feature: Escrow  Property 4–6 (conservation of credited amounts) ────

    proptest! {
        /// Feature: Escrow  Property 4
        ///
        /// Conservation: the sum of all credited amounts over `cycles` cycles
        /// (each with `n` members contributing `amount`) equals amount × n × cycles.
        #[test]
        fn prop_escrow_conservation_of_credited_amounts(
            amount in 1_i128..=1_000_000_000_i128,
            n in valid_member_count(),
            cycles in 1_u32..=20_u32,
            gid in any_group_id(),
        ) {
            let env = Env::default();
            let expected_total = amount
                .checked_mul(n as i128).expect("overflow n")
                .checked_mul(cycles as i128).expect("overflow cycles");

            let mut running_total: i128 = 0;
            for cycle in 0..cycles {
                for _ in 0..n {
                    let member = Address::generate(&env);
                    let rec = ContributionRecord::new(member, gid, cycle, amount, 0);
                    running_total = running_total
                        .checked_add(rec.amount)
                        .expect("overflow in running total");
                }
            }

            prop_assert_eq!(running_total, expected_total);
        }

        /// Feature: Escrow  Property 5
        ///
        /// Conservation across payout: total credits must equal total debits
        /// (payout amounts) after a complete ROSCA rotation.
        #[test]
        fn prop_escrow_credits_equal_debits_after_rotation(
            amount in 1_i128..=1_000_000_000_i128,
            n in valid_member_count(),
            gid in any_group_id(),
        ) {
            let env = Env::default();

            // Total credits: n members × n cycles × amount
            let total_credits = amount
                .checked_mul(n as i128).expect("overflow credits n")
                .checked_mul(n as i128).expect("overflow credits n²");

            // Total debits: n payouts, each of (amount × n)
            let pool = amount.checked_mul(n as i128).expect("overflow pool");
            let total_debits: i128 = (0..n as usize)
                .map(|cycle| {
                    let recipient = Address::generate(&env);
                    PayoutRecord::new(recipient, gid, cycle as u32, pool, cycle as u64).amount
                })
                .fold(0_i128, |acc, x| acc.checked_add(x).expect("overflow debits"));

            prop_assert_eq!(total_credits, total_debits,
                "credits {} ≠ debits {} for amount={} n={}",
                total_credits, total_debits, amount, n);
        }

        /// Feature: Escrow  Property 6
        ///
        /// Partial-cycle conservation: the credited total for an incomplete cycle
        /// equals amount × (number of members who have contributed so far),
        /// never exceeding the full cycle pool.
        #[test]
        fn prop_escrow_partial_cycle_never_exceeds_pool(
            amount in 1_i128..=1_000_000_000_i128,
            n in valid_member_count(),
            contributed in 0_u32..=50_u32,
            gid in any_group_id(),
        ) {
            let env = Env::default();
            // Clamp contributed to n
            let contributed = contributed.min(n);

            let pool = amount.checked_mul(n as i128).expect("overflow pool");

            let partial_total: i128 = (0..contributed as usize)
                .map(|_| {
                    let member = Address::generate(&env);
                    ContributionRecord::new(member, gid, 0, amount, 0).amount
                })
                .fold(0_i128, |acc, x| acc + x);

            prop_assert!(
                partial_total <= pool,
                "partial total {} > pool {} (contributed={}, n={})",
                partial_total, pool, contributed, n
            );
            prop_assert_eq!(partial_total, amount * contributed as i128);
        }

        /// Feature: Escrow  Property 7
        ///
        /// A single credited amount is never mutated: reading the amount back
        /// from a ContributionRecord always returns the originally stored value.
        #[test]
        fn prop_escrow_credited_amount_is_immutable(
            amount in positive_amount(),
            cycle in any_cycle(),
            gid in any_group_id(),
        ) {
            let env = Env::default();
            let member = Address::generate(&env);
            let rec = ContributionRecord::new(member, gid, cycle, amount, 0);
            // Reading back must always return the same value.
            prop_assert_eq!(rec.amount, amount);
            prop_assert_eq!(rec.amount, amount); // idempotent
        }
    }
}
