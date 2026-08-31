# ADR-001: Choice of Soroban Over Other Smart Contract Platforms

**Status**: Accepted  
**Date**: 2026-05-29  
**Author**: Stellar-Save Team  
**Deciders**: Architecture Team

## Context

Stellar-Save is a decentralized Rotating Savings and Credit Association (ROSCA) platform that requires a smart contract platform to manage group creation, membership, contributions, and automated payouts. The team evaluated multiple blockchain platforms and smart contract ecosystems before selecting Soroban.

### Alternatives Considered

1. **Ethereum (Solidity)**
   - Mature ecosystem with extensive tooling
   - Large developer community
   - High transaction costs ($5-50+ per transaction)
   - Complex gas optimization required
   - Slower block times (12-15 seconds)

2. **Polygon (Solidity)**
   - Lower costs than Ethereum (~$0.01-0.10 per transaction)
   - EVM-compatible tooling
   - Still requires significant gas optimization
   - Centralized validator set
   - Less focus on financial inclusion

3. **Cosmos (CosmWasm)**
   - Good for interoperability
   - Requires running own chain or using existing chains
   - Smaller ecosystem for financial applications
   - More operational complexity

4. **Soroban (Rust on Stellar)**
   - Native to Stellar blockchain
   - Designed for financial applications
   - Very low transaction costs (~0.00001 XLM ≈ $0.000001)
   - Fast finality (3-5 seconds)
   - Built-in support for Stellar assets (XLM, USDC, etc.)
   - Strong focus on financial inclusion

## Decision

**We chose Soroban as the smart contract platform for Stellar-Save.**

## Rationale

### 1. **Cost Efficiency**
- Soroban transactions cost ~0.00001 XLM (~$0.000001 at current prices)
- Ethereum equivalent: $5-50 per transaction
- **Impact**: Users in emerging markets can afford frequent transactions
- **Benefit**: Enables true financial inclusion for unbanked populations

### 2. **Stellar's Financial Focus**
- Stellar was designed specifically for financial applications
- Native support for multiple assets (XLM, USDC, EURC, etc.)
- Built-in payment channels and atomic swaps
- **Impact**: ROSCA mechanics align naturally with Stellar's design
- **Benefit**: Simpler contract logic, fewer edge cases

### 3. **Fast Finality**
- Soroban transactions finalize in 3-5 seconds
- Ethereum: 12-15 seconds per block, multiple confirmations needed
- **Impact**: Better user experience with immediate feedback
- **Benefit**: Faster payout execution and cycle advancement

### 4. **Rust Smart Contracts**
- Memory-safe language prevents common vulnerabilities
- Strong type system catches errors at compile time
- Excellent performance characteristics
- **Impact**: Reduced security risks compared to Solidity
- **Benefit**: Safer handling of financial transactions

### 5. **Institutional Knowledge**
- Stellar Development Foundation provides excellent documentation
- Growing community of developers building financial applications
- Active support for Soroban development
- **Impact**: Easier to find help and best practices
- **Benefit**: Faster development and fewer blockers

### 6. **Alignment with Mission**
- Stellar's mission: "Democratize access to financial services"
- Soroban enables building on Stellar's infrastructure
- **Impact**: Direct alignment with Stellar-Save's goal of financial inclusion
- **Benefit**: Potential for ecosystem partnerships and integrations

## Consequences

### Positive
- ✅ Extremely low transaction costs enable mass adoption
- ✅ Fast finality improves user experience
- ✅ Rust provides strong safety guarantees
- ✅ Natural fit for financial applications
- ✅ Smaller contract sizes reduce deployment costs
- ✅ Access to Stellar's asset ecosystem

### Negative
- ❌ Smaller developer ecosystem compared to Ethereum
- ❌ Fewer third-party tools and libraries
- ❌ Less historical data on production deployments
- ❌ Soroban is relatively new (launched 2023)

### Mitigation
- Actively contribute to Soroban ecosystem
- Document patterns and best practices
- Maintain close relationship with Stellar Development Foundation
- Build reusable contract libraries for community

## Implementation Notes

- Smart contracts written in Rust using Soroban SDK
- Contracts deployed to Stellar testnet, futurenet, and mainnet
- Frontend uses `@stellar/stellar-sdk` for contract interaction
- Events emitted by contracts are indexed via Horizon API

## Related Decisions

- ADR-002: Sequential payout order default design
- ADR-003: Backend event indexing approach

## References

- [Soroban Documentation](https://soroban.stellar.org/)
- [Stellar Development Foundation](https://stellar.org/)
- [Soroban SDK (Rust)](https://github.com/stellar/rs-soroban-sdk)
- [Stellar Asset Ecosystem](https://stellar.org/ecosystem/projects)
