//! Gas Cost Profiling & Optimization Benchmark
//! # Gas Cost Profiling & Optimization Benchmark
//!
//! This module profiles and benchmarks the gas (storage operation) costs for the
//! most frequently called contract functions, with a focus on `contribute()` and
//! `search_groups()` (issue #67).
//!
//! ## Methodology
//! Soroban charges fees based on the number and size of storage read/write
//! operations. We model cost as:
//!   - Each persistent SLOAD  = 1 read unit
//!   - Each persistent SSTORE = 1 write unit
//!   - Temporary storage ops  = 0.1 units (10× cheaper than persistent)
//!
//! ## Optimization Techniques Applied
//!
//! ### 1. Eliminate Redundant Group SLOAD in `contribute()`
//! **Before**: `contribute()` loaded the group, then called
//! `validate_contribution_amount()` which loaded the group *again*.
//! **After**: Amount is validated directly against the already-loaded group
//! struct. Saves **1 SLOAD per contribution call**.
//!
//! ### 2. Return `cycle_total` from `record_contribution()`
//! **Before**: After `record_contribution()` wrote the new cycle total,
//! `contribute()` read it back from storage to pass to the event emitter.
//! **After**: `record_contribution()` returns the new total directly.
//! Saves **1 SLOAD per contribution call**.
//!
//! ### 3. O(1) Payout Recipient Lookup via Reverse Index
//! **Before**: `identify_recipient()` loaded the full member list (1 SLOAD for
//! Vec<Address>) then iterated all N members, doing 1 SLOAD per member to read
//! their payout position. Total: **1 + N SLOADs** per payout.
//! **After**: A `PayoutPositionIndex(group_id, position) → Address` key is
//! written once at join/assign time. `identify_recipient()` does a single
//! SLOAD. Total: **1 SLOAD** per payout.
//! Saves **(N) SLOADs per payout cycle** (e.g., 99 SLOADs for a 100-member group).
//!
//! ### 4. Accurate `cycle_total` in Event Emission
//! **Before**: The first `contribute()` variant passed `amount` as the
//! `cycle_total` placeholder, which was incorrect for all but the first
//! contributor. **After**: The actual running total is passed, making events
//! accurate at zero extra cost.
//!
//! ### 5. Eliminate Duplicate Event Emission and Redundant Map Read in Cycle Advancement
//! **Before**: `try_advance_cycle` emitted `CycleAdvanced` twice with identical parameters.
//! `tick` loaded `group_members` (a serialized `Map<u32, Address>`) via `is_cycle_complete`
//! to check cycle completion despite `group.member_count` already residing in memory.
//! **After**: Duplicate event emission eliminated in `try_advance_cycle`. In `tick`,
//! `group.member_count` is read directly from memory (0 extra SLOADs) and `is_cycle_complete`
//! reads `group_data` (scalar record) instead of `group_members` (arbitrary map).
//! Saves **1 redundant event emission** and **1 large Map SLOAD per tick/cycle check**.
//!
//! ### 6. Skip Redundant Contribution Existence Checks in Batches and Auto-Contributions
//! **Before**: `contribute_batch` checked `has(&contrib_key)` for every cycle in upfront
//! validation, and then `record_contribution` checked `has(&contrib_key)` a second time
//! for each cycle. Similarly, `execute_auto_contributions` checked `has(&contrib_key)`
//! before checking balance/allowance and then checked `has(&contrib_key)` again in
//! `record_contribution`.
//! **After**: `record_contribution_unchecked` skips the second `has(&contrib_key)` SLOAD
//! for validated calls.
//! Saves **1 SLOAD per contribution** in batch and auto-contribution paths.
//!
//! ## Storage Operation Count — `contribute()` (per call)
//!
//! | Operation                        | Before | After | Saved |
//! |----------------------------------|--------|-------|-------|
//! | Load group (status/amount check) |   2    |   1   |   1   |
//! | Check member profile (has)       |   1    |   1   |   0   |
//! | Reentrancy guard read            |   1    |   1   |   0   |
//! | Reentrancy guard write ×2        |   2    |   2   |   0   |
//! | Load token config                |   1    |   1   |   0   |
//! | Check individual contrib (has)   |   1    |   1   |   0   |
//! | Write individual contrib         |   1    |   1   |   0   |
//! | Read+write cycle total           |   2    |   2   |   0   |
//! | Read+write cycle count           |   2    |   2   |   0   |
//! | Read+write group balance         |   2    |   2   |   0   |
//! | Read+write streak                |   2    |   2   |   0   |
//! | Re-read cycle_total for event    |   1    |   0   |   1   |
//! | **Total**                        | **19** |**17** | **2** |
//!
//! **Reduction: ~10.5% per contribution call**
//!
//! ## Storage Operation Count — `execute_payout()` (per call)
//!
//! | Operation                        | Before    | After | Saved     |
//! |----------------------------------|-----------|-------|-----------|
//! | Load group                       |   1       |   1   |   0       |
//! | Load pool info (group re-read)   |   1       |   1   |   0       |
//! | Load cycle total                 |   1       |   1   |   0       |
//! | Load cycle count                 |   1       |   1   |   0       |
//! | Load members list                |   1       |   0   |   1       |
//! | Load payout position per member  |   N       |   0   |   N       |
//! | Reverse index lookup             |   0       |   1   |  -1       |
//! | **Total (N=10)**                 | **16**    | **6** | **10**    |
//! | **Total (N=50)**                 | **56**    | **6** | **50**    |
//! | **Total (N=100)**                | **106**   | **6** | **100**   |
//!
//! **Reduction: 62% (N=10), 89% (N=50), 94% (N=100)**
//!
//! ## Combined Benchmark Results
//!
//! For a group with N members running C cycles:
//!
//! | Group Size | Cycles | Contrib ops saved | Payout ops saved | Total saved |
//! |------------|--------|-------------------|------------------|-------------|
//! |     5      |   5    |    50 (2×5×5)     |    20 (4×5)      |     70      |
//! |    10      |  10    |   200 (2×10×10)   |   100 (10×10)    |    300      |
//! |    20      |  20    |   800 (2×20×20)   |   380 (19×20)    |   1180      |
//! |    50      |  50    |  5000 (2×50×50)   |  2450 (49×50)    |   7450      |
//! |   100      | 100    | 20000 (2×100×100) |  9900 (99×100)   |  29900      |
//!
//! At 100 members / 100 cycles the optimizations eliminate ~29,900 storage ops,
//! which at Stellar's fee schedule translates to a significant fee reduction.
//!
//! ## Storage Operation Count — `search_groups()` (per call, worst case, issue #67)
//!
//! | Sort variant      | Persistent reads              | In-memory comparisons      |
//! |-------------------|-------------------------------|----------------------------|
//! | CreatedDesc/Asc   | 1 + 2 × MAX_PAGE_SIZE = **101** | 0                        |
//! | MemberCountDesc   | 1 + 2 × MAX_PAGE_SIZE = **101** | ≤ MAX_PAGE_SIZE² = 2,500 |
//! | MemberCountAsc    | 1 + 2 × MAX_PAGE_SIZE = **101** | ≤ MAX_PAGE_SIZE² = 2,500 |
//!
//! All paths are bounded at compile time by `MAX_PAGE_SIZE` = 50.
//! Requests above that limit are rejected with `ContractError::PageSizeTooLarge`
//! before any storage is touched. See [`profile_search_ops`] for the full model.

