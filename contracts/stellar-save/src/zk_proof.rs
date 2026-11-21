//! Contribution zk-proof verification (production).
//!
//! This module implements the Phase-1 proof scheme documented in
//! `zk/CIRCUIT_AUDIT.md`: an Ed25519 signature used as a proof-of-concept
//! stand-in for a full zk-SNARK, generated off-chain by `zk/client` and
//! independently checkable by `zk/server`. It is the verifier actually
//! wired into the contract's `verify_contribution_proof` entrypoint
//! (see `contract.rs`, ISSUE #1740).
//!
//! Proof layout (104 bytes, little-endian integers):
//!   `[0..32)`  Ed25519 public key
//!   `[32..96)` Ed25519 signature
//!   `[96..104)` nonce (reserved for future nullifier/replay support — see ZK-001)
//!
//! The signed payload is `group_id (u64 LE) || cycle (u32 LE)`, binding the
//! proof to a specific group and cycle so a proof for one cannot be replayed
//! against another (cross-group / wrong-cycle submissions cause the host's
//! `ed25519_verify` to trap).

use soroban_sdk::{Bytes, BytesN, Env};

pub const PROOF_PK_LEN: u32 = 32;
pub const PROOF_SIG_LEN: u32 = 64;
pub const PROOF_NONCE_LEN: u32 = 8;
pub const PROOF_TOTAL_LEN: u32 = PROOF_PK_LEN + PROOF_SIG_LEN + PROOF_NONCE_LEN;

/// Builds the payload that a valid proof must sign: `group_id || cycle`.
fn build_payload(env: &Env, group_id: u64, cycle: u32) -> Bytes {
    let mut payload = Bytes::new(env);
    for byte in group_id.to_le_bytes() {
        payload.push_back(byte);
    }
    for byte in cycle.to_le_bytes() {
        payload.push_back(byte);
    }
    payload
}

/// Verifies a contribution zk proof against the given group/cycle.
///
/// Returns `false` for a malformed proof (wrong length or unparseable key)
/// without invoking any cryptography, so callers can reject cheaply. A
/// correctly-sized proof with an invalid signature causes the Soroban host's
/// `ed25519_verify` to trap the transaction (there is no way to catch this
/// from within the contract) — callers that need a graceful `Result` should
/// invoke via `try_verify_contribution_proof` on the generated client.
pub fn verify_contribution_proof(env: &Env, proof: &Bytes, group_id: u64, cycle: u32) -> bool {
    if proof.len() != PROOF_TOTAL_LEN {
        return false;
    }

    let pk_bytes = proof.slice(0..PROOF_PK_LEN);
    let sig_bytes = proof.slice(PROOF_PK_LEN..PROOF_PK_LEN + PROOF_SIG_LEN);

    let pk: BytesN<32> = match pk_bytes.try_into() {
        Ok(v) => v,
        Err(_) => return false,
    };
    let sig: BytesN<64> = match sig_bytes.try_into() {
        Ok(v) => v,
        Err(_) => return false,
    };

    let zero_pk = BytesN::from_array(env, &[0u8; 32]);
    if pk == zero_pk {
        return false;
    }

    let payload = build_payload(env, group_id, cycle);
    env.crypto().ed25519_verify(&pk, &payload, &sig);
    true
}
