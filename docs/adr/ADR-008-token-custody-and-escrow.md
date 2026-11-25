# ADR-008: Token Custody and Escrow Lifecycle

**Status**: Accepted (documents current contract behavior)  
**Date**: 2026-11-23  
**Deciders**: Contracts team

## Context

Stellar-Save pools hold member contributions until a cycle payout or an eligible
refund. The codebase has no separate escrow contract or `escrow.rs` module, so
contributors need a precise description of where funds are held, how token
calls relate to recorded contributions, and which guarantees are actually
provided by Soroban transactions.

## Decision

The Stellar-Save contract address is the custodian for group funds. Each group
stores a `TokenConfig` (token contract address and cached decimal count) under a
separate storage key. Keeping token configuration separate from the serialized
`Group` preserves compatibility with existing group records. `create_group`
validates the token's SEP-41 `decimals()` interface and, when an allowlist is
configured, rejects tokens not on that list. With no allowlist configured,
token selection is open.

The contract uses the following lifecycle:

1. **Contribution** — `contribute` requires member authorization, an active
   group, membership, and the configured contribution amount. It records the
   contribution under a temporary reentrancy guard, then calls SEP-41
   `transfer_from` to move the exact amount from the member to the contract.
   The member must have approved the contract to spend the tokens.
2. **Payout** — `payout_executor` checks cycle readiness, selects the recipient,
   verifies the contract's balance in the group's configured token, records the
   payout and advances group state, then transfers the amount from the contract
   to the recipient. Execution is permissionless once payout conditions are
   satisfied.
3. **Refund** — `request_refund` allows a refund for pending or cancelled
   groups, or for an active/paused group's cycle before its payout has been
   processed. The contributor or group creator must authorize the request. The
   refund record is written before the token transfer to prevent duplicate
   refunds.

These state changes and token calls execute in one Soroban invocation. A token
call failure traps the invocation, so Soroban rolls back both the token-side
changes and the contract's state changes. Contribution and refund flows also
include explicit reentrancy defenses because the token contract is an external
call.

## Rationale and alternatives

- **Chosen: custody in the group contract.** It uses the group's configured
  token for deposits, payouts, and refunds without adding another deployed
  contract or cross-contract escrow-accounting protocol.
- **Rejected: a separate escrow contract/module.** The current implementation
  does not have one; introducing it would add deployment, authorization, and
  accounting boundaries without being necessary for the existing flow.
- **Rejected: direct member-to-recipient transfers.** Contributions accumulate
  until the cycle is complete, and the scheduled recipient is determined by
  contract state, so the contract must custody the pool between those events.

## Security and accounting consequences

- Contribution records and pool totals are contract accounting; token balances
  remain the authoritative measure of assets available for transfer. Groups
  using the same token share the contract's token balance; group and cycle
  attribution comes from stored records, not isolated token subaccounts.
- Operators should monitor the contract's aggregate balance for each token
  against the liabilities represented by group contribution records.
- Amounts passed to SEP-41 are token base units. `token_decimals` is metadata;
  clients must format amounts using the group's configured token precision.
- The contract only validates that a token exposes `decimals()` and enforces the
  configured allowlist. It does not prove that an arbitrary SEP-41 token has no
  transfer fees, freezes, or other non-standard behavior. Production deployments
  should restrict the allowlist to reviewed tokens.
- Soroban atomicity prevents partial contract state after a failed token call,
  but it does not make an untrusted token safe or guarantee the token will remain
  operational.
- `escrow_property_tests.rs` checks modeled accounting invariants. Those
  property tests are not a proof of arbitrary token behavior or a substitute for
  integration tests using the deployed token implementation.

## Related decisions and implementation

- [ADR-004: Contract Module Boundaries](./ADR-004-contract-module-boundaries.md)
- [`group::TokenConfig`](../../contracts/stellar-save/src/group.rs)
- [`create_group` and `contribute`](../../contracts/stellar-save/src/contract.rs)
- [`payout_executor`](../../contracts/stellar-save/src/payout_executor.rs)
- [`request_refund`](../../contracts/stellar-save/src/refund.rs)
- [Escrow property tests](../../contracts/stellar-save/src/escrow_property_tests.rs)
