# Stellar-Save User Guide - Getting Started

## What is Stellar-Save?

**Stellar-Save** is a decentralized **ROSCA** (Rotating Savings and Credit Association) built on the Stellar blockchain using Soroban smart contracts.

### What is a ROSCA?
ROSCA is a traditional savings system where:
1. **Group forms** (3-20 members)
2. **Fixed contribution** each cycle (e.g., 10 XLM weekly)
3. **One member receives FULL POOL** each cycle (10 XLM × members)
4. **Rotates fairly** until everyone receives payout
5. **No banks, no interest** - pure peer-to-peer savings

**Example**: 5 members × 10 XLM weekly = 50 XLM payout rotates weekly.

## Prerequisites
- [Stellar wallet](https://stellar.org/labs#wallet) with testnet XLM
- [Soroban RPC](https://soroban.stellar.org/) (Futurenet/Testnet)
- Frontend: [Stellar-Save UI](frontend/) or Soroban SDK

## Step 1: Create Your First Group

### Using Frontend (Recommended)
1. Visit deployed app → **"Create Group"**
2. Set:
   - **Contribution**: 10 XLM (10000000 stroops)
   - **Cycle**: 7 days
   - **Max Members**: 5-10
3. **Invite friends** to join (share Group ID)

### Using Soroban CLI / SDK
```bash
# Deploy contract first
soroban contract deploy \
  --wasm target/soroban/stellar-save.wasm \
  --source YOUR_ACCOUNT \
  --network futurenet

# Create group (returns group_id)
soroban contract invoke \
  --id CONTRACT_ID \
  -- create_group \
  --arg_address YOUR_WALLET \
  --arg_i128 10000000 \  # 10 XLM
  --arg_u64 604800 \     # 7 days
  --arg_u32 5            # max members
```

**Result**: Group ID (e.g., `12345`) - **SHARE THIS!**

## Step 2: Join Existing Group

### Frontend
1. **"Join Group"** → Enter Group ID
2. **Confirm** → You're member #2/5

### CLI/SDK
```rust
let client = StellarSaveContractClient::new(&env, &contract_id);
client.join_group(&env, &group_id, &your_wallet)?;
```

**Status**: `Pending` → members join → reaches min_members → activator starts

## Step 3: Make Contributions

**Every cycle** (weekly), ALL members contribute **EXACT AMOUNT**.

### Frontend
**"Contribute"** button → Auto-fills exact amount → Confirm

### CLI/SDK
```rust
// Validate amount first
client.validate_contribution_amount(&env, &group_id, &10000000)?;

// Contribute (frontend handles this)
```

**Missed?** → `get_missed_contributions()` tracks → reminders sent.

**Cycle Complete** when all contributed → **Payout executes**!

## Step 4: Receive Your Payout

**Automatic**: When your turn (payout_position):
1. All contribute → `is_payout_due()` = true
2. `transfer_payout()` → **50 XLM to your wallet**
3. Next cycle begins

**Check your position**:
```rust
let position = client.get_payout_position(&env, &group_id, &your_wallet)?;
let next_payout = client.get_next_payout_cycle(&env, &group_id)?;
```

## Complete Workflow Example

```
Week 1: Create Group ID=12345 (10 XLM, 7 days, 5 members)
Week 1: Members 1-5 join
Week 2: All contribute 10 XLM → Member #1 gets 50 XLM
Week 3: All contribute → Member #2 gets 50 XLM
...
Week 5: All contribute → Member #5 gets 50 XLM ✓
```

## Frontend Quick Start

```bash
cd frontend
npm install
npm run dev
```

**Features**:
- ✅ Create/Join groups
- ✅ Auto contribution amounts
- ✅ Cycle countdowns (`get_contribution_deadline`)
- ✅ Payout queue visualization
- ✅ Member dashboards

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "GroupNotFound (1001)" | Wrong Group ID |
| "AlreadyContributed (3002)" | Wait next cycle |
| "GroupFull (1002)" | Try different group |
| "InvalidAmount (3001)" | Use **exact** group amount |
| No payout? | Check `is_payout_due()` + `is_cycle_complete()` |

**Monitor**: `is_complete()`, `get_group_balance()`, `get_total_paid_out()`

## Testnet Faucet
```
https://laboratory.stellar.org/#/?network=futurenet&funder=false
```

## Next Steps
1. [API Reference →](../api/CONTRACT_API.md)
2. [Deployment Guide →](deployment.md)
3. Build your first ROSCA! 🚀

---
*Stellar-Save v1.0 - Powered by Soroban*

