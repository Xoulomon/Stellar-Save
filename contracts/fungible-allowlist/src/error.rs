//! Error surface for the fungible-allowlist contract.
//!
//! This contract previously signalled failures with `panic!` string literals,
//! which carry no stable code for a client to branch on. It now traps with the
//! canonical enum from `stellar-save-common`, so an allowlist rejection here
//! decodes identically to one raised by any other contract in the workspace.

pub use stellar_save_common::{CommonResult as Result, Error};

// === Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guard_failures_carry_distinct_canonical_codes() {
        assert_eq!(Error::Unauthorized.code(), 1);
        assert_eq!(Error::NotAllowlisted.code(), 2);
        assert_ne!(Error::Unauthorized, Error::NotAllowlisted);
    }
}
