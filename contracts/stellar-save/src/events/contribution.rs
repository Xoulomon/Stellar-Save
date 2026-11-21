use soroban_sdk::{contracttype, Address, Env};

pub const CONTRIBUTION_SCHEMA_VERSION: u32 = 1;

/// Event emitted when a member makes a contribution.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionMade {
    pub schema_version: u32,
    pub group_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub cycle: u32,
    pub cycle_total: i128,
    pub contributed_at: u64,
}

/// Structured on-chain contribution receipt event for backend indexers.
/// Emitted on every contribution and payout so the indexer can reconstruct
/// full contribution history without querying state directly (issue #754).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionEvent {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub amount: i128,
    pub cycle: u32,
    pub timestamp: u64,
}

/// Event emitted when a member misses a contribution deadline.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionMissed {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub cycle: u32,
    pub penalty_applied: i128,
    pub missed_at: u64,
}

/// Event emitted when a contribution is accepted within the grace period
/// (after the hard deadline but before grace_period_seconds elapses).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GracePeriodContribution {
    pub schema_version: u32,
    pub group_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub cycle: u32,
    pub seconds_late: u64,
    pub contributed_at: u64,
}

/// Event emitted when a contribution proof is verified (#479).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionVerified {
    pub schema_version: u32,
    pub group_id: u64,
    pub contributor: Address,
    pub cycle: u32,
    pub verified_at: u64,
}

/// Event emitted when a contribution amount change is proposed (#480).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionAmountProposed {
    pub schema_version: u32,
    pub group_id: u64,
    pub proposed_by: Address,
    pub old_amount: i128,
    pub new_amount: i128,
    pub proposed_at: u64,
}

/// Event emitted when a contribution amount change is approved and applied (#480).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionAmountChanged {
    pub schema_version: u32,
    pub group_id: u64,
    pub old_amount: i128,
    pub new_amount: i128,
    pub effective_cycle: u32,
    pub changed_at: u64,
}

/// Event emitted when an auto-contribution is executed on behalf of a member.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AutoContributionExecuted {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub amount: i128,
    pub cycle: u32,
    pub executed_at: u64,
}

/// Event emitted when an auto-contribution fails due to insufficient balance.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AutoContributionFailed {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub cycle: u32,
    pub failed_at: u64,
}

/// Event emitted when a protocol creation fee is paid by a group creator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeePaid {
    pub schema_version: u32,
    pub creator: Address,
    pub treasury: Address,
    pub amount: i128,
    pub paid_at: u64,
}

/// Event emitted when a penalty is applied to a member for a missed contribution.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PenaltyApplied {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub amount: i128,
    pub cycle_id: u32,
    pub applied_at: u64,
}

/// Event emitted when a member successfully recovers from a penalty.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PenaltyRecovered {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub cycle_id: u32,
    pub recovered_at: u64,
}

/// Event emitted when a contribution is refunded.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefundIssued {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub amount: i128,
    pub cycle: u32,
    pub refunded_at: u64,
}

/// Event emitted when a cycle advances to the next cycle.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CycleAdvanced {
    pub schema_version: u32,
    pub group_id: u64,
    pub old_cycle: u32,
    pub new_cycle: u32,
    pub payout_executed: bool,
    pub defaulted: bool,
    pub advanced_at: u64,
}

/// Event emitted when a cycle deadline is extended.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CycleDeadlineExtended {
    pub schema_version: u32,
    pub group_id: u64,
    pub cycle: u32,
    pub extension_seconds: u64,
    pub new_deadline: u64,
    pub extended_by: Address,
    pub extended_at: u64,
}

// ── Emitters ──────────────────────────────────────────────────────────────────

pub fn emit_contribution_made(
    env: &Env,
    group_id: u64,
    contributor: Address,
    amount: i128,
    cycle: u32,
    cycle_total: i128,
    contributed_at: u64,
) {
    env.events().publish(
        ("contribution_made",),
        ContributionMade {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            contributor: contributor.clone(),
            amount,
            cycle,
            cycle_total,
            contributed_at,
        },
    );

    // Issue #754: emit structured receipt for indexer
    env.events().publish(
        ("contribution_receipt",),
        ContributionEvent {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            member: contributor,
            amount,
            cycle,
            timestamp: contributed_at,
        },
    );
}

pub fn emit_contribution_missed(
    env: &Env,
    group_id: u64,
    member: Address,
    cycle: u32,
    penalty_applied: i128,
    missed_at: u64,
) {
    env.events().publish(
        ("contribution_missed",),
        ContributionMissed {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            member,
            cycle,
            penalty_applied,
            missed_at,
        },
    );
}

