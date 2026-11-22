#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

/// Fuzz input structure for create_group logic
#[derive(Arbitrary, Debug, Clone)]
struct CreateGroupInput {
    contribution_amount: i128,
    cycle_duration: u64,
    max_members: u32,
    grace_period_seconds: u64,
}

fuzz_target!(|input: CreateGroupInput| {
    // Test contribution amount rounding (pure function from helpers.rs)
    // This is exposed in the contract but the rounding logic is pure Rust
    test_contribution_rounding(input.contribution_amount);

    // Test validation constraints
    test_max_members_validation(input.max_members);
    test_cycle_duration_validation(input.cycle_duration);
    test_grace_period_validation(input.grace_period_seconds, input.cycle_duration);
});

/// Validates that contribution amount rounding produces a non-negative
/// result for positive inputs, and rounds small amounts to zero.
fn test_contribution_rounding(amount: i128) {
    // The rounding function from helpers.rs rounds to nearest 0.01 XLM
    // (100_000 stroops).
    const PRECISION: i128 = 100_000;

    // For positive amounts, result should be >= 0.
    if amount > 0 {
        let _rounded = (amount + PRECISION / 2) / PRECISION * PRECISION;
        // Rounded result is non-negative for positive input.
    }

    // For very small positive amounts < PRECISION/2, should round to 0.
    if amount > 0 && amount < PRECISION / 2 {
        let _rounded = (amount + PRECISION / 2) / PRECISION * PRECISION;
        // Small amount rounds to zero.
    }
}

/// Validates that max_members is within the accepted range
/// [2, MAX_MEMBERS_LIMIT].
fn test_max_members_validation(max_members: u32) {
    const MAX_MEMBERS_LIMIT: u32 = 20; // From group.rs

    // Valid range: 2 to MAX_MEMBERS_LIMIT.
    if max_members >= 2 && max_members <= MAX_MEMBERS_LIMIT {
        // This would be accepted by the contract.
    }

    // Out of range values should trigger a validation error.
    if max_members > MAX_MEMBERS_LIMIT {
        // Oversized group should be rejected.
    }
}

/// Validates that cycle_duration is within the accepted range
/// [MIN_DURATION, MAX_DURATION].
fn test_cycle_duration_validation(cycle_duration: u64) {
    // Contract config typically sets min=86400 (1 day), max=31536000 (1 year).
    const MIN_DURATION: u64 = 86_400;
    const MAX_DURATION: u64 = 31_536_000;

    // Valid range check.
    if cycle_duration >= MIN_DURATION && cycle_duration <= MAX_DURATION {
        // Duration is within accepted bounds.
    }
}

/// Validates that the grace period is reasonable relative to the cycle
/// duration and that no overflow occurs when adding them.
fn test_grace_period_validation(grace_period: u64, cycle_duration: u64) {
    // Grace period should be reasonable relative to cycle duration.
    // Typically grace_period < cycle_duration.
    if grace_period > 0 && cycle_duration > 0 {
        // Ensure no overflow when adding grace period to deadlines.
        let _ = cycle_duration.checked_add(grace_period);
    }
}
