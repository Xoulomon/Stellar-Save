import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { logger } from '../logger';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationMiddleware {
  static validate(schema: ZodSchema) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const data = { ...req.body, ...req.params, ...req.query };
        const validated = schema.parse(data);
        req.body = validated;
        next();
      } catch (err) {
        if (err instanceof z.ZodError) {
          const errors: ValidationError[] = err.issues.map(issue => ({
            field: issue.path.join('.') || 'unknown',
            message: issue.message,
          }));

          logger.warn('[validation] Schema validation failed', {
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

  static validateBody(schema: ZodSchema) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validated = schema.parse(req.body);
        req.body = validated;
        next();
      } catch (err) {
        if (err instanceof z.ZodError) {
          const errors: ValidationError[] = err.issues.map(issue => ({
            field: issue.path.join('.') || 'body',
            message: issue.message,
          }));

          logger.warn('[validation] Body validation failed', {
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

  static validateQuery(schema: ZodSchema) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validated = schema.parse(req.query);
        req.query = validated as any;
        next();
      } catch (err) {
        if (err instanceof z.ZodError) {
          const errors: ValidationError[] = err.issues.map(issue => ({
            field: issue.path.join('.') || 'query',
            message: issue.message,
          }));

          logger.warn('[validation] Query validation failed', {
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

  static validateParams(schema: ZodSchema) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validated = schema.parse(req.params);
        req.params = validated as any;
        next();
      } catch (err) {
        if (err instanceof z.ZodError) {
          const errors: ValidationError[] = err.issues.map(issue => ({
            field: issue.path.join('.') || 'params',
            message: issue.message,
          }));

          logger.warn('[validation] Params validation failed', {
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
}
