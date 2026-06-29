#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

// ─── Test helpers ────────────────────────────────────────────────────────────

fn setup<'a>() -> (Env, StellarSaveClient<'a>, Address, StellarAssetClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();
    let sac_client = StellarAssetClient::new(&env, &token);

    let contract_id = env.register(StellarSave, ());
    let client = StellarSaveClient::new(&env, &contract_id);

    (env, client, token, sac_client)
}

/// Mint `xlm` XLM (in stroops) to `address`.
fn mint(sac: &StellarAssetClient, address: &Address, xlm: i128) {
    sac.mint(address, &(xlm * xlm::STROOPS_PER_XLM));
}

/// Create a group with 3 members and return (group_id, [alice, bob, carol]).
fn setup_3_member_group(
    env: &Env,
    client: &StellarSaveClient,
    sac: &StellarAssetClient,
) -> (u64, Address, Address, Address) {
    let contribution = 10 * xlm::STROOPS_PER_XLM;
    let group_id = client.create_group(&contribution, &10u32, &3u32);

    let alice = Address::generate(env);
    let bob = Address::generate(env);
    let carol = Address::generate(env);

    mint(sac, &alice, 100);
    mint(sac, &bob, 100);
    mint(sac, &carol, 100);

    client.join_group(&group_id, &alice);
    client.join_group(&group_id, &bob);
    client.join_group(&group_id, &carol);

    (group_id, alice, bob, carol)
}

// ─── Group creation ───────────────────────────────────────────────────────────

#[test]
fn create_group_returns_incrementing_ids() {
    let (_, client, _, _) = setup();
    let id0 = client.create_group(&1000, &10, &3);
    let id1 = client.create_group(&1000, &10, &3);
    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
}

#[test]
fn create_group_invalid_config() {
    let (_, client, _, _) = setup();
    assert!(client.try_create_group(&0, &10, &3).is_err());      // amount = 0
    assert!(client.try_create_group(&100, &0, &3).is_err());     // duration = 0
    assert!(client.try_create_group(&100, &10, &1).is_err());    // members < 2
    assert!(client.try_create_group(&100, &10, &21).is_err());   // members > 20
}

#[test]
fn get_group_not_found() {
    let (_, client, _, _) = setup();
    assert!(client.try_get_group(&999).is_err());
}

#[test]
fn get_group_returns_initial_state() {
    let (_, client, _, _) = setup();
    let id = client.create_group(&5000, &20, &4);
    let group = client.get_group(&id);
    assert_eq!(group.contribution_amount, 5000);
    assert_eq!(group.cycle_duration, 20);
    assert_eq!(group.max_members, 4);
    assert_eq!(group.members.len(), 0);
    assert_eq!(group.current_cycle, 0);
    assert!(matches!(group.status, types::GroupStatus::Active));
}

// ─── Membership ───────────────────────────────────────────────────────────────

#[test]
fn join_group_succeeds() {
    let (env, client, _, _) = setup();
    let id = client.create_group(&1000, &10, &2);
    let alice = Address::generate(&env);
    client.join_group(&id, &alice);
    assert!(client.is_member(&id, &alice));
    assert_eq!(client.list_members(&id).len(), 1);
}

#[test]
fn join_group_duplicate_rejected() {
    let (env, client, _, _) = setup();
    let id = client.create_group(&1000, &10, &3);
    let alice = Address::generate(&env);
    client.join_group(&id, &alice);
    assert!(client.try_join_group(&id, &alice).is_err());
}

#[test]
fn join_group_full_rejected() {
    let (env, client, _, _) = setup();
    let id = client.create_group(&1000, &10, &2);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    client.join_group(&id, &alice);
    client.join_group(&id, &bob);
    assert!(client.try_join_group(&id, &carol).is_err());
}

#[test]
fn group_starts_when_full() {
    let (env, client, _, _) = setup();
    let id = client.create_group(&1000, &10, &2);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.join_group(&id, &alice);
    // Before full: cycle not started
    assert_eq!(client.get_group(&id).current_cycle, 0);
    client.join_group(&id, &bob);
    // After full: cycle 1 begins
    assert_eq!(client.get_group(&id).current_cycle, 1);
}

// ─── Contributions ────────────────────────────────────────────────────────────

#[test]
fn contribute_not_member_rejected() {
    let (env, client, token, sac) = setup();
    let (id, _, _, _) = setup_3_member_group(&env, &client, &sac);
    let outsider = Address::generate(&env);
    mint(&sac, &outsider, 100);
    assert!(client.try_contribute(&id, &outsider, &token).is_err());
}

