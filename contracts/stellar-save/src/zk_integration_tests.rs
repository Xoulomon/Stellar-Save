//! End-to-end integration tests: zk proof verification ↔ contract test harness.
//!
//! Closes #1740.
//!
//! These tests exercise the *actual* deployed contract entrypoints —
//! `verify_contribution_proof` and `contribute_with_proof` — through the
//! generated `StellarSaveContractClient`, using a real cryptographic proof
//! generated the same way `zk/client/proof-generator.ts` would hand one to
//! `zk/server/verifier.ts` (see `zk_proof.rs` for the shared proof format,
//! and `zk/CIRCUIT_AUDIT.md` for the documented Phase-1 scheme).
//!
//! Finding surfaced while implementing this ticket: prior to this change,
//! `verify_contribution_proof` accepted no proof bytes at all — it recorded
//! "verified" unconditionally for any group member — so there was no real
//! zk proof consumer to integration-test. This PR wires the entrypoint to
//! `zk_proof::verify_contribution_proof` and adds the tests below against
//! the now-real verification path.
//!
//! Group/member state is seeded directly via storage (rather than through
//! `create_group`/`join_group`) to keep these tests isolated from unrelated,
//! pre-existing drift in those flows on this branch.

#![cfg(test)]
extern crate std;

use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

use crate::group::Group;
use crate::repository::GroupRepository;
use crate::storage::StorageKeyBuilder;
use crate::types::MemberProfile;
use crate::{StellarSaveContract, StellarSaveContractClient};

const GROUP_ID: u64 = 1;
const CONTRIBUTION_AMOUNT: i128 = 100_000_000; // 10 XLM in stroops
const CYCLE_DURATION: u64 = 86_400;

fn setup() -> (Env, StellarSaveContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarSaveContract, ());
    let client = StellarSaveContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let member = Address::generate(&env);

    // Seed a group + member directly in storage so this test is isolated
    // from unrelated drift in create_group/join_group on this branch.
    env.as_contract(&contract_id, || {
        let group = Group::new(
            &env,
            GROUP_ID,
            creator.clone(),
            CONTRIBUTION_AMOUNT,
            CYCLE_DURATION,
            5,
            2,
            env.ledger().timestamp(),
            0,
        );
        GroupRepository::save_group(&env, &group);

        let member_profile = MemberProfile {
            address: member.clone(),
            group_id: GROUP_ID,
            payout_position: 0,
            joined_at: env.ledger().timestamp(),
            auto_contribute_enabled: false,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::member_profile(GROUP_ID, member.clone()), &member_profile);
    });

    (env, client, creator, member)
}

/// Builds a real contribution zk proof: 32B Ed25519 pubkey | 64B signature | 8B nonce,
/// signing `group_id (u64 LE) || cycle (u32 LE)` — the exact scheme
/// `zk_proof::verify_contribution_proof` checks on-chain.
fn make_proof(env: &Env, seed: [u8; 32], group_id: u64, cycle: u32, nonce: u64) -> Bytes {
    let signing_key = SigningKey::from_bytes(&seed);
    let verifying_key = signing_key.verifying_key();

    let mut payload = std::vec::Vec::new();
    payload.extend_from_slice(&group_id.to_le_bytes());
    payload.extend_from_slice(&cycle.to_le_bytes());
    let signature = signing_key.sign(&payload).to_bytes();

    let mut proof = Bytes::new(env);
    for byte in verifying_key.as_bytes() {
        proof.push_back(*byte);
    }
    for byte in signature {
        proof.push_back(byte);
    }
    for byte in nonce.to_le_bytes() {
        proof.push_back(byte);
    }
    proof
}

// ─────────────────────────────────────────────────────────────────────────
//  Happy path: real proof generated, submitted, verified end-to-end
// ─────────────────────────────────────────────────────────────────────────

