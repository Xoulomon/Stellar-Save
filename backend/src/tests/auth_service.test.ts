/**
 * Unit tests for auth_service.ts (Issue #1725).
 *
 * Targets 90%+ coverage of auth_service.ts.
 * Covers:
 *  - Token expiry (issueJwt boundary, verifyJwt throws on expired token)
 *  - Refresh-token rotation, reuse detection, revocation
 *  - revokeSession and revokeAllSessions paths
 *
 * The JWT/crypto layer is mocked at the module level so these remain fast
 * unit tests that do not depend on running real time or a real DB.
 *
 * Prisma is mocked via the existing __mocks__ pattern; the jsonwebtoken
 * timing is overridden with jest.useFakeTimers().
 */

import { Keypair } from '@stellar/stellar-sdk';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken') as { sign: (payload: object, secret: string, opts: object) => string };

import {
  issueJwt,
  verifyJwt,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllSessions,
  revokeSession,
  generateChallenge,
  verifySignature,
} from '../auth_service';

// ── Prisma mock ───────────────────────────────────────────────────────────────
// Mock the prisma_client module with jest.fn() stubs for all RefreshToken ops.

jest.mock('../prisma_client', () => ({
  prisma: require('../../tests/helpers/prismaMock').createPrismaMock(),
}));

