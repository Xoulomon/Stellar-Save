//! Regression tests for checks-effects-interactions ordering (Issue #1516).
//!
//! Soroban has no classic reentrancy primitive, but every function that moves
//! tokens hands control to a *caller-supplied* contract: the group's token is
//! chosen at `create_group` time. A token that calls back into this contract
//! during `transfer` / `transfer_from` observes whatever state the caller had
//! committed at that moment. Committing effects only after the transfer left the
//! duplicate-guards (`has(&refund_key)`, `has(&contrib_key)`,
//! `has(&recipient_key)`) reading pre-transfer state, so a reentrant call sailed
//! straight through them.
//!
//! Each test below arms a malicious token that re-enters the function under test
//! and asserts two things:
//!   1. the reentrant call is rejected, and
//!   2. exactly one record was written.
//!
//! State is seeded directly through `env.as_contract` so the tests exercise the
//! ordering in isolation, without depending on the full join/activate lifecycle.
//!
//! The full audit is written up in `CEI_AUDIT.md`.

#![cfg(test)]

extern crate std;

use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, Address, Env, Symbol,
};

use crate::contribution::ContributionRecord;
use crate::group::{Group, GroupStatus, TokenConfig};
use crate::refund::RefundRecord;
use crate::storage::StorageKeyBuilder;
use crate::{StellarSaveClient, StellarSaveContract};

const CONTRIBUTION: i128 = 10_000_000;
const CYCLE_DURATION: u64 = 604_800;

// === Malicious token

/// Key under which the token stores the savings contract it should call back into.
const TARGET: Symbol = symbol_short!("TARGET");
/// Key holding the re-entrancy mode the token is currently armed with.
const MODE: Symbol = symbol_short!("MODE");
/// Key holding the group id passed to the reentrant call.
const GROUP: Symbol = symbol_short!("GROUP");
/// Key holding the address the reentrant call acts on behalf of.
const ACTOR: Symbol = symbol_short!("ACTOR");
/// Key under which the token records whether its reentrant call was rejected.
const REJECTED: Symbol = symbol_short!("REJECTED");

/// Re-entrancy modes the malicious token can be armed with.
const MODE_OFF: u32 = 0;
const MODE_REFUND: u32 = 1;
const MODE_CONTRIBUTE: u32 = 2;

/// A token that calls back into Stellar-Save while a transfer is in flight.
///
/// It implements only the SEP-41 surface the contract actually invokes. Balances
/// are fictional: these tests assert on Stellar-Save's own storage, not on token
/// accounting.
#[contract]
pub struct ReentrantToken;

#[contractimpl]
impl ReentrantToken {
    pub fn arm(env: Env, target: Address, mode: u32, group_id: u64, actor: Address) {
        env.storage().instance().set(&TARGET, &target);
        env.storage().instance().set(&MODE, &mode);
        env.storage().instance().set(&GROUP, &group_id);
        env.storage().instance().set(&ACTOR, &actor);
        env.storage().instance().set(&REJECTED, &false);
    }

    /// True when the token's reentrant call came back as an error.
    pub fn was_rejected(env: Env) -> bool {
        env.storage().instance().get(&REJECTED).unwrap_or(false)
    }

    pub fn decimals(_env: Env) -> u32 {
        7
    }

    pub fn balance(_env: Env, _id: Address) -> i128 {
        i128::MAX / 2
    }

    pub fn allowance(_env: Env, _from: Address, _spender: Address) -> i128 {
        i128::MAX / 2
    }

    pub fn transfer(env: Env, _from: Address, _to: Address, _amount: i128) {
        Self::reenter(&env);
    }

    pub fn transfer_from(env: Env, _spender: Address, _from: Address, _to: Address, _amount: i128) {
        Self::reenter(&env);
    }

    fn reenter(env: &Env) {
        let mode: u32 = env.storage().instance().get(&MODE).unwrap_or(MODE_OFF);
        if mode == MODE_OFF {
            return;
        }

        // Disarm first: the reentrant call performs a transfer of its own, and
        // an un-disarmed token would recurse until the host's depth limit.
        env.storage().instance().set(&MODE, &MODE_OFF);

        let target: Address = env.storage().instance().get(&TARGET).unwrap();
        let group_id: u64 = env.storage().instance().get(&GROUP).unwrap();
        let actor: Address = env.storage().instance().get(&ACTOR).unwrap();
        let client = StellarSaveClient::new(env, &target);

        let rejected = match mode {
            MODE_REFUND => client.try_request_refund(&group_id, &0u32, &actor).is_err(),
            MODE_CONTRIBUTE => client
                .try_contribute(&group_id, &actor, &CONTRIBUTION)
                .is_err(),
            _ => false,
        };

        env.storage().instance().set(&REJECTED, &rejected);
    }
}

