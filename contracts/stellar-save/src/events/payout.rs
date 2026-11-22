use soroban_sdk::{contracttype, Address, Env};

pub const PAYOUT_SCHEMA_VERSION: u32 = 1;

/// Event emitted when a payout is executed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutExecuted {
    pub schema_version: u32,
    pub group_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub cycle: u32,
    pub executed_at: u64,
}

// ── Emitters ──────────────────────────────────────────────────────────────────

pub fn emit_payout_executed(
    env: &Env,
    group_id: u64,
    recipient: Address,
    amount: i128,
    cycle: u32,
    executed_at: u64,
) {
    env.events().publish(
        ("payout_executed",),
        PayoutExecuted {
            schema_version: PAYOUT_SCHEMA_VERSION,
            group_id,
            recipient,
            amount,
            cycle,
            executed_at,
        },
    );
}
