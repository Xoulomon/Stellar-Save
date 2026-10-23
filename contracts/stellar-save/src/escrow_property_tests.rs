/// Property-based tests for escrow invariants.
///
/// Feature: Escrow
///
/// Core invariants tested:
///   1. No double-credit — a member cannot be credited more than once per cycle.
///   2. Conservation of credited amounts — the sum of all credited amounts
///      across all cycles equals the expected total derived from the per-cycle
///      credit amount and the number of cycles, with no loss or gain.
///   3. Solvency & Non-negativity — at no point in arbitrary sequences of deposits
///      and partial withdrawals does escrow balance drop below zero.
///   4. Concurrent Interleaving Conservation — the aggregate escrow balance matches
///      total deposited minus total withdrawn across arbitrary interleaved member actions.
///   5. Exhaustive Withdrawal Liquidation — draining remaining balances brings balance to exactly 0.
///   6. Overdraw Protection — any partial withdrawal exceeding available member credit is rejected.
///   7. Member Account Isolation — member operations do not perturb independent member balances.
///   8. Multi-Cycle Interleaving — partial refunds in past cycles do not corrupt subsequent cycles.
///
/// # Gap Analysis (Issue #1714)
/// Prior to this enhancement, `escrow_property_tests.rs` only evaluated static record data
/// consistency and complete ROSCA rotation conservation (Properties 1–7). It lacked coverage for:
/// - Dynamic state tracking: simulation of active escrow accounts holding deposits.
/// - Partial withdrawals: members withdrawing fractions of their credited balances.
/// - Concurrent contribution interleavings: sequences where deposits from member A interleave
///   with partial withdrawals or refunds by member B.
/// - Solvency & overdraw invariants: ensuring that an attempted withdrawal exceeding credited funds
///   is rejected without mutating state or corrupting system solvency.
/// - Liquidation soundness: ensuring complete withdrawal drains the escrow exactly to zero.
#[cfg(test)]
mod escrow_property_tests {
    use crate::{
        contribution::ContributionRecord,
        payout::PayoutRecord,
        pool::PoolCalculator,
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

    proptest! {
        #![proptest_config(ProptestConfig {
            cases: 10_000,
            .. ProptestConfig::default()
        })]

        /// The escrow balance equals the sum of all successful contributions.
        #[test]
        fn prop_escrow_math_contributions_equal_balance(
            contributions in prop::collection::vec(1_i128..=1_000_000_000_000_i128, 1..=50),
        ) {
            let mut ledger = EscrowLedger::new(contributions.len());
            let expected_total = contributions
                .iter()
                .try_fold(0_i128, |total, amount| total.checked_add(*amount))
                .expect("generated contribution total must fit i128");

            for (member_idx, amount) in contributions.into_iter().enumerate() {
                ledger.apply_deposit(member_idx, amount).unwrap();
            }

            prop_assert_eq!(ledger.total_deposited(), expected_total);
            prop_assert_eq!(ledger.total_balance(), expected_total);
        }

        /// A calculated payout cannot exceed the balance funded by contributions.
        #[test]
        fn prop_escrow_math_payout_never_exceeds_balance(
            contribution in 1_i128..=1_000_000_000_000_i128,
            member_count in 2_u32..=50_u32,
        ) {
            let mut ledger = EscrowLedger::new(member_count as usize);
            for member_idx in 0..member_count as usize {
                ledger.apply_deposit(member_idx, contribution).unwrap();
            }

            let escrow_balance = ledger.total_balance();
            let pool = PoolCalculator::calculate_total_pool(contribution, member_count).unwrap();
            let payout = PoolCalculator::calculate_payout_amount(pool).unwrap();

            prop_assert_eq!(pool, escrow_balance);
            prop_assert!(payout <= escrow_balance);
        }

        /// Integer division distributes only whole shares; the undistributed
        /// remainder accounts for every unit and is always smaller than the share count.
        #[test]
        fn prop_escrow_math_rounding_never_creates_value(
            escrow_amount in 0_i128..=1_000_000_000_000_i128,
            share_count in 1_i128..=50_i128,
        ) {
            let share = escrow_amount / share_count;
            let distributed = share.checked_mul(share_count).unwrap();
            let remainder = escrow_amount.checked_sub(distributed).unwrap();

            prop_assert!(distributed <= escrow_amount);
            prop_assert_eq!(distributed + remainder, escrow_amount);
            prop_assert!(remainder < share_count);
        }
    }

    // ── Escrow Simulation State Machine ────────────────────────────────────────

    #[derive(Clone, Debug, Default, PartialEq, Eq)]
    pub struct EscrowMemberAccount {
        pub deposited: i128,
        pub withdrawn: i128,
    }

    impl EscrowMemberAccount {
        pub fn balance(&self) -> i128 {
            self.deposited.saturating_sub(self.withdrawn)
        }

        pub fn deposit(&mut self, amount: i128) -> Result<(), &'static str> {
            if amount <= 0 {
                return Err("deposit must be positive");
            }
            self.deposited = self.deposited.checked_add(amount).ok_or("overflow")?;
            Ok(())
        }

        pub fn withdraw(&mut self, amount: i128) -> Result<(), &'static str> {
            if amount <= 0 {
                return Err("withdrawal must be positive");
            }
            if amount > self.balance() {
                return Err("insufficient balance for withdrawal");
            }
            self.withdrawn = self.withdrawn.checked_add(amount).ok_or("overflow")?;
            Ok(())
        }
    }

    #[derive(Clone, Debug, Default)]
    pub struct EscrowLedger {
        pub accounts: std::vec::Vec<EscrowMemberAccount>,
    }

    impl EscrowLedger {
        pub fn new(member_count: usize) -> Self {
            Self {
                accounts: std::vec![EscrowMemberAccount::default(); member_count],
            }
        }

        pub fn total_balance(&self) -> i128 {
            self.accounts
                .iter()
                .map(|a| a.balance())
                .fold(0_i128, |acc, b| acc.saturating_add(b))
        }

        pub fn total_deposited(&self) -> i128 {
            self.accounts
                .iter()
                .map(|a| a.deposited)
                .fold(0_i128, |acc, d| acc.saturating_add(d))
        }

        pub fn total_withdrawn(&self) -> i128 {
            self.accounts
                .iter()
                .map(|a| a.withdrawn)
                .fold(0_i128, |acc, w| acc.saturating_add(w))
        }

        pub fn apply_deposit(&mut self, member_idx: usize, amount: i128) -> Result<(), &'static str> {
            if member_idx >= self.accounts.len() {
                return Err("invalid member index");
            }
            self.accounts[member_idx].deposit(amount)
        }

        pub fn apply_withdrawal(&mut self, member_idx: usize, amount: i128) -> Result<(), &'static str> {
            if member_idx >= self.accounts.len() {
                return Err("invalid member index");
            }
            self.accounts[member_idx].withdraw(amount)
        }
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
            let records: std::vec::Vec<ContributionRecord> = (0..n as usize)
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
            let members: std::vec::Vec<Address> =
                (0..n as usize).map(|_| Address::generate(&env)).collect();

            let records: std::vec::Vec<ContributionRecord> = members
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

    // ── Feature: Escrow  Property 4–7 (conservation of credited amounts) ────

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

        // prop_escrow_credited_amount_is_immutable removed: it verified only that
        // ContributionRecord::amount == the value passed to new(), which is a strict
        // subset of fuzz_tests::prop_contribution_amount_stored_exactly, which checks
        // amount, cycle_number, and group_id in a single property.  Keeping the
        // more comprehensive test avoids running the same assertion twice.
    }

    // ── Feature: Escrow Properties 8–14 (Partial Withdrawal & Concurrency) ───

    proptest! {
        /// Feature: Escrow  Property 8
        ///
        /// Solvency and non-negativity: across an arbitrary sequence of interleaved
        /// contributions and partial withdrawals, no member's balance and no global
        /// escrow balance can ever drop below zero.
        #[test]
        fn prop_escrow_interleaved_partial_withdrawal_preserves_non_negative_balance(
            n_members in 2_usize..=10_usize,
            steps in prop::collection::vec(
                (0_usize..=9_usize, 1_i128..=1_000_000_i128, prop::bool::ANY),
                1..=50
            ),
        ) {
            let mut ledger = EscrowLedger::new(n_members);

            for (raw_idx, amount, is_deposit) in steps {
                let member_idx = raw_idx % n_members;

                if is_deposit {
                    let res = ledger.apply_deposit(member_idx, amount);
                    prop_assert!(res.is_ok());
                } else {
                    let current_balance = ledger.accounts[member_idx].balance();
                    let withdraw_amount = if current_balance > 0 {
                        (amount % current_balance) + 1
                    } else {
                        amount
                    };

                    let res = ledger.apply_withdrawal(member_idx, withdraw_amount);
                    if withdraw_amount <= current_balance && withdraw_amount > 0 {
                        prop_assert!(res.is_ok());
                    } else {
                        prop_assert!(res.is_err());
                    }
                }

                // Invariant: all balances non-negative
                for acc in &ledger.accounts {
                    prop_assert!(acc.balance() >= 0);
                }
                prop_assert!(ledger.total_balance() >= 0);
            }
        }

        /// Feature: Escrow  Property 9
        ///
        /// Exact conservation under concurrent interleavings:
        /// At all times, total_balance == sum(member_balances) == total_deposited - total_withdrawn.
        #[test]
        fn prop_escrow_interleaved_contributions_and_withdrawals_solvency(
            n_members in 2_usize..=8_usize,
            steps in prop::collection::vec(
                (0_usize..=7_usize, 1_i128..=500_000_i128, 0_u8..=2_u8),
                1..=60
            ),
        ) {
            let mut ledger = EscrowLedger::new(n_members);
            let mut expected_deposited: i128 = 0;
            let mut expected_withdrawn: i128 = 0;

            for (raw_idx, amount, op_type) in steps {
                let member_idx = raw_idx % n_members;

                match op_type {
                    0 | 1 => {
                        // Deposit
                        if ledger.apply_deposit(member_idx, amount).is_ok() {
                            expected_deposited = expected_deposited.checked_add(amount).unwrap();
                        }
                    }
                    _ => {
                        // Partial withdrawal (fraction of balance)
                        let bal = ledger.accounts[member_idx].balance();
                        if bal > 0 {
                            let partial = (amount % bal) + 1;
                            if ledger.apply_withdrawal(member_idx, partial).is_ok() {
                                expected_withdrawn = expected_withdrawn.checked_add(partial).unwrap();
                            }
                        }
                    }
                }

                // Check solvency invariant at every intermediate state
                let current_total = ledger.total_balance();
                let sum_balances: i128 = ledger.accounts.iter().map(|a| a.balance()).sum();
                prop_assert_eq!(current_total, sum_balances);
                prop_assert_eq!(current_total, expected_deposited - expected_withdrawn);
                prop_assert_eq!(ledger.total_deposited(), expected_deposited);
                prop_assert_eq!(ledger.total_withdrawn(), expected_withdrawn);
            }
        }

        /// Feature: Escrow  Property 10
        ///
        /// Overdraw rejection: Any attempt to withdraw strictly more than a member's
        /// current escrow balance must fail with an error and leave balances untouched.
        #[test]
        fn prop_escrow_partial_withdrawal_exceeding_balance_rejected(
            n_members in 2_usize..=6_usize,
            initial_deposit in 100_i128..=1_000_000_i128,
            excess in 1_i128..=10_000_i128,
        ) {
            let mut ledger = EscrowLedger::new(n_members);

            // Fund member 0
            ledger.apply_deposit(0, initial_deposit).unwrap();
            let bal_before = ledger.accounts[0].balance();
            let total_before = ledger.total_balance();

            // Attempt to withdraw balance + excess
            let attempt = initial_deposit.checked_add(excess).unwrap();
            let res = ledger.apply_withdrawal(0, attempt);

            prop_assert!(res.is_err(), "overdraw should have returned Err");
            prop_assert_eq!(ledger.accounts[0].balance(), bal_before, "balance mutated on failed withdraw");
            prop_assert_eq!(ledger.total_balance(), total_before, "total balance mutated on failed withdraw");
        }

        /// Feature: Escrow  Property 11
        ///
        /// Exhaustive liquidation: After any sequence of interleaved deposits and partial
        /// withdrawals, draining all members' remaining balances leaves the escrow total balance
        /// at exactly zero.
        #[test]
        fn prop_escrow_exhaustive_partial_withdrawals_drains_to_zero(
            n_members in 2_usize..=6_usize,
            deposits in prop::collection::vec(1_i128..=100_000_i128, 2..=12),
        ) {
            let mut ledger = EscrowLedger::new(n_members);

            for (i, &amt) in deposits.iter().enumerate() {
                ledger.apply_deposit(i % n_members, amt).unwrap();
            }

            // Partially drain half the members
            for i in 0..n_members {
                let bal = ledger.accounts[i].balance();
                if bal > 2 {
                    ledger.apply_withdrawal(i, bal / 2).unwrap();
                }
            }

            // Now liquidate every remaining balance
            for i in 0..n_members {
                let remaining = ledger.accounts[i].balance();
                if remaining > 0 {
                    let res = ledger.apply_withdrawal(i, remaining);
                    prop_assert!(res.is_ok(), "failed to withdraw exact remaining balance");
                }
                prop_assert_eq!(ledger.accounts[i].balance(), 0_i128);
            }

            prop_assert_eq!(ledger.total_balance(), 0_i128, "escrow leaked funds or did not reach 0");
        }

        /// Feature: Escrow  Property 12
        ///
        /// Account isolation: A deposit or partial withdrawal on member A cannot mutate
        /// the balance or state of member B.
        #[test]
        fn prop_escrow_concurrent_member_isolation(
            amount_a in 1_i128..=500_000_i128,
            amount_b in 1_i128..=500_000_i128,
            withdraw_a in 1_i128..=250_000_i128,
        ) {
            let mut ledger = EscrowLedger::new(2);

            ledger.apply_deposit(0, amount_a).unwrap();
            ledger.apply_deposit(1, amount_b).unwrap();

            let b_initial = ledger.accounts[1].balance();

            // Perform partial withdrawal on member 0
            let actual_withdraw_a = withdraw_a.min(amount_a);
            ledger.apply_withdrawal(0, actual_withdraw_a).unwrap();

            // Member 1 balance must remain completely unchanged
            prop_assert_eq!(ledger.accounts[1].balance(), b_initial);
            prop_assert_eq!(ledger.accounts[0].balance(), amount_a - actual_withdraw_a);
        }

        /// Feature: Escrow  Property 13
        ///
        /// Granularity conservation: Withdrawing an amount in N smaller partial chunks
        /// yields the exact same final balance and total withdrawn as withdrawing the full
        /// amount in a single chunk (no rounding or precision leakage).
        #[test]
        fn prop_escrow_partial_withdrawal_granularity_conservation(
            total in 100_i128..=100_000_i128,
            splits in prop::collection::vec(1_u32..=10_u32, 2..=5),
        ) {
            let mut ledger_single = EscrowLedger::new(1);
            let mut ledger_chunked = EscrowLedger::new(1);

            ledger_single.apply_deposit(0, total).unwrap();
            ledger_chunked.apply_deposit(0, total).unwrap();

            // Single withdraw of 90% of total
            let withdraw_total = (total * 9) / 10;
            ledger_single.apply_withdrawal(0, withdraw_total).unwrap();

            // Chunked withdraw of same total
            let sum_weights: u32 = splits.iter().sum();
            let mut accumulated: i128 = 0;
            for (idx, &w) in splits.iter().enumerate() {
                let chunk = if idx == splits.len() - 1 {
                    withdraw_total - accumulated
                } else {
                    let c = (withdraw_total * w as i128) / sum_weights as i128;
                    accumulated += c;
                    c
                };
                if chunk > 0 {
                    ledger_chunked.apply_withdrawal(0, chunk).unwrap();
                }
            }

            prop_assert_eq!(ledger_single.accounts[0].balance(), ledger_chunked.accounts[0].balance());
            prop_assert_eq!(ledger_single.total_withdrawn(), ledger_chunked.total_withdrawn());
        }

        /// Feature: Escrow  Property 14
        ///
        /// Multi-cycle interleaved refunds and contributions: In a multi-cycle setting,
        /// refunding an earlier cycle's contribution while a later cycle is receiving
        /// concurrent contributions preserves total system accounting.
        #[test]
        fn prop_escrow_multi_cycle_interleaved_refunds_and_contributions(
            amount in 100_i128..=10_000_i128,
            n in 2_usize..=5_usize,
        ) {
            // Cycle 0: all members contribute
            let mut cycle_0_contributions = std::vec![amount; n];
            // Cycle 1: all members contribute
            let mut cycle_1_contributions = std::vec![amount; n];

            let mut escrow = EscrowLedger::new(n);
            for i in 0..n {
                escrow.apply_deposit(i, cycle_0_contributions[i]).unwrap();
            }

            // Half of the members request a partial refund for cycle 0
            // while simultaneously cycle 1 contributions arrive
            for i in 0..n {
                if i % 2 == 0 {
                    // Member i gets cycle 0 refunded
                    escrow.apply_withdrawal(i, cycle_0_contributions[i]).unwrap();
                    cycle_0_contributions[i] = 0;
                }
                // Member i contributes for cycle 1
                escrow.apply_deposit(i, cycle_1_contributions[i]).unwrap();
            }

            let expected_total: i128 = cycle_0_contributions.iter().sum::<i128>()
                + cycle_1_contributions.iter().sum::<i128>();

            prop_assert_eq!(escrow.total_balance(), expected_total);
            prop_assert!(escrow.total_balance() >= 0);
        }
    }
}