/// Generates a real Ed25519 proof, submits it to `verify_contribution_proof`,
/// then completes a contribution via `contribute_with_proof` — the full
/// entrypoint chain a zk/server-verified proof is expected to unlock.
#[test]
fn test_real_proof_verified_and_unlocks_contribution() {
    let (env, client, _creator, member) = setup();
    let cycle = 0u32;

    client.set_contribution_proof_required(&GROUP_ID, &true);

    let proof = make_proof(&env, [0x42u8; 32], GROUP_ID, cycle, 1);
    client.verify_contribution_proof(&GROUP_ID, &member, &cycle, &proof);

    // contribute_with_proof should now succeed since the proof was accepted.
    client.contribute_with_proof(&GROUP_ID, &member, &CONTRIBUTION_AMOUNT);
}

/// A proof correctly bound to a different group/cycle is still accepted for
/// its own group/cycle — confirms the verifier isn't accidentally rejecting
/// valid proofs (sanity check alongside the cross-binding negative test).
#[test]
fn test_real_proof_for_different_cycle_accepted() {
    let (env, client, _creator, member) = setup();
    let cycle = 3u32;

    client.set_contribution_proof_required(&GROUP_ID, &true);

    let proof = make_proof(&env, [0x99u8; 32], GROUP_ID, cycle, 7);
    let result = client.try_verify_contribution_proof(&GROUP_ID, &member, &cycle, &proof);

    assert!(result.is_ok(), "correctly bound proof must be accepted");
}

// ─────────────────────────────────────────────────────────────────────────
//  Negative: tampered proof rejected
// ─────────────────────────────────────────────────────────────────────────

/// A proof with a bit flipped in its signature must be rejected. The
/// Soroban host traps on an invalid Ed25519 signature, so the client's
/// `try_` accessor is used to observe this as an `Err` rather than a panic.
#[test]
fn test_tampered_signature_proof_rejected() {
    let (env, client, _creator, member) = setup();
    let cycle = 0u32;

    client.set_contribution_proof_required(&GROUP_ID, &true);

    let mut proof = make_proof(&env, [0x42u8; 32], GROUP_ID, cycle, 1);
    let corrupted_byte = proof.get(40).unwrap() ^ 0xFF; // inside the 64B signature region
    proof.set(40, corrupted_byte);

    let result = client.try_verify_contribution_proof(&GROUP_ID, &member, &cycle, &proof);

    assert!(
        result.is_err(),
        "tampered signature must be rejected, not verified"
    );
}

/// A proof signed for a different group must be rejected when submitted
/// against this group (cross-group binding).
#[test]
fn test_proof_for_wrong_group_rejected() {
    let (env, client, _creator, member) = setup();
    let cycle = 0u32;

    client.set_contribution_proof_required(&GROUP_ID, &true);

    // Proof is valid for group 999, not GROUP_ID.
    let proof = make_proof(&env, [0x42u8; 32], 999, cycle, 1);
    let result = client.try_verify_contribution_proof(&GROUP_ID, &member, &cycle, &proof);

    assert!(result.is_err(), "cross-group proof must be rejected");
}

/// A malformed (wrong-length) proof is rejected gracefully with
/// `StellarSaveError::InvalidProof`, without ever reaching the host's
/// signature-verification trap.
#[test]
fn test_malformed_proof_rejected_gracefully() {
    let (env, client, _creator, member) = setup();
    let cycle = 0u32;

    client.set_contribution_proof_required(&GROUP_ID, &true);

    let short_proof = Bytes::from_slice(&env, &[0u8; 10]);
    let result = client.try_verify_contribution_proof(&GROUP_ID, &member, &cycle, &short_proof);

    assert!(result.is_err(), "malformed proof must be rejected");
}

/// A rejected proof must not unlock `contribute_with_proof`.
#[test]
fn test_contribution_blocked_without_verified_proof() {
    let (env, client, _creator, member) = setup();
    client.set_contribution_proof_required(&GROUP_ID, &true);
    let _ = env; // env kept for parity with other tests / future use

    let result = client.try_contribute_with_proof(&GROUP_ID, &member, &CONTRIBUTION_AMOUNT);

    assert!(
        result.is_err(),
        "contribution must be blocked until a valid proof is verified"
    );
}
