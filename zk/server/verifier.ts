/**
 * ZK Backend Verification Service
 * Verifies Groth16 proofs server-side using snarkjs.
 * Closes #1174
 */

import * as snarkjs from "snarkjs";
import * as fs from "fs";
import * as path from "path";

const VKEY_PATH = path.resolve(__dirname, "../../zk/membership_proof_verification_key.json");

let vKey: object | null = null;

function getVKey(): object {
  if (!vKey) vKey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));
  return vKey!;
}

export interface VerifyRequest {
  proof: object;
  publicSignals: string[]; // [threshold, commitment]
}

export interface VerifyResult {
  valid: boolean;
  error?: string;
}

/**
 * Verifies a Groth16 proof.
 * Returns { valid: true } if the proof is sound, { valid: false, error } otherwise.
 */
export async function verifyProof(req: VerifyRequest): Promise<VerifyResult> {
  try {
    const valid = await snarkjs.groth16.verify(getVKey(), req.publicSignals, req.proof);
    return { valid };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

// --- Minimal Express route handler (attach to your router) ---
// import express from "express";
// const router = express.Router();
// router.post("/zk/verify", async (req, res) => {
//   const result = await verifyProof(req.body as VerifyRequest);
//   res.json(result);
// });
// export default router;
