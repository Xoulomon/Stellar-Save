import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';
import * as redisClient from './redis';

const JWT_SECRET = process.env.JWT_SECRET || 'stellar-save-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes
// Used-nonce TTL slightly longer than challenge TTL to cover clock skew
const USED_NONCE_TTL_SECONDS = CHALLENGE_TTL_SECONDS + 60;

export interface JwtPayload {
  sub: string; // wallet address
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  walletAddress: string;
}

/**
 * Generates a cryptographically random challenge nonce for a wallet address.
 * Stored in Redis with a 5-minute TTL to prevent replay attacks.
 */
export async function generateChallenge(walletAddress: string): Promise<string> {
  try {
    Keypair.fromPublicKey(walletAddress);
  } catch {
    throw new Error('Invalid Stellar wallet address');
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  const challengeKey = `auth:challenge:${walletAddress}`;
  const timestamp = Date.now();
  const message = `Sign this message to authenticate with Stellar Save.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  await redisClient.set(challengeKey, { nonce, message, timestamp }, CHALLENGE_TTL_SECONDS);

  return message;
}

/**
 * Verifies an Ed25519 signature against the stored challenge.
 *
 * Security properties:
 * - Challenge is consumed on the first verification attempt (success or failure)
 *   to prevent brute-force retries.
 * - Used nonces are stored separately to block replay even if a challenge key
 *   somehow survives (belt-and-suspenders).
 * - Embedded timestamp is validated server-side to reject stale challenges
 *   independent of Redis TTL.
 */
export async function verifySignature(
  walletAddress: string,
  signedMessage: string,
  signature: string
): Promise<boolean> {
  const challengeKey = `auth:challenge:${walletAddress}`;
  const stored = await redisClient.get(challengeKey);

  if (!stored) {
    throw new Error('Challenge not found or expired. Request a new challenge.');
  }

  // Consume the challenge immediately — one attempt only, regardless of outcome
  await redisClient.del(challengeKey);

  if (stored.message !== signedMessage) {
    throw new Error('Challenge message mismatch.');
  }

  // Validate the embedded timestamp is within the allowed window
  const ageMs = Date.now() - stored.timestamp;
  if (ageMs > CHALLENGE_TTL_SECONDS * 1000) {
    throw new Error('Challenge has expired.');
  }

  // Guard against nonce reuse (replay attack with a previously valid signature)
  const usedNonceKey = `auth:used_nonce:${stored.nonce}`;
  const alreadyUsed = await redisClient.get(usedNonceKey);
  if (alreadyUsed) {
    throw new Error('Challenge nonce has already been used.');
  }

  try {
    const keypair = Keypair.fromPublicKey(walletAddress);
    const messageBuffer = Buffer.from(signedMessage, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'base64');

    const isValid = keypair.verify(messageBuffer, signatureBuffer);

    if (isValid) {
      // Mark nonce as used to prevent replay
      await redisClient.set(usedNonceKey, true, USED_NONCE_TTL_SECONDS);
    }

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Issues a signed JWT with the wallet address as the subject.
 */
export function issueJwt(walletAddress: string): string {
  return jwt.sign(
    { sub: walletAddress },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * Verifies and decodes a JWT, returning the payload.
 */
export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
