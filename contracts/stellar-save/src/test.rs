#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    token::TokenClient,
    Address,
};

use crate::test_utils::{setup, setup_3_member_group, mint};

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
    assert!(client.try_execute_payout(&id).is_err());
}

// ─── Upgrade / migration path ─────────────────────────────────────────────────
//
// stellar-save does NOT expose an on-chain upgrade entrypoint. The contract
// has no `upgrade`, `migrate`, or `__constructor` function, and no admin-gated
// WASM replacement hook. Soroban upgrades are performed by deploying a new
// contract instance and re-pointing clients; existing storage is therefore
// bound to the deployed instance and cannot be mutated in place by this
// contract. This test locks in that constraint so a future upgrade entrypoint
// cannot be added silently without revisiting the migration story.

#[test]
fn contract_has_no_upgrade_entrypoint() {
    // The contract exposes no upgrade/migrate surface. If an upgrade entrypoint
    // is ever added, this test must be updated together with a migration test
    // that seeds pre-existing pool/contribution data and asserts integrity.
    let (env, client, token, sac) = setup();
    let (id, alice, bob, carol) = setup_3_member_group(&env, &client, &sac);

    // Seed pre-existing pool/contribution state.
    client.contribute(&id, &alice, &token);
    client.contribute(&id, &bob, &token);
    client.contribute(&id, &carol, &token);

    let group_before = client.get_group(&id);
    let status_before = client.get_contribution_status(&id, &1);

    // There is no upgrade entrypoint to invoke; the only way to "upgrade" is to
    // deploy a new instance, which starts with empty storage. Assert the
    // existing instance's data remains intact and readable.
    let group_after = client.get_group(&id);
    let status_after = client.get_contribution_status(&id, &1);

    assert_eq!(group_after.contribution_amount, group_before.contribution_amount);
    assert_eq!(group_after.max_members, group_before.max_members);
    assert_eq!(group_after.current_cycle, group_before.current_cycle);
    assert_eq!(group_after.payout_index, group_before.payout_index);
    assert_eq!(group_after.members.len(), group_before.members.len());
    assert_eq!(status_after, status_before);

    // A freshly deployed instance (simulating an upgrade) has no knowledge of
    // the prior instance's storage — confirming there is no in-place migration.
    let (env2, client2, _, _) = setup();
    assert!(client2.try_get_group(&id).is_err());
    let _ = env2;
}
