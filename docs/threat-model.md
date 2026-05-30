# Threat Model & Security Assumptions

This document describes the security model for the Stellar-Save smart contract, a ROSCA (Rotating Savings and Credit Association) built on Stellar Soroban. It covers what the contract trusts, what it verifies, identified attack vectors and their mitigations, and what is explicitly out of scope.

---

## 1. Trust Model

### What the Contract Trusts

| Entity | Trust Level | Rationale |
|---|---|---|
| **Soroban runtime** | Full | The contract relies on the Soroban VM for correct execution, storage isolation, and cryptographic address verification. |
| **Stellar network consensus** | Full | Ledger finality and transaction ordering are assumed correct. |
| **Group creator** | Partial | Trusted to set fair group parameters at creation. Cannot steal funds; can only pause/resume/cancel their own group. |
| **Token contract (XLM / SEP-41)** | Partial | The contract calls `transfer` on the configured token. A malicious token contract could behave unexpectedly; only allowlisted tokens are accepted when `AllowedTokens` is configured. |

### What the Contract Verifies

- **Caller identity**: Every sensitive function calls `caller.require_auth()` via the Soroban SDK. The runtime enforces that the transaction is signed by the claimed address.
- **Role membership**: Group creator operations (`pause_group`, `unpause_group`, `cancel_group`, `assign_payout_positions`) compare `caller == group.creator` on-chain.
- **Member status**: Contribution and payout functions verify membership via `MemberKey::Profile` before proceeding.
- **Contribution amount**: The exact `contribution_amount` stored in the `Group` struct is enforced; any deviation panics with `InvalidContributionAmount`.
- **Payout eligibility**: The recipient's `payout_position` must match `group.current_cycle`; double-payouts are blocked by `PayoutKey::Status`.
- **Group state machine**: Operations are gated on `GroupStatus` (Pending → Active → Paused/Completed/Cancelled). Invalid transitions are rejected.
- **Reentrancy guard**: `CounterKey::ReentrancyGuard` is set before any token transfer and cleared after, preventing re-entrant calls.
- **Emergency pause**: `CounterKey::EmergencyPause` blocks contributions and payouts contract-wide when set by the admin.

---

## 2. Attack Vectors and Mitigations

### 2.1 Reentrancy

**Description**: A malicious token contract's `transfer` callback re-enters the Stellar-Save contract before state is finalized, potentially triggering a double-payout.

**Soroban context**: Unlike EVM, Soroban does not support arbitrary callbacks during token transfers for native XLM. For SEP-41 tokens, cross-contract calls are possible.

**Mitigation**:
- `CounterKey::ReentrancyGuard` (temporary storage) is written to `true` before any outbound token transfer and cleared after. A re-entrant call finds the guard set and panics with `ReentrancyDetected`.
- Payout status (`PayoutKey::Status`) is written to `Executed` before the token transfer, so even if the guard were bypassed, the payout would be rejected as already processed.

**Residual risk**: Low. Both the guard and the idempotency check must be bypassed simultaneously.

---

### 2.2 Front-Running / Transaction Ordering

**Description**: An observer sees a pending `execute_payout` transaction and submits a competing transaction to manipulate payout order or steal position.

**Soroban context**: Stellar does not have a public mempool in the same sense as Ethereum. Transactions are submitted directly to validators and included in the next ledger (~5 s). MEV-style reordering is significantly harder.

**Mitigation**:
- Payout rotation is deterministic and position-based (`payout_position == current_cycle`). There is no auction or bid mechanism that could be front-run.
- `assign_payout_positions` is creator-only and locked once the group is Active.
- No price-sensitive operations exist; contribution amounts are fixed.

**Residual risk**: Very low. No economic incentive for reordering exists given the fixed-rotation design.

---

### 2.3 Griefing / Denial of Service

**Description**: A malicious member deliberately withholds contributions to prevent the cycle from completing, blocking other members' payouts.

**Mitigation**:
- The optional penalty system (`MemberKey::PenaltyTotal`) financially disincentivises missed contributions.
- The group creator can `cancel_group` if the group is stalled, triggering the refund path.
- `emergency_withdraw` allows a member to exit a stalled group (defined as no payout for a configurable stall period) and reclaim their contributions.
- Grace periods (`grace_period_seconds`, max 7 days) give members a window to contribute late without blocking the cycle indefinitely.

**Residual risk**: Medium. A determined griefer can still delay cycles. Groups should use the penalty system and vet members before activation.

---

### 2.4 Unauthorized Payout Claim

**Description**: A non-eligible member calls `execute_payout` to claim funds out of turn.

**Mitigation**:
- `validate_payout_recipient` checks that `member.payout_position == group.current_cycle`.
- `PayoutKey::Status` prevents re-execution of an already-processed payout.
- `MemberKey::PayoutEligibility` tracks whether a member has already received their payout.

**Residual risk**: None under correct contract logic.

