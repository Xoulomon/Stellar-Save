# Frequently Asked Questions (FAQ)

Welcome to the Stellar-Save FAQ! This page addresses common questions and concerns from our community.

🔍 **Search this FAQ:** Use `Ctrl + F` (Windows/Linux) or `Cmd + F` (Mac) to quickly find specific questions or keywords.

## Table of Contents

- [Getting Started](#getting-started)
- [Groups & Contributions](#groups--contributions)
- [Payouts & Rotations](#payouts--rotations)
- [Technical & Security](#technical--security)
- [Community & Contributions](#community--contributions)

---

## Getting Started

### What is Stellar-Save?
Stellar-Save is a decentralized rotating savings and credit association (ROSCA) built on Stellar Soroban smart contracts. It digitalizes traditional community savings systems (like Ajo or Esusu), enabling users to contribute a fixed amount regularly and take turns receiving the total pool.

### Do I need a bank account to use Stellar-Save?
No! Stellar-Save is designed for financial inclusion. All you need is a Stellar-compatible wallet and an internet connection.

### Which wallets are supported?
Currently, you can use any Stellar wallet that supports Soroban smart contracts, such as **Freighter**, **Lobstr**, or **Albedo**.

### Are there any fees?
Stellar-Save itself does not charge additional platform fees. However, you will need to pay standard Stellar network transaction fees (which are typically a fraction of a cent).

---

## Groups & Contributions

### How do I join a group?
You can join a group by providing the `group_id` through the frontend interface or directly interacting with the smart contract using the `join_group(group_id)` function. Note that groups have a maximum member limit.

### What happens if someone misses a contribution?
In the current version (v1.0), the system waits for all members to complete their contributions for the cycle before executing a payout. Future updates (v2.0) will introduce flexible payout schedules and penalty mechanisms for missed or late contributions.

### Can I leave a group early?
Once a cycle begins and funds are locked in the escrow, you cannot unilaterally withdraw them. This is to ensure trust and fairness for all participants. If a group needs to be halted, the creator can use the emergency pause functionality.

### Can we change the contribution amount later?
No. To maintain fairness, the `contribution_amount`, `cycle_duration`, and `max_members` are fixed upon group creation. 

---

## Payouts & Rotations

### How is the payout order determined?
Payouts rotate systematically among members. In current versions, the payout order is generally based on the order in which members joined the group.

### Are payouts automatic?
Yes! Once all members have made their required contribution for the current cycle, the contract automatically processes and sends the payout to the next scheduled recipient. There is no manual intervention required.

### What happens if the group creator pauses the group?
In emergency situations, the group creator can pause the group (`pause_group`), halting all new contributions and payouts. The creator can resume normal operations by calling `unpause_group`.

---

## Technical & Security

### Are my funds secure?
Yes. Stellar-Save is built on the robust Stellar Soroban smart contract platform. Contributions are held securely in a trustless, decentralized escrow mechanism on-chain. For more details, review our [Threat Model & Security](threat-model.md) and [Storage Layout](storage-layout.md) documentation.

### What assets/tokens are supported?
Currently, Stellar-Save natively supports **Stellar Lumens (XLM)**. Support for custom Stellar assets (such as USDC, EURC) is planned for the v1.1 roadmap update.

### Where can I see the transaction history?
Since all operations are on-chain, you can view transparent contribution and payout histories using the Stellar Horizon API or any Stellar network explorer.

---

## Community & Contributions

### How can I contribute to Stellar-Save?
We welcome contributions from everyone! Whether it's fixing bugs, adding new features, or improving documentation, you can fork the repository and open a Pull Request. Check out our [Contributing Guidelines](../CONTRIBUTING.md) for more details.

### What is Drips Wave?
Stellar-Save participates in **Drips Wave**, a public goods funding program. By resolving issues labeled with `wave-ready`, you can earn points and receive funding. See the [Wave Contributor Guide](wave-guide.md) to learn more.

### I found a bug. What should I do?
Please report any issues or bugs on our [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues) page. If it is a security vulnerability, please refer to our [SECURITY](../SECURITY.md) guidelines for responsible disclosure.

---
*Note: This FAQ is updated regularly based on community feedback. If you have a question that isn't answered here, please join our [GitHub Discussions](https://github.com/Xoulomon/Stellar-Save/discussions).*