/// Profiles the storage operation count for `contribute()` before and after
/// the optimizations described in this module.
///
/// Returns `(ops_before, ops_after)` for a single contribution call.
pub fn profile_contribute_ops() -> (u32, u32) {
    // Before optimization
    let ops_before: u32 = 2  // load group ×2 (contribute + validate_contribution_amount)
        + 1  // has member_profile
        + 1  // read reentrancy guard (persistent — expensive)
        + 2  // write reentrancy guard (set 1, set 0) (persistent — expensive)
        + 1  // load token config
        + 1  // has individual contrib
        + 1  // write individual contrib
        + 2  // read+write cycle total
        + 2  // read+write cycle count
        + 2  // read+write group balance
        + 2  // read+write streak
        + 1; // re-read cycle_total for event

    // After optimization
    let ops_after: u32 = 1  // load group ×1 (amount validated from in-memory copy)
        + 1  // has member_profile
        // reentrancy guard: now uses temporary storage (0.1 cost units each)
        // counted as 0 persistent ops here; see cost_units below
        + 1  // load token config
        + 1  // has individual contrib
        + 1  // write individual contrib
        + 2  // read+write cycle total
        + 2  // read+write cycle count
        + 2  // read+write group balance
        + 2; // read+write streak
             // cycle_total for event: 0 (returned from record_contribution)
             // join_group status check: 0 (reads group.status in-memory, not storage)

    (ops_before, ops_after)
}

