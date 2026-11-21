//! Cross-contract integration tests for `fungible-allowlist` ↔ `stellar-save`
//! (Issue #1723).
//!
//! # What this tests
//!
//! The Stellar-Save ROSCA contract uses a SEP-41 token for contributions and
//! payouts. When that token is backed by the `fungible-allowlist` contract, the
//! token enforces an on-chain allowlist: only allowlisted accounts may receive
//! or transfer tokens.
//!
//! This file exercises the **integration boundary** between the two contracts:
//!
//! 1. Happy path — a member on the allowlist can transfer tokens to the savings
//!    pool (simulating a contribution).
//!
//! 2. Rejection path — a member **not** on the allowlist cannot transfer
//!    tokens; the allowlist contract panics and the pool call rolls back.
//!
//! 3. Recovery path — after an admin re-allowlists a previously-rejected
//!    address, that address can transfer successfully.
//!
//! # Test architecture
//!
//! Soroban's test environment allows multiple contracts to coexist in one `Env`.
//! We deploy:
//! * The `fungible-allowlist` `ExampleContract` as the token (via `crate::`
//!   since this file lives inside the same crate).
//! * A minimal `MockSavingsPool` contract defined below that simulates
//!   `stellar-save`'s contribution path:
//!   `token.transfer_from(pool, member, pool, amount)`.
//!
//! Using an inline mock avoids cross-crate binary-dependency issues (both
//! `stellar-save` and `fungible-allowlist` are `cdylib` crates), while still
//! exercising the real allowlist enforcement code path end-to-end.

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    contract, contractimpl,
    testutils::Address as _,
    token::TokenClient,
    Address, Env,
};

use crate::{
    contract::{ExampleContract, ExampleContractClient},
    test_utils::{create_client, setup_accounts},
};

// ── Minimal mock savings-pool contract ───────────────────────────────────────
//
// In production `stellar-save` calls `token.transfer_from(spender, from, to, amount)`
// when a member makes a contribution. We replicate that call here so the test
// exercises the real allowlist enforcement code path.

#[contract]
struct MockSavingsPool;

#[contractimpl]
impl MockSavingsPool {
    /// Simulate a member contribution.
    ///
    /// Pulls `amount` tokens from `member` into this pool address using
    /// `transfer_from`. This mirrors the critical transfer path in
    /// `stellar-save::contract::contribute`.
    pub fn contribute(e: &Env, token: Address, member: Address, amount: i128) {
        let pool = e.current_contract_address();
        TokenClient::new(e, &token).transfer_from(&pool, &member, &pool, &amount);
    }

