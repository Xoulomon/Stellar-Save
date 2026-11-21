//! Property-based fuzz tests for Fungible AllowList contract.
//!
//! Uses the shared `FuzzRunner` and `FuzzRng` from `stellar_save_common::fuzz`.

#![cfg(test)]
extern crate std;

use crate::test_utils::{create_client, create_env, setup_accounts};
use stellar_save_common::fuzz::FuzzRunner;

/// Fuzz Target 1: Fuzz transfer amounts across boundary values (0, negative, > supply, i128::MAX).
///
/// Run budget: 1,000 iterations.
/// Invariants:
/// - Transfers to non-allowlisted accounts are rejected.
/// - Transfers exceeding available balance are rejected.
/// - Valid transfers strictly conserve balances (sender + recipient balance unchanged).
/// - Zero panics across 1,000 iterations.
#[test]
fn fuzz_transfer_boundaries_and_accounting() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply: i128 = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);

    // Allow user1; user2 is intentionally NOT allowed
    client.allow_user(&user1, &manager);

    let runner = FuzzRunner::default_budget(0xfa1101); // 1,000 iterations
    runner.run(|rng, _iter| {
        let amount = rng.boundary_i128(2_000_000);
        let target_user = if rng.next_bool() { &user1 } else { &user2 };

        let admin_bal_before = client.balance(&admin);
        let target_bal_before = client.balance(target_user);

        // Attempt transfer via try_transfer to check contract rejection without panicking
        let res = client.try_transfer(&admin, target_user, &amount);

        if !client.allowed(target_user) || amount <= 0 || amount > admin_bal_before {
            assert!(
                res.is_err(),
                "transfer should have failed for amount={}, allowed={}",
                amount,
                client.allowed(target_user)
            );
            // Balance must not change on error
            assert_eq!(client.balance(&admin), admin_bal_before);
            assert_eq!(client.balance(target_user), target_bal_before);
        } else {
            assert!(res.is_ok(), "valid transfer should have succeeded");
            assert_eq!(client.balance(&admin), admin_bal_before - amount);
            assert_eq!(client.balance(target_user), target_bal_before + amount);
        }
    });
}

/// Fuzz Target 2: Fuzz allowlist state transitions and manager role authorization.
///
/// Run budget: 1,000 iterations.
/// Invariants:
/// - Only authorized manager can allow/disallow users.
/// - Repeated allow/disallow calls are idempotent.
/// - Zero panics across 1,000 iterations.
#[test]
fn fuzz_allowlist_authorization_and_idempotency() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply: i128 = 1_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);

    let runner = FuzzRunner::default_budget(0xfa1102); // 1,000 iterations
    runner.run(|rng, _iter| {
        let target = if rng.next_bool() { &user1 } else { &user2 };
        let is_allow = rng.next_bool();
        let use_manager = rng.next_bool();
        let operator = if use_manager { &manager } else { &user1 };

        let prev_allowed = client.allowed(target);

        if is_allow {
            let res = client.try_allow_user(target, operator);
            if use_manager {
                assert!(res.is_ok());
                assert!(client.allowed(target));
            } else {
                assert!(res.is_err(), "unauthorized caller should fail allow_user");
                assert_eq!(client.allowed(target), prev_allowed);
            }
        } else {
            let res = client.try_disallow_user(target, operator);
            if use_manager {
                assert!(res.is_ok());
                assert!(!client.allowed(target));
            } else {
                assert!(res.is_err(), "unauthorized caller should fail disallow_user");
                assert_eq!(client.allowed(target), prev_allowed);
            }
        }
    });
}

/// Fuzz Target 3: Fuzz interleaved operations sequence (allow, transfer, burn).
///
/// Run budget: 1,000 iterations.
/// Invariants:
/// - Sum of all circulating balances plus burned tokens strictly equals initial_supply.
/// - Zero panics across 1,000 iterations.
#[test]
fn fuzz_interleaved_lifecycle_invariants() {
    let e = create_env();
    let (admin, manager, user1, user2) = setup_accounts(&e);
    let initial_supply: i128 = 10_000_000;
    let client = create_client(&e, &admin, &manager, &initial_supply);

    client.allow_user(&user1, &manager);
    client.allow_user(&user2, &manager);

    let mut total_burned: i128 = 0;
    let runner = FuzzRunner::default_budget(0xfa1103); // 1,000 iterations

    runner.run(|rng, _iter| {
        let action = rng.next_u32() % 3;
        match action {
            0 => {
                // Transfer from admin to user1
                let amount = rng.next_in_range_i128(1, 100);
                if client.balance(&admin) >= amount && amount > 0 {
                    let _ = client.try_transfer(&admin, &user1, &amount);
                }
            }
            1 => {
                // Transfer between user1 and user2
                let amount = rng.next_in_range_i128(1, 50);
                if client.balance(&user1) >= amount && amount > 0 {
                    let _ = client.try_transfer(&user1, &user2, &amount);
                }
            }
            _ => {
                // Burn from admin
                let burn_amount = rng.next_in_range_i128(1, 50);
                if client.balance(&admin) >= burn_amount && burn_amount > 0 {
                    if client.try_burn(&admin, &burn_amount).is_ok() {
                        total_burned = total_burned.saturating_add(burn_amount);
                    }
                }
            }
        }

        // Global conservation invariant
        let sum_balances = client.balance(&admin) + client.balance(&user1) + client.balance(&user2);
        assert_eq!(
            sum_balances + total_burned,
            initial_supply,
            "Total supply conservation violated"
        );
    });
}
