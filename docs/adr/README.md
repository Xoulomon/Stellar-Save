# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) that document key architectural decisions made during Stellar-Save development. ADRs preserve institutional knowledge and provide context for future maintainers.

## Format

Each ADR follows the standard format:
- **Status**: Accepted, Proposed, Deprecated, or Superseded
- **Date**: When the decision was made
- **Author**: Who proposed the decision
- **Deciders**: Who made the final decision
- **Context**: Problem statement and alternatives considered
- **Decision**: What was decided
- **Rationale**: Why this decision was made
- **Consequences**: Positive and negative impacts
- **Implementation**: How it was implemented
- **Related Decisions**: Links to related ADRs

## ADRs

### [ADR-001: Choice of Soroban Over Other Smart Contract Platforms](./ADR-001-soroban-platform-choice.md)

**Status**: Accepted

Decided to use Soroban (Rust on Stellar) as the smart contract platform instead of Ethereum, Polygon, or Cosmos.

**Key Reasons**:
- Extremely low transaction costs (~$0.000001)
- Fast finality (3-5 seconds)
- Built-in support for Stellar assets
- Strong focus on financial inclusion
- Memory-safe Rust language

### [ADR-002: Sequential Payout Order Default Design Decision](./ADR-002-sequential-payout-order.md)

**Status**: Accepted

Decided that the default payout order in ROSCAs is sequential based on join order (first in, first out).

**Key Reasons**:
- Simple and predictable
- Matches traditional ROSCA practices
- Gas efficient
- Easy to audit and verify
- Aligns with user expectations

### [ADR-003: Backend Event Indexing Approach vs. Pure On-Chain Queries](./ADR-003-event-indexing-approach.md)

**Status**: Accepted

Decided to implement a backend event indexer with PostgreSQL database instead of querying Stellar Horizon API directly.

**Key Reasons**:
- 10-50x faster queries (50-200ms vs 1-5 seconds)
- Unlimited query capabilities
- Better scalability for concurrent users
- Offline resilience
- Enables rich analytics and reporting

## Adding New ADRs

When making significant architectural decisions:

1. Create a new file: `ADR-NNN-short-title.md`
2. Use the standard format (see above)
3. Link it in this index
4. Update the status as the decision evolves
5. Reference related ADRs

## Superseding ADRs

If a decision is reversed or updated:

1. Update the original ADR status to "Superseded by ADR-NNN"
2. Create a new ADR explaining the change
3. Link both ADRs together

## References

- [ADR GitHub](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