    /// Simulate a payout.
    ///
    /// Sends `amount` tokens from the pool to `recipient`. This mirrors
    /// `stellar-save::contract::execute_payout`.
    pub fn payout(e: &Env, token: Address, recipient: Address, amount: i128) {
        let pool = e.current_contract_address();
        TokenClient::new(e, &token).transfer(&pool, &recipient, &amount);
    }
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

const INITIAL_SUPPLY: i128 = 10_000_000_000; // 1 000 XLM
const MEMBER_MINT: i128 = 100_000_000; //    10 XLM per member
const CONTRIBUTION: i128 = 10_000_000; //     1 XLM per contribution

/// Deploy the allowlisted token and mock pool; fund 3 member accounts.
///
/// Returns `(env, token_address, admin, manager, pool_address, members)`.
/// All members start with `MEMBER_MINT` tokens but are **not** on the allowlist.
fn setup() -> (Env, Address, Address, Address, Address, [Address; 3]) {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, manager, user1, _) = setup_accounts(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let members = [user1, user2, user3];

    // Deploy the allowlisted token
    let token_client = create_client(&env, &admin, &manager, &INITIAL_SUPPLY);
    let token_address = token_client.address.clone();

    // Deploy the mock savings pool and allowlist it (needed for payout transfers)
    let pool_address = env.register(MockSavingsPool, ());
    token_client.allow_user(&pool_address, &manager);

    // Fund each member: temporarily allowlist → transfer from admin → disallow.
    // After setup, members hold tokens but are NOT on the allowlist.
    for member in members.iter() {
        token_client.allow_user(member, &manager);
        TokenClient::new(&env, &token_address).transfer(&admin, member, &MEMBER_MINT);
        token_client.disallow_user(member, &manager);
    }

    (env, token_address, admin, manager, pool_address, members)
}

/// Approve `pool` to pull `amount` from `member`.
fn approve(env: &Env, token_address: &Address, member: &Address, pool: &Address, amount: i128) {
    let expiry = env.ledger().sequence() + 1_000;
    TokenClient::new(env, token_address).approve(member, pool, &amount, &expiry);
}

// ═════════════════════════════════════════════════════════════════════════════
// Happy path: allowlisted member can contribute
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn allowlisted_member_can_contribute_to_savings_pool() {
    let (env, token_address, _admin, manager, pool_address, members) = setup();
    let member = &members[0];

    let token = ExampleContractClient::new(&env, &token_address);
    let tok = TokenClient::new(&env, &token_address);
    let pool = MockSavingsPoolClient::new(&env, &pool_address);

    // Allowlist the member for this contribution
    token.allow_user(member, &manager);
    assert!(token.allowed(member));

    let balance_before = tok.balance(member);
    let pool_balance_before = tok.balance(&pool_address);

    // Approve the pool to pull the contribution, then contribute
    approve(&env, &token_address, member, &pool_address, CONTRIBUTION);
    pool.contribute(&token_address, member, &CONTRIBUTION);

    assert_eq!(
        tok.balance(member),
        balance_before - CONTRIBUTION,
        "member balance should decrease by the contribution amount"
    );
    assert_eq!(
        tok.balance(&pool_address),
        pool_balance_before + CONTRIBUTION,
        "pool balance should increase by the contribution amount"
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// Rejection path: non-allowlisted member CANNOT contribute
// ═════════════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Error(Contract")]
fn non_allowlisted_member_cannot_contribute_to_savings_pool() {
    let (env, token_address, _admin, _manager, pool_address, members) = setup();
    let member = &members[1];

    let token = ExampleContractClient::new(&env, &token_address);
    let pool = MockSavingsPoolClient::new(&env, &pool_address);

    // Confirm member is NOT allowlisted
    assert!(!token.allowed(member));

    // Allowlist check fires at transfer_from (inside contribute), not at approve
    approve(&env, &token_address, member, &pool_address, CONTRIBUTION);

    // Must panic with a contract-level allowlist error
    pool.contribute(&token_address, member, &CONTRIBUTION);
}

// ═════════════════════════════════════════════════════════════════════════════
// Rejection path: disallowed member cannot contribute after removal
// ═════════════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Error(Contract")]
fn disallowed_member_cannot_contribute_after_removal_from_allowlist() {
    let (env, token_address, _admin, manager, pool_address, members) = setup();
    let member = &members[2];

    let token = ExampleContractClient::new(&env, &token_address);
    let pool = MockSavingsPoolClient::new(&env, &pool_address);

    // Allowlist the member, then disallow them
    token.allow_user(member, &manager);
    assert!(token.allowed(member));
    token.disallow_user(member, &manager);
    assert!(!token.allowed(member));

    approve(&env, &token_address, member, &pool_address, CONTRIBUTION);

    // Must fail — the member is no longer on the allowlist
    pool.contribute(&token_address, member, &CONTRIBUTION);
}

// ═════════════════════════════════════════════════════════════════════════════
// Recovery path: re-allowlisted member can contribute again
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn re_allowlisted_member_can_contribute_after_recovery() {
    let (env, token_address, _admin, manager, pool_address, members) = setup();
    let member = &members[0];

    let token = ExampleContractClient::new(&env, &token_address);
    let tok = TokenClient::new(&env, &token_address);
    let pool = MockSavingsPoolClient::new(&env, &pool_address);

    // Allow → disallow → re-allow
    token.allow_user(member, &manager);
    token.disallow_user(member, &manager);
    assert!(!token.allowed(member));
    token.allow_user(member, &manager);
    assert!(token.allowed(member));

    let balance_before = tok.balance(member);
    approve(&env, &token_address, member, &pool_address, CONTRIBUTION);
    pool.contribute(&token_address, member, &CONTRIBUTION);

    assert_eq!(
        tok.balance(member),
        balance_before - CONTRIBUTION,
        "re-allowlisted member contribution should succeed"
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// Payout path: pool CAN pay out to an allowlisted recipient
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn pool_can_pay_out_to_allowlisted_recipient() {
    let (env, token_address, admin, manager, pool_address, members) = setup();
    let member = &members[0];

    let token = ExampleContractClient::new(&env, &token_address);
    let tok = TokenClient::new(&env, &token_address);
    let pool = MockSavingsPoolClient::new(&env, &pool_address);

    // Seed the pool from admin (admin is always allowlisted)
    let pool_seed = CONTRIBUTION * 3;
    tok.transfer(&admin, &pool_address, &pool_seed);

    // Allowlist the recipient for payout
    token.allow_user(member, &manager);
    let balance_before = tok.balance(member);

    pool.payout(&token_address, member, &pool_seed);

    assert_eq!(
        tok.balance(member),
        balance_before + pool_seed,
        "allowlisted recipient should receive full payout"
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// Payout path: pool CANNOT pay out to a non-allowlisted recipient
// ═════════════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Error(Contract")]
fn pool_cannot_pay_out_to_non_allowlisted_recipient() {
    let (env, token_address, admin, _manager, pool_address, members) = setup();
    let member = &members[1]; // not allowlisted

    let token = ExampleContractClient::new(&env, &token_address);
    let tok = TokenClient::new(&env, &token_address);
    let pool = MockSavingsPoolClient::new(&env, &pool_address);

    assert!(!token.allowed(member));

    // Fund the pool
    tok.transfer(&admin, &pool_address, &(CONTRIBUTION * 3));

    // Payout to non-allowlisted member — must fail
    pool.payout(&token_address, member, &CONTRIBUTION);
}

// ═════════════════════════════════════════════════════════════════════════════
// Full 3-cycle round-trip with allowlisted token
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn full_cycle_three_members_with_allowlisted_token() {
    let (env, token_address, _admin, manager, pool_address, members) = setup();

    let token = ExampleContractClient::new(&env, &token_address);
    let tok = TokenClient::new(&env, &token_address);
    let pool = MockSavingsPoolClient::new(&env, &pool_address);

    // Allowlist all 3 members
    for member in members.iter() {
        token.allow_user(member, &manager);
    }

    let total_pool = CONTRIBUTION * 3;

    for cycle in 0..3usize {
        let recipient = &members[cycle];
        let recipient_balance_before = tok.balance(recipient);

        // Each member approves and contributes
        for member in members.iter() {
            approve(&env, &token_address, member, &pool_address, CONTRIBUTION);
            pool.contribute(&token_address, member, &CONTRIBUTION);
        }

        // Payout to this cycle's recipient
        pool.payout(&token_address, recipient, &total_pool);

        assert_eq!(
            tok.balance(recipient),
            recipient_balance_before - CONTRIBUTION + total_pool,
            "cycle {}: recipient should net {} tokens",
            cycle,
            total_pool - CONTRIBUTION
        );
    }

    // Pool is empty after all payouts
    assert_eq!(
        tok.balance(&pool_address),
        0,
        "pool must be empty after all payouts complete"
    );
}
