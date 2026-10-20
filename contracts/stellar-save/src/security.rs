//! Security Module
//!
//! Re-exports centralized authorization helpers from [`auth`](crate::auth)
//! and the `Role` / `AuthContext` types used by the contract's
//! authorization layer.  All inline access-control logic lives in
//! `auth.rs`; this module exists only to preserve the public API
//! surface for downstream consumers.

pub use crate::auth::{
    is_active_member, require_admin, require_creator, require_group_creator,
    require_member, require_not_member,
};

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
    pub caller: soroban_sdk::Address,
    pub role: Role,
}

impl AuthContext {
    /// Creates a new authorization context.
    pub fn new(caller: soroban_sdk::Address, role: Role) -> Self {
        AuthContext { caller, role }
    }

    /// Checks if the caller has the required role.
    pub fn has_role(&self, required_role: Role) -> bool {
        self.role == required_role
    }
}