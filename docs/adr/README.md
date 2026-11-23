# Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records (ADRs) for the Stellar Save project. ADRs document significant architectural decisions made during the development of the platform.

## What is an ADR?

An Architecture Decision Record captures a single architecture decision, including the context, the decision itself, and the consequences. They serve as a historical record of why certain architectural choices were made.

## ADR Index

| Record file | Title | Status | Date |
|-------------|-------|--------|------|
| [ADR-001-soroban-platform-choice.md](./ADR-001-soroban-platform-choice.md) | Choice of Soroban Over Other Smart Contract Platforms | Accepted | 2026-05-29 |
| [ADR-002-sequential-payout-order.md](./ADR-002-sequential-payout-order.md) | Sequential Payout Order Default | Accepted | 2026-05-29 |
| [ADR-003-event-indexing-approach.md](./ADR-003-event-indexing-approach.md) | Backend Event Indexing Approach | Accepted | 2026-05-29 |
| [ADR-004-contract-module-boundaries.md](./ADR-004-contract-module-boundaries.md) | Contract Module Boundaries | Accepted | 2026-07-29 |
| [ADR-005-webhook-retry-contract.md](./ADR-005-webhook-retry-contract.md) | Webhook Retry and Idempotency Semantics | Accepted | Not recorded |
| [ADR-006-on-chain-vs-off-chain-source-of-truth.md](./ADR-006-on-chain-vs-off-chain-source-of-truth.md) | On-Chain vs Off-Chain Source of Truth | Proposed | 2026-10-19 |
| [ADR-006-package-manager.md](./ADR-006-package-manager.md) | Workspace Package Manager — pnpm | Accepted | 2026-10-18 |
| [ADR-007-event-schema-versioning.md](./ADR-007-event-schema-versioning.md) | Event Schema Versioning and Domain Module Split | Accepted | 2026-10-21 |
| [ADR-007-mobile-app-ownership.md](./ADR-007-mobile-app-ownership.md) | Mobile App Ownership — Capacitor vs. Expo React Native | Accepted | 2026-10-19 |
| [ADR-008-token-custody-and-escrow.md](./ADR-008-token-custody-and-escrow.md) | Token Custody and Escrow Lifecycle | Accepted | 2026-11-23 |
| [0001-wallet-connection.md](./0001-wallet-connection.md) | Multi-Wallet Connection Architecture | Accepted | 2026-08-28 |
| [00XX-zk-architecture.md](./00XX-zk-architecture.md) | zk Subsystem Architecture and Trust Assumptions | Proposed | TBD |

Some historical files reuse ADR-006/ADR-007 identifiers (and one uses ADR-0001).
The file name is therefore the unambiguous link for those records; new numbered
decisions continue from ADR-008.

## ADR Status Lifecycle

- **Proposed** — Under discussion, open for feedback
- **Accepted** — Approved and in effect
- **Deprecated** — No longer in effect, superseded by a newer ADR
- **Superseded** — Replaced by another ADR (linked)

## Creating a New ADR

1. Copy the template from `ADR-001` as a starting point
2. Number sequentially (next: ADR-009)
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
