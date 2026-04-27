# Stellar-Save Interactive Demo Script

This guide provides a step-by-step walkthrough for demonstrating the Stellar-Save ROSCA platform.

## Prerequisites

- Stellar CLI installed (`stellar --version`)
- Soroban CLI installed (`soroban --version`)
- Contract deployed to testnet
- 4+ funded testnet accounts

## Demo Setup

### 1. Prepare Demo Accounts

Generate demo accounts for the demonstration:

```bash
# Create demo identities
stellar keys generate alice --network testnet
stellar keys generate bob --network testnet
stellar keys generate charlie --network testnet
stellar keys generate diana --network testnet

# Fund accounts via Friendbot
stellar keys fund alice --network testnet
stellar keys fund bob --network testnet
stellar keys fund charlie --network testnet
stellar keys fund diana --network testnet
```

**Expected Output:**
```
✅ Successfully funded alice with 10,000 XLM
✅ Successfully funded bob with 10,000 XLM
✅ Successfully funded charlie with 10,000 XLM
✅ Successfully funded diana with 10,000 XLM
```

### 2. Deploy Contract

```bash
# Build the contract
cargo build --manifest-path contracts/stellar-save/Cargo.toml --target wasm32-unknown-unknown --release

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source alice \
  --network testnet
```

**Expected Output:**
```
Contract deployed successfully!
Contract ID: CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K
```

Save the contract ID for subsequent commands.

## Demo Flow

### Step 1: Create a Savings Group

**Narrator:** "Alice wants to start a savings group with her friends. She'll create a group where members contribute 100 XLM every 7 days."

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  create_group \
  --contribution_amount 1000000000 \
  --cycle_duration 604800 \
  --max_members 4
```

**Expected Output:**
```json
{
  "group_id": 1,
  "creator": "GALICE...",
  "contribution_amount": 1000000000,
  "cycle_duration": 604800,
  "max_members": 4,
  "current_members": 1
}
```

**Key Points:**
- Contribution amount is in stroops (1 XLM = 10,000,000 stroops)
- Cycle duration is in seconds (7 days = 604,800 seconds)
- Alice is automatically added as the first member

### Step 2: Members Join the Group

**Narrator:** "Bob, Charlie, and Diana hear about the group and decide to join."

```bash
# Bob joins
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source bob \
  --network testnet \
  -- \
  join_group \
  --group_id 1

# Charlie joins
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source charlie \
  --network testnet \
  -- \
  join_group \
  --group_id 1

# Diana joins
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source diana \
  --network testnet \
  -- \
  join_group \
  --group_id 1
```

**Expected Output (each):**
```
✅ Successfully joined group 1
```

### Step 3: View Group Members

**Narrator:** "Let's verify all members have joined successfully."

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  get_group_members \
  --group_id 1
```

**Expected Output:**
```json
[
  "GALICE...",
  "GBOB...",
  "GCHARLIE...",
  "GDIANA..."
]
```

### Step 4: First Cycle - All Members Contribute

**Narrator:** "It's the first cycle. All members need to contribute 100 XLM. Alice is first in the payout queue."

```bash
# Alice contributes
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  contribute \
  --group_id 1

# Bob contributes
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source bob \
  --network testnet \
  -- \
  contribute \
  --group_id 1

# Charlie contributes
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source charlie \
  --network testnet \
  -- \
  contribute \
  --group_id 1

# Diana contributes (triggers payout)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source diana \
  --network testnet \
  -- \
  contribute \
  --group_id 1
```

