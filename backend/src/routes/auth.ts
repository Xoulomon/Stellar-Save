import { Router, Request, Response } from 'express';
import { generateChallenge, verifySignature, issueJwt } from '../auth_service';
import { logger } from '../logger';

/**
 * Auth routes for Stellar wallet-based authentication.
 *
 * POST /api/auth/challenge  — Request a sign challenge for a wallet address
 * POST /api/auth/verify     — Submit signed challenge to receive a JWT
 */
export function createAuthRouter(): Router {
  const router = Router();

  /**
   * POST /api/auth/challenge
   * Body: { walletAddress: string }
   * Returns: { challenge: string }
   *
   * Generates a one-time challenge message the client must sign with their
   * Stellar keypair. Challenge expires in 5 minutes.
   */
  router.post('/challenge', async (req: Request, res: Response) => {
    const { walletAddress } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    try {
      const challenge = await generateChallenge(walletAddress.trim());
      logger.info('Auth challenge issued', { walletAddress });
      return res.status(200).json({ challenge });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate challenge';
      logger.warn('Auth challenge failed', { walletAddress, error: message });
      return res.status(400).json({ error: message });
    }
  });

  /**
   * POST /api/auth/verify
   * Body: { walletAddress: string, challenge: string, signature: string }
   * Returns: { token: string }
   *
   * Verifies the Ed25519 signature against the stored challenge.
   * On success, issues a signed JWT valid for 24h.
   *
   * The `signature` must be the base64-encoded Ed25519 signature of the
   * challenge string, produced by the wallet's private key.
   */
  router.post('/verify', async (req: Request, res: Response) => {
    const { walletAddress, challenge, signature } = req.body;

    if (!walletAddress || !challenge || !signature) {
      return res.status(400).json({
        error: 'walletAddress, challenge, and signature are required',
      });
    }

    try {
      const isValid = await verifySignature(
        walletAddress.trim(),
        challenge,
        signature
      );

      if (!isValid) {
        logger.warn('Auth verification failed — invalid signature', { walletAddress });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const token = issueJwt(walletAddress.trim());
      logger.info('Auth verification successful', { walletAddress });

      return res.status(200).json({ token });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      logger.warn('Auth verify error', { walletAddress, error: message });
      return res.status(401).json({ error: message });
    }
  });

  return router;
}