// === Fixtures

struct Fixture<'a> {
    env: Env,
    contract_id: Address,
    client: StellarSaveClient<'a>,
    token_client: ReentrantTokenClient<'a>,
    member: Address,
}

/// Seeds an active group with one recorded contribution, backed by the
/// malicious token.
fn setup<'a>(group_id: u64) -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let token = env.register(ReentrantToken, ());
    let token_client = ReentrantTokenClient::new(&env, &token);

    let contract_id = env.register(StellarSaveContract, ());
    let client = StellarSaveClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let member = Address::generate(&env);
    let now = env.ledger().timestamp();

    env.as_contract(&contract_id, || {
        let mut group = Group::new(
            &env,
            group_id,
            creator.clone(),
            CONTRIBUTION,
            CYCLE_DURATION,
            3,
            2,
            now,
            0,
        );
        group.status = GroupStatus::Active;
        group.member_count = 1;

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Active,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::group_token_config(group_id),
            &TokenConfig {
                token_address: token.clone(),
                token_decimals: 7,
            },
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, member.clone()),
            &true,
        );
        env.storage().persistent().set(
            &StorageKeyBuilder::contribution_individual(group_id, 0, member.clone()),
            &ContributionRecord::new(member.clone(), group_id, 0, CONTRIBUTION, now),
        );
    });

    Fixture {
        env,
        contract_id,
        client,
        token_client,
        member,
    }
}

fn refund_record<'a>(fixture: &Fixture<'a>, group_id: u64) -> Option<RefundRecord> {
    fixture.env.as_contract(&fixture.contract_id, || {
        fixture
            .env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::refund_record(
                group_id,
                0,
                fixture.member.clone(),
            ))
    })
}

// === Tests

#[test]
fn refund_writes_its_record_before_calling_the_token() {
    let group_id = 1u64;
    let fixture = setup(group_id);

    // The token re-enters request_refund for the same member and cycle.
    fixture.token_client.arm(
        &fixture.contract_id,
        &MODE_REFUND,
        &group_id,
        &fixture.member,
    );

    let record = fixture
        .client
        .request_refund(&group_id, &0u32, &fixture.member);

    // The reentrant call must have been rejected: the record it would duplicate
    // was already committed when the token regained control.
    assert!(
        fixture.token_client.was_rejected(),
        "reentrant refund should have been rejected by the AlreadyRefunded check"
    );

    assert_eq!(record.amount, CONTRIBUTION);
    assert_eq!(record.member, fixture.member);
    assert!(refund_record(&fixture, group_id).is_some());
}

#[test]
fn a_second_refund_is_rejected_after_the_first_settles() {
    let group_id = 2u64;
    let fixture = setup(group_id);

    fixture
        .client
        .request_refund(&group_id, &0u32, &fixture.member);

    assert!(fixture
        .client
        .try_request_refund(&group_id, &0u32, &fixture.member)
        .is_err());
}

#[test]
fn contribute_records_before_calling_the_token() {
    let group_id = 3u64;
    let fixture = setup(group_id);

    // Cycle 0 is already recorded by the fixture, so contribute against a member
    // that has not paid yet.
    let fresh_member = Address::generate(&fixture.env);
    fixture.env.as_contract(&fixture.contract_id, || {
        fixture.env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(group_id, fresh_member.clone()),
            &true,
        );
    });

    fixture.token_client.arm(
        &fixture.contract_id,
        &MODE_CONTRIBUTE,
        &group_id,
        &fresh_member,
    );

    fixture
        .client
        .contribute(&group_id, &fresh_member, &CONTRIBUTION);

    // The reentrancy guard set before the token call must still be held when the
    // token calls back.
    assert!(
        fixture.token_client.was_rejected(),
        "reentrant contribute should have been rejected while the guard is held"
    );

    let recorded: Option<ContributionRecord> =
        fixture.env.as_contract(&fixture.contract_id, || {
            fixture
                .env
                .storage()
                .persistent()
                .get(&StorageKeyBuilder::contribution_individual(
                    group_id,
                    0,
                    fresh_member.clone(),
                ))
        });
    assert!(recorded.is_some());
    assert_eq!(recorded.unwrap().amount, CONTRIBUTION);
}

#[test]
fn a_disarmed_token_leaves_the_happy_path_intact() {
    let group_id = 4u64;
    let fixture = setup(group_id);

    // No arming: the token behaves like an ordinary SEP-41 implementation.
    let record = fixture
        .client
        .request_refund(&group_id, &0u32, &fixture.member);

    assert_eq!(record.group_id, group_id);
    assert_eq!(record.cycle, 0);
    assert!(!fixture.token_client.was_rejected());
    assert!(refund_record(&fixture, group_id).is_some());
}
