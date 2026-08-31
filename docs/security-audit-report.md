# Stellar-Save Smart Contract Security Audit Report

**Date:** 2026-05-29  
**Auditor:** Kiro AI  
**Scope:** `contracts/stellar-save/src/` — all contract modules  
**Commit:** HEAD at time of audit

---

## Executive Summary

A comprehensive manual security audit was performed on the Stellar-Save ROSCA smart contract. The audit covered authorization bypass vulnerabilities and arithmetic overflow/underflow risks across all contract modules.

**8 findings** were identified and fixed:

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 3     | ✅ 3  |
| High     | 3     | ✅ 3  |
| Medium   | 2     | ✅ 2  |

---

## Findings

---

### CRIT-01 — `activate_group()` Authorization Bypass (No-Op Auth Check)

**Severity:** Critical  
**File:** `src/lib.rs` — `activate_group()`  
**Status:** Fixed

**Description:**  
The original implementation created a *dummy* `Group` struct from hardcoded defaults instead of loading the real group from storage. The authorization check `assert!(creator == creator, ...)` always evaluates to `true` regardless of who calls the function, because it compares the argument to itself. Any caller could activate any group ID.

```rust
// VULNERABLE — before fix
pub fn activate_group(env: Env, group_id: u64, creator: Address, member_count: u32) {
    assert!(creator == creator, "caller must be the group creator"); // always true!
    let mut group = Group::new(group_id, creator, 10_000_000, 604800, 5, 2, timestamp, 0);
    // ...
}
```

**Impact:** Any address could activate any group, bypassing the minimum-member requirement and the creator-only restriction. This could allow premature activation of groups that haven't reached quorum.

**Fix:** Load the group from persistent storage, call `creator.require_auth()`, and verify `group.creator == creator` before proceeding. The updated group is persisted back to storage.

---

### CRIT-02 — `transfer_payout()` Exposed as Public with No Caller Authorization

**Severity:** Critical  
**File:** `src/lib.rs` — `transfer_payout()`  
**Status:** Fixed

**Description:**  
`transfer_payout()` was declared `pub fn`, making it a callable contract entry point. It accepted arbitrary `group_id`, `recipient`, `amount`, and `cycle_number` parameters. Although it performed internal validation (group status, recipient eligibility, amount matching), the function could be called by any external account, bypassing the intended `execute_payout()` orchestration flow.

**Impact:** An attacker could attempt to trigger payout state changes out of sequence, potentially causing double-payout records or corrupting cycle state if validation gaps existed.

**Fix:** Changed `pub fn transfer_payout` to `fn transfer_payout` (private). The function is now only callable internally by `execute_payout()` via `payout_executor.rs`.

---

### CRIT-03 — `emergency_withdraw()` Deletes Member Profile Without Transferring Tokens

**Severity:** Critical  
**File:** `src/lib.rs` — `emergency_withdraw()`  
**Status:** Fixed

**Description:**  
The function calculated the withdrawal amount and emitted an event, but never executed the actual token transfer. It then deleted the member's profile from storage. Members invoking emergency withdrawal would lose their profile (and thus their group membership and payout eligibility) while receiving no funds.

```rust
// VULNERABLE — before fix
if withdrawal_amount > 0 {
    env.events().publish(...); // event emitted
    // ← no token transfer here!
}
env.storage().persistent().remove(&withdrawal_key); // profile deleted
```

**Impact:** Loss of funds. Members who triggered emergency withdrawal would have their membership revoked without receiving their contributed tokens back.

**Fix:** Added the actual `token_client.transfer()` call before removing the member profile. The group balance counter is decremented accordingly. The profile removal now follows the transfer (checks-effects-interactions pattern).

---

### HIGH-01 — Reentrancy Guard Released Before State Changes Complete in `contribute()`

**Severity:** High  
**File:** `src/lib.rs` — `contribute()`  
**Status:** Fixed

**Description:**  
The reentrancy guard was released *before* `record_contribution()` was called. This means the guard was ineffective: a reentrant call could enter `contribute()` again after the token transfer but before the contribution was recorded in storage.

```rust
// VULNERABLE — before fix
token_client.transfer_from(...); // token transfer

env.storage().persistent().set(&reentrancy_key, &0u64); // guard released HERE

let cycle_total = Self::record_contribution(...)?; // state written AFTER guard released
```

**Impact:** A malicious SEP-41 token contract could reenter `contribute()` during `transfer_from`, allowing a member to contribute twice in the same cycle before the first contribution is recorded.

**Fix:** Moved the guard release to *after* `record_contribution()` completes, ensuring the guard covers the entire state-mutation window.

---

### HIGH-02 — `total_pool_amount()` Uses Unchecked Multiplication

**Severity:** High  
**File:** `src/group.rs` — `Group::total_pool_amount()`  
**Status:** Fixed

