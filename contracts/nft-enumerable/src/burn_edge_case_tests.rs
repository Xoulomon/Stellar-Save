//! Edge-case tests for NFT burn and enumeration index-shifting.
//!
//! Covers the scenarios that are known to expose off-by-one and swap-and-pop
//! bugs in enumerable NFT implementations:
//!
//! - Burning the **only** token an owner holds
//! - Burning the **first** token in an owner's list
//! - Burning the **last** token in an owner's list
//! - Burning a **middle** token and verifying index compaction
//! - Index shifting after **multiple sequential burns**
//! - Burn followed by **remint** (recycled token IDs must not collide)
//! - Cross-owner isolation: burn from one owner must not affect another
extern crate std;

use crate::test_utils::{create_client, create_env, setup_accounts};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Collect all owner-index token IDs into a sorted Vec.
fn owner_token_ids(client: &crate::contract::ExampleContractClient, owner: &soroban_sdk::Address, count: u32) -> std::vec::Vec<u32> {
    let mut ids: std::vec::Vec<u32> = (0..count)
        .map(|i| client.get_owner_token_id(owner, &i))
        .collect();
    ids.sort();
    ids
}

// ─── Burn-only-token ─────────────────────────────────────────────────────────

/// Burning the **only** token an owner holds drops their balance to 0.
/// Reminting afterwards must produce a fresh (higher) sequential token ID.
#[test]
fn burn_only_token_then_remint() {
    let e = create_env();
    let (owner, _, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let id = client.mint(&owner);
    assert_eq!(client.balance(&owner), 1);

    client.burn(&owner, &id);
    assert_eq!(client.balance(&owner), 0);

    // Reminting must produce a new, strictly-increasing token ID (not reuse `id`).
    let new_id = client.mint(&owner);
    assert!(
        new_id > id,
        "remint after burning only token must produce a higher ID"
    );
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.get_owner_token_id(&owner, &0), new_id);
}

// ─── First-token burn ────────────────────────────────────────────────────────

