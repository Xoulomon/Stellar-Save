import * as jwt from 'jsonwebtoken';
import { Keypair, Networks, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';
import * as redisClient from './redis';

const JWT_SECRET = process.env.JWT_SECRET || 'stellar-save-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

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
  // Validate it looks like a Stellar public key (G...)
  try {
    Keypair.fromPublicKey(walletAddress);
  } catch {
    throw new Error('Invalid Stellar wallet address');
  }

  const nonce = require('crypto').randomBytes(32).toString('hex');
  const challengeKey = `auth:challenge:${walletAddress}`;
  const message = `Sign this message to authenticate with Stellar Save.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

  await redisClient.set(challengeKey, { nonce, message }, CHALLENGE_TTL_SECONDS);

  return message;
}

/**
 * Verifies a Stellar transaction-based signature against the stored challenge.
 * The client signs the challenge message using their Stellar keypair and submits
 * the signed XDR transaction envelope. We verify the signature matches the wallet.
 *
 * Stellar wallets sign arbitrary messages by wrapping them in a transaction envelope.
 * We verify the signature on the transaction matches the claimed wallet address.
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

  if (stored.message !== signedMessage) {
    throw new Error('Challenge message mismatch.');
  }

  try {
    // Verify the Ed25519 signature using Stellar SDK
    const keypair = Keypair.fromPublicKey(walletAddress);
    const messageBuffer = Buffer.from(signedMessage, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'base64');

    const isValid = keypair.verify(messageBuffer, signatureBuffer);

    if (isValid) {
      // Consume the challenge — one-time use only
      await redisClient.del(challengeKey);
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
