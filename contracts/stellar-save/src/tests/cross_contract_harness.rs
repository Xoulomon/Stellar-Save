//! Cross-contract integration test harness.
//!
//! This module provides a reusable [`CrossContractHarness`] that spins up
//! multiple Soroban contracts in a single test environment. Use it as the
//! starting point whenever you need to exercise interactions between the
//! `stellar-save` ROSCA contract and token or allowlist contracts.
//!
//! # Quick start
//!
//! ```rust,ignore
//! let harness = CrossContractHarness::new();
//! // harness.save_client  -> StellarSaveContractClient
//! // harness.token_client -> TokenClient  (standard SEP-41)
//! // harness.sac_client   -> StellarAssetClient  (mint / burn)
//! // harness.members      -> [Address; 3]  pre-funded test accounts
//! ```
//!
//! Call [`CrossContractHarness::new`] once per test; the environment is
//! isolated and all auths are mocked.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

use crate::{
    payout::PayoutOrder,
    AssignmentMode, StellarSaveContract, StellarSaveContractClient,
};

// ---------------------------------------------------------------------------
// Harness definition
// ---------------------------------------------------------------------------

/// A self-contained multi-contract test environment.
///
/// The harness wires together:
/// * A `stellar-save` ROSCA contract.
/// * A mock SEP-41 token contract (Stellar Asset Contract) that mimics any
///   allowlisted token (USDC, EURC, custom token, etc.).
/// * Three pre-funded member accounts ready to join a group.
///
/// # Usage
/// Construct via [`CrossContractHarness::new`].  All contracts are registered
/// and all auths are mocked; no further setup is required for basic scenarios.
pub struct CrossContractHarness<'a> {
    /// The Soroban test environment shared by all contracts.
    pub env: Env,
    /// Client for the ROSCA `stellar-save` contract.
    pub save_client: StellarSaveContractClient<'a>,
    /// Read-only SEP-41 view of the token (balance, allowance, …).
    pub token_client: TokenClient<'a>,
    /// Admin interface for the token (mint, burn, …).
    pub sac_client: StellarAssetClient<'a>,
    /// Address of the deployed token contract.
    pub token_address: Address,
    /// Three pre-funded member accounts.
    pub members: [Address; 3],
    /// Contribution amount used when creating the default test group (1 XLM).
    pub contribution_amount: i128,
}

impl<'a> CrossContractHarness<'a> {
    /// Initial mint per member: enough to cover contributions for many cycles.
    const MEMBER_MINT: i128 = 100_000_000; // 10 XLM
    /// Default contribution per cycle: 1 XLM.
    pub const CONTRIBUTION_AMOUNT: i128 = 10_000_000;

    /// Build a new harness with all contracts deployed and accounts funded.
    ///
    /// This is the only constructor; call it once at the top of each test.
    pub fn new() -> CrossContractHarness<'a> {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000_000);

        // --- Deploy the mock SEP-41 token ----------------------------------
        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = sac.address();
        let sac_client = StellarAssetClient::new(&env, &token_address);
        let token_client = TokenClient::new(&env, &token_address);

        // --- Deploy the stellar-save ROSCA contract -----------------------
        let save_id = env.register(StellarSaveContract, ());
        let save_client = StellarSaveContractClient::new(&env, &save_id);

        // --- Create and fund 3 member accounts ----------------------------
        let members: [Address; 3] = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        for member in members.iter() {
            sac_client.mint(member, &Self::MEMBER_MINT);
        }

