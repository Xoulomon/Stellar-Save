pragma circom 2.1.6;

/*
 * MembershipProof — proves a user attribute (e.g. KYC tier, credit score)
 * satisfies a threshold without revealing the raw value on-chain.
 *
 * Public inputs:  threshold, commitment
 * Private inputs: value, salt
 *
 * Closes #1174
 */

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template MembershipProof() {
    // Private
    signal input value;   // raw attribute value (e.g. credit score)
    signal input salt;    // random blinding factor

    // Public
    signal input threshold;   // minimum required value
    signal input commitment;  // Poseidon(value, salt) — stored on-chain

    // Outputs
    signal output valid;

    // 1. Verify commitment: Poseidon(value, salt) == commitment
    component hasher = Poseidon(2);
    hasher.inputs[0] <== value;
    hasher.inputs[1] <== salt;
    hasher.out === commitment;

    // 2. Prove value >= threshold (no overflow: both < 2^252)
    component gte = GreaterEqThan(252);
    gte.in[0] <== value;
    gte.in[1] <== threshold;
    valid <== gte.out;
    valid === 1;
}

component main { public [threshold, commitment] } = MembershipProof();
