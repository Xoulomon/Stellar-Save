//! Multi-token support integration tests.
//!
//! Tests for Requirements 7.1–7.9 and correctness properties P1–P13.
//! Feature: multi-token-support
//!
//! Setup boilerplate is handled by [`crate::test_utils::TestHarness`].

#![cfg(test)]

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

use crate::{payout::PayoutOrder, test_utils::TestHarness, StellarSaveContractClient};

// ---------------------------------------------------------------------------
// Local helpers (things TestHarness doesn't cover)
// ---------------------------------------------------------------------------

/// Deploy an *extra* SAC token unrelated to the harness token.
fn deploy_extra_token(env: &Env) -> Address {
    let admin = Address::generate(env);
    env.register_stellar_asset_contract_v2(admin).address()
}

fn approve_tokens(env: &Env, token: &Address, owner: &Address, spender: &Address, amount: i128) {
    let expiry = env.ledger().sequence() + 1000;
    TokenClient::new(env, token).approve(owner, spender, &amount, &expiry);
}

fn create_group_with_extra_token(
    client: &StellarSaveContractClient,
    creator: &Address,
    token: &Address,
) -> u64 {
    client.create_group(
        creator,
        &1_000_000i128,
        &3600u64,
        &5u32,
        token,
        &0u64,
        &PayoutOrder::Sequential,
    )
}

// ---------------------------------------------------------------------------
// Task 12.1 — create group with mock USDC (Requirements 7.1)
// ---------------------------------------------------------------------------

#[test]
fn test_create_group_with_usdc_mock() {
    let h = TestHarness::new();
    let usdc = deploy_extra_token(&h.env);
    let creator = Address::generate(&h.env);

    let group_id = create_group_with_extra_token(&h.client(), &creator, &usdc);

    let config = h.client().get_token_config(&group_id);
    assert_eq!(config.token_address, usdc);
    assert_eq!(config.token_decimals, 7);
}

// ---------------------------------------------------------------------------
// Task 12.2 — create group with mock EURC (Requirements 7.2)
// ---------------------------------------------------------------------------

#[test]
fn test_create_group_with_eurc_mock() {
    let h = TestHarness::new();
    let eurc = deploy_extra_token(&h.env);
    let creator = Address::generate(&h.env);

    let group_id = create_group_with_extra_token(&h.client(), &creator, &eurc);

    let config = h.client().get_token_config(&group_id);
    assert_eq!(config.token_address, eurc);
}

// ---------------------------------------------------------------------------
// Task 12.3 — XLM native token accepted (Requirements 1.6)
// ---------------------------------------------------------------------------

#[test]
fn test_create_group_with_xlm() {
    // The harness default token is already a SAC (XLM-equivalent mock).
    let h = TestHarness::new();
    let group_id = h.new_group(1_000_000, 3600, 5);

    let config = h.client().get_token_config(&group_id);
    assert_eq!(config.token_address, h.token);
}

// ---------------------------------------------------------------------------
// Task 12.4 — invalid token address returns error (Requirements 7.5)
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Error(Storage, MissingValue)")]
fn test_create_group_invalid_token() {
    let h = TestHarness::new();
    let creator = Address::generate(&h.env);
    let bad_token = Address::generate(&h.env); // not a deployed token

    h.client().create_group(
        &creator,
        &1_000_000i128,
        &3600u64,
        &5u32,
        &bad_token,
        &0u64,
        &PayoutOrder::Sequential,
    );
}

// ---------------------------------------------------------------------------
// Task 12.5 — contribute transfers correct token (Requirements 7.3)
// ---------------------------------------------------------------------------

#[test]
fn test_contribute_transfers_correct_token() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);
    let member = Address::generate(&h.env);
    h.fund_stroops(&member, 10_000_000);

    let group_id = h.new_group(1_000_000, 3600, 5);
    client.join_group(&group_id, &member, &None);
    client.join_group(&group_id, &creator, &None);
    client.activate_group(&group_id, &creator, &2u32);

    approve_tokens(&h.env, &h.token, &member, &h.contract_id, 1_000_000);

    let tc = TokenClient::new(&h.env, &h.token);
    let before = tc.balance(&member);
    client.contribute(&group_id, &member, &1_000_000);
    assert_eq!(before - tc.balance(&member), 1_000_000);
    assert_eq!(tc.balance(&h.contract_id), 1_000_000);
}

// ---------------------------------------------------------------------------
// Task 12.7 — wrong amount rejected (Requirements 7.6)
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #3001)")]
fn test_contribute_wrong_amount() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);
    let member = Address::generate(&h.env);
    h.fund_stroops(&member, 10_000_000);

    let group_id = h.new_group(1_000_000, 3600, 5);
    client.join_group(&group_id, &member, &None);
    client.join_group(&group_id, &creator, &None);
    client.activate_group(&group_id, &creator, &2u32);

    approve_tokens(&h.env, &h.token, &member, &h.contract_id, 999_999);
    client.contribute(&group_id, &member, &999_999);
}

