# Smart Contract Storage Layout

This document details the storage architecture for the Stellar-Save smart contract. It covers every `StorageKey` variant, the Soroban storage tier used for each, the data stored, access patterns, and cost estimates for capacity planning.

---

## Storage Strategy Overview

Stellar-Save uses Soroban's tiered storage model to balance performance, persistence, and cost.

| Tier | Characteristics | Used For |
|---|---|---|
| **Instance** | Shared across all invocations; cheapest reads; persists with contract | Global config, counters, admin flags |
| **Persistent** | Per-key TTL; survives ledger closings; higher write cost | Group data, member profiles, contribution/payout records |
| **Temporary** | Expires after TTL (default: 1 ledger); cheapest writes | Reentrancy guard, rate-limiting timestamps |

> All storage calls in the current implementation use `env.storage().persistent()` unless noted otherwise. Instance and temporary tiers are used for the specific keys listed below.

---

## Storage Key Reference

### Global / Contract-Level Keys (`CounterKey`)

These keys are stored in **instance** storage (except `ReentrancyGuard` which uses **temporary** storage).

| Key | Variant | Storage Tier | Type | Description |
|---|---|---|---|---|
| `Counter(NextGroupId)` | `CounterKey::NextGroupId` | Instance | `u64` | Monotonically increasing counter; provides unique IDs for new groups. |
| `Counter(TotalGroups)` | `CounterKey::TotalGroups` | Instance | `u64` | Total number of groups ever created (never decremented). |
| `Counter(ActiveGroups)` | `CounterKey::ActiveGroups` | Instance | `u64` | Number of currently active groups. |
| `Counter(TotalMembers)` | `CounterKey::TotalMembers` | Instance | `u64` | Global member count across all groups. |
| `Counter(ContractVersion)` | `CounterKey::ContractVersion` | Instance | `u32` | Contract version for upgrade compatibility checks. |
| `Counter(ContractConfig)` | `CounterKey::ContractConfig` | Instance | `ContractConfig` | Admin address, global min/max contribution limits, group size limits. |
| `Counter(EmergencyPause)` | `CounterKey::EmergencyPause` | Instance | `bool` | When `true`, contributions and payouts are blocked contract-wide. |
| `Counter(AllowedTokens)` | `CounterKey::AllowedTokens` | Instance | `Option<Vec<Address>>` | Optional admin-managed allowlist of permitted token addresses. |
| `Counter(ReentrancyGuard)` | `CounterKey::ReentrancyGuard` | **Temporary** | `bool` | Set to `true` before any outbound token transfer; cleared after. Prevents re-entrant calls. |
| `Counter(GroupBalance(id))` | `CounterKey::GroupBalance(u64)` | Persistent | `i128` | Running balance (stroops) for group `id`; incremented on contribution, decremented on payout. |
| `Counter(GroupTotalPaidOut(id))` | `CounterKey::GroupTotalPaidOut(u64)` | Persistent | `i128` | Cumulative amount paid out for group `id`. |
| `Counter(DeadlineExtension(id, cycle))` | `CounterKey::DeadlineExtension(u64, u32)` | Persistent | `u64` | Total deadline extension in seconds applied to cycle `cycle` of group `id`. |
| `Counter(DisputeCount(id))` | `CounterKey::DisputeCount(u64)` | Persistent | `u32` | Number of members who have raised a dispute for group `id`. |

---

### Group Data Keys (`GroupKey`)

All group keys are stored in **persistent** storage.

