#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, Vec,
};

use crate::{
    group::{Group, GroupStatus},
    payout::PayoutOrder,
    test_utils::TestHarness,
    AssignmentMode, StellarSaveContract, StellarSaveContractClient,
};

/// Set allowance: `owner` approves `spender` for `amount` of `token`.
fn approve_tokens(env: &Env, token: &Address, owner: &Address, spender: &Address, amount: i128) {
    let token_client = TokenClient::new(env, token);
    let expiry = env.ledger().sequence() + 1000;
    token_client.approve(owner, spender, &amount, &expiry);
}

#[test]
fn test_full_rosca_lifecycle_5_members() {
    let h = TestHarness::new();
    let client = h.client();

    let contribution_amount = 10_000_000i128;
    let cycle_duration = 604800u64; // 1 week
    let max_members = 5u32;

    // 1. Generate 5 member addresses and fund them
    let members: Vec<Address> = (0..5)
        .map(|_| {
            let m = Address::generate(&h.env);
            h.fund_stroops(&m, 100_000_000i128);
            m
        })
        .collect();
    let creator = members[0].clone();

    // 2. Creator creates the group
    let group_id = h.new_group(contribution_amount, cycle_duration, max_members);

    // 3. All 5 members join the group
    for member in members.iter() {
        client.join_group(&group_id, member, &None);
    }

    // 4. Creator activates the group
    client.activate_group(&group_id, &creator, &max_members);

    // 5. Assign sequential payout positions
    client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Sequential);

    // Verify group starts in cycle 0 and is not complete
    let mut group = client.get_group(&group_id);
    assert_eq!(group.current_cycle, 0);
    assert!(!client.is_complete(&group_id));

    let token_client = TokenClient::new(&h.env, &h.token);
    let expected_payout_amount = contribution_amount * (max_members as i128);

    // 6. Simulate all 5 cycles of contributions and payouts
    let mut current_time = 1_000u64;

    for cycle in 0..5 {
        // Record all members' initial balances at the start of the cycle
        let mut initial_balances = [0i128; 5];
        for i in 0..5 {
            initial_balances[i] = token_client.balance(&members[i]);
        }

        // All 5 members make their contribution
        for member in members.iter() {
            approve_tokens(&h.env, &h.token, member, &h.contract_id, contribution_amount);
            client.contribute(&group_id, member, &contribution_amount);
        }

        // Move the ledger past the cycle deadline to enable payout execution
        current_time += cycle_duration + 1;
        h.env.ledger().set_timestamp(current_time);

        // Execute the cycle tick (which triggers payout and advances the cycle)
        client.tick(&group_id);

        // The payout recipient for cycle C is members[C]
        let recipient_idx = cycle as usize;

        // Assert correct balances after payout
        for i in 0..5 {
            let final_balance = token_client.balance(&members[i]);
            if i == recipient_idx {
                // The recipient contributed and received the full pool.
                assert_eq!(
                    final_balance,
                    initial_balances[i] - contribution_amount + expected_payout_amount,
                    "Recipient balance mismatch after cycle {}",
                    cycle
                );
            } else {
                // Non-recipients contributed and received nothing.
                assert_eq!(
                    final_balance,
                    initial_balances[i] - contribution_amount,
                    "Member {} balance mismatch after cycle {}",
                    i,
                    cycle
                );
            }
        }

        // Verify group cycle progressed or completed
        group = client.get_group(&group_id);
        if cycle < 4 {
            assert_eq!(group.current_cycle, cycle + 1);
            assert!(!client.is_complete(&group_id));
        }
    }

    // 7. After the final cycle payout, verify that the group is fully complete
    assert!(client.is_complete(&group_id));

    let group = client.get_group(&group_id);
    assert_eq!(group.status, GroupStatus::Completed);
    assert!(!group.is_active);
}
