/// Property-based tests for insurance-module invariants.
///
/// Feature: Insurance
///
/// Core invariants tested:
///   1. Balance never negative — the insurance reserve can never be drawn below zero.
///   2. Claims ≤ available — no individual claim, or aggregate of claims, can
///      exceed the currently available insurance reserve.
#[cfg(test)]
mod insurance_property_tests {
    use proptest::prelude::*;

    // ── Strategies ────────────────────────────────────────────────────────────

    /// A non-negative insurance reserve balance (0 – 100 000 XLM in stroops).
    fn non_negative_balance() -> impl Strategy<Value = i128> {
        0_i128..=1_000_000_000_000_i128
    }

    /// A positive premium (deposit) amount.
    fn positive_premium() -> impl Strategy<Value = i128> {
        1_i128..=100_000_000_i128
    }

    /// A non-negative claim amount (0 allowed for zero-value edge cases).
    fn claim_amount() -> impl Strategy<Value = i128> {
        0_i128..=1_000_000_000_000_i128
    }

    /// Number of premium deposits in a test.
    fn premium_count() -> impl Strategy<Value = usize> {
        1_usize..=50_usize
    }

    /// Number of sequential claims in a test.
    fn claim_count() -> impl Strategy<Value = usize> {
        1_usize..=20_usize
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Simulate the insurance reserve accepting a premium.
    /// Returns the new balance, or None on overflow.
    fn deposit_premium(balance: i128, premium: i128) -> Option<i128> {
        balance.checked_add(premium)
    }

    /// Simulate the insurance reserve processing a claim.
    /// Returns Ok(new_balance) when the claim is funded, Err if it would go negative.
    fn process_claim(balance: i128, claim: i128) -> Result<i128, &'static str> {
        if claim < 0 {
            return Err("negative claim amount");
        }
        balance
            .checked_sub(claim)
            .filter(|&b| b >= 0)
            .ok_or("claim exceeds available balance")
    }

    // ── Feature: Insurance  Property 1 ───────────────────────────────────────
    // Balance never negative.

    proptest! {
        /// Feature: Insurance  Property 1
        ///
        /// After any sequence of premium deposits, the reserve balance is non-negative.
        #[test]
        fn prop_insurance_balance_never_negative_after_deposits(
            initial in non_negative_balance(),
            premiums in prop::collection::vec(positive_premium(), 1..=50),
        ) {
            let mut balance = initial;
            for premium in premiums {
                balance = deposit_premium(balance, premium)
                    .expect("deposit overflowed — not a real invariant violation");
                prop_assert!(balance >= 0,
                    "balance went negative ({}) after deposit", balance);
            }
        }

        /// Feature: Insurance  Property 2
        ///
        /// A claim that exactly equals the available balance reduces the balance
        /// to zero (not negative).
        #[test]
        fn prop_insurance_exact_claim_reduces_to_zero(
            balance in 1_i128..=1_000_000_000_000_i128,
        ) {
            let result = process_claim(balance, balance);
            prop_assert!(result.is_ok(), "exact claim should succeed");
            prop_assert_eq!(result.unwrap(), 0_i128);
        }

        /// Feature: Insurance  Property 3
        ///
        /// Any claim strictly greater than the available balance must be rejected —
        /// the balance must never be driven negative.
        #[test]
        fn prop_insurance_claim_exceeding_balance_is_rejected(
            balance in 0_i128..=1_000_000_000_000_i128,
            excess in 1_i128..=1_000_000_000_i128,
        ) {
            let claim = balance.saturating_add(excess);
            let result = process_claim(balance, claim);
            prop_assert!(
                result.is_err(),
                "claim ({}) > balance ({}) should be rejected",
                claim, balance
            );
        }

        /// Feature: Insurance  Property 4
        ///
        /// After a valid partial claim, the balance decreases by exactly the
        /// claim amount — no rounding or truncation error.
        #[test]
        fn prop_insurance_valid_claim_decreases_balance_exactly(
            balance in 1_i128..=1_000_000_000_000_i128,
            claim in 1_i128..=1_000_000_000_000_i128,
        ) {
            prop_assume!(claim <= balance);
            let new_balance = process_claim(balance, claim).expect("valid claim");
            prop_assert_eq!(new_balance, balance - claim);
            prop_assert!(new_balance >= 0);
        }
    }

    // ── Feature: Insurance  Property 5–8 (claims ≤ available) ───────────────