| Key | Variant | Type | Description |
|---|---|---|---|
| `Group(Data(id))` | `GroupKey::Data(u64)` | `Group` | Core group struct: creator, contribution amount, cycle duration, max/min members, current cycle, `grace_period_seconds`, status, token address. |
| `Group(Members(id))` | `GroupKey::Members(u64)` | `Vec<Address>` | Ordered list of member addresses. Used for iteration and member count. |
| `Group(Status(id))` | `GroupKey::Status(u64)` | `GroupStatus` | Current lifecycle state: `Pending`, `Active`, `Paused`, `Completed`, `Cancelled`. |
| `Group(PayoutSequence(id))` | `GroupKey::PayoutSequence(u64)` | `Vec<Address>` | Randomised payout order (set at group activation or by creator). |
| `Group(PayoutPositionIndex(id, pos))` | `GroupKey::PayoutPositionIndex(u64, u32)` | `Address` | Reverse index: maps payout position `pos` → member `Address`. O(1) recipient lookup. |
| `Group(TokenConfig(id))` | `GroupKey::TokenConfig(u64)` | `TokenConfig` | Token address and decimal precision for the group's contribution token. |
| `Group(Invitations(id))` | `GroupKey::Invitations(u64)` | `Vec<Address>` | Addresses invited to join this group (invite-only mode). |
| `Group(Archived(id))` | `GroupKey::Archived(u64)` | `bool` | When `true`, group is hidden from `list_groups()` and only visible via `list_archived_groups()`. |
| `Group(MergedFrom(id))` | `GroupKey::MergedFrom(u64)` | `(u64, u64)` | Source group IDs when this group was created by merging two groups. |
| `Group(Rating(id, addr))` | `GroupKey::Rating(u64, Address)` | `RatingEntry` | Star rating submitted by member `addr` for group `id`. |
| `Group(RatingAggregate(id))` | `GroupKey::RatingAggregate(u64)` | `RatingAggregate` | Running aggregate: `total_stars` + `rating_count` for computing average rating. |
| `Group(DisputeReason(id))` | `GroupKey::DisputeReason(u64)` | `String` | Free-text reason string for the most recent dispute raised against group `id`. |
| `Group(DisputeVote(id, addr))` | `GroupKey::DisputeVote(u64, Address)` | `bool` | Whether member `addr` has raised a dispute for group `id`. |

---

### Member Data Keys (`MemberKey`)

All member keys are stored in **persistent** storage.

| Key | Variant | Type | Description |
|---|---|---|---|
| `Member(Profile(id, addr))` | `MemberKey::Profile(u64, Address)` | `MemberProfile` | Member profile: join timestamp, payout position, display name. |
| `Member(ContributionStatus(id, addr))` | `MemberKey::ContributionStatus(u64, Address)` | `bool` | Whether member `addr` has contributed in the current cycle of group `id`. |
| `Member(PayoutEligibility(id, addr))` | `MemberKey::PayoutEligibility(u64, Address)` | `PayoutEligibility` | Payout position (0-indexed) and whether the member has already received their payout. |
| `Member(TotalContributions(id, addr))` | `MemberKey::TotalContributions(u64, Address)` | `i128` | Cumulative contribution amount (stroops) by member `addr` across all cycles of group `id`. |
| `Member(RewardClaimed(id, addr))` | `MemberKey::RewardClaimed(u64, Address)` | `bool` | Whether member `addr` has claimed their group-completion reward. |
| `Member(PenaltyTotal(id, addr))` | `MemberKey::PenaltyTotal(u64, Address)` | `i128` | Cumulative penalty amount (stroops) charged to member `addr` for missed contributions. |
| `Member(Streak(id, addr))` | `MemberKey::Streak(u64, Address)` | `StreakData` | Current and best consecutive-contribution streak for member `addr`. |
| `Member(AutoContribute(id, addr))` | `MemberKey::AutoContribute(u64, Address)` | `bool` | Whether member `addr` has opted in to automatic contributions at cycle start. |
| `Member(Referral(id, addr))` | `MemberKey::Referral(u64, Address)` | `Address` | Referrer address for invitee `addr` within group `id`. |

---

### Contribution Keys (`ContributionKey`)

All contribution keys are stored in **persistent** storage.

