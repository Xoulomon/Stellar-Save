# ZK Circuit Audit Process
<!-- Closes #1174 -->

## Scope
`zk/circuits/membership_proof.circom` — Groth16 Poseidon-commitment range proof.

## Pre-Audit Checklist
- [ ] All signals constrained (no under-constrained wires)
- [ ] Poseidon hash matches on-chain commitment (same domain separator)
- [ ] Range comparator bounds prevent overflow (`GreaterEqThan(252)`)
- [ ] Trusted setup ceremony completed (or PTAU file sourced from Powers of Tau)
- [ ] Final `.zkey` contribution verified with `snarkjs zkey verify`

## Audit Steps

### 1. Static Analysis
```bash
# Check for under-constrained signals
circom zk/circuits/membership_proof.circom --r1cs --wasm --sym -o zk/build
snarkjs r1cs info zk/build/membership_proof.r1cs
```

### 2. Witness Generation Test
```bash
node zk/build/membership_proof_js/generate_witness.js \
  zk/build/membership_proof_js/membership_proof.wasm \
  zk/test/input_valid.json \
  zk/build/witness.wtns
```

### 3. Proof Soundness
- Verify a valid proof passes: `snarkjs groth16 verify`
- Verify a forged proof fails (wrong commitment, wrong threshold)
- Fuzz private inputs; confirm commitment mismatch is always rejected

### 4. External Audit
Engage a ZK-specialised firm (e.g. Trail of Bits, Veridise, or zkSecurity) for:
- Constraint system completeness review
- Trusted setup verification
- Side-channel analysis of WASM prover

## Fix & Disclosure Timeline
| Day | Action |
|-----|--------|
| 0   | Finding reported to `security@stellar-save.example` |
| 1   | Triage and severity classification |
| 7   | Patch developed and internally reviewed |
| 14  | Patch deployed; circuit re-audited if needed |
| 21  | Public disclosure after community notification |
