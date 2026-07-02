import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';
import * as redisClient from './redis';
import { prisma } from './prisma_client';
import { config } from './config';

const JWT_SECRET = config.auth.jwtSecret;
const ACCESS_TOKEN_TTL = config.auth.accessTokenTtl;   // e.g. '15m'
const REFRESH_TOKEN_TTL_DAYS = config.auth.refreshTokenTtlDays; // e.g. 30
const CHALLENGE_TTL_SECONDS = 300;
const USED_NONCE_TTL_SECONDS = CHALLENGE_TTL_SECONDS + 60;

export interface JwtPayload {
  sub: string;   // wallet address
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  walletAddress: string;
}

// ── Challenge / signature ─────────────────────────────────────────────────────

export async function generateChallenge(walletAddress: string): Promise<string> {
  try {
    Keypair.fromPublicKey(walletAddress);
  } catch {
    throw new Error('Invalid Stellar wallet address');
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  const challengeKey = `auth:challenge:${walletAddress}`;
  const timestamp = Date.now();
  const message =
    `Sign this message to authenticate with Stellar Save.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  await redisClient.set(challengeKey, { nonce, message, timestamp }, CHALLENGE_TTL_SECONDS);
  return message;
}

export async function verifySignature(
  walletAddress: string,
  signedMessage: string,
  signature: string
): Promise<boolean> {
  const challengeKey = `auth:challenge:${walletAddress}`;
  const stored = await redisClient.get(challengeKey);

  if (!stored) throw new Error('Challenge not found or expired. Request a new challenge.');

  await redisClient.del(challengeKey);

  if (stored.message !== signedMessage) throw new Error('Challenge message mismatch.');

  const ageMs = Date.now() - stored.timestamp;
  if (ageMs > CHALLENGE_TTL_SECONDS * 1000) throw new Error('Challenge has expired.');

  const usedNonceKey = `auth:used_nonce:${stored.nonce}`;
  if (await redisClient.get(usedNonceKey)) throw new Error('Challenge nonce has already been used.');

  try {
    const keypair = Keypair.fromPublicKey(walletAddress);
    const isValid = keypair.verify(
      Buffer.from(signedMessage, 'utf8'),
      Buffer.from(signature, 'base64'),
    );

    if (isValid) {
      await redisClient.set(usedNonceKey, true, USED_NONCE_TTL_SECONDS);
    }
    return isValid;
  } catch {
    return false;
  }
}

// ── Access token ──────────────────────────────────────────────────────────────

export function issueJwt(walletAddress: string): string {
  return jwt.sign(
    { sub: walletAddress },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL } as jwt.SignOptions,
  );
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ── Refresh-token helpers ─────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function tokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return d;
}

/**
 * Issue a new refresh token (DB row) and return the raw secret value.
 * Caller must deliver the raw value to the client; only the hash is stored.
 */
export async function issueRefreshToken(
  walletAddress: string,
  familyId?: string,
): Promise<string> {
  const raw = crypto.randomBytes(40).toString('hex');
  const family = familyId ?? crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      walletAddress,
      familyId: family,
      expiresAt: tokenExpiresAt(),
    },
  });

  return raw;
}

/**
 * Rotate a refresh token:
 * 1. Look up the current token; verify it is valid.
 * 2. If the token was already used → reuse detected → revoke entire family.
 * 3. Mark current token as used and create a replacement token.
 *
 * Returns new { accessToken, refreshToken } on success.
 * Throws on any failure (expired, revoked, reuse).
 */
export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const hash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

  if (!record) throw new Error('Invalid refresh token.');
  if (record.revokedAt) throw new Error('Refresh token has been revoked.');
  if (record.expiresAt < new Date()) throw new Error('Refresh token has expired.');

  if (record.used) {
    // Reuse detected — revoke entire family immediately
    await revokeFamilyTokens(record.familyId);
    throw new Error('Refresh token reuse detected. All sessions invalidated.');
  }

  // Mark current token consumed and issue a new one in the same family
  await prisma.refreshToken.update({ where: { tokenHash: hash }, data: { used: true } });

  const newRaw = await issueRefreshToken(record.walletAddress, record.familyId);
  const accessToken = issueJwt(record.walletAddress);

  return { accessToken, refreshToken: newRaw };
}

/**
 * Revoke all active tokens in a session family.
 * Called on reuse detection or explicit logout-one.
 */
async function revokeFamilyTokens(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all refresh tokens for a wallet address ("log out everywhere").
 */
export async function revokeAllSessions(walletAddress: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { walletAddress, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke the single session family containing the given raw token.
 * Used for "log out this device".
 */
export async function revokeSession(rawToken: string): Promise<void> {
  const hash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (record) await revokeFamilyTokens(record.familyId);
}
