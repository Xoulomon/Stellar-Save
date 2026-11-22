# zk/ Subsystem

This directory implements the zero-knowledge proof flows used by the
protocol.

- `circuits/` — circuit definitions and compiled artifacts (R1CS,
  proving/verification keys).
- `client/` — witness assembly and proof generation.
- `server/` — proof verification.

## Architecture and trust assumptions

See [ADR 0001: zk/ Subsystem Architecture and Trust Assumptions](../docs/adr/0001-zk-architecture.md)
for the end-to-end proof generation/verification flow, the trust
assumptions, the trusted-setup details, and the contracts that consume zk
proofs.

## Status

**Experimental.** This workspace contains open HIGH-priority audit items
(ZK-001, ZK-002) tracked in [`CIRCUIT_AUDIT.md`](CIRCUIT_AUDIT.md) and
issue #1327. It is not built or tested by the root CI scripts
(`scripts/build.sh`, `scripts/test.sh`). Do not remove or archive until
the audit items are closed.
