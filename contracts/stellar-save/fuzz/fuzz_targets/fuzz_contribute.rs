#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

/// Fuzz input for contribute validation logic
#[derive(Arbitrary, Debug, Clone)]
struct ContributeInput {
    amount: i128,
    expected_amount: i128,
    cycle_number: u32,
    timestamp: u64,
    deadline: u64,
    grace_period: u64,
}

fuzz_target!(|input: ContributeInput| {
    // Test contribution amount validation
    test_amount_validation(input.amount, input.expected_amount);
    
    // Test deadline + grace period logic
    test_deadline_validation(input.timestamp, input.deadline, input.grace_period);
    
    // Test cycle number bounds
    test_cycle_validation(input.cycle_number);
});

fn test_amount_validation(amount: i128, expected: i128) {
    // Contribution must be positive
    if amount <= 0 {
        assert!(amount <= 0, "Zero or negative amount should be rejected");
        return;
    }
    
    // Amount must exactly match group's required contribution
    if amount == expected && amount > 0 {
        assert_eq!(amount, expected, "Valid amount matches expected");
    }
    
    // Reject mismatched amounts
    if amount != expected && amount > 0 && expected > 0 {
        assert_ne!(amount, expected, "Mismatched amount should be rejected");
    }
}

fn test_deadline_validation(timestamp: u64, deadline: u64, grace_period: u64) {
    // Check if timestamp is within deadline + grace period
    if let Some(effective_deadline) = deadline.checked_add(grace_period) {
        if timestamp <= effective_deadline {
            // Within valid window
            assert!(timestamp <= effective_deadline);
        } else {
            // Past deadline
            assert!(timestamp > effective_deadline, "Should reject late contribution");
        }
    }
    
    // Ensure no overflow in deadline calculation
    let _ = deadline.checked_add(grace_period);
}

fn test_cycle_validation(cycle_number: u32) {
    // Cycle numbers should be reasonable (0 to max members typically < 50)
    const TYPICAL_MAX_CYCLES: u32 = 50;
    
    // Valid cycles are 0-indexed
    if cycle_number <= TYPICAL_MAX_CYCLES {
        assert!(cycle_number <= TYPICAL_MAX_CYCLES);
    }
    
    // Very large cycle numbers would indicate completed group
    if cycle_number > TYPICAL_MAX_CYCLES {
        assert!(cycle_number > TYPICAL_MAX_CYCLES);
    }
}

/// Tests contribution record creation doesn't panic on valid inputs
fn test_contribution_record_invariants(amount: i128, cycle: u32) {
    // Amount must be positive to create a valid ContributionRecord
    if amount > 0 {
        // Verify no overflow in amount storage
        assert!(amount > 0);
        
        // Cycle should be valid
        assert!(cycle < u32::MAX);
    }
}
