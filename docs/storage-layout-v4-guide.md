# Storage Layout and Data Model Guide for v4.0 Features

This document extends the existing storage-layout guidance for the v4.0 capabilities around escrow, insurance, governance, badges, and recovery.

## Scope and conventions

The storage layout conventions in [docs/storage-layout.md](../docs/storage-layout.md) remain the same:

- each storage key has a clear type and lifecycle
- persistent storage is used for durable group and member state
- instance storage remains the home for contract-wide configuration and counters
- temporary storage is reserved for short-lived guards and rate-limit state

## New v4.0 storage areas

### Escrow storage

| Key | Type | Purpose | Lifecycle |
|---|---|---|---|
| `EscrowBalance(group_id)` | `i128` | Tracks funds held in escrow for a specific group | Created when escrow is first funded; updated on deposits and releases |
| `EscrowStatus(group_id)` | `u32` | Marks whether the escrow is pending, active, or released | Changes with escrow lifecycle transitions |

### Insurance storage

| Key | Type | Purpose | Lifecycle |
|---|---|---|---|
| `InsurancePool(group_id)` | `i128` | Maintains the insurance pool balance for a group | Grows from premiums or reserves; shrinks on claims |
| `InsuranceClaim(group_id, member)` | `bool` | Tracks whether a member has already claimed insurance for a given group | Created when a claim is submitted; persists until the claim window closes |

### Governance storage

| Key | Type | Purpose | Lifecycle |
|---|---|---|---|
| `GovernanceProposal(group_id, proposal_id)` | `Proposal` | Stores the proposal payload, voting window, and outcome | Created on proposal submission; updated through voting and execution |
| `GovernanceVote(group_id, proposal_id, member)` | `bool` | Tracks whether a member has voted for a proposal | Created on first vote; remains for the proposal lifecycle |

### Badge storage

| Key | Type | Purpose | Lifecycle |
|---|---|---|---|
| `BadgeAward(group_id, member)` | `u32` | Stores the badge bitmask or award count earned by a member | Updated when badge thresholds are crossed |
| `BadgeThresholds()` | `Vec<u32>` | Stores the threshold sequence for achievement badges | Static once deployed, unless thresholds are reconfigured |

### Recovery storage

| Key | Type | Purpose | Lifecycle |
|---|---|---|---|
| `RecoveryRequest(group_id, member)` | `RecoveryRequest` | Stores recovery initiation details and approval state | Created on recovery start; cleared after finalization |
| `RecoverySigner(group_id, member, signer)` | `bool` | Marks whether a signer is authorized for recovery | Created when signers are added; removed when revoked |

## Storage relationship diagram

```text
ContractConfig
  └── Group[group_id]
        ├── EscrowBalance(group_id)
        ├── EscrowStatus(group_id)
        ├── InsurancePool(group_id)
        ├── InsuranceClaim(group_id, member)
        ├── GovernanceProposal(group_id, proposal_id)
        ├── GovernanceVote(group_id, proposal_id, member)
        ├── BadgeAward(group_id, member)
        ├── RecoveryRequest(group_id, member)
        └── RecoverySigner(group_id, member, signer)
```

## Migration implications

Each addition has an operational migration impact:

- Escrow fields should be initialized for existing groups to preserve compatibility with any historical escrow state.
- Insurance state should be defaulted to zero or absent for existing groups until the feature is enabled.
- Governance proposals and votes should be absent by default and should not break existing groups that never use governance.
- Badge data should be calculated lazily or backfilled rather than assumed to exist for all historical members.
- Recovery state should be opt-in and should not require any existing group to pre-populate signers.

## Review checklist

- [ ] Every new storage key has a documented type and purpose.
- [ ] The lifecycle is described from creation to teardown.
- [ ] Migration or backfill considerations are noted.
- [ ] The storage layout remains consistent with the rest of the documentation.
