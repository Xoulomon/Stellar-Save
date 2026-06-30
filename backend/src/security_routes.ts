/**
 * Security API Routes (Issues #1102, #1103, #1104, #1105)
 * 
 * Example routes demonstrating security feature usage.
 */

import express, { Request, Response } from 'express';
import { transactionDecoderService } from './transaction_decoder_service';
import {
  sanitizeInputMiddleware,
  sanitizeGroupMetadataMiddleware,
  InputSanitizer,
} from './input_sanitization_middleware';
import { secretsManager } from './secrets_manager_service';
import { jwtAuthMiddleware, AuthenticatedRequest } from './auth_middleware';
import { logger } from './logger';

const router = express.Router();

// ── #1102: Transaction Decoding ──────────────────────────────────────────────

/**
 * Decode a Stellar transaction for user review
 */
router.post('/decode-transaction', sanitizeInputMiddleware, (req: Request, res: Response) => {
  try {
    const { xdr, origin } = req.body;

    if (!xdr) {
      return res.status(400).json({ error: 'Transaction XDR is required' });
    }

    // Decode transaction
    const decoded = transactionDecoderService.decodeTransaction(xdr);

    // Validate origin if provided (phishing protection)
    let originValidation;
    if (origin) {
      originValidation = transactionDecoderService.validateOrigin(origin);
    }

    // Validate transaction
    const validation = transactionDecoderService.validateTransaction(xdr, origin);

    logger.info('Transaction decoded', {
      riskLevel: decoded.overallRiskLevel,
      operationCount: decoded.operations.length,
      originValid: originValidation?.valid,
    });

    return res.json({
      decoded,
      validation,
      originCheck: originValidation,
    });
  } catch (error) {
    logger.error('Transaction decoding failed', { error });
    return res.status(400).json({
      error: 'Failed to decode transaction',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Validate transaction origin (for phishing detection)
 */
router.post('/validate-origin', sanitizeInputMiddleware, (req: Request, res: Response) => {
  try {
    const { origin } = req.body;

    if (!origin) {
      return res.status(400).json({ error: 'Origin is required' });
    }

    const result = transactionDecoderService.validateOrigin(origin);

    return res.json(result);
  } catch (error) {
    logger.error('Origin validation failed', { error });
    return res.status(400).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ── #1103: Input Sanitization Examples ───────────────────────────────────────

/**
 * Create group with sanitized metadata
 */
router.post(
  '/groups',
  jwtAuthMiddleware,
  sanitizeInputMiddleware,
  sanitizeGroupMetadataMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, metadata } = req.body;

      // Additional validation
      if (!name || name.length === 0) {
        return res.status(400).json({ error: 'Group name is required' });
      }

      // At this point, all inputs are sanitized by middleware
      logger.info('Creating group with sanitized input', {
        walletAddress: req.walletAddress,
        nameLength: name.length,
      });

      // Your group creation logic here
      const group = {
        id: 'mock-group-id',
        name,
        description,
        metadata,
        creator: req.walletAddress,
      };

      return res.status(201).json({ group });
    } catch (error) {
      logger.error('Group creation failed', { error });
      return res.status(500).json({ error: 'Failed to create group' });
    }
  }
);

/**
 * Add comment with sanitization
 */
router.post(
  '/groups/:groupId/comments',
  jwtAuthMiddleware,
  sanitizeInputMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { comment } = req.body;

      if (!comment || comment.length === 0) {
        return res.status(400).json({ error: 'Comment is required' });
      }

      // Additional sanitization for comments
      const sanitizedComment = InputSanitizer.sanitizeComment(comment);

      logger.info('Adding sanitized comment', {
        groupId: req.params.groupId,
        commentLength: sanitizedComment.length,
      });

      // Your comment storage logic here
      const savedComment = {
        id: 'mock-comment-id',
        content: sanitizedComment,
        author: req.walletAddress,
        groupId: req.params.groupId,
        createdAt: new Date().toISOString(),
      };

      return res.status(201).json({ comment: savedComment });
    } catch (error) {
      logger.error('Comment creation failed', { error });
      return res.status(500).json({ error: 'Failed to add comment' });
    }
  }
);

/**
 * Validate input manually (for testing)
 */
router.post('/validate-input', (req: Request, res: Response) => {
  try {
    const { input, type } = req.body;

    let result;
    switch (type) {
      case 'stellar-address':
        result = InputSanitizer.validateStellarAddress(input);
        break;
      case 'email':
        result = InputSanitizer.validateEmail(input);
        break;
      case 'url':
        try {
          InputSanitizer.sanitizeUrl(input);
          result = true;
        } catch {
          result = false;
        }
        break;
      default:
        return res.status(400).json({ error: 'Invalid validation type' });
    }

    return res.json({ valid: result });
  } catch (error) {
    return res.status(400).json({ error: 'Validation failed' });
  }
});

// ── #1105: Secrets Management (Admin only) ───────────────────────────────────

/**
 * Get secret metadata (for monitoring)
 */
router.get('/admin/secrets/:secretName/metadata', async (req: Request, res: Response) => {
  try {
    // In production, add admin authentication
    const { secretName } = req.params;

    const metadata = await secretsManager.getSecretMetadata(secretName);

    return res.json({ metadata });
  } catch (error) {
    logger.error('Failed to get secret metadata', { error });
    return res.status(500).json({
      error: 'Failed to retrieve secret metadata',
    });
  }
});

/**
 * Trigger secret rotation (admin operation)
 */
router.post('/admin/secrets/:secretName/rotate', async (req: Request, res: Response) => {
  try {
    // In production, add admin authentication
    const { secretName } = req.params;

    await secretsManager.rotateSecret(secretName);

    logger.info('Secret rotation triggered', { secretName });

    return res.json({
      message: 'Secret rotation initiated',
      secretName,
    });
  } catch (error) {
    logger.error('Failed to rotate secret', { error });
    return res.status(500).json({
      error: 'Failed to initiate rotation',
    });
  }
});

/**
 * Check rotation status for all secrets
 */
router.get('/admin/secrets/rotation-status', async (req: Request, res: Response) => {
  try {
    // In production, add admin authentication
    const secretNames = [
      'stellar-save/jwt-secret',
      'stellar-save/admin-secret',
      'stellar-save/db-password',
    ];

    const status = await secretsManager.checkRotationStatus(secretNames);

    return res.json({ status });
  } catch (error) {
    logger.error('Failed to check rotation status', { error });
    return res.status(500).json({
      error: 'Failed to check rotation status',
    });
  }
});

/**
 * Clear secret cache
 */
router.post('/admin/secrets/clear-cache', async (req: Request, res: Response) => {
  try {
    // In production, add admin authentication
    const { secretName } = req.body;

    if (secretName) {
      secretsManager.clearCache(secretName);
    } else {
      secretsManager.clearCache();
    }

    logger.info('Secret cache cleared', { secretName: secretName || 'all' });

    return res.json({
      message: 'Cache cleared',
      secretName: secretName || 'all',
    });
  } catch (error) {
    logger.error('Failed to clear cache', { error });
    return res.status(500).json({
      error: 'Failed to clear cache',
    });
  }
});

// ── Health & Status ───────────────────────────────────────────────────────────

/**
 * Security features health check
 */
router.get('/security/health', async (req: Request, res: Response) => {
  const health = {
    transactionDecoder: 'ok',
    inputSanitization: 'ok',
    securityHeaders: 'ok',
    secretsManager: 'unknown',
  };

  try {
    // Test secrets manager connectivity
    await secretsManager.getSecretMetadata('stellar-save/jwt-secret');
    health.secretsManager = 'ok';
  } catch (error) {
    health.secretsManager = 'error';
    logger.warn('Secrets Manager health check failed', { error });
  }

  const allOk = Object.values(health).every((status) => status === 'ok');

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    components: health,
  });
});

export { router as securityRouter };