| Key | Variant | Type | Description |
|---|---|---|---|
| `Contribution(Individual(id, cycle, addr))` | `ContributionKey::Individual(u64, u32, Address)` | `ContributionRecord` | Contribution amount and timestamp for member `addr` in cycle `cycle` of group `id`. |
| `Contribution(CycleTotal(id, cycle))` | `ContributionKey::CycleTotal(u64, u32)` | `i128` | Total amount contributed by all members in cycle `cycle` of group `id`. |
| `Contribution(CycleCount(id, cycle))` | `ContributionKey::CycleCount(u64, u32)` | `u32` | Number of members who have contributed in cycle `cycle` of group `id`. |
| `Contribution(ProofVerified(id, cycle, addr))` | `ContributionKey::ProofVerified(u64, u32, Address)` | `bool` | Whether member `addr`'s contribution proof has been verified for cycle `cycle`. |
| `Contribution(PendingAmountChange(id))` | `ContributionKey::PendingAmountChange(u64)` | `i128` | Proposed new contribution amount awaiting member vote approval. |
| `Contribution(AmountChangeVoteCount(id))` | `ContributionKey::AmountChangeVoteCount(u64)` | `u32` | Number of members who have voted to approve the pending amount change. |
| `Contribution(MemberVote(id, addr))` | `ContributionKey::MemberVote(u64, Address)` | `bool` | Whether member `addr` has voted on the pending amount change. |
| `Contribution(DissolveVoteCount(id))` | `ContributionKey::DissolveVoteCount(u64)` | `u32` | Number of members who have voted to dissolve group `id`. |
| `Contribution(DissolveVote(id, addr))` | `ContributionKey::DissolveVote(u64, Address)` | `bool` | Whether member `addr` has voted to dissolve group `id`. |

---

### Payout Keys (`PayoutKey`)

All payout keys are stored in **persistent** storage.

| Key | Variant | Type | Description |
|---|---|---|---|
| `Payout(Record(id, cycle))` | `PayoutKey::Record(u64, u32)` | `PayoutRecord` | Complete payout record for cycle `cycle` of group `id`: recipient, amount, timestamp. |
| `Payout(Recipient(id, cycle))` | `PayoutKey::Recipient(u64, u32)` | `Address` | Quick lookup: address of the member who received the payout in cycle `cycle`. |
| `Payout(Status(id, cycle))` | `PayoutKey::Status(u64, u32)` | `PayoutStatus` | Whether the payout for cycle `cycle` has been `Pending` or `Executed`. Prevents double-payout. |

---

### Refund Keys (`RefundKey`)

All refund keys are stored in **persistent** storage.

| Key | Variant | Type | Description |
|---|---|---|---|
| `Refund(Record(id, cycle, addr))` | `RefundKey::Record(u64, u32, Address)` | `RefundRecord` | Refund record for member `addr` in cycle `cycle` of group `id` (used on cancellation/emergency withdraw). |

---

### User Rate-Limiting Keys (`UserKey`)

These keys are stored in **temporary** storage (expire after 1 ledger by default).

| Key | Variant | Type | Description |
|---|---|---|---|
| `User(LastGroupCreation(addr))` | `UserKey::LastGroupCreation(Address)` | `u64` | Ledger timestamp of the last group created by `addr`. Used to enforce creation rate limits. |
| `User(LastGroupJoin(addr))` | `UserKey::LastGroupJoin(Address)` | `u64` | Ledger timestamp of the last group joined by `addr`. Used to enforce join rate limits. |

---

## Storage Relationship Diagram