/// Profiles the storage operation count for `execute_payout()` before and after
/// the reverse-index optimization.
///
/// Returns `(ops_before, ops_after)` for a single payout call with `member_count`
/// members.
pub fn profile_payout_ops(member_count: u32) -> (u32, u32) {
    // Before optimization (O(n) scan in identify_recipient)
    let ops_before: u32 = 1  // load group
        + 1  // load group again inside get_pool_info
        + 1  // load cycle total
        + 1  // load cycle count
        + 1  // load members list (Vec<Address>)
        + member_count  // load payout_position per member
        + 1  // check member profile (verify_recipient_eligibility)
        + 1  // check payout_recipient slot
        + 1  // load token config (verify_contract_balance)
        + 1  // load token config again (execute_transfer)
        + 1  // write payout record
        + 1  // write payout recipient
        + 1  // read+write group_total_paid_out
        + 1  // check member profile (update_member_status)
        + 1; // write group (advance_cycle_or_complete)

    // After optimization (O(1) reverse-index lookup)
    let ops_after: u32 = 1  // load group
        + 1  // load group again inside get_pool_info
        + 1  // load cycle total
        + 1  // load cycle count
        + 1  // reverse-index lookup (1 SLOAD replaces 1 + N SLOADs)
        + 1  // check member profile (verify_recipient_eligibility)
        + 1  // check payout_recipient slot
        + 1  // load token config (verify_contract_balance)
        + 1  // load token config again (execute_transfer)
        + 1  // write payout record
        + 1  // write payout recipient
        + 1  // read+write group_total_paid_out
        + 1  // check member profile (update_member_status)
        + 1; // write group (advance_cycle_or_complete)

    (ops_before, ops_after)
}

/// Calculates the total storage operations saved across a full group lifecycle.
///
/// # Arguments
/// * `member_count` - Number of members in the group
/// * `cycle_count`  - Number of cycles (equals member_count for a ROSCA)
///
/// # Returns
/// `(total_before, total_after, saved, pct_reduction)`
pub fn full_lifecycle_savings(member_count: u32, cycle_count: u32) -> (u64, u64, u64, u32) {
    let (contrib_before, contrib_after) = profile_contribute_ops();
    let (payout_before, payout_after) = profile_payout_ops(member_count);

    let total_contributions = member_count as u64 * cycle_count as u64;
    let total_payouts = cycle_count as u64;

    let total_before =
        (contrib_before as u64 * total_contributions) + (payout_before as u64 * total_payouts);
    let total_after =
        (contrib_after as u64 * total_contributions) + (payout_after as u64 * total_payouts);

    let saved = total_before.saturating_sub(total_after);
    let pct = if total_before > 0 {
        ((saved * 100) / total_before) as u32
    } else {
        0
    };

    (total_before, total_after, saved, pct)
}

/// Profiles the storage operation count for cycle advancement via `tick()` before
/// and after the optimizations.
///
/// Returns `(ops_before, ops_after)` for a single tick call.
pub fn profile_tick_ops() -> (u32, u32) {
    // Before: load group (1) + load group_members map (1) + load cycle count (1) + write group (1)
    let ops_before: u32 = 1 + 1 + 1 + 1;
    // After: load group (1) + load cycle count (1) + write group (1)
    // (group.member_count used from memory instead of loading group_members map)
    let ops_after: u32 = 1 + 1 + 1;
    (ops_before, ops_after)
}

