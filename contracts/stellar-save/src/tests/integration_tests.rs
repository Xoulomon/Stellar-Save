#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, Vec,
};

use crate::{
    group::{Group, GroupStatus},
    payout::PayoutOrder,
    AssignmentMode, StellarSaveContract, StellarSaveContractClient,
};

/// Deploy a mock SEP-41 token (Stellar Asset Contract) and return its address.
fn deploy_mock_token(env: &Env) -> Address {
    let admin = Address::generate(env);
    env.register_stellar_asset_contract_v2(admin).address()
}

/// Set allowance: `owner` approves `spender` for `amount` of `token`.
fn approve_tokens(env: &Env, token: &Address, owner: &Address, spender: &Address, amount: i128) {
    let token_client = TokenClient::new(env, token);
    let expiry = env.ledger().sequence() + 1000;
    token_client.approve(owner, spender, &amount, &expiry);
}

#[test]
fn test_full_rosca_lifecycle_5_members() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarSaveContract, ());
    let client = StellarSaveContractClient::new(&env, &contract_id);

    // Deploy a mock SEP-41 token (representing XLM / stablecoin)
    let token_address = deploy_mock_token(&env);
    let token_client = TokenClient::new(&env, &token_address);
    let sac_client = StellarAssetClient::new(&env, &token_address);

    // Set initial time
    env.ledger().set_timestamp(1000);

    // 1. Generate 5 member addresses
    let members: [Address; 5] = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let creator = members[0].clone();

    // 2. Mint tokens to all members (need enough to cover contributions for 5 cycles)
    // contribution_amount = 10_000_000 (1 XLM)
    // 5 cycles = 50_000_000 needed per member. Let's mint 100_000_000 each.
    let contribution_amount = 10_000_000i128;
    for member in members.iter() {
        sac_client.mint(member, &100_000_000i128);
    }

    // 3. Creator creates the group
    let cycle_duration = 604800u64; // 1 week
    let max_members = 5u32;
    let grace_period = 0u64;
    
    let group_id = client.create_group(
        &creator,
        &contribution_amount,
        &cycle_duration,
        &max_members,
        &token_address,
        &grace_period,
        &PayoutOrder::Sequential,
    );

    // 4. All 5 members join the group
    for member in members.iter() {
        client.join_group(&group_id, member, &None);
    }

    // 5. Creator activates the group
    client.activate_group(&group_id, &creator, &max_members);

    // 6. Assign sequential payout positions
    // In sequential order, the payout sequence will match the join/assignment order:
    // Cycle 0: members[0] (creator)
    // Cycle 1: members[1]
    // Cycle 2: members[2]
    // Cycle 3: members[3]
    // Cycle 4: members[4]
    client.assign_payout_positions(&group_id, &creator, &AssignmentMode::Sequential);

    // Verify group starts in cycle 0 and is not complete
    let mut group = client.get_group(&group_id);
    assert_eq!(group.current_cycle, 0);
    assert!(!client.is_complete(&group_id));

    // Total pool size distributed per cycle = contribution_amount * max_members = 50_000_000
    let expected_payout_amount = contribution_amount * (max_members as i128);

    // 7. Simulate all 5 cycles of contributions and payouts
    let mut current_time = 1000u64;

    for cycle in 0..5 {
        // Record all members' initial balances at the start of the cycle
        let mut initial_balances = [0i128; 5];
        for i in 0..5 {
            initial_balances[i] = token_client.balance(&members[i]);
        }

        // All 5 members make their contribution of 10_000_000
        for member in members.iter() {
            // Approve the contract to transfer the contribution amount
            approve_tokens(&env, &token_address, member, &contract_id, contribution_amount);
            client.contribute(&group_id, member, &contribution_amount);
        }

        // Move the ledger past the cycle deadline to enable payout execution
        current_time += cycle_duration + 1;
        env.ledger().set_timestamp(current_time);

        // Execute the cycle tick (which triggers payout and advances the cycle)
        client.tick(&group_id);

        // The payout recipient for cycle C is members[C]
        let recipient_idx = cycle as usize;

        // Assert correct balances after payout
        for i in 0..5 {
            let final_balance = token_client.balance(&members[i]);
            if i == recipient_idx {
                // The recipient contributed 10_000_000 and received 50_000_000.
                // Net change: +40_000_000
                assert_eq!(
                    final_balance,
                    initial_balances[i] - contribution_amount + expected_payout_amount,
                    "Recipient balance mismatch after cycle {}",
                    cycle
                );
            } else {
                // Non-recipients contributed 10_000_000 and received nothing.
                // Net change: -10_000_000
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

    // 8. After the final cycle payout, verify that the group is fully complete
    assert!(client.is_complete(&group_id));
    
    let group = client.get_group(&group_id);
    assert_eq!(group.status, GroupStatus::Completed);
    assert!(!group.is_active);
}
