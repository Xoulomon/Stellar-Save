import { z } from 'zod';

import { logger } from '../logger';

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
}

type ValidationTarget = 'schema' | 'body' | 'query' | 'params';

function createValidationMiddleware(schema: ZodSchema, target: ValidationTarget) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input =
        target === 'schema'
          ? { ...req.body, ...req.params, ...req.query }
          : req[target];
      const validated = schema.parse(input);

      if (target === 'schema' || target === 'body') {
        req.body = validated;
      } else if (target === 'query') {
        req.query = validated;
      } else {
        req.params = validated;
      }

      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fallbackField = target === 'schema' ? 'unknown' : target;
        const errors: ValidationError[] = err.issues.map((issue) => ({
          field: issue.path.join('.') || fallbackField,
          message: issue.message,
        }));

        const targetLabel =
          target === 'schema' ? 'Schema' : target.charAt(0).toUpperCase() + target.slice(1);
        logger.warn(`[validation] ${targetLabel} validation failed`, {
          errors,
          endpoint: req.path,
        });

        return res.status(400).json({
          error: 'Validation Error',
          details: errors,
        });
      }

      logger.error('[validation] Unexpected validation error', { error: err });
      return res.status(500).json({
        error: 'Internal Server Error',
      });
    }
  };
}

export class ValidationMiddleware {
  static validate(schema: ZodSchema) {
    return createValidationMiddleware(schema, 'schema');
  }

  static validateBody(schema: ZodSchema) {
    return createValidationMiddleware(schema, 'body');
  }

  static validateQuery(schema: ZodSchema) {
    return createValidationMiddleware(schema, 'query');
  }

  static validateParams(schema: ZodSchema) {
    return createValidationMiddleware(schema, 'params');
  }
}