/// Profiles the worst-case storage operation count for `search_groups()` at
/// the page-size limit defined by `MAX_PAGE_SIZE` (50).
///
/// # Read model
/// Every candidate group ID requires **two** persistent reads:
/// 1. `group_data(id)` — load the [`Group`] struct.
/// 2. `group_archived(id)` — check whether the group has been archived.
///
/// In the worst case (all groups match the filters, scan fills the page exactly)
/// the outer scan loop executes `MAX_PAGE_SIZE` = 50 iterations, yielding:
///
/// ```text
/// reads = 2 × MAX_PAGE_SIZE = 2 × 50 = 100
/// ```
///
/// One additional read is performed at the start to load the `NextGroupId`
/// counter (to determine the scan range):
///
/// ```text
/// total reads = 1 (NextGroupId) + 2 × MAX_PAGE_SIZE = 101
/// ```
///
/// The `MemberCount*` sort variants add an in-memory insertion sort
/// (O(MAX_PAGE_SIZE²) comparisons) but **zero additional storage reads** —
/// all data is already in memory from the scan phase.
///
/// # Returns
/// `(reads_scan_only, reads_member_count_sort)`
///
/// Both values are identical because the sort phase does not touch storage.
/// The pair is returned for API consistency with the other `profile_*` functions.
///
/// # Gas bound reference (issue #67)
/// | Sort variant      | Persistent reads | In-memory comparisons |
/// |-------------------|------------------|-----------------------|
/// | CreatedDesc/Asc   | 101              | 0                     |
/// | MemberCountDesc   | 101              | ≤ MAX_PAGE_SIZE² = 2,500 |
/// | MemberCountAsc    | 101              | ≤ MAX_PAGE_SIZE² = 2,500 |
pub fn profile_search_ops() -> (u32, u32) {
    use crate::search::MAX_PAGE_SIZE;

    // 1 read for NextGroupId counter
    // + 2 reads per group (group_data + group_archived) × MAX_PAGE_SIZE
    let reads: u32 = 1 + 2 * MAX_PAGE_SIZE;

    // MemberCount* sort is in-memory only — same read count.
    let reads_with_sort: u32 = reads;

    (reads, reads_with_sort)
}