pub fn emit_grace_period_contribution(
    env: &Env,
    group_id: u64,
    contributor: Address,
    amount: i128,
    cycle: u32,
    seconds_late: u64,
    contributed_at: u64,
) {
    env.events().publish(
        ("grace_period_contribution",),
        GracePeriodContribution {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            contributor,
            amount,
            cycle,
            seconds_late,
            contributed_at,
        },
    );
}

pub fn emit_contribution_verified(
    env: &Env,
    group_id: u64,
    contributor: Address,
    cycle: u32,
    verified_at: u64,
) {
    env.events().publish(
        ("contribution_verified",),
        ContributionVerified {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            contributor,
            cycle,
            verified_at,
        },
    );
}

pub fn emit_contribution_amount_proposed(
    env: &Env,
    group_id: u64,
    proposed_by: Address,
    old_amount: i128,
    new_amount: i128,
    proposed_at: u64,
) {
    env.events().publish(
        ("contribution_amount_proposed",),
        ContributionAmountProposed {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            proposed_by,
            old_amount,
            new_amount,
            proposed_at,
        },
    );
}

pub fn emit_contribution_amount_changed(
    env: &Env,
    group_id: u64,
    old_amount: i128,
    new_amount: i128,
    effective_cycle: u32,
    changed_at: u64,
) {
    env.events().publish(
        ("contribution_amount_changed",),
        ContributionAmountChanged {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            old_amount,
            new_amount,
            effective_cycle,
            changed_at,
        },
    );
}

pub fn emit_auto_contribution_executed(
    env: &Env,
    group_id: u64,
    member: Address,
    amount: i128,
    cycle: u32,
    executed_at: u64,
) {
    env.events().publish(
        ("auto_contribution_executed",),
        AutoContributionExecuted {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            member,
            amount,
            cycle,
            executed_at,
        },
    );
}

pub fn emit_auto_contribution_failed(env: &Env, group_id: u64, member: Address, cycle: u32, failed_at: u64) {
    env.events().publish(
        ("auto_contribution_failed",),
        AutoContributionFailed {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            member,
            cycle,
            failed_at,
        },
    );
}

pub fn emit_fee_paid(env: &Env, creator: Address, treasury: Address, amount: i128, paid_at: u64) {
    env.events().publish(
        ("fee_paid",),
        FeePaid {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            creator,
            treasury,
            amount,
            paid_at,
        },
    );
}

pub fn emit_penalty_applied(env: &Env, group_id: u64, member: Address, amount: i128, cycle_id: u32) {
    env.events().publish(
        ("penalty_applied",),
        PenaltyApplied {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            member,
            amount,
            cycle_id,
            applied_at: env.ledger().timestamp(),
        },
    );
}

pub fn emit_penalty_recovered(env: &Env, group_id: u64, member: Address, cycle_id: u32) {
    env.events().publish(
        ("penalty_recovered",),
        PenaltyRecovered {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            member,
            cycle_id,
            recovered_at: env.ledger().timestamp(),
        },
    );
}

pub fn emit_refund_issued(
    env: &Env,
    group_id: u64,
    member: Address,
    amount: i128,
    cycle: u32,
    refunded_at: u64,
) {
    env.events().publish(
        ("refund_issued",),
        RefundIssued {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            member,
            amount,
            cycle,
            refunded_at,
        },
    );
}

pub fn emit_cycle_advanced(
    env: &Env,
    group_id: u64,
    old_cycle: u32,
    new_cycle: u32,
    payout_executed: bool,
    defaulted: bool,
    advanced_at: u64,
) {
    env.events().publish(
        ("cycle_advanced",),
        CycleAdvanced {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            old_cycle,
            new_cycle,
            payout_executed,
            defaulted,
            advanced_at,
        },
    );
}

pub fn emit_cycle_deadline_extended(
    env: &Env,
    group_id: u64,
    cycle: u32,
    extension_seconds: u64,
    new_deadline: u64,
    extended_by: Address,
    extended_at: u64,
) {
    env.events().publish(
        ("cycle_deadline_extended",),
        CycleDeadlineExtended {
            schema_version: CONTRIBUTION_SCHEMA_VERSION,
            group_id,
            cycle,
            extension_seconds,
            new_deadline,
            extended_by,
            extended_at,
        },
    );
}

/// Emits a reminder event when a contribution is due for a member.
pub fn emit_contribution_due(
    env: &Env,
    group_id: u64,
    member: Address,
    cycle: u32,
    deadline: u64,
    emitted_at: u64,
) {
    // Note: group_id is included in the data tuple (not the topic) so indexers
    // can filter by topic "contribution_due" and extract group context from the
    // event body. This matches the pattern used by all other emitters.
    env.events().publish(
        ("contribution_due",),
        (group_id, member, cycle, deadline, emitted_at),
    );
}
