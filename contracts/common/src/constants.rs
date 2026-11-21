//! Shared numeric constants used across Stellar-Save contracts.
//!
//! All contracts in this workspace should import protocol-level constants
//! from here rather than redefining them locally, so that the single
//! canonical value can be changed in one place without risk of numeric drift.
//!
//! # Usage
//! ```rust,ignore
//! use stellar_save_common::constants::STROOPS_PER_XLM;
//! ```

// ─── XLM / Stroop Conversions ─────────────────────────────────────────────────
// ─── XLM / Stroop Conversions ─────────────────────────────────────────────────

/// Number of stroops in one XLM.
///
/// 1 XLM = 10,000,000 stroops.  All token amounts in Soroban are expressed
/// in the smallest indivisible unit (stroops); multiply by this constant to
/// convert from whole XLM.
/// Unit: stroops per XLM
pub const STROOPS_PER_XLM: i128 = 10_000_000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stroops_per_xlm_is_canonical_stellar_value() {
        assert_eq!(STROOPS_PER_XLM, 10_000_000);
    }
}
