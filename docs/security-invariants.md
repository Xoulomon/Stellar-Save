# Smart Contract Security Model & Invariants Reference

This is the authoritative reference for the Stellar-Save contract's trust boundaries and
formal invariants. It complements [threat-model.md](threat-model.md), which covers attack
vectors and mitigations in narrative form — this document enumerates the trust boundaries
for every privileged role and maps each guaranteed invariant to the test(s) that protect it.

---

## 1. Trust Boundaries

The contract defines roles via the `Role` enum in
[`security.rs`](../contracts/stellar-save/src/security.rs). There is no governor, guardian,
or oracle role in the current contract — contribution amounts are fixed and no price feed
is consulted (see [threat-model.md §3](threat-model.md#3-out-of-scope)). The privileged
roles that do exist are:

| Role | Capability | Trust boundary | Enforced by |
|---|---|---|---|
| **Contract Admin** (`Role::ContractAdmin`) | Pause/unpause the entire contract | Single address set at deployment; not multisig-enforced on-chain. Production deployments should use a multisig or governed address (see [threat-model.md §2.8](threat-model.md#28-emergency-pause-abuse)). | `AuthorizationChecker::require_contract_admin` |
| **Group Creator** (`Role::GroupCreator`) | Pause/resume/cancel their own group, assign payout positions | Scoped to the group they created; cannot touch other groups or move funds out of turn. | `AuthorizationChecker::require_group_creator` |
| **Group Member** (`Role::GroupMember`) | Contribute, receive payout at their assigned position | Scoped to groups they have joined. | `AuthorizationChecker::require_group_member` |
| **Token Contract** (SEP-41 / native XLM) | Executes `transfer` on behalf of the contract | External dependency, partially trusted — see [threat-model.md §2.7](threat-model.md#27-malicious-token-contract). | Reentrancy guard + (optional) allowlist |
| **Public / unauthenticated caller** (`Role::Public`) | None | No state-mutating capability. | Default-deny: every sensitive entrypoint requires a matched role. |

Every privileged call site validates the caller's identity via Soroban's
`require_auth()` *and* an explicit role/ownership comparison (e.g.
`caller == group.creator`) before mutating state — see
[threat-model.md §1](threat-model.md#1-trust-model) for the full caller-identity model.

---

## 2. Core Invariants

Each row is an invariant the contract guarantees, the code that enforces it, and the
test(s) that protect it from regressing.

| # | Invariant | Enforced in | Protecting test(s) |
|---|---|---|---|
| 1 | A token transfer cannot be re-entered while a payout is in flight | `payout_executor.rs` (`ReentrancyGuard`) | `test_execute_payout_reentrancy_detected`, `test_transfer_payout_reentrancy_protection`, `test_reentrancy_guard_key` |
| 2 | Only the contract admin can pause/unpause the contract | `security.rs` | `test_require_contract_admin_success`, `test_require_contract_admin_failure`, `test_check_authorization_pause_contract` |
| 3 | Only a group's creator can pause/resume/cancel that group | `security.rs` | `test_require_group_creator_success`, `test_require_group_creator_failure`, `test_check_authorization_pause_group`, `test_check_authorization_pause_group_unauthorized` |
| 4 | Only a group member can contribute to that group | `security.rs` | `test_require_group_member_success`, `test_require_group_member_failure`, `test_check_authorization_contribute`, `test_check_authorization_contribute_unauthorized` |
| 5 | A contribution must exactly match the group's configured `contribution_amount` | `contribution.rs` | `test_invalid_amount` |
| 6 | A payout amount can never be calculated as zero or negative | `payout_executor.rs` | `test_calculate_payout_amount_zero`, `test_calculate_payout_amount_negative` |
| 7 | Pool total calculations cannot silently overflow `i128` | `pool.rs` | `test_calculate_total_pool_overflow` |
| 8 | A recorded payout cannot be zero, negative, or re-recorded for an already-paid cycle | `payout_executor.rs` | `test_record_payout_validation`, `test_record_payout_zero_amount`, `test_record_payout_negative_amount` |
| 9 | Group lifecycle transitions follow the state machine (Pending → Active → Paused/Completed/Cancelled); invalid transitions are rejected | `status.rs`, `group.rs` | `test_valid_transitions_from_pending`, `test_valid_transitions_from_active`, `test_valid_transitions_from_paused`, `test_transition_to_success`, `test_transition_to_failure`, `test_full_lifecycle_with_pause`, `test_group_status_transitions` |
| 10 | `emergency_withdraw` only succeeds for an existing member of a stalled, non-completed group, and removes their membership on success | `lib.rs` | `test_emergency_withdraw_not_member`, `test_emergency_withdraw_group_complete`, `test_emergency_withdraw_not_stalled`, `test_emergency_withdraw_success`, `test_emergency_withdraw_removes_member` |
| 11 | Ed25519 signature verification rejects malformed payloads, keys, or signatures | `security.rs` | `test_rejects_empty_payload`, `test_rejects_short_public_key`, `test_rejects_long_public_key`, `test_rejects_short_signature`, `test_rejects_long_signature`, `test_rejects_all_zero_lengths`, `test_valid_ed25519_signature_returns_true`, `test_invalid_ed25519_signature_panics` |

> Invariants discussed narratively in the threat model (e.g. emergency-pause scope,
> allowlisted tokens) that do not yet have a dedicated regression test are intentionally
> excluded from this table rather than listed without proof. If you add enforcement for
> one of those, add it here together with its test.

---

## 3. Keeping this in sync

- New privileged roles must be added to the [Trust Boundaries](#1-trust-boundaries) table.
- New invariants must be added to the [Core Invariants](#2-core-invariants) table with at
  least one protecting test before being claimed here.
- This document is linked from [threat-model.md](threat-model.md); update both when the
  trust model changes.
