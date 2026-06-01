# Stellar-Save Tokenomics

This document describes the economic model of Stellar-Save: how value flows through the system, how contributions and payouts work, what fees and penalties apply, and what incentives keep the protocol healthy.

---

## Overview

Stellar-Save is a **zero-yield, zero-fee rotational savings protocol**. It does not issue a native token, does not charge platform fees, and does not generate yield. Its economic purpose is purely redistributive: every stroop contributed by members is paid out to members, in full, on a rotating schedule.

The protocol currently supports **XLM (Stellar Lumens)** as the contribution asset. Support for SEP-41 tokens (USDC, EURC, etc.) is planned for v1.1.

---

## Core Economic Mechanics

### The ROSCA Model

A ROSCA (Rotating Savings and Credit Association) works as follows:

1. A group of `N` members each agree to contribute a fixed amount `C` every cycle.
2. Each cycle, the total pool `P = C × N` is paid out to one member.
3. The rotation continues until every member has received exactly one payout.
4. Total cycles = `N`. Total contributed per member = `C × N`. Total received per member = `C × N`.

**Net economic result: every member contributes and receives the same total amount.** The benefit is not yield — it is access to a lump sum earlier than saving alone would allow.

### Group Parameters

When a group is created, the following parameters are fixed and cannot be changed:

| Parameter | Description | Constraints |
|---|---|---|
| `contribution_amount` | Amount each member must contribute per cycle (in stroops) | > 0 |
| `cycle_duration` | Length of each cycle in seconds | Validated range (see contract config) |
| `max_members` | Maximum number of members in the group | Validated range |
| `grace_period_seconds` | Extra time after deadline to contribute without penalty | 0–604800 (7 days) |
| `token_address` | SEP-41 token contract used for contributions | Must implement `decimals()` |

> **Stroop**: The smallest unit of XLM. 1 XLM = 10,000,000 stroops (10^7).

### Pool Size

```
Pool per cycle = contribution_amount × max_members
```

**Example — 5-member group, 10 XLM contribution:**

```
Pool = 10 XLM × 5 members = 50 XLM per cycle
Total cycles = 5
Total contributed per member = 10 XLM × 5 cycles = 50 XLM
Total received per member = 50 XLM (one payout)
```

### Payout Rotation

Each member is assigned a `payout_position` (0 to `max_members - 1`) when they join. The member whose `payout_position` equals the current `cycle_number` is the eligible recipient for that cycle.

```
Eligible recipient for cycle C = member with payout_position == C
```

Payout is triggered automatically by `execute_payout` once all members have contributed for the current cycle. The contract transfers the full pool to the recipient and advances the cycle counter.

---

## Contribution Flow

```
Member calls contribute(group_id, member, amount)
    │
    ├─ Validates: group is Active, member is enrolled, amount matches contribution_amount
    ├─ Validates: member has not already contributed this cycle
    ├─ Transfers amount from member wallet → contract escrow (on-chain)
    ├─ Records ContributionRecord (member, group_id, cycle_number, amount, timestamp)
    ├─ Updates cycle totals and member totals
    └─ Emits contribution event
```

Once all `max_members` contributions are recorded for the cycle, `execute_payout` can be called:

```
execute_payout(group_id)
    │
    ├─ Validates: group is Active, cycle is complete (all members contributed)
    ├─ Identifies eligible recipient (payout_position == current_cycle)
    ├─ Transfers pool amount from contract escrow → recipient wallet
    ├─ Records PayoutRecord (recipient, group_id, cycle_number, amount, timestamp)
    ├─ Advances current_cycle counter
    ├─ If current_cycle == max_members → marks group Completed
    └─ Emits payout event
```

---

## Fee Structure

**Stellar-Save charges no platform fees.** The protocol is designed for financial inclusion and does not extract value from participants.

The only costs a user incurs are:

| Cost | Who Pays | Amount |
|---|---|---|
| Stellar network transaction fee | The transaction submitter | ~0.00001 XLM per operation (standard Stellar base fee) |
| Soroban resource fee | The transaction submitter | Variable; typically < 0.01 XLM per contract invocation |

These are Stellar network costs, not Stellar-Save fees. They are paid to the Stellar network validators, not to any protocol treasury.

> For current Stellar fee estimates, see the [Stellar Developers documentation](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering).

---

## Penalty System

The penalty system is implemented in the contract but applies to **future versions** with flexible payout schedules. In v1.0, the group simply waits for all contributions before executing a payout.

The penalty parameters are defined as follows:

| Parameter | Value | Description |
|---|---|---|
| Base penalty | 5% (500 bps) | Applied on the first missed cycle |
| Penalty increment | +5% per additional miss | Escalating penalty for repeat misses |
| Maximum penalty | 25% (2500 bps) | Cap on total penalty percentage |
| Recovery fee | 10% (1000 bps) | Surcharge on top of missed contribution to recover standing |

**Penalty calculation:**

