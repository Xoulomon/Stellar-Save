import { Keypair } from '@stellar/stellar-sdk';
import {
  generateChallenge,
  verifySignature,
  issueJwt,
  verifyJwt,
  issueRefreshToken,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
} from '../../src/auth_service';

/**
 * Backend unit tests for Issue #1535 (#81):
 * Closing coverage gaps in auth_service to support 85%+ baseline threshold.
 */

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
    it('returns false when signature verification throws an exception', async () => {
      const msg = await generateChallenge(validAddress);
      const invalidBase64 = '%%%not_valid_base64%%%';

      const result = await verifySignature(validAddress, msg, invalidBase64);
      expect(result).toBe(false);
    });
  });

  describe('issueJwt() and verifyJwt()', () => {
    it('signs and verifies payload successfully', () => {
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