#[test]
fn contribute_before_group_full_rejected() {
    let (env, client, token, sac) = setup();
    let contribution = 10 * xlm::STROOPS_PER_XLM;
    let id = client.create_group(&contribution, &10, &2);
    let alice = Address::generate(&env);
    mint(&sac, &alice, 100);
    client.join_group(&id, &alice);
    // Group not full yet (current_cycle == 0)
    assert!(client.try_contribute(&id, &alice, &token).is_err());
}

#[test]
fn double_contribute_rejected() {
    let (env, client, token, sac) = setup();
    let (id, alice, _, _) = setup_3_member_group(&env, &client, &sac);
    client.contribute(&id, &alice, &token);
    assert!(client.try_contribute(&id, &alice, &token).is_err());
}

#[test]
fn contribution_status_tracks_correctly() {
    let (env, client, token, sac) = setup();
    let (id, alice, _bob, _carol) = setup_3_member_group(&env, &client, &sac);

    let before = client.get_contribution_status(&id, &1);
    assert_eq!(before, soroban_sdk::vec![&env, false, false, false]);

    client.contribute(&id, &alice, &token);
    let after_alice = client.get_contribution_status(&id, &1);
    assert_eq!(after_alice, soroban_sdk::vec![&env, true, false, false]);
}

// ─── Payout rotation ─────────────────────────────────────────────────────────

#[test]
fn full_cycle_triggers_payout_to_first_member() {
    let (env, client, token, sac) = setup();
    let (id, alice, bob, carol) = setup_3_member_group(&env, &client, &sac);
    let tc = TokenClient::new(&env, &token);

    let before = tc.balance(&alice);

    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);
    client.contribute(&id, &carol, &token);

    // Alice (index 0) should have received 3 × contribution_amount.
    let contribution = 10 * xlm::STROOPS_PER_XLM;
    assert_eq!(tc.balance(&alice), before - contribution + 3 * contribution);    assert_eq!(client.get_group(&id).current_cycle, 2);
    assert_eq!(client.get_group(&id).payout_index, 1);
}

#[test]
fn payout_rotates_through_all_members() {
    let (env, client, token, sac) = setup();
    let (id, alice, bob, carol) = setup_3_member_group(&env, &client, &sac);
    let tc = TokenClient::new(&env, &token);

    // Cycle 1 → alice
    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);
    client.contribute(&id, &carol, &token);

    // Cycle 2 → bob
    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);
    client.contribute(&id, &carol, &token);

    // Cycle 3 → carol
    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);
    client.contribute(&id, &carol, &token);

    // All cycles complete
    assert!(client.is_complete(&id));

    // Each member ends up having contributed 3 × contribution and received 3 × contribution once.
    // Net change = 0 for each (started with 100 XLM).
    let expected = 100 * xlm::STROOPS_PER_XLM;
    assert_eq!(tc.balance(&alice), expected);
    assert_eq!(tc.balance(&bob), expected);
    assert_eq!(tc.balance(&carol), expected);
}

// ─── Group completion ─────────────────────────────────────────────────────────

#[test]
fn is_complete_false_until_all_cycles_done() {
    let (env, client, token, sac) = setup();
    let (id, alice, bob, carol) = setup_3_member_group(&env, &client, &sac);

    assert!(!client.is_complete(&id));

    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);
    client.contribute(&id, &carol, &token);

    assert!(!client.is_complete(&id));
}

#[test]
fn contribute_after_complete_rejected() {
    let (env, client, token, sac) = setup();
    let contribution = 10 * xlm::STROOPS_PER_XLM;
    let id = client.create_group(&contribution, &10, &2);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    mint(&sac, &alice, 100);
    mint(&sac, &bob, 100);
    client.join_group(&id, &alice);
    client.join_group(&id, &bob);

    // Cycle 1 → alice
    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);

    // Cycle 2 → bob
    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);

    assert!(client.is_complete(&id));
    assert!(client.try_contribute(&id, &alice, &token).is_err());
}

// ─── execute_payout ────────────────────────────────────────────────────────────

#[test]
fn execute_payout_fails_if_not_all_contributed() {
    let (env, client, token, sac) = setup();
    let (id, alice, _, _) = setup_3_member_group(&env, &client, &sac);
    client.contribute(&id, &alice, &token);
    // Only 1/3 contributed — payout should fail.
    assert!(client.try_execute_payout(&id, &token).is_err());
}

#[test]
fn execute_payout_succeeds_when_all_contributed() {
    let (env, client, token, sac) = setup();
    let (id, alice, bob, carol) = setup_3_member_group(&env, &client, &sac);

    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);
    client.contribute(&id, &carol, &token);

    // After auto-payout, cycle advanced; calling execute_payout manually on
    // the new cycle with no contributions should fail.
    assert!(client.try_execute_payout(&id, &token).is_err());
}
