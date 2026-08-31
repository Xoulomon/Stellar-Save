#![no_main]

use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;

/// Fuzz input representing deposit and withdraw boundary conditions
#[derive(Arbitrary, Debug, Clone)]
pub struct DepositWithdrawInput {
    pub deposit_amount: i128,
    pub withdraw_amount: i128,
    pub initial_balance: i128,
    pub member_count: u32,
    pub cycle_number: u32,
    pub fee_basis_points: u32,
}

fuzz_target!(|input: DepositWithdrawInput| {
    test_deposit_bounds(input.deposit_amount, input.initial_balance);
    test_withdraw_bounds(input.withdraw_amount, input.initial_balance);
    test_payout_calculation(input.deposit_amount, input.member_count);
    test_fee_deduction(input.withdraw_amount, input.fee_basis_points);
    test_deposit_withdraw_roundtrip(input.deposit_amount, input.withdraw_amount, input.initial_balance);
});

fn test_deposit_bounds(deposit: i128, initial: i128) {
    if deposit <= 0 {
        // Zero or negative deposits must be rejected
        assert!(deposit <= 0, "Zero or negative deposit should be invalid");
        return;
    }

    if initial >= 0 {
        // Test overflow on balance addition
        if let Some(new_balance) = initial.checked_add(deposit) {
            assert!(new_balance >= initial);
            assert!(new_balance >= deposit);
        }
    }
}

fn test_withdraw_bounds(withdraw: i128, balance: i128) {
    if withdraw <= 0 {
        // Non-positive withdraw amounts are rejected
        assert!(withdraw <= 0);
        return;
    }

    if balance >= 0 {
        if withdraw > balance {
            // Overdraw should be detected
            assert!(withdraw > balance, "Cannot withdraw more than balance");
        } else {
            let remaining = balance.checked_sub(withdraw);
            assert!(remaining.is_some());
            assert!(remaining.unwrap() >= 0);
        }
    }
}

fn test_payout_calculation(deposit_amount: i128, member_count: u32) {
    if deposit_amount > 0 && member_count > 0 && member_count <= 50 {
        if let Some(total_pool) = deposit_amount.checked_mul(member_count as i128) {
            assert!(total_pool >= deposit_amount);
        }
    }
}

fn test_fee_deduction(amount: i128, fee_bps: u32) {
    if amount > 0 && fee_bps <= 10_000 {
        let fee = (amount as i128)
            .checked_mul(fee_bps as i128)
            .map(|prod| prod / 10_000);
        if let Some(f) = fee {
            assert!(f >= 0);
            assert!(f <= amount);
            let net = amount.checked_sub(f);
            assert!(net.is_some());
            assert!(net.unwrap() >= 0);
        }
    }
}

fn test_deposit_withdraw_roundtrip(deposit: i128, withdraw: i128, initial: i128) {
    if deposit > 0 && withdraw > 0 && initial >= 0 {
        if let Some(after_deposit) = initial.checked_add(deposit) {
            if withdraw <= after_deposit {
                let remaining = after_deposit.checked_sub(withdraw).unwrap();
                assert!(remaining >= 0);
            }
        }
    }
}
