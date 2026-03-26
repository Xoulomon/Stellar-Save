//! Security Module
//!
//! Provides signature verification utilities for the Stellar-Save contract.
//! Intended for future use when explicit signature verification is needed
//! beyond Soroban built-in require_auth() mechanism.

use soroban_sdk::{Bytes, BytesN, Env};

/// Verifies that an Ed25519 signature is valid for the given public key and payload.
///
/// Soroban handles most authorization via Address::require_auth(). This function
/// provides an explicit verification path for cases where you need to validate a
/// signature against a known payload without triggering an auth requirement
/// (e.g., off-chain pre-validation, multi-step flows, meta-transactions).
///
/// # Arguments
/// * `env`        - Soroban environment
/// * `public_key` - 32-byte Ed25519 public key of the signer
/// * `payload`    - The raw bytes that were signed
/// * `signature`  - 64-byte Ed25519 signature to verify
///
/// # Returns
/// `true` if the signature is valid, `false` if the payload is empty.
/// Panics (via the Soroban host) if the signature is cryptographically invalid.
pub fn verify_signature(
    env: &Env,
    public_key: &BytesN<32>,
    payload: &Bytes,
    signature: &BytesN<64>,
) -> bool {
    if payload.is_empty() {
        return false;
    }
    env.crypto().ed25519_verify(public_key, payload, signature);
    true
}

/// Convenience wrapper that accepts raw Bytes and validates lengths before verifying.
///
/// Returns false for incorrect key/signature lengths or an empty payload,
/// avoiding a panic from the host function.
pub fn verify_signature_bytes(
    env: &Env,
    public_key: &Bytes,
    payload: &Bytes,
    signature: &Bytes,
) -> bool {
    if public_key.len() != 32 || signature.len() != 64 || payload.is_empty() {
        return false;
    }
    let pk: BytesN<32> = match public_key.clone().try_into() {
        Ok(v) => v,
        Err(_) => return false,
    };
    let sig: BytesN<64> = match signature.clone().try_into() {
        Ok(v) => v,
        Err(_) => return false,
    };
    verify_signature(env, &pk, payload, &sig)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Bytes, BytesN, Env};

    fn bytes_of(env: &Env, len: u32, val: u8) -> Bytes {
        let mut b = Bytes::new(env);
        for _ in 0..len {
            b.push_back(val);
        }
        b
    }

    // --- verify_signature_bytes: input validation (no real crypto needed) ---

    #[test]
    fn test_rejects_empty_payload() {
        let env = Env::default();
        let pk = bytes_of(&env, 32, 0xAB);
        let payload = Bytes::new(&env);
        let sig = bytes_of(&env, 64, 0xCD);
        assert!(!verify_signature_bytes(&env, &pk, &payload, &sig));
    }

    #[test]
    fn test_rejects_short_public_key() {
        let env = Env::default();
        let pk = bytes_of(&env, 16, 0x01);
        let payload = bytes_of(&env, 32, 0x02);
        let sig = bytes_of(&env, 64, 0x03);
        assert!(!verify_signature_bytes(&env, &pk, &payload, &sig));
    }

    #[test]
    fn test_rejects_long_public_key() {
        let env = Env::default();
        let pk = bytes_of(&env, 64, 0x01);
        let payload = bytes_of(&env, 32, 0x02);
        let sig = bytes_of(&env, 64, 0x03);
        assert!(!verify_signature_bytes(&env, &pk, &payload, &sig));
    }

    #[test]
    fn test_rejects_short_signature() {
        let env = Env::default();
        let pk = bytes_of(&env, 32, 0x01);
        let payload = bytes_of(&env, 32, 0x02);
        let sig = bytes_of(&env, 32, 0x03);
        assert!(!verify_signature_bytes(&env, &pk, &payload, &sig));
    }

    #[test]
    fn test_rejects_long_signature() {
        let env = Env::default();
        let pk = bytes_of(&env, 32, 0x01);
        let payload = bytes_of(&env, 32, 0x02);
        let sig = bytes_of(&env, 128, 0x03);
        assert!(!verify_signature_bytes(&env, &pk, &payload, &sig));
    }

    #[test]
    fn test_rejects_all_zero_lengths() {
        let env = Env::default();
        let empty = Bytes::new(&env);
        assert!(!verify_signature_bytes(&env, &empty, &empty, &empty));
    }

    // --- verify_signature: real Ed25519 crypto ---

    #[test]
    fn test_valid_ed25519_signature_returns_true() {
        let env = Env::default();
        let secret_seed = [0u8; 32];
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&secret_seed);
        let verifying_key = signing_key.verifying_key();
        let message = b"stellar-save test payload";
        use ed25519_dalek::Signer;
        let sig_bytes = signing_key.sign(message).to_bytes();
        let pk: BytesN<32> = BytesN::from_array(&env, verifying_key.as_bytes());
        let payload = Bytes::from_slice(&env, message);
        let sig: BytesN<64> = BytesN::from_array(&env, &sig_bytes);
        assert!(verify_signature(&env, &pk, &payload, &sig));
    }

    #[test]
    #[should_panic]
    fn test_invalid_ed25519_signature_panics() {
        let env = Env::default();
        let secret_seed = [0u8; 32];
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&secret_seed);
        let verifying_key = signing_key.verifying_key();
        let message = b"stellar-save test payload";
        use ed25519_dalek::Signer;
        let mut sig_bytes = signing_key.sign(message).to_bytes();
        sig_bytes[0] ^= 0xFF; // corrupt
        let pk: BytesN<32> = BytesN::from_array(&env, verifying_key.as_bytes());
        let payload = Bytes::from_slice(&env, message);
        let sig: BytesN<64> = BytesN::from_array(&env, &sig_bytes);
        verify_signature(&env, &pk, &payload, &sig);
    }
}