**Description:**  
The pool amount was calculated as `contribution_amount * max_members as i128` using the `*` operator, which wraps on overflow in release builds (Rust's `i128` overflow panics in debug but wraps in release with `--release`). With `contribution_amount` up to `i128::MAX / 20` and `max_members` up to 20, overflow is theoretically reachable.

**Impact:** Overflow would produce a wildly incorrect (potentially negative) pool amount, causing payouts to fail or transfer incorrect amounts.

**Fix:** Replaced with `checked_mul(...).expect("pool amount overflow")` and added a `checked_total_pool_amount() -> Option<i128>` variant for callers that need to handle overflow gracefully.

---

### HIGH-03 — `get_group_statistics()` Uses Unchecked Multiplication for `total_distributed`

**Severity:** High  
**File:** `src/lib.rs` — `get_group_statistics()`  
**Status:** Fixed

**Description:**  
`total_distributed` was computed as `(group.current_cycle as i128) * group.total_pool_amount()`, where `total_pool_amount()` itself was unchecked (see HIGH-02). Even after fixing HIGH-02, the outer multiplication remained unchecked.

**Impact:** Overflow in a view function would cause the statistics query to return incorrect data, potentially misleading off-chain tooling about group health.

**Fix:** Uses `group.checked_total_pool_amount()` and then `checked_mul` for the outer multiplication, returning `StellarSaveError::Overflow` on failure.

---

### MED-01 — `contribution_reminder_emitted()` Storage Key Collides with `contribution_proof_verified()`

**Severity:** Medium  
**File:** `src/storage.rs` — `StorageKeyBuilder::contribution_reminder_emitted()`  
**Status:** Fixed

**Description:**  
`contribution_reminder_emitted()` returned `StorageKey::Contribution(ContributionKey::ProofVerified(...))` — the same key variant used by `contribution_proof_verified()`. Any group with `require_contribution_proof = true` would have reminder flags and proof-verified flags sharing the same storage slot.

```rust
// VULNERABLE — before fix
pub fn contribution_reminder_emitted(group_id, cycle, address) -> StorageKey {
    StorageKey::Contribution(ContributionKey::ProofVerified(group_id, cycle, address))
    //                                         ^^^^^^^^^^^^ wrong variant!
}
```

**Impact:** Setting a reminder flag would overwrite the proof-verified flag (or vice versa). In groups requiring contribution proofs, a member who received a reminder could have their proof verification silently cleared, causing their subsequent `contribute_with_proof()` call to fail with `Unauthorized`.

**Fix:** Added a new `ContributionKey::ReminderEmitted(u64, u32, Address)` variant to `storage.rs` and updated `contribution_reminder_emitted()` to use it.

---

### MED-02 — `get_next_payout_cycle()` Overflows via `u32` Intermediate Before Cast to `u64`

**Severity:** Medium  
**File:** `src/lib.rs` — `get_next_payout_cycle()`  
**Status:** Fixed

**Description:**  
The cycle end time was computed by multiplying `cycle_multiplier: u32` by `group.cycle_duration as u32`, then casting the result to `u64`. If `cycle_multiplier * cycle_duration` exceeds `u32::MAX` (~4.3 billion), the `checked_mul` on `u32` returns `None` and the function returns `Overflow` — even though the result would fit in a `u64`.

```rust
// VULNERABLE — before fix
let next_cycle_end_time = cycle_multiplier          // u32
    .checked_mul(group.cycle_duration as u32)       // u32 × u32 — overflows at ~4.3B
    .map(|duration| duration as u64)
    .and_then(|duration| group.started_at.checked_add(duration))
    .ok_or(StellarSaveError::Overflow)?;
```

For a group with `cycle_duration = 2_592_000` (30 days) and `cycle_multiplier = 2000`, the product is `5.18 × 10^12`, which overflows `u32` but fits in `u64`.

**Impact:** `get_next_payout_cycle()` returns a spurious `Overflow` error for long-running groups, breaking UI countdown timers and off-chain scheduling.

**Fix:** Cast `cycle_multiplier` to `u64` before the multiplication so the arithmetic is performed in `u64` space throughout.

---

## Audit Methodology

The audit was performed by:

1. **Manual code review** of all `.rs` files in `contracts/stellar-save/src/`
2. **Authorization flow tracing** — every `pub fn` entry point was checked for `require_auth()` calls and correct identity verification
3. **Arithmetic analysis** — all multiplication and addition operations on financial amounts were checked for overflow potential
4. **Storage key analysis** — all `StorageKeyBuilder` methods were cross-referenced to detect collisions
5. **Reentrancy analysis** — all token transfer call sites were checked against guard placement

## Out of Scope / Acknowledged Issues

The following items were noted but are outside the scope of this audit or are accepted design decisions:

- **Reentrancy guard uses persistent storage** — Soroban temporary storage would be cheaper, but persistent storage is functionally correct. Optimization is a separate concern.
- **`execute_payout()` is permissionless** — Any caller can trigger a payout once conditions are met. This is an intentional design choice for the ROSCA model.
- **`randomize_payout_order()` entropy** — Ledger timestamp + PRNG is used as entropy. Validator manipulation is partially mitigated by the group ID salt, but a fully commit-reveal scheme would be stronger. Noted as a future improvement.
- **No rate limiting on group creation** — A spam-creation attack is possible. Mitigated by the protocol creation fee when configured.

## Recommendations

1. **Add integration tests** specifically covering the fixed scenarios (emergency withdrawal, activate_group auth, reentrancy in contribute).
2. **Consider using Soroban temporary storage** for the reentrancy guard to reduce ledger fees.
3. **Add a `MAX_CONTRIBUTION_AMOUNT` constant** to bound `total_pool_amount()` at the configuration level, preventing overflow at the source.
4. **Implement a commit-reveal scheme** for `randomize_payout_order()` to eliminate validator front-running risk.
