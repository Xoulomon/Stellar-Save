# Function Flow: get_member_total_contributions

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  get_member_total_contributions(env, group_id, member)      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Verify Group Exists                                │
│  ─────────────────────────────────────────────────────────  │
│  • Build storage key: GROUP_DATA_{group_id}                 │
│  • Load group from persistent storage                       │
│  • Return GroupNotFound error if not exists                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Initialize Total                                   │
│  ─────────────────────────────────────────────────────────  │
│  • Set total = 0                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Iterate Through Cycles                             │
│  ─────────────────────────────────────────────────────────  │
│  • For cycle in 0..=group.current_cycle:                    │
│    ┌───────────────────────────────────────────────────┐   │
│    │ Build key: CONTRIB_{group_id}_{cycle}_{member}   │   │
│    └───────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│    ┌───────────────────────────────────────────────────┐   │
│    │ Load contribution record from storage            │   │
│    └───────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│    ┌───────────────────────────────────────────────────┐   │
│    │ If record exists:                                 │   │
│    │   • Add amount to total (with overflow check)    │   │
│    │ Else:                                             │   │
│    │   • Continue to next cycle                        │   │
│    └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Return Total                                       │
│  ─────────────────────────────────────────────────────────  │
│  • Return Ok(total)                                         │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Example

### Scenario: Member with 3 contributions across 5 cycles

```
Group State:
├── group_id: 1
├── current_cycle: 4
└── contribution_amount: 10_000_000 stroops (1 XLM)

Member Contributions:
├── Cycle 0: ✓ 10_000_000 stroops
├── Cycle 1: ✗ (skipped)
├── Cycle 2: ✓ 10_000_000 stroops
├── Cycle 3: ✗ (skipped)
└── Cycle 4: ✓ 10_000_000 stroops

Execution Flow:
┌──────────────────────────────────────────────────────────┐
│ Cycle 0: Load contribution → Found → total = 10_000_000 │
├──────────────────────────────────────────────────────────┤
│ Cycle 1: Load contribution → Not Found → total = 10_000_000 │
├──────────────────────────────────────────────────────────┤
│ Cycle 2: Load contribution → Found → total = 20_000_000 │
├──────────────────────────────────────────────────────────┤
│ Cycle 3: Load contribution → Not Found → total = 20_000_000 │
├──────────────────────────────────────────────────────────┤
│ Cycle 4: Load contribution → Found → total = 30_000_000 │
└──────────────────────────────────────────────────────────┘

Result: Ok(30_000_000) // 3 XLM
```

## Storage Access Pattern

```
Storage Reads:
┌─────────────────────────────────────────────────────────┐
│ Read 1: GROUP_DATA_1                                    │
│         └─> Returns Group struct                        │
├─────────────────────────────────────────────────────────┤
│ Read 2: CONTRIB_1_0_MEMBER_ADDR                         │
│         └─> Returns ContributionRecord or None          │
├─────────────────────────────────────────────────────────┤
│ Read 3: CONTRIB_1_1_MEMBER_ADDR                         │
│         └─> Returns ContributionRecord or None          │
├─────────────────────────────────────────────────────────┤
│ Read 4: CONTRIB_1_2_MEMBER_ADDR                         │
│         └─> Returns ContributionRecord or None          │
├─────────────────────────────────────────────────────────┤
│ Read 5: CONTRIB_1_3_MEMBER_ADDR                         │
│         └─> Returns ContributionRecord or None          │
├─────────────────────────────────────────────────────────┤
│ Read 6: CONTRIB_1_4_MEMBER_ADDR                         │
│         └─> Returns ContributionRecord or None          │
└─────────────────────────────────────────────────────────┘

Total Reads: 1 + current_cycle + 1 = 6 reads
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────┐
│ Input: (env, group_id, member)                          │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Group exists?         │
        └───────────────────────┘
                │       │
            No  │       │  Yes
                │       │
                ▼       ▼
    ┌──────────────┐   ┌──────────────────────────┐
    │ Return       │   │ Iterate cycles           │
    │ GroupNotFound│   └──────────────────────────┘
    └──────────────┘               │
                                   ▼
                        ┌──────────────────────────┐
                        │ Add contribution amount  │
                        └──────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────┐
                        │ Overflow check           │
                        └──────────────────────────┘
                            │           │
                        No  │           │  Yes
                            │           │
                            ▼           ▼
                    ┌──────────┐   ┌──────────┐
                    │ Continue │   │ Return   │
                    │ loop     │   │ Overflow │
                    └──────────┘   └──────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Return       │
                    │ Ok(total)    │
                    └──────────────┘
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────┐
│ Metric              │ Value                             │
├─────────────────────────────────────────────────────────┤
│ Time Complexity     │ O(n) where n = current_cycle      │
├─────────────────────────────────────────────────────────┤
│ Space Complexity    │ O(1) - constant space             │
├─────────────────────────────────────────────────────────┤
│ Storage Reads       │ n + 1 reads                       │
├─────────────────────────────────────────────────────────┤
│ Storage Writes      │ 0 (read-only operation)           │
├─────────────────────────────────────────────────────────┤
│ Gas Cost            │ Linear with cycle count           │
└─────────────────────────────────────────────────────────┘

Example Gas Costs (approximate):
• Group with 5 cycles:  ~6 storage reads
• Group with 10 cycles: ~11 storage reads
• Group with 50 cycles: ~51 storage reads
```

## Integration Example

```
Frontend Application
        │
        │ Request: Get member total
        ▼
┌─────────────────────────────────────────┐
│ Smart Contract                          │
│ ─────────────────────────────────────── │
│ get_member_total_contributions()        │
│   │                                     │
│   ├─> Verify group exists               │
│   ├─> Iterate cycles                    │
│   ├─> Sum contributions                 │
│   └─> Return total                      │
└─────────────────────────────────────────┘
        │
        │ Response: Total amount
        ▼
Frontend Display
├─> Show in dashboard
├─> Calculate statistics
└─> Display charts
```
