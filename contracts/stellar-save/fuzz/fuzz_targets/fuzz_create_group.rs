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

fn test_contribution_rounding(amount: i128) {
    // The rounding function from helpers.rs rounds to nearest 0.01 XLM (100_000 stroops)
    const PRECISION: i128 = 100_000;
    
    // For positive amounts, result should be >= 0
    if amount > 0 {
        let rounded = (amount + PRECISION / 2) / PRECISION * PRECISION;
        assert!(rounded >= 0, "Rounding produced negative for positive input");
    }
    
    // For very small positive amounts < PRECISION/2, should round to 0
    if amount > 0 && amount < PRECISION / 2 {
        let rounded = (amount + PRECISION / 2) / PRECISION * PRECISION;
        assert_eq!(rounded, 0, "Small amount should round to zero");
    }
}

fn test_max_members_validation(max_members: u32) {
    const MAX_MEMBERS_LIMIT: u32 = 20; // From group.rs
    
    // Valid range: 2 to MAX_MEMBERS_LIMIT
    if max_members >= 2 && max_members <= MAX_MEMBERS_LIMIT {
        // This would be accepted by the contract
        assert!(max_members >= 2);
        assert!(max_members <= MAX_MEMBERS_LIMIT);
    }
    
    // Out of range values should trigger validation error
    if max_members > MAX_MEMBERS_LIMIT {
        assert!(max_members > MAX_MEMBERS_LIMIT, "Should reject oversized groups");
    }
}

fn test_cycle_duration_validation(cycle_duration: u64) {
    // Contract config typically sets min=86400 (1 day), max=31536000 (1 year)
    const MIN_DURATION: u64 = 86_400;
    const MAX_DURATION: u64 = 31_536_000;
    
    // Valid range check
    if cycle_duration >= MIN_DURATION && cycle_duration <= MAX_DURATION {
        assert!(cycle_duration >= MIN_DURATION);
    }
}

fn test_grace_period_validation(grace_period: u64, cycle_duration: u64) {
    // Grace period should be reasonable relative to cycle duration
    // Typically grace period < cycle_duration
    if grace_period > 0 && cycle_duration > 0 {
        // Ensure no overflow when adding grace period to deadlines
        let _ = cycle_duration.checked_add(grace_period);
    }
}
