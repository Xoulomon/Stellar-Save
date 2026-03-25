# Stellar-Save User Guide

Welcome to Stellar-Save — a decentralized rotational savings platform built on the Stellar blockchain. This guide walks you through everything you need to start saving with your community.

---

## Table of Contents

- [Getting Started](#getting-started)
- [How to Create a Group](#how-to-create-a-group)
- [How to Join a Group](#how-to-join-a-group)
- [Contributing to a Cycle](#contributing-to-a-cycle)
- [Payout Mechanics](#payout-mechanics)
- [FAQ](#faq)

---

## Getting Started

### What is Stellar-Save?

Stellar-Save is a digital version of the traditional community savings system known as Ajo or Esusu in West Africa. A group of people pool a fixed amount of money each cycle, and one member receives the full pool. This rotates until every member has received a payout.

### What You Need

Before using Stellar-Save, make sure you have:

1. **A Stellar wallet** — We recommend [Freighter](https://www.freighter.app/), a free browser extension wallet
2. **XLM (Stellar Lumens)** — The native currency used for contributions. You can get XLM from any major exchange
3. **A modern web browser** — Chrome, Firefox, or Brave

### Setting Up Your Wallet

1. Install the [Freighter wallet extension](https://www.freighter.app/)
2. Create a new wallet and securely save your recovery phrase — **never share this with anyone**
3. Fund your wallet with enough XLM to cover your group's contribution amount plus a small amount for transaction fees (~0.1 XLM per transaction)
4. Visit the Stellar-Save app and click **Connect Wallet**
5. Approve the connection request in Freighter

### Choosing a Network

- **Testnet** — Use this to practice with test XLM (no real money). Recommended for first-time users
- **Mainnet** — Real XLM, real savings. Switch to this when you're ready

---

## How to Create a Group

Creating a group makes you the group creator. You set the rules — everyone who joins agrees to them.

### Step 1 — Open the Create Group Form

From the dashboard, click **Create Group**.

### Step 2 — Configure Your Group

Fill in the following details:

| Field | Description | Example |
|-------|-------------|---------|
| Contribution Amount | Fixed XLM amount each member pays per cycle | 100 XLM |
| Cycle Duration | How long each cycle lasts (in seconds) | 604800 (7 days) |
| Max Members | Maximum number of members allowed | 5 |

**Tips:**
- Choose a contribution amount everyone in your group can comfortably afford
- Shorter cycles (e.g. weekly) keep momentum; longer cycles (e.g. monthly) give members more time
- The total payout per cycle = contribution amount × number of members

### Step 3 — Confirm and Sign

Click **Create Group**. Freighter will ask you to sign the transaction. Review the details and approve.

### Step 4 — Share Your Group

Once created, your group will have a unique **Group ID**. Share this ID with the people you want to invite. The group stays in `Pending` status until enough members join and you activate it.

### Managing Your Group

As the creator, while the group is still `Pending` you can:
- Update the contribution amount, cycle duration, or max members
- Delete the group if plans change

Once the group is `Active`, settings are locked.

---

## How to Join a Group

### Step 1 — Get the Group ID

Ask the group creator to share the Group ID with you.

### Step 2 — Find the Group

From the dashboard, click **Join Group** and enter the Group ID. You'll see the group details — contribution amount, cycle duration, and current member count.

### Step 3 — Review the Terms

Before joining, confirm you understand:
- The exact contribution amount required each cycle
- The cycle duration (how often you need to contribute)
- The maximum number of members (determines how many cycles before you receive your payout)

### Step 4 — Join and Sign

Click **Join Group**. Freighter will ask you to sign the transaction. Approve it to become a member.

### Your Payout Position

When you join, you are assigned a **payout position** — this determines which cycle you receive the full pool. Positions are assigned in join order (first come, first served) by default.

> **Example:** In a 5-member group, if you join third, you receive the payout in cycle 3.

### Rate Limiting

To prevent spam, there is a short waiting period (2 minutes) between join attempts. If you see a "rate limit" error, wait a moment and try again.

---

## Contributing to a Cycle

Every member must contribute the fixed amount each cycle for the payout to be triggered.

### When to Contribute

Each cycle has a deadline. You can contribute any time after a cycle starts and before the deadline. Check the group dashboard to see:
- The current cycle number
- How many members have contributed so far
- The time remaining in the cycle

### How to Contribute

1. Open the group from your dashboard
2. Click **Contribute**
3. Freighter will show the exact amount to be sent — confirm and sign
4. Your contribution is recorded on-chain immediately

### Rules

- You can only contribute **once per cycle**
- The amount must be **exactly** the group's configured contribution amount — no more, no less
- You must be an active member of the group

### Missed Contributions

If you miss a cycle deadline, your contribution for that cycle is recorded as missed. Repeated missed contributions may affect your standing in the group. Always contribute before the deadline.

---

## Payout Mechanics

### How Payouts Work

When **all members** have contributed in a cycle, the payout is automatically triggered. The full pool is sent to the member whose payout position matches the current cycle number.

```
Payout Amount = Contribution Amount × Number of Members
```

> **Example:** 5 members each contributing 100 XLM → 500 XLM payout per cycle

### Payout Order

Payout positions are assigned when members join:
- Position 0 → receives payout in Cycle 0 (first cycle)
- Position 1 → receives payout in Cycle 1
- Position 2 → receives payout in Cycle 2
- ...and so on

### Receiving Your Payout

You don't need to do anything to receive your payout — it is sent automatically to your wallet address as soon as all members contribute in your cycle. You'll see the funds arrive in your Freighter wallet.

### Group Completion

Once every member has received their payout, the group moves to `Completed` status. No further contributions or payouts occur. You're free to create or join a new group.

### Checking Payout Status

From the group dashboard you can see:
- Which cycle is currently active
- Who has received payouts in past cycles
- When your payout cycle is expected (based on cycle duration)

---

## FAQ

**Q: Is my money safe?**
All funds are held by the smart contract on the Stellar blockchain — not by any individual or company. The contract code is open source and auditable by anyone.

---

**Q: What happens if someone doesn't contribute?**
The payout for that cycle cannot be triggered until all members contribute. If a member misses the deadline, the group may be stalled. Future versions will include penalty mechanisms to handle this automatically.

---

**Q: Can I leave a group after joining?**
You can leave a group while it is still in `Pending` status (before it activates). Once a group is `Active`, leaving is not supported in v1.0 to protect other members who are depending on your contributions.

---

**Q: What are transaction fees?**
Each action (join, contribute, etc.) requires a small Stellar network fee, typically less than 0.001 XLM. Make sure your wallet has a small buffer above your contribution amount to cover fees.

---

**Q: Can I be in multiple groups at the same time?**
Yes. You can join as many groups as you like, as long as you can meet the contribution requirements for each.

---

**Q: What is the minimum/maximum contribution amount?**
This is set by the contract administrator. Check the app for current limits. In general, contributions must be a positive XLM amount within the configured range.

---

**Q: What network should I use?**
Use **Testnet** to practice with no real money. Switch to **Mainnet** when you're ready to save with real XLM.

---

**Q: I approved a transaction but nothing happened. What do I do?**
Wait a few seconds for the Stellar network to confirm the transaction. If it still doesn't appear, check your transaction history in Freighter. If the transaction failed, you'll see an error — try again or contact support via [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues).

---

**Q: How do I know when it's my turn to receive the payout?**
Your payout position is shown on your group dashboard. You can calculate your expected payout cycle: if you're position 3 in a group with 7-day cycles, you'll receive your payout approximately 3 weeks after the group starts.

---

## Need More Help?

- Browse [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues) for known problems and solutions
- Start a [GitHub Discussion](https://github.com/Xoulomon/Stellar-Save/discussions) for questions
- Contact the team via Telegram: [@Xoulomon]

---

**Built with ❤️ for financial inclusion on Stellar**
