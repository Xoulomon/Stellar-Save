# Checks-Effects-Interactions Audit

Issue #1516. Reviews every state mutation in `contracts/stellar-save/src`
relative to a cross-contract call, and records the ordering each call site now
enforces.

## Why this matters on Soroban

Soroban has no classic reentrancy primitive, and a trapped invocation reverts the
whole transaction atomically. That removes the "partial write survives the
revert" class of bug, but not the one that matters here: **the group's token
contract is caller-supplied**. It is chosen at `create_group` time and is
whatever address the creator passed. Every `transfer` / `transfer_from` therefore
hands control to code the protocol does not own, and that code can call straight
back into Stellar-Save.

What a reentrant call sees is whatever the outer call had already committed. The
duplicate guards this contract relies on are all storage-presence checks:

| Guard | Key |
|---|---|
| Refund already issued | `REFUND_{group}_{cycle}_{member}` |
| Member already contributed | `CONTRIB_{group}_{cycle}_{member}` |
| Payout already made for cycle | `PAYOUT_RECIPIENT_{group}_{cycle}` |

If the write that sets one of those keys happens *after* the token call, the
guard reads pre-transfer state during reentry and lets the duplicate through.
That is the defect this audit closes: effects are now committed before the
interaction, everywhere.

## Cross-contract call sites

Every outbound call in the contract, and its ordering verdict.

| # | Call site | External call | Before | After |
|---|---|---|---|---|
| 1 | `refund.rs::request_refund` | `token.transfer` | transfer, **then** write `RefundRecord` | write `RefundRecord` + emit, **then** transfer |
| 2 | `payout_executor.rs::execute_payout` | `token.transfer` (via `execute_transfer`) | transfer, **then** record payout, counter, member status, cycle advance | all effects committed, **then** transfer, **then** release guard |
| 3 | `contract.rs::contribute` | `token.transfer_from` | transfer, guard released, **then** record | record, **then** transfer, **then** release guard |
| 4 | `contract.rs::contribute_batch` | `token.transfer_from` | transfer, **then** record every cycle | record every cycle, **then** transfer, **then** emit |
| 5 | `contract.rs::execute_auto_contributions` | `token.transfer_from` per member | transfer, **then** record | record, **then** transfer |
| 6 | `contract.rs::create_group` | `token.decimals` (via `token::validate_token`) | already compliant | unchanged |
| 7 | `contract.rs::execute_auto_contributions` | `token.balance`, `token.allowance` | already compliant | unchanged |

`penalty.rs` moves no funds of its own: its doc comment states the caller has
already transferred, and the module only adjusts pool accounting. `token.rs`
performs a read-only `decimals()` probe.

## Findings

### 1. `request_refund` paid out before recording the refund (critical)

The `AlreadyRefunded` guard reads `REFUND_{group}_{cycle}_{member}`, but that key
was written after `token.transfer` returned. A token that called
`request_refund` back during its own `transfer` found the key absent, passed the
guard, and drained one contribution per reentry until the contract balance ran
out. This function has no reentrancy guard of its own, so ordering was the only
defence.

**Fix:** the `RefundRecord` is persisted and the `RefundIssued` event emitted
before the transfer. The token config is loaded during the checks phase so a
misconfigured group still fails before any write.

### 2. `execute_payout` transferred before settling the cycle (critical)

`execute_transfer` ran at step 9, ahead of `record_payout`, the incremental
paid-out counter, `update_member_status` and `advance_cycle_or_complete`. The
per-group `payout_in_progress` flag did block a reentrant `execute_payout`, so
this was defence-in-depth rather than an open drain, but the contract's own
duplicate check (`has(&recipient_key)`) was reading stale state and the ordering
contradicted the "EXECUTION PHASE" comment above it.

**Fix:** all five effects are committed first; `execute_transfer` runs last; the
`payout_in_progress` guard is now released *after* the external call returns
rather than before, so it is genuinely held for the duration of the interaction.

### 3. `contribute` released its guard before recording (high)

The temporary-storage reentrancy guard was cleared *before*
`record_contribution` ran, and the transfer happened before both. A reentrant
`contribute` arriving during `transfer_from` therefore met neither the guard nor
the contribution key.

**Fix:** record first, transfer second, release the guard only after the token
call returns. A redundant write of the guard key into *persistent* storage was
also dropped: the guard is read from temporary storage, so that write set a key
nothing ever read.

### 4. `contribute_batch` had no guard and recorded after transferring (high)

The batch path validated every cycle, transferred the full total, then recorded.
It carries no reentrancy guard at all, so a reentrant batch passed the
`has(&contrib_key)` validation loop unchanged.

**Fix:** every cycle is recorded first; the single aggregate `transfer_from`
follows; `ContributionMade` events are emitted afterwards from the cycle totals
captured during the recording pass, so event content is unchanged.

### 5. `execute_auto_contributions` recorded after transferring (high)

Per member, step 4e transferred and step 4f recorded. Reentry during a member's
`transfer_from` hit the "already contributed" skip at 4b before it was true, so
the same member could be charged more than once in a cycle.

**Fix:** 4e and 4f are swapped - record, then transfer.

### 6. `create_group` (compliant, no change)

`token::validate_token` calls `decimals()` at step 5, ahead of the first state
mutation at step 6 (`generate_next_group_id`). Checks-effects-interactions is
already satisfied: the probe cannot observe partial group state because none
exists yet.

### 7. `execute_auto_contributions` balance/allowance probes (compliant, no change)

Steps 4c and 4d read `balance` and `allowance` before any write for that member.
Both are checks, and they sit in the checks phase.

## Behaviour that did not change

- No error codes were added, removed, or renumbered.
- No storage keys were added, removed, or re-encoded.
- Event types, ordering per call, and payloads are unchanged. In
  `contribute_batch` the events now fire after the transfer instead of
  interleaved with the recording loop, but the same events are emitted with the
  same values in the same relative order.
- Failure semantics are unchanged: a trapping token still reverts every effect
  written ahead of it, because Soroban rolls the whole invocation back.

## Regression coverage

`src/cei_tests.rs` registers a `ReentrantToken` - a minimal SEP-41 surface whose
`transfer` / `transfer_from` calls back into Stellar-Save - and asserts that the
reentrant call is rejected and exactly one record is written:

| Test | Guards |
|---|---|
| `refund_writes_its_record_before_calling_the_token` | Finding 1 - reentrant refund hits `AlreadyRefunded` |
| `a_second_refund_is_rejected_after_the_first_settles` | Finding 1 - the guard still works on the ordinary path |
| `contribute_records_before_calling_the_token` | Finding 3 - the guard is still held during `transfer_from` |
| `a_disarmed_token_leaves_the_happy_path_intact` | The reordering did not change ordinary behaviour |