```
ContractConfig (Instance)
    │
    ├── NextGroupId / TotalGroups / ActiveGroups / TotalMembers (Instance counters)
    │
    └── Group[id]
            ├── GroupKey::Data(id)          ← Group struct (config + state)
            ├── GroupKey::Status(id)         ← GroupStatus enum
            ├── GroupKey::Members(id)        ← Vec<Address>
            ├── GroupKey::PayoutSequence(id) ← Vec<Address>
            ├── GroupKey::TokenConfig(id)    ← token address + decimals
            ├── CounterKey::GroupBalance(id) ← running balance (i128)
            ├── CounterKey::GroupTotalPaidOut(id)
            │
            ├── Member[addr]
            │       ├── MemberKey::Profile(id, addr)
            │       ├── MemberKey::PayoutEligibility(id, addr)
            │       ├── MemberKey::TotalContributions(id, addr)
            │       └── MemberKey::PenaltyTotal(id, addr)
            │
            ├── Cycle[cycle]
            │       ├── ContributionKey::CycleTotal(id, cycle)
            │       ├── ContributionKey::CycleCount(id, cycle)
            │       ├── ContributionKey::Individual(id, cycle, addr)  ← per member
            │       ├── PayoutKey::Record(id, cycle)
            │       ├── PayoutKey::Recipient(id, cycle)
            │       └── PayoutKey::Status(id, cycle)
            │
            └── GroupKey::PayoutPositionIndex(id, pos)  ← pos → Address (O(1) lookup)
```

---

## Cost Estimates (Soroban 2026 Fee Model)

### Per-Group Storage Footprint

Estimates for a standard group with **N members** completing **C cycles**:

| Entry | Avg. Size | Count | Total |
|---|---|---|---|
| `GroupKey::Data` | ~250 B | 1 | 250 B |
| `GroupKey::Status` | ~20 B | 1 | 20 B |
| `GroupKey::Members` | ~32 B × N | 1 | 32N B |
| `GroupKey::PayoutSequence` | ~32 B × N | 1 | 32N B |
| `GroupKey::PayoutPositionIndex` | ~40 B | N | 40N B |
| `GroupKey::TokenConfig` | ~40 B | 1 | 40 B |
| `CounterKey::GroupBalance` | ~16 B | 1 | 16 B |
| `CounterKey::GroupTotalPaidOut` | ~16 B | 1 | 16 B |
| `MemberKey::Profile` | ~120 B | N | 120N B |
| `MemberKey::PayoutEligibility` | ~40 B | N | 40N B |
| `MemberKey::TotalContributions` | ~16 B | N | 16N B |
| `MemberKey::PenaltyTotal` | ~16 B | N | 16N B |
| `ContributionKey::Individual` | ~60 B | N × C | 60NC B |
| `ContributionKey::CycleTotal` | ~16 B | C | 16C B |
| `ContributionKey::CycleCount` | ~8 B | C | 8C B |
| `PayoutKey::Record` | ~100 B | C | 100C B |
| `PayoutKey::Recipient` | ~32 B | C | 32C B |
| `PayoutKey::Status` | ~8 B | C | 8C B |

**Simplified formula** (dominant terms):

```
Total ≈ 280N + 60NC + 160C + 600  (bytes)
```

### Example: 10-member group, 10 cycles

```
Total ≈ 280×10 + 60×10×10 + 160×10 + 600
      = 2,800 + 6,000 + 1,600 + 600
      = ~11 KB
```

### Scaling Notes

- Storage grows **linearly** with members (N) and cycles (C).
- The dominant cost at scale is `ContributionKey::Individual` (~60 B × N × C).
- Optional features add overhead: `MemberKey::Streak` (~50 B/member), `GroupKey::Rating` (~40 B/member), `ContributionKey::DissolveVote` (~8 B/member).
- Temporary keys (`ReentrancyGuard`, `UserKey::*`) do not contribute to long-term storage cost.
- Soroban persistent storage entries must have their TTL extended (rent bumped) to avoid expiry. The contract bumps TTL on every read/write of persistent entries.

### Rent Bump Strategy

The contract calls `env.storage().persistent().extend_ttl(key, min_ttl, max_ttl)` on every access to ensure entries do not expire mid-group lifecycle. For a 10-cycle monthly group (~10 months), entries need a TTL of at least ~2.6 million ledgers (at 5 s/ledger). Plan for rent costs accordingly when estimating total group operating cost.
