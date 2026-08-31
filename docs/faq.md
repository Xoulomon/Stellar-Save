# Frequently Asked Questions (FAQ) 🔍

Welcome to the **Stellar-Save FAQ**! This comprehensive document addresses common questions, operational mechanics, troubleshooting scenarios, and community queries.

> [!TIP]
> **Quick Search:** Press `Ctrl + F` (Windows/Linux) or `Cmd + F` (Mac) to quickly search for specific keywords or error codes.

---

## 🗺️ Table of Contents

- [🎒 1. Wallet Setup & Testnet Faucets](#-1-wallet-setup--testnet-faucets)
- [🏗️ 2. Group Creation & Parameters](#-2-group-creation--parameters)
- [🪙 3. Contribution Mechanics & Escrow](#-3-contribution-mechanics--escrow)
- [⏱️ 4. Payout Timing & Cycle Rotations](#-4-payout-timing--cycle-rotations)
- [⚠️ 5. "What happens if I miss a contribution?" (Penalties & Late Rules)](#-5-what-happens-if-i-miss-a-contribution-penalties--late-rules)
- [🔐 6. Smart Contract & Security Guarantees](#-6-smart-contract--security-guarantees)
- [🛠️ 7. Troubleshooting Common Transaction Failures](#-7-troubleshooting-common-transaction-failures)
- [🌍 8. Community & Contribution Programs](#-8-community--contribution-programs)

---

## 🎒 1. Wallet Setup & Testnet Faucets

### Q1.1: Which cryptocurrency wallets can I use with Stellar-Save?
Stellar-Save supports any wallet that integrates with Stellar's Soroban smart contract environment. The primary recommended wallet is **Freighter** (available as a web extension for Chrome, Brave, Firefox, and Edge). You can also use **Lobstr** or **Albedo** for wallet connection.

### Q1.2: How do I configure my Freighter wallet for Stellar-Save development?
To interact with Stellar-Save during development and staging:
1. Open the Freighter extension.
2. Go to **Settings** (gear icon) -> **Preferences** -> **Experimental Features**.
3. Toggle **Enable Soroban** to `ON`.
4. Switch your network from `Public` to `Testnet` using the network dropdown in the top bar.

### Q1.3: How do I get test network funds (XLM) to test the app?
For testnet development, you do not need real money. You can request free testnet XLM from the **Stellar Friendbot faucet**:
* **Using browser:** Visit `https://friendbot.stellar.org/?addr=<YOUR_STELLAR_ADDRESS>`
* **Using Stellar CLI:** 
  ```bash
  stellar keys generate deployer --network testnet
  ```
  This command automatically calls Friendbot to fund your newly generated identity with 10,000 testnet XLM!

### Q1.4: Why does Freighter say "Connection Blocked" or fail to prompt?
This is typically caused by one of two scenarios:
1. **DApp Authorization**: The frontend application has not been granted permission. Click the Freighter extension icon, unlock your wallet, and look for an authorization prompt, or refresh the page and click "Connect Wallet".
2. **Local Port Incompatibility**: Secure browser sandboxing might block script injection from `localhost`. Ensure you are running your local frontend over a supported development server and that your Freighter extension is updated to the latest version.

---

## 🏗️ 2. Group Creation & Parameters

### Q2.1: What are the limits on group size (max members) when creating a group?
By default, savings groups have boundaries enforced by the contract's configuration (`ContractConfig`):
* **Minimum members**: Enforced at `2` (a ROSCA requires at least two participants).
* **Maximum members**: The default is capped at `20` members to manage cycle duration risk, though this can be configured differently by the contract admin.
Creating a group with members outside these boundaries will fail with `StellarSaveError::InvalidState`.

### Q2.2: Can we adjust the contribution amount or cycle duration after a group has been created?
**No.** Once a group is created, all parameters—including the `contribution_amount`, `cycle_duration`, `max_members`, and the rotating payout order—are permanently locked on-chain in storage (`Group` struct). This prevents a group creator or late-joining member from changing rules unfairly after participants have committed funds.

### Q2.3: What cycles durations are supported?
You can configure the cycle duration to any time window in seconds during group creation. Common presets include:
* **Weekly**: `604800` seconds
* **Bi-weekly**: `1209600` seconds
* **Monthly** (30 days): `2592000` seconds
The contract validates that the duration is greater than zero, and if a `ContractConfig` is present, that it falls within the authorized bounds (e.g., between 1 day and 365 days).

---

## 🪙 3. Contribution Mechanics & Escrow

### Q3.1: How are contributions secure? Where do my tokens go?
When you call the `contribute` function, the smart contract utilizes Stellar's secure escrow mechanism. Funds are transferred directly from your wallet address into the contract's unique address via the SEP-41 token standard. They are locked securely in the contract state under that specific group's escrow pool and cannot be accessed by anyone, including the group creator, until a payout is executed.

### Q3.2: Do I need to approve the contract before contributing?
Yes. If the savings group uses a custom SEP-41 token (like USDC or EURC), you must first grant the contract an **allowance** to transfer the contribution amount on your behalf.
* In the frontend, the app will automatically prompt you to sign a token `approve` transaction before prompting the `contribute` transaction.
* If you are calling the contract directly via CLI, you must call `approve(member, contract_address, amount)` on the token contract first. Otherwise, the call will fail with a `TokenTransferFailed` error.

### Q3.3: Can I contribute more than the set contribution amount to get a double payout?
**No.** The contract enforces exact amount checks. If you try to call `contribute` with an amount other than `group.contribution_amount`, the smart contract will immediately reject the transaction with a `StellarSaveError::InvalidAmount` error, and no tokens will leave your wallet.

### Q3.4: What are the network gas fees for contributing?
Stellar's Soroban fees are incredibly cheap, usually costing less than **0.001 XLM** (a tiny fraction of a cent) per transaction. This makes micro-savings groups highly viable compared to other L1 blockchains.

---

## ⏱️ 4. Payout Timing & Cycle Rotations

### Q4.1: When exactly does a payout happen?
Payouts are completely automated. The contract evaluates the state of the group immediately after a successful contribution.
* **Instant Payout**: The moment the *last* member of the group submits their contribution for the current cycle, the contract automatically executes the payout function within the very same transaction block. The full pool is sent to the scheduled recipient instantly.
* **No Manual Execution**: Members do not need to wait for a creator to click "payout" or manually claim their funds.

### Q4.2: How is the rotating payout order determined?
By default, the payout order is established by the order in which members join the group.
* The first member to join is assigned **Position 0** (receives payout at the end of Cycle 0).
* The second member is assigned **Position 1** (Cycle 1).
* Subsequent members are assigned positions in incrementing order up to `max_members - 1`.

### Q4.3: How does the contract calculate the current cycle index?
The contract uses a robust elapsed time helper function:
$$\text{Current Cycle} = \min\left(\left\lfloor \frac{\text{Current Ledger Time} - \text{Started At}}{\text{Cycle Duration}} \right\rfloor, \text{Max Members} - 1\right)$$
If a group has not yet been started (i.e. not all members have joined), or if the ledger clock experiences minor skews, the helper safely returns `0` without panicking.

---

## ⚠️ 5. "What happens if I miss a contribution?" (Penalties & Late Rules)

> [!IMPORTANT]
> A member is considered "late" if they fail to submit their contribution before the cycle time window expires. A group cannot progress to the next cycle until all contributions for the current cycle are recorded.

```
Cycle N Starts ──► [Contribution Window] ──► Member Misses Deadline ──► Group Stalled (No Payout) ──► Late Member Contributes + Penalty ──► Payout Executed ──► Cycle N+1 Starts
```

### v1.0 Operational Handling (Current)
In the initial release, the escrow pool must be fully funded before a payout can be released.
* **Group Freezing**: If a member misses a deadline, the group's payout is stalled. Subsequent cycles cannot proceed because the payout recipient position is bound to the current cycle index.
* **Resolution**: The group remains in an "Active but Stalled" state until the late member submits their contribution, at which point the payout instantly fires and the next cycle immediately unlocks.

### Planned v2.0 Penalty Mechanisms
To discourage late payments and protect participating members, we are building several penalty mechanisms into the roadmap:

1.  **Late Contribution Fees (Dynamic Penalty)**:
    A configurable penalty percentage (e.g., 5% to 10% of the contribution amount) is applied to the late member. The extra fee collected is pooled and distributed as a "cooperation bonus" to the other members who paid on time.
2.  **Delayed Payout Queue Re-ordering**:
    Members who miss contributions are systematically pushed to the end of the rotating payout queue (assigned the last cycle positions), meaning they lose the privilege of receiving an early pool payout.
3.  **Configurable Grace Periods**:
    Group creators can set a "Grace Period" (e.g., 24 or 48 hours). A payment submitted within the grace period is marked "Late" but incurs no monetary fee; payments beyond the grace period incur the full penalty.
4.  **On-Chain Dispute Flags**:
    If a member permanently defaults or goes unresponsive, a dispute mechanism will allow the remaining members to collectively vote to expel the defaulting member and dissolve the group, distributing locked escrow funds back to active members proportionally.

---

## 🔐 6. Smart Contract & Security Guarantees

### Q6.1: Are my savings safe from being stolen by the group creator?
**Yes.** The group creator has **no custodial power** over your funds once they are in the escrow pool. The smart contract acts as a trustless third party. The only creator-exclusive functions are:
* `pause_group`: Halts new contributions/payouts in an emergency.
* `unpause_group`: Resumes normal operations.
Neither of these allows the creator to withdraw other members' funds.

### Q6.2: How does the contract prevent reentrancy attacks?
Stellar-Save implements a strict **Reentrancy Guard** on all state-modifying transfer entry points. The contract checks and locks a reentrancy flag in storage at the beginning of a contribution or payout transfer call and releases it only upon exit, blocking nested recursive transaction calls.

### Q6.3: Where can I audit the contract code?
Our smart contracts are completely open-source and public goods. You can audit the Rust implementation, error mappings, and validation checks directly in the repository at [contracts/stellar-save/src/](file:///c:/Users/user/Documents/Wave%205/Stellar-Save/contracts/stellar-save/src/).

---

## 🛠️ 7. Troubleshooting Common Transaction Failures

This section describes specific error codes returned by the smart contract and how to resolve them.

### Q7.1: Error: `InvalidAmount` (Error Code: 1002)
* **Why it happens**: You attempted to contribute a token amount that does not match `group.contribution_amount` exactly, or submitted a zero value.
* **Resolution**: Verify the required contribution in the group info card. Adjust your transaction parameters to send the exact amount.

### Q7.2: Error: `InvalidState` (Error Code: 1001)
* **Why it happens**: You attempted an action that is disallowed by the group's current status.
  * Trying to `join_group` a group that is already `Active`, `Completed`, or `Cancelled`.
  * Trying to `contribute` to a group that is `Paused` or `Pending`.
  * Trying to create/update a group with out-of-bounds config parameters (e.g. `max_members < 2`).
* **Resolution**: Check the group's status on the dashboard. If the group is paused, wait for the creator to call `unpause_group` before retrying.

### Q7.3: Error: `AlreadyContributed` (Error Code: 2002)
* **Why it happens**: You have already successfully submitted your contribution for the current active cycle. Double payments in a single cycle are blocked.
* **Resolution**: No action needed! Your contribution is recorded. Wait for the cycle to end and roll over.

### Q7.4: Error: `GroupNotFound` (Error Code: 4004)
* **Why it happens**: The `group_id` provided in the transaction parameters does not match any registered savings group in the contract's persistent storage.
* **Resolution**: Double-check the spelling/characters of your Group ID. If copying a link, ensure no trailing spaces are present.

### Q7.5: Error: `TokenTransferFailed` (Error Code: 5002)
* **Why it happens**: The contract failed to pull the custom SEP-41 tokens from your wallet address during `contribute()`. This occurs if you have an insufficient balance of that token or forgot to approve the contract allowance.
* **Resolution**:
  1. Confirm your wallet has a sufficient token balance.
  2. Ensure you have authorized a sufficient allowance for the smart contract address.
  3. Ensure you have a tiny amount of XLM to cover Stellar network transaction fees.

### Q7.6: Freighter Wallet Error: "Host Closed / Timeout"
* **Why it happens**: The connection between Freighter and the Stellar RPC node timed out, or local network latency is high.
* **Resolution**:
  1. Go to Freighter Settings -> Network, and verify that the RPC URL is correct and active (e.g., `https://soroban-testnet.stellar.org` for Testnet).
  2. Refresh the Stellar-Save frontend browser tab and reconnect your wallet.

---

## 🌍 8. Community & Contribution Programs

### Q8.1: How does Stellar-Save participate in Drips Wave?
Stellar-Save is an approved public goods project under the **Drips Wave** program. Contributors can earn funding by taking on designated development, testing, and documentation issues.
* Each open issue has an assigned point value (100–200 points).
* Once your PR is reviewed and merged, you receive points that convert to USDC at the end of the Wave cycle.
* Read the **[Wave Contributor Guide](wave-guide.md)** for complete rules.

### Q8.2: Where can I ask more questions or get development help?
We have an extremely active and welcoming community!
* **GitHub Discussions**: Post questions, ideas, and showcase work at [Stellar-Save Discussions](https://github.com/Xoulomon/Stellar-Save/discussions).
* **Telegram Channel**: Join us for quick chat at [@Xoulomon](https://t.me/Xoulomon).
* **Developer Issues**: Submit bugs and tasks at [Stellar-Save GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues).
