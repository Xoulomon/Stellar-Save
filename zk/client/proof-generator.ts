/**
 * ZK Proof Generation (client-side)
 * Uses snarkjs + Groth16 with the compiled MembershipProof circuit.
 * Closes #1174
 */

// snarkjs is loaded at runtime; import type only to avoid bundler issues.
// In practice: import snarkjs from "snarkjs" in your bundler config.
declare const snarkjs: typeof import("snarkjs");

export interface ProofInput {
  value: bigint;      // private: raw attribute value
  salt: bigint;       // private: random blinding factor
  threshold: bigint;  // public: minimum required value
  commitment: bigint; // public: Poseidon(value, salt)
}

export interface ZKProof {
  proof: object;
  publicSignals: string[];
}

const WASM_PATH = "/zk/membership_proof.wasm";
const ZKEY_PATH = "/zk/membership_proof_final.zkey";

/**
 * Generates a Groth16 proof that `value >= threshold` without revealing `value`.
 */
export async function generateProof(input: ProofInput): Promise<ZKProof> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      value:      input.value.toString(),
      salt:       input.salt.toString(),
      threshold:  input.threshold.toString(),
      commitment: input.commitment.toString(),
    },
    WASM_PATH,
    ZKEY_PATH
  );
  return { proof, publicSignals };
}

/**
 * Serializes proof into the format expected by the backend verifier.
 */
export function serializeProof(zk: ZKProof): string {
  return JSON.stringify({ proof: zk.proof, publicSignals: zk.publicSignals });
}
