//! Error surface for the nft-enumerable contract.
//!
//! This contract carried no failure enum of its own and leaned entirely on the
//! traps raised inside `stellar-tokens`. It now exposes the canonical enum from
//! `stellar-save-common` so any guard added here traps with the same codes the
//! rest of the workspace uses, rather than growing a fifth private duplicate.

pub use stellar_save_common::{CommonResult as Result, Error};

// === Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_errors_are_reachable_from_this_contract() {
        assert_eq!(Error::NotFound.code(), 20);
        assert_eq!(Error::Unauthorized.code(), 1);
        assert_eq!(Error::InvalidInput.code(), 40);
    }
}
