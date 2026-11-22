# Contracts

Soroban smart contracts for the Stellar Save project.

## Crates

| Crate                | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `common`             | Shared, contract-agnostic types, errors, and helpers.    |
| `stellar-save`       | Savings contract.                                        |
| `fungible-allowlist` | Fungible token with allowlist support.                   |
| `guess-the-number`   | Guess-the-number game contract.                          |
| `nft-enumerable`     | Enumerable NFT contract.                                 |

## Module boundaries

Shared logic lives in `common`; contract-specific logic lives in each
per-contract crate. Per-contract crates may depend on `common`, but never on
each other.

See the architecture decision record for the full rationale and dependency
rules:

- [ADR 0001: Smart Contract Module Boundaries](../docs/adr/0001-contract-module-boundaries.md)
