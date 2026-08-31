//! Error surface for the guess-the-number contract.
//!
//! The three variants this contract used to declare were restatements of
//! failures every other contract also has, so they now resolve to the canonical
//! enum in `stellar-save-common` instead of a local duplicate.
//!
//! Mapping from the retired local enum:
//!
//! | Retired variant               | Canonical variant     |
//! |-------------------------------|-----------------------|
//! | `FailedToTransferToGuesser`   | `TransferFailed`      |
//! | `FailedToTransferFromGuesser` | `TransferFailed`      |
//! | `NoBalanceToTransfer`         | `InsufficientBalance` |
//!
//! The transfer direction is no longer encoded in the error code. It is still
//! recoverable from the trapped call frame, which is where a caller debugging a
//! failed transfer looks anyway.

pub use stellar_save_common::{CommonResult as Result, Error};

// === Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transfer_failures_share_one_canonical_code() {
        assert_eq!(Error::TransferFailed.code(), 61);
        assert_eq!(Error::InsufficientBalance.code(), 60);
    }

    #[test]
    fn an_empty_pot_is_distinguishable_from_a_failed_transfer() {
        assert_ne!(Error::InsufficientBalance, Error::TransferFailed);
    }
}