```
missed_cycles = number of cycles a member has missed

penalty_bps = min(
    BASE_PENALTY_BPS + (missed_cycles - 1) × PENALTY_INCREMENT_BPS,
    MAX_PENALTY_BPS
)

penalty_amount = contribution_amount × penalty_bps / 10000
```

**Example — member misses 3 cycles, contribution = 10 XLM:**

```
Cycle 1 miss: 5%  → 0.50 XLM penalty
Cycle 2 miss: 10% → 1.00 XLM penalty
Cycle 3 miss: 15% → 1.50 XLM penalty
```

**Recovery:** A penalized member can recover their standing by paying the missed contribution amount plus a 10% recovery fee:

```
recovery_payment = missed_contribution + (missed_contribution × 10%)
                 = 10 XLM + 1 XLM = 11 XLM
```

Penalty history is stored on-chain per `(group_id, member)` for full auditability.

---

## Economic Incentives

### For Members

- **Early position holders** receive the pool sooner, effectively getting an interest-free loan from the group. They pay back through their remaining contributions.
- **Late position holders** act as lenders to early recipients. Their incentive is the discipline of forced savings and the certainty of receiving the lump sum at their designated cycle.
- **All members** benefit from the social accountability and transparency of on-chain records.

### For Group Creators

- Creators set the group parameters and control the emergency pause/unpause mechanism.
- There is no economic reward for being a creator. The role is one of coordination, not extraction.

### Protocol-Level Incentives

- **No yield, no speculation**: Stellar-Save does not promise returns. This keeps the system simple, auditable, and resistant to the failure modes of yield-bearing protocols.
- **Trustless escrow**: Funds are held by the smart contract, not by any individual. No coordinator can abscond with the pool.
- **Transparent rotation**: The payout schedule is deterministic and verifiable on-chain. Members can independently verify when they will receive their payout.

---

## Token Support

### Current (v1.0)

XLM is the native asset. Contributions and payouts are denominated in stroops.

### Planned (v1.1)

Any SEP-41-compliant token can be used as the contribution asset. The token is validated at group creation by calling `decimals()` on the token contract. Tokens with more than 38 decimal places are rejected to prevent overflow.

Each group uses exactly one token for its entire lifecycle. Two groups can use different tokens independently.

**Supported tokens (planned):**

| Token | Standard | Decimals |
|---|---|---|
| XLM | Native / SEP-41 | 7 |
| USDC | SEP-41 | 7 |
| EURC | SEP-41 | 7 |

---

## Worked Examples

### Example 1: 5-member weekly group, 10 XLM each

| Parameter | Value |
|---|---|
| Members | 5 |
| Contribution | 10 XLM (100,000,000 stroops) |
| Cycle duration | 604,800 seconds (7 days) |
| Pool per cycle | 50 XLM |
| Total duration | 5 weeks |

| Cycle | Recipient | Pool Received |
|---|---|---|
| 0 | Member A | 50 XLM |
| 1 | Member B | 50 XLM |
| 2 | Member C | 50 XLM |
| 3 | Member D | 50 XLM |
| 4 | Member E | 50 XLM |

Each member contributes 50 XLM total and receives 50 XLM total. Member A receives their 50 XLM after contributing only 10 XLM (week 1), effectively borrowing 40 XLM interest-free from the group.

### Example 2: 10-member monthly group, 50 USDC each (v1.1)

| Parameter | Value |
|---|---|
| Members | 10 |
| Contribution | 50 USDC |
| Cycle duration | 2,592,000 seconds (30 days) |
| Pool per cycle | 500 USDC |
| Total duration | 10 months |

Member at position 0 receives 500 USDC after their first 50 USDC contribution. They repay the implicit loan through 9 more monthly contributions of 50 USDC each.

---

## Lifecycle and Value Flow Diagram

```
Group Created (Pending)
        │
        ▼
Members Join (up to max_members)
        │
        ▼
Group Activated (Active)
        │
        ▼
┌─────────────────────────────────────────┐
│  Cycle N                                │
│                                         │
│  Each member contributes C stroops      │
│  ──────────────────────────────────►   │
│  Contract escrow accumulates N × C      │
│                                         │
│  All contributed? → execute_payout()    │
│  ──────────────────────────────────►   │
│  Recipient at position N receives N × C │
│                                         │
│  Cycle counter advances: N → N+1        │
└─────────────────────────────────────────┘
        │
        │  (repeat for each member)
        │
        ▼
All cycles complete → Group Completed
```

---

## Summary

| Property | Value |
|---|---|
| Platform fee | None |
| Yield | None |
| Native token | None (uses XLM or SEP-41 tokens) |
| Payout formula | `contribution_amount × max_members` |
| Penalty (v2.0) | 5–25% of contribution amount, escalating |
| Recovery fee (v2.0) | 10% surcharge on missed contribution |
| Net member gain/loss | Zero (pure redistribution) |
| Trust model | Trustless — contract holds escrow |

---

## Related Documentation

- [Architecture Overview](architecture.md)
- [Storage Layout](storage-layout.md)
- [Threat Model & Security](threat-model.md)
- [Roadmap](roadmap.md)
- [FAQ](faq.md)
