use soroban_sdk::{Address, Env};
use crate::{
    error::StellarSaveError,
    events::EventEmitter,
    group::{Group, GroupStatus},
    storage::StorageKeyBuilder,
};

// ─── Cycle Calculation ────────────────────────────────────────────────────────

/// Returns the current cycle index (0-indexed) based on elapsed time.
///
/// Formula: `floor((now - started_at) / cycle_duration)`
///
/// Returns `0` if the group has not started yet or `now < started_at`.
pub fn get_current_cycle(group: &Group, now: u64) -> u32 {
    if !group.started || now < group.started_at || group.cycle_duration == 0 {
        return 0;
    }
    let elapsed = now - group.started_at;
    let cycle = elapsed / group.cycle_duration;
    // Cap at max_members so we never exceed the group's total cycles
    (cycle as u32).min(group.max_members)
}

/// Returns the start timestamp of a given cycle.
///
/// `cycle_start = started_at + (cycle_number * cycle_duration)`
pub fn get_cycle_start(group: &Group, cycle_number: u32) -> Result<u64, StellarSaveError> {
    let offset = (cycle_number as u64)
        .checked_mul(group.cycle_duration)
        .ok_or(StellarSaveError::Overflow)?;
    group.started_at.checked_add(offset).ok_or(StellarSaveError::Overflow)
}

/// Returns the deadline (end timestamp) of a given cycle.
///
/// `deadline = started_at + ((cycle_number + 1) * cycle_duration)`
pub fn get_cycle_deadline(group: &Group, cycle_number: u32) -> Result<u64, StellarSaveError> {
    let next = (cycle_number as u64)
        .checked_add(1)
        .ok_or(StellarSaveError::Overflow)?;
    let offset = next
        .checked_mul(group.cycle_duration)
        .ok_or(StellarSaveError::Overflow)?;
    group.started_at.checked_add(offset).ok_or(StellarSaveError::Overflow)
}

// ─── Deadline Validation ──────────────────────────────────────────────────────

/// Returns `true` when the given cycle's deadline has passed.
///
/// An optional `grace_period` (in seconds) allows minor clock drift.
pub fn is_cycle_expired(
    group: &Group,
    cycle_number: u32,
    now: u64,
    grace_period: u64,
) -> Result<bool, StellarSaveError> {
    let deadline = get_cycle_deadline(group, cycle_number)?;
    Ok(now > deadline.saturating_add(grace_period))
}

// ─── Cycle Transition ─────────────────────────────────────────────────────────

/// Attempts to advance the group to the next cycle.
///
/// This is the main entry-point for cycle progression. It:
/// 1. Validates the group is active and not already complete.
/// 2. Checks the current cycle's deadline has passed (time-based trigger).
/// 3. Emits a `CycleEnded` event for the outgoing cycle.
/// 4. Increments `current_cycle` and persists the updated group.
/// 5. Emits a `CycleStarted` event for the new cycle (unless group is now complete).
/// 6. Emits `GroupStatusChanged` / `GroupCompleted` when the final cycle ends.
///
/// Idempotent: if `group.current_cycle` already reflects the time-derived cycle
/// no transition is performed and `Ok(false)` is returned.
///
/// Returns `Ok(true)` when a transition occurred, `Ok(false)` when not needed.
pub fn try_advance_cycle(
    env: &Env,
    group_id: u64,
    caller: &Address,
) -> Result<bool, StellarSaveError> {
    let group_key = StorageKeyBuilder::group_data(group_id);
    let mut group: Group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Must be active and started
    if group.status != GroupStatus::Active || !group.started {
        return Err(StellarSaveError::InvalidState);
    }

    // Already finished all cycles
    if group.is_complete() {
        return Err(StellarSaveError::InvalidState);
    }

    let now = env.ledger().timestamp();
    let time_cycle = get_current_cycle(&group, now);

    // Nothing to do — time hasn't moved past the current cycle boundary
    if time_cycle <= group.current_cycle {
        return Ok(false);
    }

    // Prevent skipping more than one cycle at a time
    let next_cycle = group.current_cycle + 1;

    // Emit CycleEnded for the cycle we're leaving
    EventEmitter::emit_cycle_ended(env, group_id, group.current_cycle, now);

    // Advance the cycle counter (group.advance_cycle also handles completion)
    group.advance_cycle(env);

    // Persist updated group
    env.storage().persistent().set(&group_key, &group);

    // Emit CycleStarted for the new cycle (only if group is still running)
    if !group.is_complete() {
        EventEmitter::emit_cycle_started(env, group_id, next_cycle, now);
    } else {
        // Emit GroupStatusChanged → Completed
        EventEmitter::emit_group_status_changed(
            env,
            group_id,
            GroupStatus::Active as u32,
            GroupStatus::Completed as u32,
            caller.clone(),
            now,
        );
    }

    Ok(true)
}