// ---------------------------------------------------------------------------
// Task 12.8 — no allowance panics (Requirements 7.9)
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_contribute_insufficient_allowance() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);
    let member = Address::generate(&h.env);
    h.fund_stroops(&member, 10_000_000);

    let group_id = h.new_group(1_000_000, 3600, 5);
    client.join_group(&group_id, &member, &None);
    client.join_group(&group_id, &creator, &None);
    client.activate_group(&group_id, &creator, &2u32);

    // No approve — transfer_from must fail
    client.contribute(&group_id, &member, &1_000_000);
}

// ---------------------------------------------------------------------------
// Task 12.9 — two groups, different tokens, independent (Requirements 7.8)
// ---------------------------------------------------------------------------

#[test]
fn test_two_groups_different_tokens_independent() {
    let h = TestHarness::new();
    let client = h.client();
    let creator2 = Address::generate(&h.env);
    let token2 = deploy_extra_token(&h.env);

    let group1 = h.new_group(1_000_000, 3600, 5);
    let group2 = create_group_with_extra_token(&client, &creator2, &token2);

    let c1 = client.get_token_config(&group1);
    let c2 = client.get_token_config(&group2);
    assert_eq!(c1.token_address, h.token);
    assert_eq!(c2.token_address, token2);
    assert_ne!(c1.token_address, c2.token_address);

    assert_eq!(TokenClient::new(&h.env, &h.token).balance(&h.contract_id), 0);
    assert_eq!(TokenClient::new(&h.env, &token2).balance(&h.contract_id), 0);
}

// ---------------------------------------------------------------------------
// Property 1: TokenConfig round-trip
// ---------------------------------------------------------------------------

#[test]
fn prop_token_config_round_trip() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);

    for _ in 0..5 {
        let token = deploy_extra_token(&h.env);
        let gid = create_group_with_extra_token(&client, &creator, &token);
        let cfg = client.get_token_config(&gid);
        assert_eq!(cfg.token_address, token);
        assert_eq!(cfg.token_decimals, 7);
    }
}

// ---------------------------------------------------------------------------
// Property 4: Exact amount enforcement
// ---------------------------------------------------------------------------

#[test]
fn prop_wrong_amount_rejected() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);
    let member = Address::generate(&h.env);
    h.fund_stroops(&member, 100_000_000);

    let group_id = h.new_group(1_000_000, 3600, 5);
    client.join_group(&group_id, &member, &None);
    client.join_group(&group_id, &creator, &None);
    client.activate_group(&group_id, &creator, &2u32);

    let expiry = h.env.ledger().sequence() + 1000;
    let tc = TokenClient::new(&h.env, &h.token);
    for wrong in [500_000i128, 999_999, 1_000_001, 2_000_000] {
        tc.approve(&member, &h.contract_id, &wrong, &expiry);
        assert!(client.try_contribute(&group_id, &member, &wrong).is_err());
    }
}

// ---------------------------------------------------------------------------
// Issue #762 — under / over / exact amount validation
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #3001)")]
fn test_contribute_under_amount() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);
    let member = Address::generate(&h.env);
    h.fund_stroops(&member, 100_000_000);

    let gid = h.new_group(1_000_000, 3600, 5);
    client.join_group(&gid, &member, &None);
    client.join_group(&gid, &creator, &None);
    client.activate_group(&gid, &creator, &2u32);

    approve_tokens(&h.env, &h.token, &member, &h.contract_id, 999_999);
    client.contribute(&gid, &member, &999_999);
}

#[test]
#[should_panic(expected = "Error(Contract, #3001)")]
fn test_contribute_over_amount() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);
    let member = Address::generate(&h.env);
    h.fund_stroops(&member, 100_000_000);

    let gid = h.new_group(1_000_000, 3600, 5);
    client.join_group(&gid, &member, &None);
    client.join_group(&gid, &creator, &None);
    client.activate_group(&gid, &creator, &2u32);

    approve_tokens(&h.env, &h.token, &member, &h.contract_id, 1_000_001);
    client.contribute(&gid, &member, &1_000_001);
}

#[test]
fn test_contribute_exact_amount() {
    let h = TestHarness::new();
    let client = h.client();
    let creator = Address::generate(&h.env);
    let member = Address::generate(&h.env);
    h.fund_stroops(&member, 100_000_000);

    let gid = h.new_group(1_000_000, 3600, 5);
    client.join_group(&gid, &member, &None);
    client.join_group(&gid, &creator, &None);
    client.activate_group(&gid, &creator, &2u32);

    approve_tokens(&h.env, &h.token, &member, &h.contract_id, 1_000_000);
    client.contribute(&gid, &member, &1_000_000);

    let status = client.get_contribution_status(&gid, &0u32);
    assert!(
        status.iter().any(|(addr, contributed)| addr == member && contributed),
        "member contribution should be recorded"
    );
}
