# Smart Contract Integration Guide

A comprehensive reference for developers integrating with the Stellar-Save Soroban smart contract.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Contract Functions](#contract-functions)
   - [Group Management](#group-management)
   - [Membership](#membership)
   - [Contributions](#contributions)
   - [Payouts](#payouts)
   - [Admin Controls](#admin-controls)
4. [Integration Patterns](#integration-patterns)
5. [Code Samples](#code-samples)
6. [Error Reference](#error-reference)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Stellar-Save is a Soroban smart contract implementing a ROSCA (Rotating Savings and Credit Association). Members contribute a fixed amount each cycle; one member receives the full pool per cycle, rotating until everyone has been paid out.

**Contract source:** `contracts/stellar-save/src/lib.rs`  
**Network:** Stellar testnet / mainnet  
**Language:** Rust (Soroban SDK)

---

## Prerequisites

- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli) v22+
- [soroban-sdk](https://crates.io/crates/soroban-sdk) (Rust) or [stellar-sdk](https://www.npmjs.com/package/@stellar/stellar-sdk) (JavaScript/TypeScript)
- A funded Stellar account (use [Friendbot](https://friendbot.stellar.org) on testnet)
- The deployed contract ID (see [Deployment Guide](deployment.md))

---

## Contract Functions

All amounts are in **stroops** (1 XLM = 10,000,000 stroops). Durations are in **seconds**.

### Group Management

#### `create_group`

Creates a new savings group on-chain. The caller becomes the group creator/admin.

```
create_group(
  contribution_amount: i128,
  cycle_duration:      u64,
  max_members:         u32
) -> u64
```

| Parameter | Type | Description |
|---|---|---|
| `contribution_amount` | `i128` | Fixed XLM amount each member contributes per cycle (stroops) |
| `cycle_duration` | `u64` | Length of each cycle in seconds (e.g. `604800` = 1 week) |
| `max_members` | `u32` | Maximum number of members (determines rotation length) |

Returns the new `group_id`.

**Constraints:** `max_members >= 2`, `contribution_amount > 0`, `cycle_duration > 0`.

---

#### `get_group`

Fetches the current state of a group.

```
get_group(group_id: u64) -> Group
```

The returned `Group` struct contains:

```rust
pub struct Group {
    pub id:                  u64,
    pub creator:             Address,
    pub contribution_amount: i128,
    pub cycle_duration:      u64,
    pub max_members:         u32,
    pub current_cycle:       u32,
    pub status:              GroupStatus,  // Active | Paused | Complete
}
```

---

#### `list_members`

Returns all member addresses in join order.

```
list_members(group_id: u64) -> Vec<Address>
```

---

### Membership

#### `join_group`

Adds the transaction signer to a group. Must be called before the group is full or complete.

```
join_group(group_id: u64)
```

The caller's payout position is assigned sequentially based on join order (first joiner = position 0).

---

#### `is_member`

Checks whether an address is a member of a group.

```
is_member(group_id: u64, address: Address) -> bool
```

---

### Contributions

#### `contribute`

Records a contribution for the current cycle. Transfers `contribution_amount` XLM from `member` to the contract escrow.

```
contribute(
  group_id: u64,
  member:   Address,
  amount:   i128
)
```

`amount` must exactly equal the group's `contribution_amount`. The `member` address must authorise this call.

---

#### `get_contribution_status`

Returns which members have contributed in a given cycle.

```
get_contribution_status(
  group_id:     u64,
  cycle_number: u32
) -> Vec<(Address, bool)>
```

Each tuple is `(member_address, has_contributed)`.

---

### Payouts

#### `execute_payout`

Distributes the pooled funds to the next recipient in the rotation. Called automatically when all members have contributed in the current cycle, or manually by any member.

```
execute_payout(group_id: u64)
```

Fails if not all members have contributed in the current cycle.

---

#### `is_complete`

Returns `true` when all members have received a payout.

```
is_complete(group_id: u64) -> bool
```

---

### Admin Controls

These functions require the caller to be the group creator.

#### `pause_group`

Halts contributions and payouts. Use in emergencies or disputes.

```
pause_group(group_id: u64, caller: Address)
```

#### `unpause_group`

Resumes a paused group.

```
unpause_group(group_id: u64, caller: Address)
```

---

## Integration Patterns

### Pattern 1: Full Group Lifecycle

```
create_group → join_group (×N members) → contribute (×N per cycle) → execute_payout → repeat until is_complete
```

### Pattern 2: Read-Only Monitoring

Poll `get_group` and `get_contribution_status` to display group state without submitting transactions. No auth required.

### Pattern 3: Event-Driven Updates

Subscribe to Soroban contract events to receive real-time updates instead of polling:

| Event | Emitted When |
|---|---|
| `group_created` | `create_group` succeeds |
| `member_joined` | `join_group` succeeds |
| `contribution_made` | `contribute` succeeds |
| `payout_executed` | `execute_payout` succeeds |
| `group_paused` | `pause_group` succeeds |
| `group_completed` | Last payout executed |

### Pattern 4: Calling from Another Contract

```rust
use soroban_sdk::{contract, contractimpl, Address, Env};

// Import the Stellar-Save contract client
mod stellar_save {
    soroban_sdk::contractimport!(
        file = "path/to/stellar_save.wasm"
    );
}

#[contractimpl]
impl MyContract {
    pub fn check_membership(env: Env, stellar_save_id: Address, group_id: u64, member: Address) -> bool {
        let client = stellar_save::Client::new(&env, &stellar_save_id);
        client.is_member(&group_id, &member)
    }
}
```

---

## Code Samples

### TypeScript / JavaScript

```typescript
import { Contract, SorobanRpc, TransactionBuilder, Networks, BASE_FEE } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const CONTRACT_ID = 'C...'; // your deployed contract ID

// Create a group
async function createGroup(
  sourceKeypair: Keypair,
  contributionXlm: number,
  cycleDays: number,
  maxMembers: number
): Promise<bigint> {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(contract.call(
      'create_group',
      nativeToScVal(BigInt(contributionXlm * 10_000_000), { type: 'i128' }),
      nativeToScVal(BigInt(cycleDays * 86400),            { type: 'u64' }),
      nativeToScVal(maxMembers,                           { type: 'u32' })
    ))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(sourceKeypair);
  const result = await server.sendTransaction(prepared);
  // parse result.returnValue for the group_id
  return scValToNative(result.returnValue) as bigint;
}

// Check contribution status
async function getContributionStatus(groupId: bigint, cycle: number) {
  const contract = new Contract(CONTRACT_ID);
  const result = await server.simulateTransaction(
    new TransactionBuilder(/* ... */)
      .addOperation(contract.call(
        'get_contribution_status',
        nativeToScVal(groupId, { type: 'u64' }),
        nativeToScVal(cycle,   { type: 'u32' })
      ))
      .build()
  );
  return scValToNative(result.result.retval);
}
```

### Rust (off-chain client)

```rust
use stellar_sdk::{Client, Keypair, Network};

async fn join_and_contribute(
    contract_id: &str,
    member_secret: &str,
    group_id: u64,
    amount: i128,
) -> anyhow::Result<()> {
    let keypair = Keypair::from_secret(member_secret)?;
    let client  = Client::new(Network::Testnet);

    // Join the group
    client
        .invoke_contract(contract_id, "join_group", vec![group_id.into()])
        .sign(&keypair)
        .send()
        .await?;

    // Contribute
    client
        .invoke_contract(contract_id, "contribute", vec![group_id.into(), keypair.public_key().into(), amount.into()])
        .sign(&keypair)
        .send()
        .await?;

    Ok(())
}
```

### Stellar CLI

```bash
# Create a group (10 XLM/cycle, weekly, 5 members)
stellar contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --source-account deployer \
  -- create_group \
  --contribution_amount 100000000 \
  --cycle_duration 604800 \
  --max_members 5

# Join a group
stellar contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --source-account member1 \
  -- join_group \
  --group_id 1

# Contribute
stellar contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --source-account member1 \
  -- contribute \
  --group_id 1 \
  --member $MEMBER1_ADDRESS \
  --amount 100000000

# Check if complete
stellar contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --source-account member1 \
  -- is_complete \
  --group_id 1
```

---

## Error Reference

| Error | Code | Cause | Resolution |
|---|---|---|---|
| `GroupNotFound` | — | `group_id` does not exist | Verify the group ID |
| `InvalidAmount` | — | `amount` ≠ `contribution_amount` | Use the exact group contribution amount |
| `AlreadyMember` | — | Caller already joined this group | No action needed |
| `GroupFull` | — | `max_members` reached | Join a different group |
| `GroupPaused` | — | Admin paused the group | Wait for admin to unpause |
| `GroupComplete` | — | All payouts executed | Group is finished |
| `NotAllContributed` | — | `execute_payout` called before all members contributed | Wait for remaining contributions |
| `Unauthorized` | — | Caller is not the group creator (admin functions) | Use the creator account |
| `InvalidState` | — | Operation not valid in current group state | Check `GroupStatus` before calling |

---

## Security Considerations

**Verify the contract ID.** Before integrating, confirm the contract ID on [Stellar Expert](https://stellar.expert) matches the one in this repository's deployment records. Never trust a contract ID from an untrusted source.

**Exact amounts only.** The contract rejects contributions that do not exactly match `contribution_amount`. Build your UI to pre-fill this value from `get_group` rather than accepting free-form input.

**Auth requirements.** `contribute` requires the `member` address to authorise the call. In a frontend context this means the user must sign the transaction with their wallet. Never sign on behalf of a user without explicit consent.

**Paused groups.** Check `group.status` before submitting contributions or payouts. Transactions against a paused group will fail and waste fees.

**Mainnet vs testnet.** Contract IDs differ between networks. Use environment variables to manage this; never hardcode a mainnet contract ID in shared code.

**No upgradeability.** The current contract has no upgrade mechanism. A new deployment produces a new contract ID. Communicate contract ID changes clearly to all integrators.

For the full threat model see [docs/threat-model.md](threat-model.md).

---

## Troubleshooting

**Transaction simulation fails with `HostError`**  
Usually means an argument type mismatch. Ensure amounts are `i128`, durations are `u64`, and member counts are `u32`.

**`stellar contract invoke` returns empty output**  
Functions that return `()` (void) produce no output. This is expected for `join_group`, `contribute`, `pause_group`, etc.

**Contribution rejected with `InvalidAmount`**  
Fetch the group with `get_group` and use `group.contribution_amount` exactly — do not round or convert independently.

**`execute_payout` fails**  
Call `get_contribution_status` first. All members must have `has_contributed = true` for the current cycle before payout can execute.

**RPC timeout**  
Soroban RPC endpoints occasionally time out under load. Retry with exponential back-off. For production use, consider running your own RPC node or using a paid provider.

**Need help?** Open an issue on [GitHub](https://github.com/Xoulomon/Stellar-Save/issues) or start a [Discussion](https://github.com/Xoulomon/Stellar-Save/discussions).
