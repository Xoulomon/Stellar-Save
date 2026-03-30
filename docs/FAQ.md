# Stellar-Save FAQ

## Common User Questions

### What is Stellar-Save?
Stellar-Save is a decentralized rotational savings and credit association (ROSCA) built on Stellar Soroban smart contracts. It enables groups to pool funds where members contribute regularly and take turns receiving the total pool.

### How does the rotation work?
Members join a group with a fixed contribution amount and cycle duration. Each cycle, all members contribute the required amount. Once all contributions are received, the pool is distributed to one member. The rotation continues until all members have received their payout.

### What is a ROSCA?
A ROSCA (Rotating Savings and Credit Association) is a traditional community-based savings system common in Africa and other regions. Members form a group, contribute fixed amounts regularly, and take turns receiving the pooled funds.

### How much does it cost to use Stellar-Save?
Stellar-Save is free to use. You only pay Stellar network fees for transactions, which are typically very small (fractions of a cent).

### Can I join multiple groups?
Yes, you can join as many groups as you want. Each group operates independently.

### What happens if a member doesn't contribute?
If a member doesn't contribute by the cycle deadline, the cycle cannot complete and payouts are delayed. The group creator or members may need to address this through group governance.

### Is my money safe?
Yes. All funds are held in smart contracts on the Stellar blockchain. The contract code is transparent and auditable. No central authority controls your funds.

### Can I withdraw my money?
Withdrawal policies depend on the group's rules. Once a cycle is complete and you've received your payout, those funds are yours to use. Contributions for ongoing cycles may have restrictions depending on group settings.

### What wallet do I need?
You need a Stellar wallet such as:
- Freighter
- Lobstr
- Albedo
- Any other Stellar-compatible wallet

### How long does a cycle take?
Cycle duration is set when the group is created. Common durations are:
- 1 week (604,800 seconds)
- 1 month (2,592,000 seconds)
- Custom duration (1-365 days)

## Technical Questions About Smart Contracts

### What blockchain does Stellar-Save use?
Stellar-Save uses the Stellar network with Soroban smart contracts. Soroban is Stellar's smart contract platform.

### What is XLM?
XLM (Stellar Lumens) is the native asset of the Stellar network. Stellar-Save currently supports XLM contributions.

### Will Stellar-Save support other tokens?
Yes, token support is on the roadmap. Future versions will support USDC, EURC, and other Stellar-issued tokens.

### How are group IDs generated?
Group IDs are generated sequentially by the contract. Each new group receives a unique ID starting from 1.

### What is a stroops?
1 stroops = 0.0000001 XLM. All amounts in the contract are stored in stroops for precision.

### How does the contract validate contributions?
The contract checks:
1. The member is part of the group
2. The contribution amount matches the group requirement exactly
3. The contribution deadline hasn't passed
4. The member hasn't already contributed this cycle

### What happens when all members contribute?
The contract automatically triggers a payout to the next member in the rotation. The cycle advances and the next cycle begins.

### Can the contract be upgraded?
The current implementation is immutable. Future versions may support upgradeable contracts through governance mechanisms.

### How are events tracked?
The contract emits events for all major actions:
- Group creation
- Member joining
- Contributions
- Payouts
- Status changes

These events are indexed by the Stellar network and can be queried via Horizon API.

## Troubleshooting Common Issues

### I can't join a group
Possible reasons:
- The group is full (reached max members)
- The group is not in Active status
- You're already a member of this group
- The group doesn't exist

### My contribution was rejected
Check:
- You're a member of the group
- The amount matches exactly (including stroops)
- The cycle deadline hasn't passed
- You haven't already contributed this cycle

### I don't see my group in the list
- The group may not be activated yet
- Try refreshing the page
- Check the group ID directly if you have it
- Ensure you're on the correct network (testnet/mainnet)

### The payout didn't execute
Possible reasons:
- Not all members have contributed yet
- The cycle deadline hasn't passed
- The group is paused or cancelled
- There's insufficient balance in the pool

### My wallet isn't connecting
- Ensure your wallet extension is installed and enabled
- Try refreshing the page
- Check that you're on a supported network
- Try a different wallet if available

### I see a "Group Not Found" error
- Verify the group ID is correct
- Check you're on the correct network
- The group may have been deleted or cancelled

## Links to Relevant Documentation

### Getting Started
- [User Guide](docs/guides/user-guide.md) - Step-by-step guide for using Stellar-Save
- [Deployment Guide](docs/guides/deployment.md) - How to deploy the contract

### Technical Documentation
- [Architecture Overview](docs/architecture.md) - System design and components
- [Storage Layout](docs/storage-layout.md) - How data is organized on-chain
- [API Reference](docs/api-reference.md) - Complete contract API documentation
- [Smart Contract API](docs/api/CONTRACT_API.md) - Detailed contract function reference

### Security & Operations
- [Threat Model & Security](docs/threat-model.md) - Security considerations
- [Roadmap](docs/roadmap.md) - Future features and improvements

### Development
- [Build Guide](BUILD_GUIDE.md) - How to build the project
- [Testing Guide](TESTING.md) - How to run tests
- [Contributing Guidelines](CONTRIBUTING.md) - How to contribute

## Still Have Questions?

- **GitHub Issues**: [Report bugs or request features](https://github.com/Xoulomon/Stellar-Save/issues)
- **GitHub Discussions**: [Ask questions and discuss ideas](https://github.com/Xoulomon/Stellar-Save/discussions)
- **Telegram**: [@Xoulomon](https://t.me/Xoulomon)