/// Pure logic version of cycle advancement (no storage, no events).
///
/// Useful for unit tests and scenarios where storage is managed externally.
/// Returns `Err(InvalidState)` if the group is already complete.
pub fn advance_group_cycle_logic(
    env: &Env,
    group: &mut Group,
) -> Result<(), StellarSaveError> {
    if group.is_complete() {
        return Err(StellarSaveError::InvalidState);
    }
    group.advance_cycle(env);
    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn make_group(env: &Env, max_members: u32, cycle_duration: u64, started_at: u64) -> Group {
        let creator = Address::generate(env);
        let mut g = Group::new(1, creator, 10_000_000, cycle_duration, max_members, 2, started_at);
        // Simulate min members joined so activate works
        g.member_count = max_members;
        g.activate(started_at);
        g
    }

    // ── get_current_cycle ──────────────────────────────────────────────────

    #[test]
    fn test_get_current_cycle_before_start() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 1_000_000);
        // now < started_at
        assert_eq!(get_current_cycle(&g, 999_999), 0);
    }

    #[test]
    fn test_get_current_cycle_at_start() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 1_000_000);
        assert_eq!(get_current_cycle(&g, 1_000_000), 0);
    }

    #[test]
    fn test_get_current_cycle_mid_first_cycle() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        assert_eq!(get_current_cycle(&g, 300_000), 0);
    }

    #[test]
    fn test_get_current_cycle_exact_boundary() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        // Exactly at the start of cycle 1
        assert_eq!(get_current_cycle(&g, 604800), 1);
    }

    #[test]
    fn test_get_current_cycle_multiple_cycles() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        assert_eq!(get_current_cycle(&g, 604800 * 2 + 1), 2);
        assert_eq!(get_current_cycle(&g, 604800 * 3), 3);
    }

    #[test]
    fn test_get_current_cycle_capped_at_max_members() {
        let env = Env::default();
        let g = make_group(&env, 3, 604800, 0);
        // Way past all cycles
        assert_eq!(get_current_cycle(&g, 604800 * 100), 3);
    }

    // ── is_cycle_expired ──────────────────────────────────────────────────

    #[test]
    fn test_is_cycle_expired_false_before_deadline() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        // Deadline for cycle 0 = 604800; now = 604799
        assert_eq!(is_cycle_expired(&g, 0, 604799, 0).unwrap(), false);
    }

    #[test]
    fn test_is_cycle_expired_false_at_deadline() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        assert_eq!(is_cycle_expired(&g, 0, 604800, 0).unwrap(), false);
    }

    #[test]
    fn test_is_cycle_expired_true_after_deadline() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        assert_eq!(is_cycle_expired(&g, 0, 604801, 0).unwrap(), true);
    }

    #[test]
    fn test_is_cycle_expired_grace_period() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        // 60-second grace: deadline + 60 = 604860; now = 604850 → still active
        assert_eq!(is_cycle_expired(&g, 0, 604850, 60).unwrap(), false);
        // now = 604861 → expired
        assert_eq!(is_cycle_expired(&g, 0, 604861, 60).unwrap(), true);
    }

    // ── advance_group_cycle_logic ─────────────────────────────────────────

    #[test]
    fn test_advance_cycle_logic_success() {
        let env = Env::default();
        let mut g = make_group(&env, 3, 604800, 0);
        assert_eq!(g.current_cycle, 0);
        advance_group_cycle_logic(&env, &mut g).unwrap();
        assert_eq!(g.current_cycle, 1);
        assert!(g.is_active);
    }

    #[test]
    fn test_advance_cycle_logic_to_completion() {
        let env = Env::default();
        let mut g = make_group(&env, 2, 604800, 0);
        advance_group_cycle_logic(&env, &mut g).unwrap();
        advance_group_cycle_logic(&env, &mut g).unwrap();
        assert!(g.is_complete());
        assert!(!g.is_active);
    }

    #[test]
    fn test_advance_cycle_logic_error_when_complete() {
        let env = Env::default();
        let mut g = make_group(&env, 2, 604800, 0);
        g.current_cycle = 2;
        g.is_active = false;
        let err = advance_group_cycle_logic(&env, &mut g).unwrap_err();
        assert_eq!(err, StellarSaveError::InvalidState);
    }

    #[test]
    fn test_advance_cycle_logic_preserves_config() {
        let env = Env::default();
        let mut g = make_group(&env, 4, 604800, 0);
        let orig_amount = g.contribution_amount;
        let orig_duration = g.cycle_duration;
        advance_group_cycle_logic(&env, &mut g).unwrap();
        assert_eq!(g.contribution_amount, orig_amount);
        assert_eq!(g.cycle_duration, orig_duration);
    }

    #[test]
    fn test_advance_cycle_logic_full_progression() {
        let env = Env::default();
        let mut g = make_group(&env, 4, 604800, 0);
        for expected in 1u32..=4 {
            advance_group_cycle_logic(&env, &mut g).unwrap();
            assert_eq!(g.current_cycle, expected);
        }
        assert!(g.is_complete());
    }

    // ── get_cycle_deadline ────────────────────────────────────────────────

    #[test]
    fn test_get_cycle_deadline_cycle_0() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        assert_eq!(get_cycle_deadline(&g, 0).unwrap(), 604800);
    }

    #[test]
    fn test_get_cycle_deadline_cycle_1() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 0);
        assert_eq!(get_cycle_deadline(&g, 1).unwrap(), 604800 * 2);
    }

    #[test]
    fn test_get_cycle_deadline_with_offset_start() {
        let env = Env::default();
        let g = make_group(&env, 4, 604800, 1_000_000);
        assert_eq!(get_cycle_deadline(&g, 0).unwrap(), 1_000_000 + 604800);
    }
}
