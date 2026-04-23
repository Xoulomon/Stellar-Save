//! Security Module
//!
//! Provides authorization and signature verification utilities for the Stellar-Save contract.
//! Implements role-based access control for sensitive operations.

use soroban_sdk::{Bytes, BytesN, Env, Address};
use crate::error::{StellarSaveError, ContractResult};

/// Role-based access control for contract operations.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    /// Group creator - can pause, resume, and cancel groups
    GroupCreator,

    /// Group member - can contribute and receive payouts
    GroupMember,

    /// Contract admin - can pause/unpause the entire contract
    ContractAdmin,

    /// Public - no special permissions
    Public,
}

/// Authorization context for contract operations.
pub struct AuthContext {
    pub caller: Address,
    pub role: Role,
}

impl AuthContext {
    /// Creates a new authorization context.
    pub fn new(caller: Address, role: Role) -> Self {
        AuthContext { caller, role }
    }

    /// Checks if the caller has the required role.
    pub fn has_role(&self, required_role: Role) -> bool {
        self.role == required_role
    }

    /// Checks if the caller is the group creator.
    pub fn is_group_creator(&self) -> bool {
        self.role == Role::GroupCreator
    }

    /// Checks if the caller is a group member.
    pub fn is_group_member(&self) -> bool {
        self.role == Role::GroupMember
    }

    /// Checks if the caller is a contract admin.
    pub fn is_contract_admin(&self) -> bool {
        self.role == Role::ContractAdmin
    }
}

/// Authorization checks for sensitive operations.
pub struct AuthorizationChecker;

impl AuthorizationChecker {
    /// Requires that the caller is the group creator.
    ///
    /// Used for operations like pause, resume, and cancel.
    pub fn require_group_creator(caller: &Address, creator: &Address) -> ContractResult<()> {
        if caller == creator {
            Ok(())
        } else {
            Err(StellarSaveError::Unauthorized)
        }
    }

    /// Requires that the caller is a group member.
    ///
    /// Used for operations like contribute and receive payout.
    pub fn require_group_member(is_member: bool) -> ContractResult<()> {
        if is_member {
            Ok(())
        } else {
            Err(StellarSaveError::NotMember)
        }
    }

    /// Requires that the caller is not already a member.
    ///
    /// Used for join operations.
    pub fn require_not_member(is_member: bool) -> ContractResult<()> {
        if !is_member {
            Ok(())
        } else {
            Err(StellarSaveError::AlreadyMember)
        }
    }

    /// Requires that the caller is the contract admin.
    ///
    /// Used for contract-level operations like pause/unpause.
    pub fn require_contract_admin(caller: &Address, admin: &Address) -> ContractResult<()> {
        if caller == admin {
            Ok(())
        } else {
            Err(StellarSaveError::Unauthorized)
        }
    }

    /// Requires that the caller is the specified address.
    ///
    /// Generic authorization check for any address-based permission.
    pub fn require_address(caller: &Address, required: &Address) -> ContractResult<()> {
        if caller == required {
            Ok(())
        } else {
            Err(StellarSaveError::Unauthorized)
        }
    }

