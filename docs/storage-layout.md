# Smart Contract Storage Layout

This document details the storage architecture for the Stellar-Save smart contract. It identifies all `StorageKey` variants, maps them to Soroban storage types, explains core data structures, and provides cost estimates based on the Soroban 2026 fee model.

## Storage Strategy Overview

Stellar-Save leverages Soroban’s tiered storage model to balance performance, persistence, and cost. While the current implementation primarily uses `persistent()` storage for data consistency, the architecture logically separates data into Instance, Persistent, and Temporary categories.

- **Instance Storage**: Shared, frequently-accessed global state (e.g., Protocol Config).
- **Persistent Storage**: Long-term, high-volume data (e.g., Groups, Member Profiles).
- **Temporary Storage**: Short-lived data for security or rate limiting (e.g., Reentrancy Guard, Cooldowns).

---

## Storage Key Mapping

The following table summarizes all `StorageKey` variants used in the contract:

| Key Category | Variant | Storage Type | Data Stored |
| :--- | :--- | :--- | :--- |
| **Global Config** | `ContractConfig` | Instance | Admin address, global contribution limits, group size limits. |
| **Global State** | `NextGroupId`, `TotalGroups`, `ActiveGroups`, `TotalMembers`, `ContractVersion` | Instance | Global counters and system-wide statistics. |
| **Admin** | `EmergencyPause` | Instance | Boolean flag to pause/unpause contract operations. |
| **Security** | `ReentrancyGuard` | Temporary | Flag to prevent reentrancy during fund transfers. |
| **Rate Limiting** | `LastGroupCreation(Address)`, `LastGroupJoin(Address)` | Temporary | Timestamps of a user's last major actions. |
| **Group Data** | `Data(u64)` | Persistent | The core `Group` struct containing configuration and state. |
| **Group State** | `Members(u64)`, `Status(u64)`, `GroupBalance(u64)`, `GroupTotalPaidOut(u64)` | Persistent | Member list (Vec), group lifecycle status, and incremental balances. |
| **Member Data** | `Profile(u64, Address)`, `PayoutEligibility(u64, Address)`, `TotalContributions(u64, Address)` | Persistent | Individual member profiles, payout positions, and aggregate contributions. |
| **Transactions** | `Individual(u64, cycle, Address)`, `CycleTotal(u64, cycle)`, `CycleCount(u64, cycle)` | Persistent | Contribution records, totals, and counts per group and cycle. |
| **Payouts** | `Record(u64, cycle)`, `Recipient(u64, cycle)`, `Status(u64, cycle)` | Persistent | Payout records, recipient lookups, and execution status. |

---

## Core Data Structures

### Group Struct
The `Group` struct is the central entity for any ROSCA. It stores:
- **Identity**: Unique sequential ID and creator address.
- **Config**: Contribution amount (stroops), cycle duration (seconds), and member limits.
- **State**: Current member count, current cycle index (0-indexed), and activation status.
- **Lifecycle**: `GroupStatus` enum (Pending, Active, Paused, Completed, Cancelled).

### Member Tracking
Member tracking is handled via a combination of a membership list and individual profiles:
- **Group Membership**: A `Vec<Address>` stored at `GroupKey::Members(id)` allows for efficient iteration.
- **Individual Profile**: Stored at `MemberKey::Profile(id, address)`, containing identifying data and the assigned `joined_at` timestamp.

### Payout Queue (Rotation)
The rotation is managed through a "position-based" eligibility system:
- **Position Assignment**: Every member is assigned a `payout_position` (0 to max_members - 1) upon joining or by the creator.
- **Implicit Queue**: The rotation is stored implicitly; the member whose `payout_position` matches the `Group.current_cycle` is the eligible recipient for that cycle.
- **Execution Tracking**: The `PayoutKey::Recipient(id, cycle)` serves as a permanent record of who received funds in each rotation.

---

## Cost Estimates (Soroban 2026 Fee Model)

Estimates for a "Standard Group" consisting of 1 creator and 9 additional members (10 total):

| Entry Type | Avg. Size (Bytes) | Count | Total Size |
| :--- | :--- | :--- | :--- |
| **Group Core (Data)** | ~250 | 1 | 250 B |
| **Group Meta (Status, Balances)** | ~100 | 3 | 300 B |
| **Group Members (Vec)** | ~350 | 1 | 350 B |
| **Member Profiles** | ~120 | 10 | 1,200 B |
| **Estimated Total** | - | - | **~2.1 KB** |

*Note: Total ledger footprint scales linearly with the number of members (~120 B per member profile) and with the number of cycles (~150 B per contribution/payout record).*
