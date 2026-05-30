# Video Tutorial Series

A series of short, focused tutorials covering every aspect of Stellar-Save — from first setup to advanced group management.

> **Status:** Scripts complete. Recording in progress. Videos will be published to the [Stellar-Save YouTube channel](#) and embedded here as they are released.

---

## Tutorial Index

| # | Title | Duration | Topics | Status |
|---|---|---|---|---|
| 1 | [Getting Started with Stellar-Save](#tutorial-1-getting-started) | ~8 min | Wallets, testnet setup, first login | 🎬 Scripted |
| 2 | [Creating Your First Savings Group](#tutorial-2-creating-a-group) | ~10 min | Group parameters, on-chain creation | 🎬 Scripted |
| 3 | [Joining a Group & Making Contributions](#tutorial-3-joining-and-contributing) | ~8 min | Joining, contributing XLM, cycle tracking | 🎬 Scripted |
| 4 | [Understanding Payouts & Rotation](#tutorial-4-payouts-and-rotation) | ~7 min | Payout order, automatic execution, completion | 🎬 Scripted |
| 5 | [Managing Your Group (Admin)](#tutorial-5-group-management) | ~9 min | Pause/unpause, member oversight, troubleshooting | 🎬 Scripted |
| 6 | [Deploying the Contract Yourself](#tutorial-6-deploying-the-contract) | ~12 min | Rust build, Stellar CLI, testnet deploy | 🎬 Scripted |
| 7 | [Security & Best Practices](#tutorial-7-security-and-best-practices) | ~6 min | Key management, threat model, safe usage | 🎬 Scripted |

---

## Tutorial 1: Getting Started

**Goal:** Set up a Stellar wallet, fund it on testnet, and connect to Stellar-Save.

### Script Outline

1. **Introduction** (1 min) — What is Stellar-Save? Why use a blockchain ROSCA?
2. **Install Freighter wallet** (2 min) — Browser extension, create account, back up seed phrase.
3. **Switch to testnet** (1 min) — Network selector in Freighter.
4. **Fund with Friendbot** (1 min) — `https://friendbot.stellar.org/?addr=<your-address>`.
5. **Connect to Stellar-Save** (2 min) — Open the app, click Connect Wallet, approve in Freighter.
6. **Tour the dashboard** (1 min) — Groups list, contribution history, wallet balance.

### Key Commands

```bash
# Fund testnet account via CLI
curl "https://friendbot.stellar.org/?addr=YOUR_ADDRESS"
```

### Captions & Translations

- English captions: included at upload
- Spanish, French, Yoruba: community translations welcome — see [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## Tutorial 2: Creating a Group

**Goal:** Create a new savings group with custom parameters.

### Script Outline

1. **Navigate to Create Group** (1 min)
2. **Set contribution amount** (2 min) — XLM amount per cycle; discuss choosing a realistic amount.
3. **Set cycle duration** (2 min) — Weekly vs monthly; on-chain time is in ledger seconds.
4. **Set max members** (1 min) — Determines total rotation length.
5. **Submit transaction** (2 min) — Freighter approval, transaction confirmation, group ID.
6. **Share your group** (2 min) — Copy group ID, invite members.

### Contract Call Reference

```typescript
// Frontend SDK call
const groupId = await contract.create_group({
  contribution_amount: BigInt(100_000_000), // 10 XLM in stroops
  cycle_duration: 604800,                   // 1 week in seconds
  max_members: 5
});
```

---

## Tutorial 3: Joining and Contributing

**Goal:** Join an existing group and make your first contribution.

### Script Outline

1. **Receive a group ID** (1 min) — How group IDs are shared.
2. **Join the group** (2 min) — `join_group` call, membership confirmation.
3. **Check cycle status** (1 min) — Who has contributed, who hasn't.
4. **Make a contribution** (3 min) — `contribute` call, XLM transfer, receipt.
5. **Track your position** (1 min) — Payout order in the rotation.

### Contract Call Reference

```typescript
await contract.join_group({ group_id: groupId });

await contract.contribute({
  group_id: groupId,
  member: walletAddress,
  amount: BigInt(100_000_000)
});
```

---

## Tutorial 4: Payouts and Rotation

**Goal:** Understand how automatic payouts work and what to expect when it's your turn.

### Script Outline

1. **How rotation works** (2 min) — Members take turns; order set at join time.
2. **Triggering a payout** (2 min) — All members contribute → `execute_payout` fires automatically.
3. **Receiving a payout** (1 min) — XLM arrives in your wallet; on-chain event emitted.
4. **Checking completion** (1 min) — `is_complete` returns true after all members have received.
5. **What happens after completion** (1 min) — Group is closed; start a new one.

### Contract Call Reference

```typescript
// Called automatically when all members have contributed
await contract.execute_payout({ group_id: groupId });

const done = await contract.is_complete({ group_id: groupId });
```

---

## Tutorial 5: Group Management

**Goal:** Use admin controls to manage a group safely.

### Script Outline

1. **Who is the admin** (1 min) — Group creator; stored on-chain.
2. **Pausing a group** (2 min) — When to pause (dispute, emergency), `pause_group` call.
3. **Resuming a group** (2 min) — `unpause_group`, communicating with members.
4. **Viewing member status** (2 min) — `list_members`, `get_contribution_status`.
5. **Common issues** (2 min) — Member missed contribution, wrong amount, network errors.

### Contract Call Reference

```typescript
await contract.pause_group({ group_id: groupId, caller: adminAddress });
await contract.unpause_group({ group_id: groupId, caller: adminAddress });

const members = await contract.list_members({ group_id: groupId });
const status  = await contract.get_contribution_status({ group_id: groupId, cycle_number: 1 });
```

---

## Tutorial 6: Deploying the Contract

**Goal:** Build and deploy the Stellar-Save contract to testnet from source.

### Script Outline

1. **Prerequisites** (1 min) — Rust 1.70+, Stellar CLI, funded deployer key.
2. **Clone and build** (3 min)
3. **Generate deployer key** (2 min)
4. **Deploy to testnet** (3 min)
5. **Verify deployment** (2 min) — Run `scripts/verify_contract.sh`.
6. **Save the contract ID** (1 min) — Update `.env`.

### Commands

```bash
# Build
./scripts/build.sh

# Generate deployer key
stellar keys generate deployer --network testnet

# Deploy
./scripts/deploy_testnet.sh

# Verify
export CONTRACT_ID=<deployed-id>
export STELLAR_NETWORK=testnet
export STELLAR_RPC_URL=https://soroban-testnet.stellar.org
export EXPECTED_WASM_HASH=$(sha256sum target/wasm32-unknown-unknown/release/stellar_save.wasm | awk '{print $1}')
bash scripts/verify_contract.sh
```

---

## Tutorial 7: Security and Best Practices

**Goal:** Use Stellar-Save safely and understand the threat model.

### Script Outline

1. **Seed phrase hygiene** (1 min) — Never share, store offline, use hardware wallet for mainnet.
2. **Testnet vs mainnet** (1 min) — Always test on testnet first; mainnet XLM has real value.
3. **Trust the contract, not the UI** (2 min) — Verify contract ID before transacting; check explorer.
4. **Group member vetting** (1 min) — Only join groups with people you trust.
5. **Emergency pause** (1 min) — Creators can halt a group; understand when this is appropriate.

### Further Reading

- [Threat Model](threat-model.md)
- [Security Policy](../SECURITY.md)
- [FAQ](faq.md)

---

## Contributing to the Series

We welcome community contributions:

- **Translations** — Translate captions into your language and open a PR adding the `.srt` file to `docs/captions/`.
- **New tutorials** — Propose a topic by opening a GitHub issue with the `docs` label.
- **Corrections** — If a script is outdated, open a PR updating this file.

## Feedback

After watching, please leave feedback via [GitHub Discussions](https://github.com/Xoulomon/Stellar-Save/discussions) or the issue tracker. We use viewer feedback to prioritise future tutorials.
