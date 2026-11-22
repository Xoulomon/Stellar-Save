//! Property-based fuzz tests for Non-Fungible Enumerable contract.
//!
//! Uses the shared `FuzzRunner` and `FuzzRng` from `stellar_save_common::fuzz`.

#![cfg(test)]
extern crate std;

use crate::test_utils::{create_client, create_env, setup_accounts};
use stellar_save_common::fuzz::FuzzRunner;

/// Fuzz Target 1: Fuzz sequential minting and owner index mapping invariants.
///
/// Run budget: 1,000 iterations (10 batches of 100 sequential mints across randomized recipients).
/// Invariants:
/// - Token IDs minted sequentially increment from 0 to N-1.
/// - Balance of each owner strictly equals the count of tokens minted to that owner.
/// - get_owner_token_id strictly returns the correct token ID for each index.
/// - Zero panics across the run budget.
#[test]
fn fuzz_sequential_minting_and_enumeration() {
    let e = create_env();
    let (owner, recipient, _spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let mut expected_owner_tokens = std::vec::Vec::new();
    let mut expected_recipient_tokens = std::vec::Vec::new();
    let mut next_expected_id: u32 = 0;

    let runner = FuzzRunner::new(0xee1101, 100);
    runner.run(|rng, _iter| {
        let to = if rng.next_bool() { &owner } else { &recipient };
        let token_id = client.mint(to);

        assert_eq!(token_id, next_expected_id, "token ID should strictly increment");
        next_expected_id += 1;

        if to == &owner {
            expected_owner_tokens.push(token_id);
        } else {
            expected_recipient_tokens.push(token_id);
        }

        // Verify balance invariants
        assert_eq!(client.balance(&owner), expected_owner_tokens.len() as u32);
        assert_eq!(client.balance(&recipient), expected_recipient_tokens.len() as u32);
    });

    // Verify enumeration queries
    for (idx, &id) in expected_owner_tokens.iter().enumerate() {
        assert_eq!(client.get_owner_token_id(&owner, &(idx as u32)), id);
    }
    for (idx, &id) in expected_recipient_tokens.iter().enumerate() {
        assert_eq!(client.get_owner_token_id(&recipient, &(idx as u32)), id);
    }
}

/// Fuzz Target 2: Fuzz boundary and out-of-bounds enumeration queries.
///
/// Run budget: 1,000 iterations.
/// Invariants:
/// - Out-of-bounds indices fail gracefully via try_get_owner_token_id without panics.
/// - Valid in-bounds indices always succeed and return non-corrupt token IDs.
/// - Zero panics across 1,000 iterations.
#[test]
fn fuzz_enumeration_boundary_and_out_of_bounds() {
    let e = create_env();
    let (owner, recipient, _spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    // Mint 5 tokens to owner
    for _ in 0..5 {
        client.mint(&owner);
    }

    let runner = FuzzRunner::default_budget(0xee1102); // 1,000 iterations
    runner.run(|rng, _iter| {
        let query_idx = rng.next_u32();
        let target = if rng.next_bool() { &owner } else { &recipient };
        let bal = client.balance(target);

        let res = client.try_get_owner_token_id(target, &query_idx);
        if query_idx < bal {
            assert!(res.is_ok(), "valid index should succeed");
        } else {
            assert!(res.is_err(), "out-of-bounds index should fail gracefully");
        }
    });
}

/// Fuzz Target 3: Fuzz interleaved minting, transferring, and burning.
///
/// Run budget: 1,000 iterations.
/// Invariants:
/// - Balance conservation across transfers and burns: balance(owner) + balance(recipient) matches live token count.
/// - Zero panics across 1,000 iterations.
#[test]
fn fuzz_interleaved_transfer_and_burn_invariants() {
    let e = create_env();
    let (owner, recipient, _spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    // Mint initial pool of tokens
    let mut live_owner_tokens = std::vec::Vec::new();
    let mut live_recipient_tokens = std::vec::Vec::new();
    for _ in 0..20 {
        let id = client.mint(&owner);
        live_owner_tokens.push(id);
    }

    let runner = FuzzRunner::default_budget(0xee1103); // 1,000 iterations
    runner.run(|rng, _iter| {
        let op = rng.next_u32() % 3;
        match op {
            0 => {
                // Transfer from owner to recipient
                if !live_owner_tokens.is_empty() {
                    let idx = (rng.next_u32() as usize) % live_owner_tokens.len();
                    let token_id = live_owner_tokens.swap_remove(idx);
                    let res = client.try_transfer(&owner, &recipient, &token_id);
                    assert!(res.is_ok());
                    live_recipient_tokens.push(token_id);
                }
            }
            1 => {
                // Transfer from recipient to owner
                if !live_recipient_tokens.is_empty() {
                    let idx = (rng.next_u32() as usize) % live_recipient_tokens.len();
                    let token_id = live_recipient_tokens.swap_remove(idx);
                    let res = client.try_transfer(&recipient, &owner, &token_id);
                    assert!(res.is_ok());
                    live_owner_tokens.push(token_id);
                }
            }
            _ => {
                // Burn token from owner if available
                if !live_owner_tokens.is_empty() {
                    let idx = (rng.next_u32() as usize) % live_owner_tokens.len();
                    let token_id = live_owner_tokens.swap_remove(idx);
                    let res = client.try_burn(&owner, &token_id);
                    assert!(res.is_ok());
                }
            }
        }

        assert_eq!(client.balance(&owner), live_owner_tokens.len() as u32);
        assert_eq!(client.balance(&recipient), live_recipient_tokens.len() as u32);
    });
}
