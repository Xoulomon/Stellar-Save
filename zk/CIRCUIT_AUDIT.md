# ZK Circuit Audit Report

## Audit Summary

| Property     | Value                      |
|--------------|----------------------------|
| Version      | 0.1.0 (Draft)              |
| Auditor      | Internal Review            |
| Date         | 2026-07-29                 |
| Status       | Open Items Remaining       |

## Circuit Description

The Stellar-Save ZK circuit enforces the following constraints:

1. **Contribution Range Check**: Contribution amount is within `[min_contribution, max_contribution]`
2. **Member Membership Proof**: Prover is a member of the group Merkle tree
3. **Nullifier Uniqueness**: Proof nonce has not been previously used (anti-replay)
4. **Cycle Binding**: Proof is bound to a specific cycle number

## Open Audit Items

### HIGH Priority

| ID     | Description                                                    | Status  | Tracked By        |
|--------|----------------------------------------------------------------|---------|-------------------|
| ZK-001 | Verify replay protection: nullifier storage and uniqueness checks | OPEN    | Issue #1327       |
| ZK-002 | Confirm malformed-proof early rejection before crypto operations  | OPEN    | Issue #1327       |

### MEDIUM Priority

| ID     | Description                                                            | Status  | Tracked By  |
|--------|------------------------------------------------------------------------|---------|-------------|
| ZK-003 | Gas cost of valid proof verification must be documented and bounded     | OPEN    | Issue #1327 |
| ZK-004 | Test boundary: proof with all-zero public inputs must be rejected       | OPEN    | Issue #1327 |
| ZK-005 | Test boundary: truncated proof bytes must be rejected gracefully        | OPEN    | Issue #1327 |

### LOW Priority

| ID     | Description                                                         | Status  | Tracked By  |
|--------|---------------------------------------------------------------------|---------|-------------|
| ZK-006 | Add test for proof from a different group ID (cross-group binding)  | OPEN    | Issue #1327 |
| ZK-007 | Verify circuit constants match business-rule constants in constants.rs | OPEN | Issue #1330 |

## Test Coverage Requirements

| Test Case                                  | Required | Implemented |
|--------------------------------------------|----------|-------------|
| Valid proof accepted                        | YES      | Partial     |
| Invalid proof rejected                      | YES      | Partial     |
| Malformed/truncated proof rejected          | YES      | NO          |
| Replayed proof rejected                     | YES      | NO          |
| All-zero public inputs rejected             | YES      | NO          |
| Cross-group proof rejected                  | YES      | NO          |
| Gas cost within acceptable bounds           | YES      | NO          |
| Empty proof bytes rejected                  | YES      | NO          |

## Acceptable Gas Cost Bounds

| Operation          | Max Allowed Instructions | Notes                           |
|--------------------|-------------------------|---------------------------------|
| Valid verification  | 100,000                 | Ed25519 verify included          |
| Invalid (reject)    | 20,000                  | Must fail fast without full work |
| Malformed (reject)  | 5,000                   | Input validation only            |

## Known Limitations

1. **Phase 1 Only**: Current implementation uses Ed25519 signatures as a proof-of-concept, not a full ZK system.
2. **No Trusted Setup**: Full Groth16 requires a trusted setup ceremony not yet performed.
3. **Nullifier Storage**: On-chain nullifier storage needs TTL/cleanup strategy.

## Resolution Plan

All open items will be addressed by implementing dedicated unit tests in `src/zk_tests.rs`.
See Issue #1327 for implementation tasks.