jest.mock('../redis', () => {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (key: string) => {
      const raw = store.get(key);
      return raw ? JSON.parse(raw) : null;
    }),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

import * as redisClient from '../redis';
import { prisma } from '../prisma_client';

const mockRedis = redisClient as jest.Mocked<typeof redisClient> & { __store: Map<string, string> };
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ── Test keypair ─────────────────────────────────────────────────────────────

const keypair = Keypair.random();
const walletAddress = keypair.publicKey();

function signMessage(message: string): string {
  return keypair.sign(Buffer.from(message, 'utf8')).toString('base64');
}

// ── Shared reset ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.__store.clear();
  jest.useRealTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ═════════════════════════════════════════════════════════════════════════════
// issueJwt / verifyJwt — token expiry boundary
// ═════════════════════════════════════════════════════════════════════════════

describe('issueJwt / verifyJwt – token expiry boundary', () => {
  it('issues a valid JWT that decodes to the wallet address', () => {
    const token = issueJwt(walletAddress);
    const payload = verifyJwt(token);

    expect(payload.sub).toBe(walletAddress);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    // exp must be in the future
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('includes the expected expiry window (exp - iat ≈ ACCESS_TOKEN_TTL)', () => {
    const token = issueJwt(walletAddress);
    const payload = verifyJwt(token);

    const ttlSeconds = payload.exp - payload.iat;
    // Default is 15m = 900s; allow ±5s clock drift.
    expect(ttlSeconds).toBeGreaterThanOrEqual(895);
    expect(ttlSeconds).toBeLessThanOrEqual(905);
  });

  it('throws TokenExpiredError when the token is past its exp claim', () => {
    jest.useFakeTimers();

    const token = issueJwt(walletAddress);

    // Fast-forward 20 minutes past issue time to expire a 15-minute token.
    jest.advanceTimersByTime(20 * 60 * 1000);

    // jwt.verify honours system clock; advance Date.now via fakeTimers so the
    // real jwt library sees the time change.
    expect(() => verifyJwt(token)).toThrow(/expired/i);
  });

  it('immediately-issued token is still valid at issuance moment', () => {
    const token = issueJwt(walletAddress);
    // Must not throw
    expect(() => verifyJwt(token)).not.toThrow();
  });

  it('throws on a tampered/garbage token string', () => {
    expect(() => verifyJwt('not.a.valid.jwt')).toThrow();
  });

  it('throws on a token signed with a different secret', () => {
    const foreignToken = jwt.sign({ sub: walletAddress }, 'wrong-secret', { expiresIn: '15m' });
    expect(() => verifyJwt(foreignToken)).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// issueRefreshToken
// ═════════════════════════════════════════════════════════════════════════════

describe('issueRefreshToken', () => {
  beforeEach(() => {
    // Return minimal record on create
    (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({
      id: 'tok-1',
      tokenHash: 'hash',
      walletAddress,
      familyId: 'fam-1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      used: false,
      revokedAt: null,
    });
  });

  it('returns a non-empty random hex string', async () => {
    const raw = await issueRefreshToken(walletAddress);

    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toMatch(/^[0-9a-f]+$/);
  });

  it('stores the token hash (not the raw value) in the DB', async () => {
    const raw = await issueRefreshToken(walletAddress);

    const createCall = (mockPrisma.refreshToken.create as jest.Mock).mock.calls[0][0];
    // The hash must differ from the raw token.
    expect(createCall.data.tokenHash).not.toBe(raw);
    // The hash is a hex SHA-256 string (64 chars).
    expect(createCall.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('uses the supplied familyId when provided', async () => {
    await issueRefreshToken(walletAddress, 'my-family-id');

    const createCall = (mockPrisma.refreshToken.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.familyId).toBe('my-family-id');
  });

  it('generates a new familyId when none is provided', async () => {
    await issueRefreshToken(walletAddress);
    await issueRefreshToken(walletAddress);

    const firstFamily = (mockPrisma.refreshToken.create as jest.Mock).mock.calls[0][0].data.familyId;
    const secondFamily = (mockPrisma.refreshToken.create as jest.Mock).mock.calls[1][0].data.familyId;

    expect(typeof firstFamily).toBe('string');
    expect(firstFamily).not.toBe('');
    expect(firstFamily).not.toBe(secondFamily);
  });

  it('sets an expiry date ~30 days from now', async () => {
    await issueRefreshToken(walletAddress);

    const createCall = (mockPrisma.refreshToken.create as jest.Mock).mock.calls[0][0];
    const expiresAt: Date = createCall.data.expiresAt;
    const msDiff = expiresAt.getTime() - Date.now();

    // Allow ±5 seconds clock tolerance.
    expect(msDiff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000 - 5000);
    expect(msDiff).toBeLessThan(31 * 24 * 60 * 60 * 1000 + 5000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// rotateRefreshToken — core rotation logic
// ═════════════════════════════════════════════════════════════════════════════

describe('rotateRefreshToken', () => {
  const RAW_TOKEN = 'deadbeef'.repeat(10); // 80-char hex

  function makeFreshRecord(overrides: Partial<{
    used: boolean;
    revokedAt: Date | null;
    expiresAt: Date;
  }> = {}) {
    return {
      id: 'tok-1',
      tokenHash: 'somehash',
      walletAddress,
      familyId: 'fam-1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      used: false,
      revokedAt: null,
      ...overrides,
    };
  }

  it('returns new accessToken and refreshToken on a valid, unused token', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(makeFreshRecord());
    (mockPrisma.refreshToken.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({
      ...makeFreshRecord(),
      id: 'tok-2',
      tokenHash: 'newhash',
    });

    const result = await rotateRefreshToken(RAW_TOKEN);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    // The new refresh token must be different from the consumed one.
    expect(result.refreshToken).not.toBe(RAW_TOKEN);
  });

  it('marks the current token as used', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(makeFreshRecord());
    (mockPrisma.refreshToken.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue(makeFreshRecord());

    await rotateRefreshToken(RAW_TOKEN);

    const updateCall = (mockPrisma.refreshToken.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.used).toBe(true);
  });

  it('issues a new token in the same family', async () => {
    const record = makeFreshRecord();
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(record);
    (mockPrisma.refreshToken.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue({ ...record, id: 'tok-2' });

    await rotateRefreshToken(RAW_TOKEN);

    const createCall = (mockPrisma.refreshToken.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.familyId).toBe(record.familyId);
  });

  it('throws on an unknown / invalid token', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(rotateRefreshToken('unknown-token')).rejects.toThrow('Invalid refresh token');
  });

  it('throws when the token has been revoked', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(
      makeFreshRecord({ revokedAt: new Date() })
    );

    await expect(rotateRefreshToken(RAW_TOKEN)).rejects.toThrow('Refresh token has been revoked');
  });

  it('throws when the token is past its expiry date', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(
      makeFreshRecord({ expiresAt: new Date(Date.now() - 1) })
    );

    await expect(rotateRefreshToken(RAW_TOKEN)).rejects.toThrow('Refresh token has expired');
  });

  // ── Refresh-token reuse detection ─────────────────────────────────────────

  it('detects token reuse and revokes the entire family', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(
      makeFreshRecord({ used: true }) // already-consumed token
    );
    (mockPrisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

    await expect(rotateRefreshToken(RAW_TOKEN)).rejects.toThrow(
      'Refresh token reuse detected'
    );

    // The entire family must have been revoked.
    const updateManyCall = (mockPrisma.refreshToken.updateMany as jest.Mock).mock.calls[0][0];
    expect(updateManyCall.where.familyId).toBe('fam-1');
    expect(updateManyCall.where.revokedAt).toBeNull();
    expect(updateManyCall.data.revokedAt).toBeInstanceOf(Date);
  });

  it('reuse detection message tells the user all sessions were invalidated', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(
      makeFreshRecord({ used: true })
    );
    (mockPrisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const error = await rotateRefreshToken(RAW_TOKEN).catch((e) => e);
    expect(error.message).toMatch(/all sessions invalidated/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// revokeSession — single-device logout
// ═════════════════════════════════════════════════════════════════════════════

describe('revokeSession', () => {
  const RAW_TOKEN = 'cafebabe'.repeat(10);

  it('revokes the family that belongs to the token', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: 'tok-1',
      walletAddress,
      familyId: 'fam-42',
      expiresAt: new Date(Date.now() + 1000),
      used: false,
      revokedAt: null,
    });
    (mockPrisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await revokeSession(RAW_TOKEN);

    const updateCall = (mockPrisma.refreshToken.updateMany as jest.Mock).mock.calls[0][0];
    expect(updateCall.where.familyId).toBe('fam-42');
    expect(updateCall.data.revokedAt).toBeInstanceOf(Date);
  });

  it('does nothing silently when the token is not found', async () => {
    (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(revokeSession('no-such-token')).resolves.not.toThrow();
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// revokeAllSessions — global logout
// ═════════════════════════════════════════════════════════════════════════════

describe('revokeAllSessions', () => {
  it('marks all active tokens for the wallet address as revoked', async () => {
    (mockPrisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

    await revokeAllSessions(walletAddress);

    const updateCall = (mockPrisma.refreshToken.updateMany as jest.Mock).mock.calls[0][0];
    expect(updateCall.where.walletAddress).toBe(walletAddress);
    expect(updateCall.where.revokedAt).toBeNull();
    expect(updateCall.data.revokedAt).toBeInstanceOf(Date);
  });

  it('does not attempt to revoke already-revoked tokens', async () => {
    (mockPrisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    // Should resolve cleanly when there is nothing active.
    await expect(revokeAllSessions(walletAddress)).resolves.not.toThrow();
    const call = (mockPrisma.refreshToken.updateMany as jest.Mock).mock.calls[0][0];
    // The query filter excludes already-revoked rows.
    expect(call.where.revokedAt).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// generateChallenge / verifySignature — quick smoke paths
// (full coverage in auth.test.ts; these plug remaining gaps)
// ═════════════════════════════════════════════════════════════════════════════

describe('generateChallenge + verifySignature – expiry paths', () => {
  it('rejects a challenge whose embedded timestamp is older than CHALLENGE_TTL_SECONDS', async () => {
    const challenge = await generateChallenge(walletAddress);
    const sig = signMessage(challenge);

    // Back-date the stored entry so the age check triggers.
    const nonce = challenge.match(/Nonce: ([a-f0-9]+)/)![1];
    const staleTs = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    mockRedis.__store.set(
      `auth:challenge:${walletAddress}`,
      JSON.stringify({ nonce, message: challenge, timestamp: staleTs })
    );

    await expect(verifySignature(walletAddress, challenge, sig)).rejects.toThrow(
      'Challenge has expired'
    );
  });

  it('blocks replay of a nonce that was already used', async () => {
    const challenge = await generateChallenge(walletAddress);
    const sig = signMessage(challenge);

    // First use.
    await verifySignature(walletAddress, challenge, sig);

    // Re-insert the challenge to simulate a replay attempt.
    const nonce = challenge.match(/Nonce: ([a-f0-9]+)/)![1];
    const ts = parseInt(challenge.match(/Timestamp: (\d+)/)![1]);
    mockRedis.__store.set(
      `auth:challenge:${walletAddress}`,
      JSON.stringify({ nonce, message: challenge, timestamp: ts })
    );

    await expect(verifySignature(walletAddress, challenge, sig)).rejects.toThrow(
      'Challenge nonce has already been used'
    );
  });
});
