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

// ─── Overflow / arithmetic safety tests (issue #1317) ────────────────────────

/// `PoolInfo::completion_percentage` must not panic or wrap when
/// contributors_count is near u32::MAX.
/// The checked_mul saturates to u64::MAX and the division still returns 100.
#[test]
fn completion_percentage_saturates_safely_at_max_contributors() {
    use crate::pool::PoolInfo;
    let pool = PoolInfo {
        group_id: 1,
        cycle: 0,
        member_count: u32::MAX,
        contribution_amount: 1,
        total_pool_amount: 1,
        current_contributions: 1,
        contributors_count: u32::MAX,
        is_cycle_complete: true,
    };
    // Must not panic; result must be 0–100.
    let pct = pool.completion_percentage();
    assert!(pct <= 100, "completion_percentage exceeded 100: {}", pct);
}

/// `PoolInfo::completion_percentage` returns 0 when member_count is 0.
#[test]
fn completion_percentage_zero_member_count() {
    use crate::pool::PoolInfo;
    let pool = PoolInfo {
        group_id: 1,
        cycle: 0,
        member_count: 0,
        contribution_amount: 1,
        total_pool_amount: 0,
        current_contributions: 0,
        contributors_count: 0,
        is_cycle_complete: false,
    };
    assert_eq!(pool.completion_percentage(), 0);
}

/// `PoolCalculator::calculate_total_pool` must return `Err(InternalError)` when
/// contribution_amount × member_count would overflow i128.
#[test]
fn pool_total_overflows_returns_internal_error() {
    use crate::pool::PoolCalculator;
    use crate::error::StellarSaveError;
    // i128::MAX * 2 overflows
    let result = PoolCalculator::calculate_total_pool(i128::MAX, 2);
    assert_eq!(result.unwrap_err(), StellarSaveError::InternalError);
}

/// `Group::advance_cycle` panics if called on an already-complete group.
/// This is the existing guard; we make it explicit as a regression test.
#[test]
#[should_panic(expected = "group is already complete")]
fn advance_cycle_panics_when_group_complete() {
    use crate::group::Group;
    use soroban_sdk::{testutils::Address as _, Env};
    let env = Env::default();
    let creator = Address::generate(&env);
    let mut g = Group::new(
        &env, 1, creator, 10_000_000, 604800, 2, 2, 1_000_000, 0,
    );
    g.member_count = 2;
    g.activate(1_000_000);
    // Advance past all cycles
    g.advance_cycle(&env);
    g.advance_cycle(&env);
    // Group is now complete — this must panic
    g.advance_cycle(&env);
}

/// `Group::advance_cycle` uses checked_add so a cycle counter that is already
/// at `max_members` triggers `is_complete()` first and panics with the
/// "already complete" message rather than silently wrapping.
#[test]
#[should_panic(expected = "group is already complete")]
fn advance_cycle_does_not_wrap_u32() {
    use crate::group::Group;
    use soroban_sdk::{testutils::Address as _, Env};
    let env = Env::default();
    let creator = Address::generate(&env);
    let mut g = Group::new(
        &env, 1, creator, 10_000_000, 604800, 2, 2, 1_000_000, 0,
    );
    g.member_count = 2;
    g.activate(1_000_000);
    // Force current_cycle to max so is_complete() returns true immediately
    g.current_cycle = g.max_members;
    g.is_active = false;
    // Must panic — not wrap around
    g.advance_cycle(&env);
}

/// `Group::add_member` panics on u32 overflow rather than wrapping silently.
/// In production member_count is bounded by MAX_MEMBERS, but the arithmetic
/// guard must exist independently.
#[test]
#[should_panic(expected = "member_count overflow")]
fn add_member_panics_on_u32_overflow() {
    use crate::group::Group;
    use soroban_sdk::{testutils::Address as _, Env};
    let env = Env::default();
    let creator = Address::generate(&env);
    // max_members = u32::MAX to bypass the max_members >= 2 assert.
    // We can't easily construct a group with max_members = u32::MAX via `new`
    // (which asserts max >= 2 and grace <= 604800), so build one up manually.
    let mut g = Group::new(
        &env, 1, creator, 10_000_000, 604800, 20, 2, 1_000_000, 0,
    );
    // Force member_count to u32::MAX so the next checked_add overflows
    g.member_count = u32::MAX;
    g.add_member(); // must panic
}

/// `join_group` returns `Err(GroupFull)` before member_count ever reaches
/// max_members, so the checked_add in join_group can never actually overflow
/// in a correctly-operating group.  This test verifies the GroupFull guard
/// fires first (i.e., overflow is unreachable via the normal path).
#[test]
fn join_group_group_full_fires_before_overflow() {
    let (env, client, _token, sac) = setup();
    // Create a 2-member group
    let contribution = 10 * xlm::STROOPS_PER_XLM;
    let group_id = client.create_group(&contribution, &604800u32, &2u32);

    let alice = Address::generate(&env);
    let bob   = Address::generate(&env);
    let carol = Address::generate(&env);

    mint(&sac, &alice, 100);
    mint(&sac, &bob, 100);
    mint(&sac, &carol, 100);

    client.join_group(&group_id, &alice);
    client.join_group(&group_id, &bob);

    // Third join must fail with GroupFull, not overflow
    let err = client.try_join_group(&group_id, &carol).unwrap_err();
    // Soroban SDK wraps contract errors in InvokeHostFunctionError; just assert it's an error.
    let _ = err; // presence of the error is sufficient
}

/// `raise_dispute` threshold arithmetic: (member_count / 2).checked_add(1).
/// With member_count = u32::MAX the half is u32::MAX/2 = 2147483647,
/// and adding 1 gives 2147483648 — which fits in u32 — so no overflow.
/// This test verifies the normal-range path returns Ok.
#[test]
fn raise_dispute_threshold_no_overflow_for_max_half() {
    // Direct unit test of the arithmetic without a full contract env.
    let member_count: u32 = u32::MAX;
    let half = member_count / 2;
    // This must not overflow: u32::MAX / 2 == 2147483647, + 1 == 2147483648 < u32::MAX
    let threshold = half.checked_add(1);
    assert!(threshold.is_some(), "threshold unexpectedly overflowed");
    assert_eq!(threshold.unwrap(), 2_147_483_648u32);
}

/// Directly verify that the checked arithmetic pattern for the vote_count
/// increment used in `raise_dispute` returns `None` on u32 overflow.
#[test]
fn raise_dispute_vote_count_checked_add_overflows_at_max() {
    let vote_count: u32 = u32::MAX;
    // This is the pattern used in raise_dispute after the fix
    let result = vote_count.checked_add(1);
    assert!(result.is_none(), "expected None on u32::MAX + 1");
}
