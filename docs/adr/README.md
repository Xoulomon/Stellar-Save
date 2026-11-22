# Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records (ADRs) for the Stellar Save project. ADRs document significant architectural decisions made during the development of the platform.

## What is an ADR?

An Architecture Decision Record captures a single architecture decision, including the context, the decision itself, and the consequences. They serve as a historical record of why certain architectural choices were made.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./ADR-001-soroban-platform-choice.md) | Choice of Soroban as Smart Contract Platform | Accepted | 2024-12-15 |
| [ADR-002](./ADR-002-prisma-orm-selection.md) | Selection of Prisma as ORM | Accepted | 2024-12-20 |
| [ADR-003](./ADR-003-event-indexing-approach.md) | Event Indexing Strategy | Accepted | 2025-01-05 |
| [ADR-004](./ADR-004-contract-module-boundaries.md) | Smart Contract Module Boundaries | Accepted | 2025-01-15 |
| [ADR-005](./ADR-005-frontend-state-management.md) | Frontend State Management Approach | Accepted | 2025-02-01 |
| [ADR-006](./ADR-006-on-chain-vs-off-chain-source-of-truth.md) | On-Chain vs Off-Chain Source of Truth | Proposed | 2026-10-19 |
| [ADR-007](./ADR-007-mobile-app-ownership.md) | Mobile App Ownership — Capacitor vs. Expo React Native | Accepted | 2026-10-19 |

## ADR Status Lifecycle

- **Proposed** — Under discussion, open for feedback
- **Accepted** — Approved and in effect
- **Deprecated** — No longer in effect, superseded by a newer ADR
- **Superseded** — Replaced by another ADR (linked)

## Creating a New ADR

1. Copy the template from `ADR-001` as a starting point
2. Number sequentially (next: ADR-008)
3. Fill in all sections: Context, Decision, Rationale, Consequences
4. Submit as a PR for team review
5. Update this index

## Related Documentation

- [Contributing Guide](../../CONTRIBUTING.md)
- [API Reference](../api/README.md)
- [Backend Architecture](../../backend/README.md)

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

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's article on ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
