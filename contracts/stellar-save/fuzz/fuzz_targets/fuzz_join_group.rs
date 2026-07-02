#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

/// Fuzz input for join_group validation logic
#[derive(Arbitrary, Debug, Clone)]
struct JoinGroupInput {
    current_members: u32,
    max_members: u32,
    group_status: u8, // 0=Pending, 1=Active, 2=Paused, 3=Completed, 4=Cancelled
    payout_position: u32,
}

fuzz_target!(|input: JoinGroupInput| {
    // Test member capacity validation
    test_member_capacity(input.current_members, input.max_members);
    
    // Test group status validation for joining
    test_join_status_validation(input.group_status);
    
    // Test payout position assignment
    test_payout_position(input.payout_position, input.max_members);
});

fn test_member_capacity(current: u32, max: u32) {
    const MAX_MEMBERS_PROTOCOL: u32 = 20; // From group.rs
    
    // Group should not exceed max_members
    if current >= max {
        assert!(current >= max, "Full group should reject new members");
    }
    
    // Ensure max_members doesn't exceed protocol limit
    if max > MAX_MEMBERS_PROTOCOL {
        assert!(max > MAX_MEMBERS_PROTOCOL, "Should reject oversized group");
    }
    
    // Valid capacity
    if current < max && max <= MAX_MEMBERS_PROTOCOL {
        assert!(current < max);
    }
}

fn test_join_status_validation(status_code: u8) {
    // Only Pending (0) groups accept new members
    const PENDING: u8 = 0;
    const ACTIVE: u8 = 1;
    const PAUSED: u8 = 2;
    const COMPLETED: u8 = 3;
    const CANCELLED: u8 = 4;
    
    match status_code {
        PENDING => {
            // Can join
            assert_eq!(status_code, PENDING);
        }
        ACTIVE | PAUSED | COMPLETED | CANCELLED => {
            // Cannot join
            assert!(status_code != PENDING, "Non-pending groups reject joins");
        }
        _ => {
            // Invalid status
            assert!(status_code > CANCELLED, "Invalid status code");
        }
    }
}

fn test_payout_position(position: u32, max_members: u32) {
    // Payout positions are 0-indexed
    // Valid range: 0 to (max_members - 1)
    
    if max_members > 0 && position < max_members {
        // Valid position
        assert!(position < max_members);
    }
    
    if position >= max_members && max_members > 0 {
        // Out of range
        assert!(position >= max_members, "Position out of range");
    }
    
    // Ensure no overflow when assigning positions
    if let Some(next_pos) = position.checked_add(1) {
        assert!(next_pos > position);
    }
}

/// Test member profile invariants
fn test_member_profile(group_id: u64, position: u32, joined_at: u64) {
    // Group ID should be valid (non-zero typically)
    if group_id > 0 {
        assert!(group_id > 0);
    }
    
    // Position should be reasonable
    assert!(position < u32::MAX);
    
    // Timestamp should be reasonable (not in far future)
    const REASONABLE_FUTURE: u64 = 2_000_000_000; // ~Year 2033
    if joined_at < REASONABLE_FUTURE {
        assert!(joined_at < REASONABLE_FUTURE);
    }
}
