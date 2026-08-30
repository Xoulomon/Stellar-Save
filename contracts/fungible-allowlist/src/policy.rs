//! Allowlist policy guards for the fungible-allowlist contract.
//!
//! This module isolates the policy checks (authorization, allowlist enforcement)
//! from the SEP-41 token mechanics in `contract.rs`. Token logic can remain
//! unaware of policy internals; policy hooks are wired in via these guard
//! functions called at the contract entry-points.

use soroban_sdk::{panic_with_error, symbol_short, Address, Env};
use stellar_access::access_control::{self as access_control};

use crate::error::Error;

/// Require caller auth + verify caller is admin or has the manager role.
pub fn require_admin(e: &Env, operator: &Address) {
    operator.require_auth();
    if let Some(admin) = access_control::get_admin(e) {
        if &admin != operator && !access_control::has_role(e, operator, &symbol_short!("manager")) {
            panic_with_error!(e, Error::Unauthorized);
        }
    }
}

/// Require that `account` is on the contract allowlist.
pub fn require_allowlisted(e: &Env, account: &Address) {
    if !stellar_tokens::fungible::allowlist::AllowList::allowed(e, account) {
        panic_with_error!(e, Error::NotAllowlisted);
    }
}

#[cfg(test)]
mod tests {
    // Policy unit tests are covered by the integration tests in test.rs
    // (`centralized_access_control_guards_work`).
    // Individual guard logic is tested there against the deployed contract.
}