---

### 2.5 Integer Overflow / Underflow

**Description**: Arithmetic on contribution totals, balances, or cycle counts wraps around, corrupting state.

**Mitigation**:
- Rust's default arithmetic panics on overflow in debug mode and wraps in release mode. The contract uses `checked_add` / `checked_mul` for all balance arithmetic.
- Contribution amounts are validated against `ContractConfig` min/max bounds at group creation.
- `CounterKey::GroupBalance` and `CounterKey::GroupTotalPaidOut` use `i128` (Soroban token amount type), which has a 128-bit range sufficient for all realistic XLM amounts.

**Residual risk**: Very low.

---

### 2.6 Unauthorized Group Modification

**Description**: A non-creator modifies group parameters (contribution amount, cycle duration, member cap) after creation.

**Mitigation**:
- All group mutation functions (`pause_group`, `unpause_group`, `cancel_group`, `assign_payout_positions`) call `AuthorizationChecker::require_group_creator`, which compares `caller == group.creator` and returns `Unauthorized` on mismatch.
- Group configuration fields are immutable after the group transitions to Active status.

**Residual risk**: None under correct contract logic.

---

### 2.7 Malicious Token Contract

**Description**: A group is created with a token contract that behaves maliciously (e.g., re-entrancy, fake transfer success, fee-on-transfer).

**Mitigation**:
- The admin can configure `CounterKey::AllowedTokens` to restrict which token addresses are accepted.
- The reentrancy guard (§2.1) mitigates re-entrant token callbacks.
- Fee-on-transfer tokens may cause the contract to record a higher balance than actually received; groups should only use well-known tokens (XLM, USDC, EURC).

**Residual risk**: Medium if `AllowedTokens` is not configured. Low when restricted to audited tokens.

---

### 2.8 Emergency Pause Abuse

**Description**: The contract admin abuses `EmergencyPause` to freeze all groups indefinitely, preventing members from contributing or receiving payouts.

**Mitigation**:
- `emergency_withdraw` remains callable even when the contract is paused, allowing members to reclaim contributions from stalled groups.
- The admin key should be a multisig or governed address in production.

**Residual risk**: Low if admin key is properly secured. Members retain exit rights via emergency withdrawal.

---

### 2.9 Stale / Expired Storage

**Description**: Soroban temporary storage entries expire after their TTL. If `ReentrancyGuard` expires mid-transaction, the guard is ineffective.

**Mitigation**:
- `ReentrancyGuard` is set and cleared within the same transaction. Soroban temporary storage TTL is per-ledger; a single transaction cannot span ledgers, so expiry mid-transaction is not possible.

**Residual risk**: None.

---

## 3. Out of Scope

The following are explicitly **not** covered by the smart contract security model:

| Item | Reason |
|---|---|
| **Frontend / dApp security** | XSS, phishing, and wallet-draining attacks via the UI are outside contract scope. Users must verify contract addresses independently. |
| **Private key compromise** | If a user's or admin's private key is stolen, the contract cannot prevent unauthorized transactions. Use hardware wallets and multisig for high-value accounts. |
| **Stellar network-level attacks** | Eclipse attacks, validator collusion, or Stellar protocol bugs are outside the contract's control. |
| **Social engineering** | Members being coerced into joining malicious groups or sharing seed phrases is a human problem, not a contract problem. |
| **Oracle / price feeds** | Stellar-Save uses fixed contribution amounts in a single token; no price oracle is used. Token price volatility is a user risk. |
| **Regulatory compliance** | KYC/AML obligations depend on jurisdiction and are the responsibility of group operators, not the contract. |
| **Off-chain coordination** | Disputes between members that do not involve on-chain funds (e.g., verbal agreements) are not enforceable by the contract. |
| **Upgradability risks** | Contract upgrade authorization and migration correctness are covered separately in [docs/upgrade-guide.md](upgrade-guide.md). |

---

## 4. Security Best Practices for Group Operators

1. **Use the penalty system** for groups with members you don't know personally.
2. **Set a grace period** appropriate to your community's payment habits (e.g., 24–48 hours).
3. **Restrict tokens** via `AllowedTokens` if deploying a permissioned instance.
4. **Vet members** before activating a group; once Active, the member list is locked.
5. **Monitor on-chain events** (`ContributionMade`, `PayoutExecuted`, `PenaltyApplied`) for anomalies.
6. **Use testnet first** to validate group parameters before committing real funds.

---

## 5. Audit Status

| Component | Status |
|---|---|
| Core group lifecycle | Covered by unit + property tests |
| Reentrancy guard | Covered by `test_transfer_payout_reentrancy_protection` |
| Emergency withdraw | Covered by `test_emergency_withdraw_*` suite |
| Payout rotation | Covered by `test_transfer_payout_*` suite |
| Formal / third-party audit | Not yet performed |

A third-party audit is recommended before mainnet deployment with significant value at stake.