**Expected Output (Diana's contribution):**
```
✅ Contribution recorded
🎉 Payout executed: 400 XLM sent to Alice
```

### Step 5: Check Pool Balance

**Narrator:** "After the payout, the pool should be empty and ready for the next cycle."

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  get_pool_balance \
  --group_id 1
```

**Expected Output:**
```json
{
  "balance": 0,
  "cycle": 1,
  "contributions_received": 4
}
```

### Step 6: Advance to Next Cycle

**Narrator:** "Time passes, and we move to cycle 2. Bob is next in line for the payout."

```bash
# Simulate time passage (in production, this happens automatically)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  advance_cycle \
  --group_id 1
```

**Expected Output:**
```
✅ Advanced to cycle 2
Next recipient: Bob (GBOB...)
```

### Step 7: Second Cycle Contributions

**Narrator:** "Members contribute again in cycle 2."

```bash
# All members contribute (same commands as Step 4)
# When the last member contributes, Bob receives 400 XLM
```

**Expected Output (final contribution):**
```
✅ Contribution recorded
🎉 Payout executed: 400 XLM sent to Bob
```

### Step 8: Check Contribution History

**Narrator:** "Let's review Alice's contribution history."

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  get_member_contributions \
  --group_id 1 \
  --member "GALICE..."
```

**Expected Output:**
```json
{
  "member": "GALICE...",
  "total_contributions": 2,
  "cycles_contributed": [1, 2],
  "total_amount": 2000000000,
  "payout_received": true,
  "payout_cycle": 1
}
```

### Step 9: Check Group Status

**Narrator:** "Let's see the overall group status."

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  get_group \
  --group_id 1
```

**Expected Output:**
```json
{
  "group_id": 1,
  "creator": "GALICE...",
  "contribution_amount": 1000000000,
  "cycle_duration": 604800,
  "max_members": 4,
  "current_members": 4,
  "current_cycle": 2,
  "is_complete": false,
  "total_contributions": 8,
  "total_paid_out": 8000000000
}
```

### Step 10: Complete the ROSCA

**Narrator:** "After all 4 cycles complete, everyone has received their payout once."

```bash
# Continue cycles 3 and 4 (Charlie and Diana receive payouts)
# After cycle 4 completes...

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  is_complete \
  --group_id 1
```

**Expected Output:**
```json
{
  "is_complete": true,
  "total_cycles": 4,
  "all_payouts_executed": true
}
```

## Demo Talking Points

### Key Features to Highlight

1. **Trustless Operation**
   - No central coordinator needed
   - Smart contract enforces rules automatically
   - Transparent on-chain history

2. **Automatic Payouts**
   - When all members contribute, payout executes immediately
   - No manual intervention required
   - Guaranteed rotation order

3. **Flexible Configuration**
   - Customizable contribution amounts
   - Adjustable cycle durations
   - Variable group sizes

4. **Financial Inclusion**
   - Accessible to anyone with a Stellar wallet
   - No bank account required
   - Global participation

### Common Questions & Answers

**Q: What happens if someone doesn't contribute?**
A: The payout won't execute until all members contribute. Future versions may include penalty mechanisms.

**Q: Can I leave a group early?**
A: Currently, no. Once you join, you're committed to the full rotation. This ensures fairness.

**Q: What tokens are supported?**
A: Currently XLM only. Custom token support (USDC, EURC) is on the roadmap.

**Q: How is the payout order determined?**
A: First-come, first-served based on join order. The creator is always first.

**Q: Is this secure?**
A: Yes. The smart contract is audited and all funds are held on-chain. See our [threat model](../docs/threat-model.md).

## Troubleshooting

### Account Not Funded
```bash
stellar keys fund <identity> --network testnet
```

### Contract Not Found
Verify the contract ID is correct:
```bash
stellar contract info --id <CONTRACT_ID> --network testnet
```

### Insufficient Balance
Check account balance:
```bash
stellar account balance <identity> --network testnet
```

### Transaction Failed
Check transaction details:
```bash
stellar transaction view <TX_HASH> --network testnet
```

## Demo Data Summary

| Account | Role | Join Order | Payout Cycle |
|---------|------|------------|--------------|
| Alice | Creator | 1 | Cycle 1 |
| Bob | Member | 2 | Cycle 2 |
| Charlie | Member | 3 | Cycle 3 |
| Diana | Member | 4 | Cycle 4 |

**Group Configuration:**
- Contribution: 100 XLM per cycle
- Cycle Duration: 7 days
- Max Members: 4
- Total Pool per Cycle: 400 XLM

## Next Steps

After the demo, guide users to:
1. [Architecture Documentation](../docs/architecture.md)
2. [API Reference](../docs/api-reference.md)
3. [Deployment Guide](../docs/deployment.md)
4. [Contributing Guidelines](../CONTRIBUTING.md)

---

**Demo Duration:** ~15-20 minutes
**Difficulty:** Beginner-friendly
**Prerequisites:** Basic Stellar knowledge