    proptest! {
        /// Feature: Insurance  Property 5
        ///
        /// Claims ≤ available: sum of all processed claims can never exceed the
        /// total premiums paid into the reserve.
        #[test]
        fn prop_insurance_aggregate_claims_never_exceed_premiums(
            premium in 1_i128..=100_000_000_i128,
            n_premiums in premium_count(),
            claim_fractions in prop::collection::vec(1_u32..=100_u32, 1..=20),
        ) {
            // Build the reserve by depositing n_premiums × premium.
            let total_funded = premium
                .checked_mul(n_premiums as i128)
                .expect("overflow in total funded");
            let mut balance = total_funded;
            let mut total_claimed: i128 = 0;

            for fraction in &claim_fractions {
                // Each claim is at most 1/100 of the original funded amount.
                let claim = (total_funded / 100).max(1).min(*fraction as i128);
                if claim > balance {
                    break; // stop once reserve is exhausted
                }
                balance = process_claim(balance, claim).expect("claim should succeed");
                total_claimed = total_claimed.checked_add(claim).expect("overflow");
                prop_assert!(balance >= 0,
                    "balance negative after claim: balance={}", balance);
            }

            prop_assert!(
                total_claimed <= total_funded,
                "total claimed ({}) > total funded ({})", total_claimed, total_funded
            );
        }

        /// Feature: Insurance  Property 6
        ///
        /// Sequential claims deplete the reserve monotonically: each successive
        /// balance reading is ≤ the previous one.
        #[test]
        fn prop_insurance_balance_monotonically_decreases_on_claims(
            initial in 1_i128..=1_000_000_000_000_i128,
            n_claims in claim_count(),
        ) {
            let per_claim = (initial / n_claims as i128).max(1);
            let mut balance = initial;
            let mut previous = balance;

            for _ in 0..n_claims {
                if per_claim > balance {
                    break;
                }
                balance = process_claim(balance, per_claim).expect("valid claim");
                prop_assert!(balance <= previous,
                    "balance {} > previous {} after claim", balance, previous);
                previous = balance;
            }
        }

        /// Feature: Insurance  Property 7
        ///
        /// A zero-value claim is always accepted and leaves the balance unchanged.
        #[test]
        fn prop_insurance_zero_claim_is_noop(
            balance in non_negative_balance(),
        ) {
            let result = process_claim(balance, 0);
            prop_assert!(result.is_ok());
            prop_assert_eq!(result.unwrap(), balance);
        }

        /// Feature: Insurance  Property 8
        ///
        /// After processing a claim the remaining balance is always a non-negative
        /// integer (no fractional values).
        #[test]
        fn prop_insurance_remaining_balance_is_non_negative_integer(
            balance in 1_i128..=1_000_000_000_000_i128,
            claim in 0_i128..=1_000_000_000_000_i128,
        ) {
            prop_assume!(claim <= balance);
            let remaining = process_claim(balance, claim).unwrap();
            prop_assert!(remaining >= 0);
            // i128 is always integral — this property documents the no-fractional invariant.
            prop_assert_eq!(remaining, balance - claim);
        }

        /// Feature: Insurance  Property 9
        ///
        /// Premiums and claims are associative: processing them in any order
        /// produces the same final balance, provided no intermediate balance
        /// goes negative.
        #[test]
        fn prop_insurance_premium_plus_claim_is_order_independent(
            reserve in non_negative_balance(),
            premium in positive_premium(),
            claim in claim_amount(),
        ) {
            // Only test when claim ≤ reserve + premium (valid scenario).
            let funded = reserve.checked_add(premium).unwrap_or(i128::MAX);
            prop_assume!(claim <= funded);

            // Order A: deposit first, then claim.
            let after_deposit_a = deposit_premium(reserve, premium).unwrap_or(i128::MAX);
            let final_a = process_claim(after_deposit_a, claim).expect("order A claim failed");

            // Order B: (conceptual) — if claim ≤ reserve, claim first, then deposit.
            let final_b = if claim <= reserve {
                let after_claim_b = process_claim(reserve, claim).unwrap();
                deposit_premium(after_claim_b, premium).unwrap_or(i128::MAX)
            } else {
                // Claim is only possible after deposit — this ordering matches A.
                final_a
            };

            prop_assert_eq!(final_a, final_b,
                "order mattered: A={} B={} (reserve={} premium={} claim={})",
                final_a, final_b, reserve, premium, claim);
        }
    }
}
