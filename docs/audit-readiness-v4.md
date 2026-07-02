# Smart Contract Audit Readiness Package — Stellar-Save v4.0

**Prepared for:** Third-party security auditors  
**Scope version:** v4.0 (escrow, governance, insurance, recovery)  
**Status:** Pre-audit — ready for engagement

---

## 1. Audit Boundary

### In Scope

All Rust source files under `contracts/stellar-save/src/` plus the workspace `Cargo.toml`:

| Module | Description |
|--------|-------------|
| `lib.rs` | Contract entry points and dispatcher |
| `group.rs` | Group lifecycle (create, join, activate, cancel) |
| `contribution.rs` | Member contribution logic and amount validation |
| `payout.rs` / `payout_executor.rs` | Payout rotation, escrow release, reentrancy guard |
| `pool.rs` | Pooled-balance accounting |
| `storage.rs` | On-chain key/value layout and TTL management |
| `migration.rs` | Contract upgrade and state migration path |
| `security.rs` | Emergency pause, admin controls |
| `penalty.rs` | Late-contribution penalties |
| `refund.rs` | Member refund on cancellation |
| `cycle_advancement.rs` | Cycle counter and deadline enforcement |
| `deadline.rs` | Grace-period and deadline primitives |
| `token.rs` | SEP-41 token interface wrapper |
| `errors.rs` | All `ContractError` variants |
| `events.rs` | Soroban event emission |

### Out of Scope

- Frontend (`frontend/`) and backend API (`backend/`) — separate review track
- Stellar Horizon / Soroban runtime itself
- Third-party libraries (soroban-sdk, stellar-access) — trust the published crates
- `fuzz_tests.rs`, `mutation_tests.rs`, `*_benchmark*.rs` — test-only code, not deployed

### Changed Entry Points Since v3.0

New or significantly modified public functions added for v4.0 scope:

- `escrow_deposit` / `escrow_release` — new escrow module
- `governance_vote` / `governance_execute` — on-chain parameter governance
- `insurance_claim` — insurance-pool withdrawal
- `recovery_initiate` / `recovery_finalize` — social-recovery key rotation

---

## 2. Invariants

The following properties must hold at all times. Auditors should verify each invariant is enforced across all execution paths.

### Financial Invariants

1. **Conservation of funds**: The sum of all member balances stored on-chain plus the contract escrow balance must equal the total amount deposited minus the total amount paid out.  
   `Σ member_deposits - Σ payouts_executed == escrow_balance`

2. **No double payout**: Each `(group_id, cycle_number)` pair can have at most one `PayoutKey::Status == Executed`.

3. **Contribution amount immutability**: `group.contribution_amount` cannot be modified after `GroupStatus::Active`.

4. **Payout ordering**: Payouts must follow the `payout_position` assignment order; no member may receive more than once per cycle.

5. **Reentrancy guard**: `CounterKey::ReentrancyGuard` must be `true` during any outbound token transfer and `false` at all other times.

### Access Control Invariants

6. **Creator-only operations**: `pause_group`, `unpause_group`, `cancel_group`, `assign_payout_positions`, `governance_execute` require `caller == group.creator`.

7. **Member-only operations**: `contribute`, `refund`, `insurance_claim` require `is_member(group_id, caller) == true`.

8. **Auth enforced first**: Every public function that modifies state calls `caller.require_auth()` before any storage read or write.

### State Machine Invariants

9. **Valid transitions only**:
   - `Pending → Active` (via `activate_group`)
   - `Active → Paused` (via `pause_group`)
   - `Paused → Active` (via `unpause_group`)
   - `Active → Completed` (automatically when all cycles done)
   - `Active | Paused → Cancelled` (via `cancel_group`)
   - No other transitions are permitted.

10. **Emergency pause**: When `CounterKey::EmergencyPause == true`, `contribute` and `execute_payout` must panic regardless of group state.

---

## 3. Test Coverage Report

Run the following to regenerate coverage before the audit:

```bash
cargo install cargo-tarpaulin --version 0.31.2
cargo tarpaulin --out Html --output-dir coverage-report/ \
  --manifest-path contracts/stellar-save/Cargo.toml
```

Coverage targets:

| Module | Target | Notes |
|--------|--------|-------|
| `group.rs` | ≥ 90 % | All state transitions |
| `payout.rs` / `payout_executor.rs` | ≥ 90 % | Reentrancy, double-payout |
| `contribution.rs` | ≥ 90 % | Amount validation, grace period |
| `security.rs` | ≥ 95 % | Pause/unpause, emergency |
| `migration.rs` | ≥ 85 % | Upgrade paths |
| Overall | ≥ 85 % | |

Existing test suites:
- `src/tests/` — unit tests per module
- `src/property_tests.rs` — property-based tests (via `proptest`)
- `src/fuzz_tests.rs` — fuzz corpus (run via `cargo fuzz`)
- `src/mutation_tests.rs` — mutation test hooks
- `src/upgrade_tests.rs` — contract migration tests

---

## 4. Known Risks and Mitigations

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Reentrancy via SEP-41 token callback | High | `CounterKey::ReentrancyGuard` + idempotent payout status | Mitigated |
| Front-running payout order | Low | Deterministic position-based rotation, no auction | Mitigated |
| Admin key compromise | High | Social recovery module (v4.0), emergency pause | Partial — recovery module is in-scope for audit |
| Malicious token contract | Medium | `AllowedTokens` allowlist enforced at contribution | Mitigated |
| Integer overflow in contribution math | High | Rust `overflow-checks = true` in release profile | Mitigated |
| Governance capture (51% attack) | Medium | Timelock + creator veto proposed — audit required | **Open** |
| Insurance pool drain via claim spam | Medium | Per-member claim limits — audit required | **Open** |

---

## 5. Engagement Checklist

- [ ] Share this document and the repository link with the auditor
- [ ] Grant auditor read access to the private repo (if applicable)
- [ ] Agree on scope hash / commit SHA to audit
- [ ] Provide auditor with a copy of `docs/threat-model.md`
- [ ] Provide auditor with `docs/storage-layout.md` for storage key reference
- [ ] Run `cargo tarpaulin` and share the HTML coverage report
- [ ] Run `cargo deny check` and resolve any advisories before engagement starts
- [ ] Create a private GitHub project board for finding triage
- [ ] Assign each finding a severity label and a remediation issue
- [ ] Re-audit or verify all High/Critical fixes before mainnet deploy

---

## 6. Finding Triage Process

When the auditor delivers the report:

1. Import each finding into a GitHub Issue with labels: `audit`, `severity:critical|high|medium|low|informational`
2. Assign each issue to the relevant module owner
3. Fix High/Critical findings first; do not deploy to mainnet with any unresolved Critical
4. For findings that are accepted risks (won't fix), add a `formally-accepted` label and document the rationale in the issue
5. Request a re-audit (or targeted review) for all High/Critical fixes
6. Publish the final audit report in `docs/audit-report-v4.md` once all findings are resolved or accepted

---

## 7. Useful References

- Threat model: `docs/threat-model.md`
- Storage layout: `docs/storage-layout.md`
- Contract API reference: `docs/contract-api-reference.md`
- Previous audit (v3.0 scope): `docs/security-audit-report.md`
- Gas optimization report: `contracts/stellar-save/GAS_OPTIMIZATION_REPORT.md`
- Soroban security best practices: https://developers.stellar.org/docs/smart-contracts/security