    /// Checks if an operation is authorized based on the caller and context.
    pub fn check_authorization(
        caller: &Address,
        operation: &str,
        context: &AuthContext,
    ) -> ContractResult<()> {
        match operation {
            "pause_group" | "resume_group" | "cancel_group" => {
                if context.is_group_creator() {
                    Ok(())
                } else {
                    Err(StellarSaveError::Unauthorized)
                }
            }
            "contribute" | "claim_payout" => {
                if context.is_group_member() {
                    Ok(())
                } else {
                    Err(StellarSaveError::NotMember)
                }
            }
            "pause_contract" | "unpause_contract" => {
                if context.is_contract_admin() {
                    Ok(())
                } else {
                    Err(StellarSaveError::Unauthorized)
                }
            }
            _ => Ok(()), // Unknown operations are allowed by default
        }
    }
}

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
    use soroban_sdk::{Bytes, BytesN, Env, testutils::Address as _};

    fn bytes_of(env: &Env, len: u32, val: u8) -> Bytes {
        let mut b = Bytes::new(env);
        for _ in 0..len {
            b.push_back(val);
        }
        b
    }

    // --- Authorization tests ---

    #[test]
    fn test_auth_context_creation() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller.clone(), Role::GroupCreator);

        assert_eq!(ctx.caller, caller);
        assert_eq!(ctx.role, Role::GroupCreator);
    }

    #[test]
    fn test_auth_context_has_role() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller, Role::GroupMember);

        assert!(ctx.has_role(Role::GroupMember));
        assert!(!ctx.has_role(Role::GroupCreator));
    }

    #[test]
    fn test_auth_context_role_checks() {
        let env = Env::default();
        let caller = Address::generate(&env);

        let creator_ctx = AuthContext::new(caller.clone(), Role::GroupCreator);
        assert!(creator_ctx.is_group_creator());
        assert!(!creator_ctx.is_group_member());

        let member_ctx = AuthContext::new(caller.clone(), Role::GroupMember);
        assert!(member_ctx.is_group_member());
        assert!(!member_ctx.is_group_creator());

        let admin_ctx = AuthContext::new(caller, Role::ContractAdmin);
        assert!(admin_ctx.is_contract_admin());
    }

    #[test]
    fn test_require_group_creator_success() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let result = AuthorizationChecker::require_group_creator(&creator, &creator);
        assert!(result.is_ok());
    }

    #[test]
    fn test_require_group_creator_failure() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let other = Address::generate(&env);

        let result = AuthorizationChecker::require_group_creator(&other, &creator);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    #[test]
    fn test_require_group_member_success() {
        let result = AuthorizationChecker::require_group_member(true);
        assert!(result.is_ok());
    }

    #[test]
    fn test_require_group_member_failure() {
        let result = AuthorizationChecker::require_group_member(false);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::NotMember);
    }

    #[test]
    fn test_require_not_member_success() {
        let result = AuthorizationChecker::require_not_member(false);
        assert!(result.is_ok());
    }

    #[test]
    fn test_require_not_member_failure() {
        let result = AuthorizationChecker::require_not_member(true);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::AlreadyMember);
    }

    #[test]
    fn test_require_contract_admin_success() {
        let env = Env::default();
        let admin = Address::generate(&env);

        let result = AuthorizationChecker::require_contract_admin(&admin, &admin);
        assert!(result.is_ok());
    }

    #[test]
    fn test_require_contract_admin_failure() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let other = Address::generate(&env);

        let result = AuthorizationChecker::require_contract_admin(&other, &admin);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    #[test]
    fn test_require_address_success() {
        let env = Env::default();
        let addr = Address::generate(&env);

        let result = AuthorizationChecker::require_address(&addr, &addr);
        assert!(result.is_ok());
    }

    #[test]
    fn test_require_address_failure() {
        let env = Env::default();
        let addr1 = Address::generate(&env);
        let addr2 = Address::generate(&env);

        let result = AuthorizationChecker::require_address(&addr1, &addr2);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    #[test]
    fn test_check_authorization_pause_group() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller.clone(), Role::GroupCreator);

        let result = AuthorizationChecker::check_authorization(&caller, "pause_group", &ctx);
        assert!(result.is_ok());
    }

    #[test]
    fn test_check_authorization_pause_group_unauthorized() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller.clone(), Role::GroupMember);

        let result = AuthorizationChecker::check_authorization(&caller, "pause_group", &ctx);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::Unauthorized);
    }

    #[test]
    fn test_check_authorization_contribute() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller.clone(), Role::GroupMember);

        let result = AuthorizationChecker::check_authorization(&caller, "contribute", &ctx);
        assert!(result.is_ok());
    }

    #[test]
    fn test_check_authorization_contribute_unauthorized() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller.clone(), Role::Public);

        let result = AuthorizationChecker::check_authorization(&caller, "contribute", &ctx);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StellarSaveError::NotMember);
    }

    #[test]
    fn test_check_authorization_pause_contract() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller.clone(), Role::ContractAdmin);

        let result = AuthorizationChecker::check_authorization(&caller, "pause_contract", &ctx);
        assert!(result.is_ok());
    }

    #[test]
    fn test_check_authorization_unknown_operation() {
        let env = Env::default();
        let caller = Address::generate(&env);
        let ctx = AuthContext::new(caller.clone(), Role::Public);

        let result = AuthorizationChecker::check_authorization(&caller, "unknown_op", &ctx);
        assert!(result.is_ok()); // Unknown operations are allowed by default
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
