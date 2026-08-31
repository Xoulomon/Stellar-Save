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

/// Number of stroops in one XLM.
///
/// 1 XLM = 10,000,000 stroops.  All token amounts in Soroban are expressed
/// in the smallest indivisible unit (stroops); multiply by this constant to
/// convert from whole XLM.
/// Unit: stroops per XLM
pub const STROOPS_PER_XLM: i128 = 10_000_000;

/// Convert a whole-XLM amount to stroops.
///
/// This is a `const fn` so it can be used in const-expressions and `#[test]`
/// attribute values.
pub const fn xlm_to_stroops(xlm: u64) -> i128 {
    (xlm as i128) * STROOPS_PER_XLM
}

// ─── Basis-point helpers ──────────────────────────────────────────────────────

/// Total basis points in 100% (10,000 bp = 100%).
///
/// Use this as the denominator when converting a basis-point rate to a
/// percentage: `amount * rate_bps / MAX_BASIS_POINTS`.
pub const MAX_BASIS_POINTS: u32 = 10_000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stroops_per_xlm_is_canonical_stellar_value() {
        assert_eq!(STROOPS_PER_XLM, 10_000_000);
    }

    #[test]
    fn xlm_to_stroops_converts_correctly() {
        assert_eq!(xlm_to_stroops(0), 0);
        assert_eq!(xlm_to_stroops(1), 10_000_000);
        assert_eq!(xlm_to_stroops(10), 100_000_000);
    }

    #[test]
    fn max_basis_points_is_ten_thousand() {
        assert_eq!(MAX_BASIS_POINTS, 10_000);
    }
}
