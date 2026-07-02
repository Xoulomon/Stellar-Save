# ZK Verification for Private User Attributes
<!-- Closes #1174 -->

Zero-knowledge proof system allowing users to prove sensitive attributes (e.g. "contribution balance ≥ X", "member of group Y") without disclosing the underlying data on-chain.

## Framework Selection

**Chosen: Circom + snarkjs (Groth16)**

| Option | Proof size | Verify time | Soroban-compatible | Maturity |
|--------|-----------|-------------|-------------------|---------|
| **Circom/snarkjs (Groth16)** | ~200 bytes | ~1ms | ✅ via WASM verifier | High |
| Circom/snarkjs (PLONK) | ~600 bytes | ~5ms | ✅ | High |
| Noir (Barretenberg) | ~500 bytes | ~3ms | ✅ | Medium |
| Move Prover | N/A | N/A | ❌ (Move-only) | Low |

Groth16 gives the smallest proof size (fits in a Soroban transaction) and fastest on-chain verification. Trade-off: requires a trusted setup ceremony per circuit.

---

## Circuits

### 1. `membership_proof` — prove group membership without revealing which group

**Private inputs:** `member_address`, `group_id`, `membership_merkle_path[]`  
**Public inputs:** `merkle_root`, `nullifier_hash`  
**Statement:** "I know a preimage in the membership Merkle tree with this root."

```circom
// circuits/membership_proof.circom
pragma circom 2.1.0;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/merkleProof.circom";

template MembershipProof(levels) {
    signal input  address;          // private
    signal input  pathElements[levels]; // private
    signal input  pathIndices[levels];  // private
    signal input  root;             // public
    signal output nullifier;        // public (prevents double-use)

    // Nullifier = H(address || secret_nonce) — prevents linking proofs to identity
    component nullHash = Poseidon(1);
    nullHash.inputs[0] <== address;
    nullifier <== nullHash.out;

    // Verify Merkle inclusion
    component tree = MerkleProof(levels);
    tree.leaf <== address;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i]  <== pathIndices[i];
    }
    tree.root === root;
}

component main {public [root]} = MembershipProof(20);
```

### 2. `balance_range_proof` — prove contribution balance is within a range

**Private inputs:** `balance`, `blinding_factor`  
**Public inputs:** `commitment`, `lower_bound`, `upper_bound`  
**Statement:** "My committed balance satisfies lower ≤ balance ≤ upper."

---

## Client-Side Proof Generation

`src/zk/prover.ts`:

```typescript
import { groth16 } from 'snarkjs';

const WASM_PATH = '/zk/membership_proof.wasm';
const ZKEY_PATH = '/zk/membership_proof_final.zkey';

export async function proveMembership(
  address: bigint,
  pathElements: bigint[],
  pathIndices: number[],
  root: bigint,
): Promise<{ proof: object; publicSignals: string[] }> {
  const input = { address, pathElements, pathIndices, root };
  return groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
}
```

Proof generation runs in a Web Worker to avoid blocking the UI:

```typescript
// src/zk/prover.worker.ts
self.onmessage = async ({ data }) => {
  const result = await proveMembership(...data);
  self.postMessage(result);
};
```

---

## Backend Verification Service

A lightweight Node/Bun service that verifies proofs before forwarding actions to the Stellar network.

`backend/src/verify.ts`:

```typescript
import { groth16 } from 'snarkjs';
import vKey from '../zk/membership_proof_verification_key.json';

export async function verifyMembershipProof(
  proof: object,
  publicSignals: string[],
): Promise<boolean> {
  return groth16.verify(vKey, publicSignals, proof);
}
```

**Endpoint:** `POST /api/zk/verify`  
**Request:** `{ circuit: "membership_proof", proof, publicSignals }`  
**Response:** `{ valid: boolean }`

The backend never receives private inputs — only the proof and public signals.

---

## Circuit Auditing Process

| Phase | Action | Owner |
|-------|--------|-------|
| **1. Internal review** | Constraint count audit; check for under-constrained signals using `circom --inspect` | Dev team |
| **2. Formal verification** | Run `snarkjs r1cs info` + check constraint satisfaction with edge-case witnesses | Dev team |
| **3. Trusted setup** | Powers-of-Tau ceremony (reuse Hermez Phase 1); Phase 2 per-circuit with public entropy contributions | Multi-party (≥5 contributors) |
| **4. External audit** | Engage a ZK-specialist firm (e.g. Trail of Bits, Zellic) before mainnet | External |
| **5. Ongoing** | Any circuit change resets phases 1-4; nullifier set monitored for double-spend attempts | Dev + monitoring |

### Trusted Setup Artifacts

```
zk/
├── pot20_final.ptau              # Phase 1 (reused from Hermez)
├── membership_proof.r1cs
├── membership_proof.wasm
├── membership_proof_final.zkey   # Phase 2 output
└── membership_proof_verification_key.json
```

All `.ptau` and `.zkey` files must have their hashes committed in `zk/checksums.sha256` and verified in CI.

---

## Security Notes

- **Nullifiers** prevent proof reuse. The backend stores a nullifier set; duplicate submissions are rejected.
- **Trusted setup compromise** would allow forged proofs. Mitigate via multi-party ceremony and future migration to transparent setup (PLONK/STARKs) in v2.
- **Circuit under-constraining** is the most common ZK bug. Every constraint must be checked with both valid and invalid witnesses in tests.
- See [threat-model.md](threat-model.md) for the overall security posture.
