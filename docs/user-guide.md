# Stellar-Save User Guide

Welcome to Stellar-Save, a decentralized rotational savings and credit association (ROSCA) built on the Stellar blockchain. This guide will walk you through everything you need to know to participate in community-based savings groups.

## What is Stellar-Save?

Stellar-Save brings traditional ROSCA systems to blockchain technology. Members contribute a fixed amount regularly, and each member receives the total pool on a rotating basis. This creates:

- **Trustless savings**: No central coordinator needed
- **Transparent transactions**: All activity is verifiable on-chain
- **Global accessibility**: Anyone with a Stellar wallet can join
- **Automated payouts**: Smart contracts handle distributions

## Getting Started

### Prerequisites

1. **Stellar Wallet**: Install a compatible wallet like [Freighter](https://www.freighter.app/) or [Lobstr](https://lobstr.co/)
2. **XLM Funds**: You'll need Stellar Lumens (XLM) for contributions and transaction fees
3. **Internet Connection**: Access to the Stellar network

### Setting Up Your Wallet

1. Install your preferred Stellar wallet
2. Create or import a Stellar account
3. Fund your account with XLM (available from exchanges or faucets)
4. Connect your wallet to the Stellar-Save dApp

### Network Selection

Stellar-Save operates on:
- **Testnet**: For testing and learning (recommended for beginners)
- **Mainnet**: For real savings groups with actual value

Start with testnet to familiarize yourself with the platform.

## Creating a Group

As a group creator, you set the terms for your savings circle.

### Step-by-Step Guide

1. **Access the dApp**: Navigate to the Stellar-Save interface
2. **Connect Wallet**: Click "Connect Wallet" and approve the connection
3. **Select "Create Group"**: Find this option in the main menu
4. **Configure Group Settings**:
   - **Contribution Amount**: How much each member contributes per cycle (in XLM)
   - **Cycle Duration**: How often contributions are due (e.g., weekly, monthly)
   - **Maximum Members**: Total number of participants (2-50 recommended)
   - **Minimum Members**: Minimum required to start the group
5. **Review Terms**: Double-check all settings
6. **Create Group**: Sign the transaction with your wallet
7. **Share Group ID**: Distribute the group identifier to potential members

### Best Practices for Group Creation

- **Realistic Amounts**: Set contribution amounts members can afford
- **Familiar Cycles**: Choose durations that work for your community's schedule
- **Trusted Members**: Start with people you know for your first group
- **Clear Communication**: Discuss expectations with potential members beforehand

## Using Group Templates

Instead of configuring every setting manually, you can start from a predefined template. Templates set the cycle duration and maximum members for you — you only choose the contribution amount.

### Available Templates

| ID | Name             | Cycle     | Max Members | Total Duration |
|----|------------------|-----------|-------------|----------------|
| 1  | Weekly Saver     | 7 days    | 10          | ~10 weeks      |
| 2  | Biweekly Saver   | 14 days   | 8           | ~16 weeks      |
| 3  | Monthly Pool     | 30 days   | 12          | ~12 months     |
| 4  | Quarterly Circle | 90 days   | 4           | ~12 months     |
| 5  | Annual Pool      | 365 days  | 5           | ~5 years       |

### Creating a Group from a Template

1. **Browse Templates**: Call `list_templates()` or select from the UI template picker
2. **Pick a Template**: Choose the one that fits your community's rhythm
3. **Set Contribution Amount**: Enter how much each member pays per cycle (in XLM)
4. **Create**: Sign the transaction — the contract fills in cycle duration and member cap automatically

### Choosing the Right Template

- **Weekly Saver** — tight-knit groups wanting frequent payouts and short commitment windows
- **Biweekly Saver** — a middle ground with slightly larger pools and a manageable cadence
- **Monthly Pool** — the classic Ajo/Esusu pattern; 12 members each receive one month's pool per year
- **Quarterly Circle** — larger contribution amounts where members prefer less frequent cycles
- **Annual Pool** — long-term capital accumulation over multiple years

> Need something custom? Use **Create Group** instead and specify any cycle duration and member count.

For full API details see [docs/group-templates.md](group-templates.md).

## Joining a Group

Participate in existing savings groups created by others.

### Finding Groups

1. **Browse Groups**: Use the "Browse Groups" or "Join Group" section
2. **Search by ID**: If you have a specific group ID, enter it directly
3. **Filter Options**: Look for groups by:
   - Contribution amount
   - Cycle duration
   - Current member count
   - Group status

### Joining Process

1. **Select Group**: Click on a group that interests you
2. **Review Terms**: Carefully read the group rules and requirements
3. **Check Compatibility**: Ensure you can meet the contribution schedule
4. **Join Group**: Click "Join" and approve the wallet transaction
5. **Confirm Position**: Note your payout position in the rotation

### What to Consider Before Joining

- **Trust Level**: How well do you know the group creator and other members?
- **Financial Commitment**: Can you reliably make contributions on schedule?
- **Group Size**: Larger groups mean longer waits for your payout but potentially more stability
- **Duration**: Consider how long you're willing to wait for your turn

## Contribution Process

Regular contributions are the heart of the ROSCA system.

### How Contributions Work

- **Fixed Amount**: Everyone contributes the same amount each cycle
- **Set Schedule**: Contributions are due at regular intervals
- **All or Nothing**: The full pool is distributed only when all members contribute
- **Automatic Tracking**: The smart contract records all contributions

### Making a Contribution

1. **Check Due Date**: Monitor your group's contribution deadline
2. **Access Group**: Go to "My Groups" and select your active group
3. **View Status**: See current cycle progress and who's contributed
4. **Contribute**: Click "Contribute" and approve the XLM transfer
5. **Confirm**: Wait for transaction confirmation on the blockchain

### Contribution Deadlines

- **Cycle Start**: Timer begins when the group becomes active
- **Extension Period**: Groups may have grace periods for late contributions
- **Consequences**: Missing contributions may affect your standing or payout eligibility

### Tracking Your Contributions

- **Contribution History**: View all your past payments
- **Cycle Progress**: See how many members have contributed this cycle
- **Total Saved**: Track your cumulative contributions
- **Payout Eligibility**: Monitor when you'll receive funds

## Payout Mechanics

Understanding how payouts work ensures you know what to expect.

### How Payouts Work

1. **Pool Formation**: All members' contributions create the cycle pool
2. **Rotation Order**: Members receive payouts in the order they joined
3. **Automatic Distribution**: Smart contract triggers payout when all contribute
4. **Full Amount**: Each member receives the total pool amount

### Payout Process

1. **Cycle Completion**: All members must contribute for the cycle to complete
2. **Automatic Trigger**: Smart contract detects completion and initiates payout
3. **Recipient Selection**: Next member in rotation receives the funds
4. **Instant Transfer**: Funds are transferred directly to the recipient's wallet

### Payout Schedule

- **Position-Based**: Your payout position is determined by join order
- **Sequential**: Payouts happen one at a time as cycles complete
- **Predictable**: You know exactly when your turn will come

### Receiving Your Payout

1. **Monitor Progress**: Watch as cycles complete
2. **Automatic Transfer**: Funds appear in your wallet automatically
3. **Transaction Record**: All payouts are recorded on the blockchain
4. **Continue Contributing**: Keep contributing even after receiving your payout

## FAQ

### General Questions

**Q: Is my money safe?**
A: Your contributions are held by smart contracts on the Stellar blockchain. While smart contracts reduce counterparty risk, always research and understand the platform before participating.

**Q: What happens if someone doesn't contribute?**
A: If a member misses their contribution, the cycle cannot complete and no one receives a payout. Groups should establish clear expectations and consequences.

**Q: Can I leave a group early?**
A: This depends on the group's rules. Some groups may allow withdrawal, but you typically forfeit future payouts.

**Q: Are there fees?**
A: Transaction fees are minimal (Stellar network fees), but the platform itself is free to use.

### Technical Questions

**Q: What wallet should I use?**
A: We recommend Freighter for its good Soroban support. Other compatible wallets include Lobstr and StellarX.

**Q: How do I get test XLM?**
A: Use the Stellar testnet faucet at https://laboratory.stellar.org/ to get free test XLM.

**Q: What if I lose my wallet?**
A: Your funds are tied to your Stellar account. Recover your wallet using your backup seed phrase.

**Q: Can I use this on mobile?**
A: Yes, through compatible mobile wallets that support Stellar and Soroban contracts.

### Group Management

**Q: How do I change group settings?**
A: Only the group creator can modify settings, and only before the group becomes active.

**Q: What if my group doesn't fill up?**
A: Groups can start with minimum members, but work best with full participation.

**Q: Can I be in multiple groups?**
A: Yes, but ensure you can meet all contribution schedules.

**Q: How do I know if a group is legitimate?**
A: Check the contract address, read reviews, and verify with other participants.

### Troubleshooting

**Q: My transaction is stuck**
A: Check Stellar Explorer for transaction status. Network congestion can cause delays.

**Q: I can't connect my wallet**
A: Ensure your wallet is unlocked and supports the current network (testnet/mainnet).

**Q: Contribution failed**
A: Verify you have sufficient XLM for both the contribution and transaction fees.

**Q: Wrong contribution amount**
A: Contributions must match the group's exact amount. Check the group settings.

## Penalty System

To encourage timely contributions and protect active members, Stellar-Save supports an optional penalty mechanism for missed contributions.

### How Penalties Work

When a group creator enables penalties, any member who fails to contribute during a cycle is automatically charged a fixed penalty fee at payout time. The penalty amount is added directly to the cycle pool, so the payout recipient receives the full pool **plus** any penalties collected from non-contributors.

**Key points:**
- Penalties are **optional** — the group creator decides whether to enable them at group creation.
- The penalty amount is fixed in stroops (1 XLM = 10,000,000 stroops) and set when the group is created.
- Penalties are applied automatically by the smart contract when `execute_payout` is called; no manual action is required.
- A `PenaltyApplied` event is emitted on-chain for each penalty, providing a transparent audit trail.

### Penalty Configuration

When creating a group, the creator can set:

| Field | Description |
|---|---|
| `penalty_enabled` | `true` to activate the penalty system, `false` to disable it |
| `penalty_amount` | Fixed penalty in stroops charged per missed cycle (must be > 0 when enabled) |

Example: a group with `contribution_amount = 10,000,000` (1 XLM) and `penalty_amount = 500,000` (0.05 XLM) means a member who misses a cycle pays an extra 0.05 XLM that goes to the current cycle's recipient.

### Penalty Flow

1. All members contribute (or the cycle deadline passes).
2. `execute_payout` is called.
3. The contract identifies members who did not contribute this cycle.
4. For each non-contributor, `penalty_amount` is:
   - Added to their cumulative penalty total (queryable via `get_member_penalties`).
   - Added to the cycle pool total so the payout recipient receives it.
5. A `PenaltyApplied` event is emitted for each penalised member.
6. The payout is distributed to the eligible recipient (base pool + penalties).

### Querying Penalties

Use the `get_member_penalties(group_id, member)` contract function to check how much a member has been penalised in total across all cycles of a group.

```
get_member_penalties(group_id: u64, member: Address) -> i128
```

Returns the cumulative penalty amount in stroops. Returns `0` if no penalties have been applied.

### FAQ

**Q: Can penalties be changed after the group is created?**
A: No. Penalty settings are fixed at group creation to ensure all members agree to the same terms.

**Q: What if I miss a contribution — will I be removed from the group?**
A: No. You remain a member and will still receive your payout when your turn comes. The penalty is a financial charge, not an exclusion.

**Q: Does the penalty affect the payout I receive when it's my turn?**
A: No. Your payout is based on the pool at the time of your cycle. If other members missed contributions in your cycle, their penalties are added to your payout.

**Q: Can I see who was penalised?**
A: Yes. `PenaltyApplied` events are emitted on-chain and include the group ID, member address, penalty amount, and cycle number.

## Getting Help

- **Documentation**: Check this guide and the technical docs
- **Community**: Join Stellar communities for support
- **Support**: Contact the development team through GitHub issues
- **Stellar Resources**: Visit developers.stellar.org for technical help

## Best Practices

1. **Start Small**: Begin with testnet and small amounts
2. **Build Trust**: Start groups with people you know
3. **Stay Committed**: Reliable contributions build group trust
4. **Communicate**: Keep open lines with group members
5. **Learn Continuously**: Stay updated with platform changes

Remember, Stellar-Save is about building financial discipline and community trust. Participate responsibly and help others do the same!</content>
<parameter name="filePath">c:\Users\USER\Desktop\solo\Stellar-Save\docs\user-guide.md