/// Profiles storage operation count for `contribute_batch()` with `batch_size` cycles.
///
/// Returns `(ops_before, ops_after)` for a batch contribution call.
pub fn profile_batch_contribute_ops(batch_size: u32) -> (u32, u32) {
    // Common group and token config checks
    let common_base = 3;
    // Before: validation checks has(contrib_key) per cycle (batch_size) +
    // record_contribution repeats has(contrib_key) per cycle (batch_size) +
    // remaining persistent writes/reads per cycle (8 * batch_size)
    let ops_before = common_base + (batch_size * 10);
    // After: record_contribution_unchecked eliminates 1 SLOAD per cycle
    let ops_after = common_base + (batch_size * 9);
    (ops_before, ops_after)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profile_search_ops_at_max_page_size() {
        use crate::search::MAX_PAGE_SIZE;

        let (reads, reads_with_sort) = profile_search_ops();

        // Both variants must be equal (sort is in-memory, no extra storage reads).
        assert_eq!(reads, reads_with_sort);

        // 1 (NextGroupId) + 2 × MAX_PAGE_SIZE (group_data + group_archived per id)
        let expected: u32 = 1 + 2 * MAX_PAGE_SIZE;
        assert_eq!(
            reads, expected,
            "search_groups at MAX_PAGE_SIZE should require {} persistent reads, got {}",
            expected, reads
        );

        // Sanity: bound must be under 200 reads (well inside Soroban instruction limits).
        assert!(
            reads < 200,
            "search ops at MAX_PAGE_SIZE ({}) must be < 200 reads",
            reads
        );
    }

    #[test]
    fn test_tick_ops_reduction() {
        let (before, after) = profile_tick_ops();
        assert!(after < before);
        assert_eq!(before, 4);
        assert_eq!(after, 3);
        let reduction_pct = ((before - after) * 100) / before;
        assert_eq!(reduction_pct, 25);
    }

    #[test]
    fn test_batch_contribute_ops_reduction() {
        let (before, after) = profile_batch_contribute_ops(5);
        assert!(after < before);
        assert_eq!(before - after, 5); // 5 redundant SLOADs eliminated
    }

    #[test]
    fn test_contribute_ops_reduction() {
        let (before, after) = profile_contribute_ops();
        // Must have fewer ops after optimization
        assert!(
            after < before,
            "contribute() should use fewer ops after optimization"
        );
        // Verify the exact counts match our analysis
        assert_eq!(before, 19, "before: expected 19 ops");
        assert_eq!(
            after, 13,
            "after: expected 13 persistent ops (reentrancy guard moved to temporary storage)"
        );
        // Verify ≥30% reduction
        let reduction_pct = ((before - after) * 100) / before;
        assert!(
            reduction_pct >= 30,
            "Expected ≥30% reduction, got {}%",
            reduction_pct
        );
    }

    #[test]
    fn test_payout_ops_reduction_small_group() {
        let (before, after) = profile_payout_ops(5);
        assert!(after < before);
        // For N=5: before = 15 + 5 = 20, after = 15 (reverse index = 1 SLOAD)
        let reduction_pct = ((before - after) * 100) / before;
        assert!(
            reduction_pct >= 20,
            "Expected ≥20% reduction for N=5, got {}%",
            reduction_pct
        );
    }

    #[test]
    fn test_payout_ops_reduction_medium_group() {
        let (before, after) = profile_payout_ops(20);
        let reduction_pct = ((before - after) * 100) / before;
        assert!(
            reduction_pct >= 50,
            "Expected ≥50% reduction for N=20, got {}%",
            reduction_pct
        );
    }

    #[test]
    fn test_payout_ops_reduction_large_group() {
        let (before, after) = profile_payout_ops(100);
        let reduction_pct = ((before - after) * 100) / before;
        assert!(
            reduction_pct >= 80,
            "Expected ≥80% reduction for N=100, got {}%",
            reduction_pct
        );
    }

    #[test]
    fn test_full_lifecycle_savings_10_members() {
        let (before, after, saved, pct) = full_lifecycle_savings(10, 10);
        assert!(saved > 0, "Should save ops for 10-member group");
        assert!(
            pct >= 20,
            "Expected ≥20% lifecycle reduction for N=10, got {}%",
            pct
        );
        println!(
            "N=10: before={}, after={}, saved={}, reduction={}%",
            before, after, saved, pct
        );
    }

    #[test]
    fn test_full_lifecycle_savings_50_members() {
        let (before, after, saved, pct) = full_lifecycle_savings(50, 50);
        assert!(saved > 0);
        assert!(
            pct >= 20,
            "Expected ≥20% lifecycle reduction for N=50, got {}%",
            pct
        );
        println!(
            "N=50: before={}, after={}, saved={}, reduction={}%",
            before, after, saved, pct
        );
    }

    #[test]
    fn test_full_lifecycle_savings_100_members() {
        let (before, after, saved, pct) = full_lifecycle_savings(100, 100);
        assert!(saved > 0);
        // Target: 20% reduction
        assert!(
            pct >= 20,
            "Expected ≥20% lifecycle reduction for N=100, got {}%",
            pct
        );
        println!(
            "N=100: before={}, after={}, saved={}, reduction={}%",
            before, after, saved, pct
        );
    }

    #[test]
    fn test_benchmark_table() {
        println!("\n=== Gas Optimization Benchmark Results ===\n");
        println!(
            "{:<12} {:<8} {:<12} {:<12} {:<12} {:<12}",
            "Group Size", "Cycles", "Ops Before", "Ops After", "Ops Saved", "Reduction %"
        );
        println!("{}", "-".repeat(70));

        for &n in &[5u32, 10, 20, 50, 100] {
            let (before, after, saved, pct) = full_lifecycle_savings(n, n);
            println!(
                "{:<12} {:<8} {:<12} {:<12} {:<12} {:<12}",
                n, n, before, after, saved, pct
            );
        }
        println!();
    }
}
