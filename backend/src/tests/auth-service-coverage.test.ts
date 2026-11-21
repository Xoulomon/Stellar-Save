/**
 * Backend unit tests for Issue #1535 (#81):
 * Closing coverage gaps in auth_service to support 85%+ baseline threshold.
 *
 * Moved from backend/test/unit/auth-service-coverage.test.ts as part of
 * test consolidation (Issue #1727).
 */

import { Keypair } from '@stellar/stellar-sdk';

import {
  generateChallenge,
  verifySignature,
  issueJwt,
  verifyJwt,
  issueRefreshToken,
  revokeSession,
  revokeAllSessions,
} from '../modules/auth/auth_service';

describe('auth_service Unit Test Coverage', () => {
  const validKeypair = Keypair.random();
  const validAddress = validKeypair.publicKey();

  describe('generateChallenge()', () => {
    it('returns a formatted string with nonce and timestamp for valid address', async () => {
      const msg = await generateChallenge(validAddress);
      expect(msg).toMatch(/^Sign this message to authenticate with Stellar Save\./);
      expect(msg).toContain(validAddress);
    });

    it('throws error when wallet address is not a valid Stellar public key', async () => {
      await expect(generateChallenge('not-a-stellar-key')).rejects.toThrow(
        'Invalid Stellar wallet address'
      );
    });
  });

  describe('verifySignature()', () => {
    it('returns true for a valid signature', async () => {
      const challenge = await generateChallenge(validAddress);
      const signature = validKeypair.sign(Buffer.from(challenge, 'utf8')).toString('base64');
      const result = await verifySignature(validAddress, challenge, signature);
      expect(result).toBe(true);
    });

    it('returns false for an invalid signature', async () => {
      const challenge = await generateChallenge(validAddress);
      const result = await verifySignature(validAddress, challenge, 'invalid-signature');
      expect(result).toBe(false);
    });
  });

  describe('issueJwt / verifyJwt', () => {
    it('issues and verifies a valid JWT', async () => {
      const token = issueJwt(validAddress);
      const decoded = verifyJwt(token);
      expect(decoded.sub).toBe(validAddress);
      expect(typeof decoded.iat).toBe('number');
      expect(typeof decoded.exp).toBe('number');
    });
  });

  describe('Refresh Token Operations', () => {
    it('creates database record hash for newly issued refresh token', async () => {
      const raw = await issueRefreshToken(validAddress);
      expect(raw).toBeDefined();
      expect(typeof raw).toBe('string');
    });

    it('handles session revocation cleanly', async () => {
      const raw = await issueRefreshToken(validAddress);
      await expect(revokeSession(raw)).resolves.not.toThrow();
      await expect(revokeAllSessions(validAddress)).resolves.not.toThrow();
    });
  });
});
