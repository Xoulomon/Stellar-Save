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
import {
  TEST_USERS,
  TEST_USER_KEYPAIR,
  createExpiredJwt,
  createInvalidSignature,
} from '../fixtures/users';

/**
 * Integration test suite for issue #1536 (#82):
 * Full auth lifecycle integration tests post auth handler refactor.
 *
 * Covers:
 * - Challenge generation & Stellar signature verification
 * - JWT access token issuance, verification, and expiration handling
 * - Refresh token issuance, rotation, and family revocation on reuse
 * - Session revocation ("logout device" & "logout everywhere")
 * - Edge cases (invalid credentials, expired tokens, revoked tokens)
 */

describe('Auth Service Integration Tests', () => {
  const walletAddress = TEST_USERS.primary.walletAddress;

  describe('1. Challenge & Signature Authentication Lifecycle', () => {
    it('generates a valid authentication challenge containing nonce and timestamp', async () => {
      const challengeMessage = await generateChallenge(walletAddress);

      expect(challengeMessage).toContain('Sign this message to authenticate with Stellar Save.');
      expect(challengeMessage).toContain(`Wallet: ${walletAddress}`);
      expect(challengeMessage).toContain('Nonce:');
      expect(challengeMessage).toContain('Timestamp:');
    });

    it('rejects challenge generation for invalid Stellar wallet address', async () => {
      await expect(generateChallenge(TEST_USERS.invalid.walletAddress)).rejects.toThrow(
        'Invalid Stellar wallet address'
      );
    });

    it('verifies a valid Ed25519 signature against stored challenge', async () => {
      const challengeMessage = await generateChallenge(walletAddress);
      const signatureBuffer = TEST_USER_KEYPAIR.sign(Buffer.from(challengeMessage, 'utf8'));
      const signatureBase64 = signatureBuffer.toString('base64');

      const isValid = await verifySignature(walletAddress, challengeMessage, signatureBase64);
      expect(isValid).toBe(true);
    });

    it('rejects signature verification when message is tampered or challenge is missing', async () => {
      const challengeMessage = await generateChallenge(walletAddress);
      const invalidSig = createInvalidSignature();

      const isValid = await verifySignature(walletAddress, challengeMessage, invalidSig);
      expect(isValid).toBe(false);
    });

    it('prevents challenge replay attacks by rejecting reused nonces', async () => {
      const challengeMessage = await generateChallenge(walletAddress);
      const signatureBuffer = TEST_USER_KEYPAIR.sign(Buffer.from(challengeMessage, 'utf8'));
      const signatureBase64 = signatureBuffer.toString('base64');

      // First verification succeeds
      const firstTry = await verifySignature(walletAddress, challengeMessage, signatureBase64);
      expect(firstTry).toBe(true);

      // Replay attempt fails because challenge key was removed / nonce registered as used
      await expect(
        verifySignature(walletAddress, challengeMessage, signatureBase64)
      ).rejects.toThrow('Challenge not found or expired. Request a new challenge.');
    });
  });

  describe('2. JWT Access Token Lifecycle', () => {
    it('issues and verifies a valid JWT access token with correct subject claim', () => {
      const token = issueJwt(walletAddress);
      expect(typeof token).toBe('string');

      const payload = verifyJwt(token);
      expect(payload.sub).toBe(walletAddress);
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('fails verification on expired or tampered JWT access token', () => {
      const expiredToken = createExpiredJwt(walletAddress);
      expect(() => verifyJwt(expiredToken)).toThrow();

      const tamperedToken = issueJwt(walletAddress) + 'invalid_signature_suffix';
      expect(() => verifyJwt(tamperedToken)).toThrow();
    });
  });

  describe('3. Refresh Token Issuance & Family Rotation', () => {
    it('issues a new refresh token raw string', async () => {
      const rawToken = await issueRefreshToken(walletAddress);
      expect(typeof rawToken).toBe('string');
      expect(rawToken.length).toBeGreaterThan(20);
    });

    it('rotates a valid refresh token and returns new access + refresh token pair', async () => {
      const initialRawToken = await issueRefreshToken(walletAddress);

      const rotated = await rotateRefreshToken(initialRawToken);

      expect(rotated).toHaveProperty('accessToken');
      expect(rotated).toHaveProperty('refreshToken');
      expect(rotated.refreshToken).not.toBe(initialRawToken);

      const payload = verifyJwt(rotated.accessToken);
      expect(payload.sub).toBe(walletAddress);
    });

    it('detects refresh token reuse and revokes entire session family', async () => {
      const initialRawToken = await issueRefreshToken(walletAddress);
      const rotated = await rotateRefreshToken(initialRawToken);

      // Attempting to reuse initialRawToken MUST trigger reuse detection & family revocation
      await expect(rotateRefreshToken(initialRawToken)).rejects.toThrow(
        'Refresh token reuse detected. All sessions invalidated.'
      );

      // Subsequent attempt with the child token rotated.refreshToken MUST also fail (family revoked)
      await expect(rotateRefreshToken(rotated.refreshToken)).rejects.toThrow(
        'Refresh token has been revoked.'
      );
    });
  });

  describe('4. Session Revocation Flows', () => {
    it('revokes a single session family via raw refresh token', async () => {
      const rawToken = await issueRefreshToken(walletAddress);
      await revokeSession(rawToken);

      await expect(rotateRefreshToken(rawToken)).rejects.toThrow(
        'Refresh token has been revoked.'
      );
    });

    it('revokes all active sessions for a wallet address ("logout everywhere")', async () => {
      const session1 = await issueRefreshToken(walletAddress);
      const session2 = await issueRefreshToken(walletAddress);

      await revokeAllSessions(walletAddress);

      await expect(rotateRefreshToken(session1)).rejects.toThrow(
        'Refresh token has been revoked.'
      );
      await expect(rotateRefreshToken(session2)).rejects.toThrow(
        'Refresh token has been revoked.'
      );
    });
  });
});