        CrossContractHarness {
            env,
            save_client,
            token_client,
            sac_client,
            token_address,
            members,
            contribution_amount: Self::CONTRIBUTION_AMOUNT,
        }
    }

    /// Approve the save contract to pull `amount` tokens from `owner`.
    pub fn approve(&self, owner: &Address, amount: i128) {
        let expiry = self.env.ledger().sequence() + 10_000;
        self.token_client
            .approve(owner, &self.save_client.address, &amount, &expiry);
    }

    /// Create a 3-member group and return its `group_id`.
    ///
    /// The group uses the harness token and a 1-week cycle duration.
    pub fn create_group(&self) -> u64 {
        let creator = &self.members[0];
        let cycle_duration = 604_800u64; // 1 week
        let grace_period = 0u64;
        self.save_client.create_group(
            creator,
            &self.contribution_amount,
            &cycle_duration,
            &3u32,
            &self.token_address,
            &grace_period,
            &PayoutOrder::Sequential,
        )
    }

    /// Join all 3 members, activate the group, and assign sequential positions.
    pub fn bootstrap_group(&self, group_id: u64) {
        for member in self.members.iter() {
            self.save_client.join_group(&group_id, member, &None);
        }
        self.save_client
            .activate_group(&group_id, &self.members[0], &3u32);
        self.save_client.assign_payout_positions(
            &group_id,
            &self.members[0],
            &AssignmentMode::Sequential,
        );
    }
}

// ---------------------------------------------------------------------------
// Cross-contract integration scenarios
// ---------------------------------------------------------------------------

/// Verify that the save contract correctly pulls the allowlisted token
/// from members during contributions and routes the pool to the recipient.
#[test]
fn test_save_contract_with_allowlisted_token_full_cycle() {
    let h = CrossContractHarness::new();

    // Create and bootstrap a 3-member group
    let group_id = h.create_group();
    h.bootstrap_group(group_id);

    let cycle_duration = 604_800u64;

    // Run 3 complete cycles (one payout per member)
    for cycle_idx in 0..3usize {
        // Record balances before contributions
        let balances_before: [i128; 3] =
            core::array::from_fn(|i| h.token_client.balance(&h.members[i]));

        // Each member approves and contributes
        for member in h.members.iter() {
            h.approve(member, h.contribution_amount);
            h.save_client
                .contribute(&group_id, member, &h.contribution_amount);
        }

        // Advance time past the cycle deadline
        let new_ts = h.env.ledger().get().timestamp + cycle_duration + 1;
        h.env.ledger().set_timestamp(new_ts);

        // Trigger payout
        h.save_client.tick(&group_id);

        // Recipient for this cycle is members[cycle_idx]
        let expected_payout = h.contribution_amount * 3;
        for i in 0..3 {
            let bal = h.token_client.balance(&h.members[i]);
            if i == cycle_idx {
                // Paid in contribution_amount, received full pool
                assert_eq!(
                    bal,
                    balances_before[i] - h.contribution_amount + expected_payout,
                    "cycle {}: recipient {} balance mismatch",
                    cycle_idx,
                    i
                );
            } else {
                assert_eq!(
                    bal,
                    balances_before[i] - h.contribution_amount,
                    "cycle {}: contributor {} balance mismatch",
                    cycle_idx,
                    i
                );
            }
        }
    }

    // After all 3 cycles the group must be complete
    assert!(h.save_client.is_complete(&group_id));
}

/// Verify that the harness can be reused for independent scenarios.
/// Spin up two groups backed by the same token and verify isolation.
#[test]
fn test_harness_two_independent_groups() {
    let h = CrossContractHarness::new();

    let group_a = h.create_group();
    h.bootstrap_group(group_a);

    // Both groups are independent; group_a is running while group_b is created
    let creator = &h.members[0];
    let group_b = h.save_client.create_group(
        creator,
        &h.contribution_amount,
        &604_800u64,
        &3u32,
        &h.token_address,
        &0u64,
        &PayoutOrder::Sequential,
    );

    // Verify both exist and are distinct
    assert_ne!(group_a, group_b);
    let ga = h.save_client.get_group(&group_a);
    let gb = h.save_client.get_group(&group_b);
    assert_eq!(ga.contribution_amount, h.contribution_amount);
    assert_eq!(gb.contribution_amount, h.contribution_amount);
    assert!(!h.save_client.is_complete(&group_a));
    assert!(!h.save_client.is_complete(&group_b));
}