/// Burning the **first** token in a two-token list must leave the remaining
/// token accessible at index 0.
#[test]
fn burn_first_token_index_compacts() {
    let e = create_env();
    let (owner, _, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let first = client.mint(&owner);
    let second = client.mint(&owner);

    client.burn(&owner, &first);
    assert_eq!(client.balance(&owner), 1);
    // After compaction the single remaining token must be at owner-index 0.
    assert_eq!(client.get_owner_token_id(&owner, &0), second);
}

// ─── Last-token burn ─────────────────────────────────────────────────────────

/// Burning the **last** token in a two-token list must leave only the first
/// token at owner-index 0.
#[test]
fn burn_last_token_index_compacts() {
    let e = create_env();
    let (owner, _, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let first = client.mint(&owner);
    let second = client.mint(&owner);

    client.burn(&owner, &second);
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.get_owner_token_id(&owner, &0), first);
}

// ─── Middle-token burn ───────────────────────────────────────────────────────

/// Burning the **middle** token in a three-token list must compact correctly,
/// leaving the remaining two tokens at indices 0 and 1 with no gaps.
#[test]
fn burn_middle_token_index_compacts() {
    let e = create_env();
    let (owner, _, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let first = client.mint(&owner);
    let middle = client.mint(&owner);
    let last = client.mint(&owner);

    client.burn(&owner, &middle);
    assert_eq!(client.balance(&owner), 2);

    let remaining = owner_token_ids(&client, &owner, 2);
    let mut expected = std::vec![first, last];
    expected.sort();
    assert_eq!(
        remaining, expected,
        "remaining tokens after middle burn must be first={first} and last={last}"
    );
}

// ─── Multiple sequential burns ───────────────────────────────────────────────

/// Burn multiple tokens sequentially and verify the final index state.
///
/// Mint 4 (ids a,b,c,d), burn a and c; expect only b and d to remain.
#[test]
fn burn_multiple_sequential_index_shifts() {
    let e = create_env();
    let (owner, _, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let a = client.mint(&owner);
    let b = client.mint(&owner);
    let c = client.mint(&owner);
    let d = client.mint(&owner);

    client.burn(&owner, &a);
    assert_eq!(client.balance(&owner), 3);

    client.burn(&owner, &c);
    assert_eq!(client.balance(&owner), 2);

    let remaining = owner_token_ids(&client, &owner, 2);
    let mut expected = std::vec![b, d];
    expected.sort();
    assert_eq!(remaining, expected);
}

// ─── Burn all ────────────────────────────────────────────────────────────────

/// Burn all tokens one by one and verify balance reaches 0 at each step.
#[test]
fn burn_all_tokens_balance_tracks_to_zero() {
    let e = create_env();
    let (owner, _, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let n = 5u32;
    let ids: std::vec::Vec<u32> = (0..n).map(|_| client.mint(&owner)).collect();
    assert_eq!(client.balance(&owner), n);

    for (i, id) in ids.iter().enumerate() {
        client.burn(&owner, id);
        assert_eq!(
            client.balance(&owner),
            n - (i as u32 + 1),
            "balance should decrease after burning token {id}"
        );
    }
    assert_eq!(client.balance(&owner), 0);
}

// ─── Burn then transfer in ───────────────────────────────────────────────────

/// After burning all their tokens the owner can receive a new one via transfer
/// and enumeration remains correct.
#[test]
fn burn_all_then_transfer_in() {
    let e = create_env();
    let (owner, recipient, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    // Owner mints and burns their only token.
    let id = client.mint(&owner);
    client.burn(&owner, &id);
    assert_eq!(client.balance(&owner), 0);

    // Recipient mints and transfers to the now-empty owner.
    let new_id = client.mint(&recipient);
    client.transfer(&recipient, &owner, &new_id);

    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.get_owner_token_id(&owner, &0), new_id);
}

// ─── Cross-owner isolation ───────────────────────────────────────────────────

/// Burning a token from one owner must not affect another owner's enumeration.
#[test]
fn burn_does_not_affect_other_owner_enumeration() {
    let e = create_env();
    let (owner, recipient, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let owner_id = client.mint(&owner);
    let recipient_id = client.mint(&recipient);

    client.burn(&owner, &owner_id);

    // Recipient's enumeration must be unaffected.
    assert_eq!(client.balance(&recipient), 1);
    assert_eq!(client.get_owner_token_id(&recipient, &0), recipient_id);
}

// ─── burn_from with index compaction ─────────────────────────────────────────

/// `burn_from` with approval must correctly update enumeration when burning
/// the first of three tokens.
#[test]
fn burn_from_first_token_index_compacts() {
    let e = create_env();
    let (owner, _, spender) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    let first = client.mint(&owner);
    let second = client.mint(&owner);
    let third = client.mint(&owner);

    // Approve spender for the first token.
    client.approve(&owner, &spender, &first, &1000);
    client.burn_from(&spender, &owner, &first);

    assert_eq!(client.balance(&owner), 2);

    let remaining = owner_token_ids(&client, &owner, 2);
    let mut expected = std::vec![second, third];
    expected.sort();
    assert_eq!(
        remaining, expected,
        "second={second} and third={third} must remain after burning first={first} via burn_from"
    );
}

// ─── Boundary: exact supply tracking ─────────────────────────────────────────

/// Minting increases total supply; burning decreases it.
/// After a complete burn-back-to-zero, a remint starts from the next ID.
#[test]
fn total_supply_tracks_burn_and_remint() {
    let e = create_env();
    let (owner, _, _) = setup_accounts(&e);
    let client = create_client(&e, &owner);

    // Mint 3 tokens: IDs 0, 1, 2.
    let id0 = client.mint(&owner);
    let id1 = client.mint(&owner);
    let id2 = client.mint(&owner);

    // Burn them all back.
    client.burn(&owner, &id0);
    client.burn(&owner, &id1);
    client.burn(&owner, &id2);
    assert_eq!(client.balance(&owner), 0);

    // Remint must continue from ID 3 (sequential, no reuse).
    let id3 = client.mint(&owner);
    assert_eq!(id3, 3, "sequential mint ID must continue after burn");
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.get_owner_token_id(&owner, &0), id3);
}
