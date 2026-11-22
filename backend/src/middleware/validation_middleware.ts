import { Request, Response, NextFunction } from 'express';
import { z, ZodTypeAny, ZodError } from 'zod';

/**
 * Single boundary for input sanitization and DTO validation.
 *
 * Every DTO is described by exactly one Zod schema. TypeScript types are
 * derived from those schemas via `z.infer`, and routes validate/sanitize
 * incoming payloads through `validate()` instead of manual field checks.
 */

// ---------------------------------------------------------------------------
// Sanitization primitives (the one place sanitization rules live)
// ---------------------------------------------------------------------------

export const sanitizers = {
  /** Trim surrounding whitespace. */
  trim: (value: string): string => value.trim(),

  /** Collapse internal runs of whitespace into a single space. */
  collapseWhitespace: (value: string): string => value.replace(/\s+/g, ' '),

  /** Remove ASCII control characters (except tab/newline). */
  stripControlChars: (value: string): string =>
    value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''),

  /** Escape HTML-significant characters to prevent stored XSS. */
  escapeHtml: (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),

  /** Normalize an email address (trim + lowercase). */
  normalizeEmail: (value: string): string => value.trim().toLowerCase(),
};

/**
 * A sanitized string schema: trims, strips control chars, collapses
 * whitespace, and enforces a max length. Use as the base for text fields.
 */
export const sanitizedString = (maxLength = 255) =>
  z
    .string()
    .transform((value) => sanitizers.collapseWhitespace(sanitizers.stripControlChars(sanitizers.trim(value))))
    .pipe(z.string().max(maxLength));

/** A sanitized, HTML-escaped string schema for free-text fields. */
export const sanitizedText = (maxLength = 5000) =>
  z
    .string()
    .transform((value) => sanitizers.escapeHtml(sanitizers.stripControlChars(sanitizers.trim(value))))
    .pipe(z.string().max(maxLength));

/** A sanitized email schema. */
export const sanitizedEmail = () =>
  z
    .string()
    .transform((value) => sanitizers.normalizeEmail(value))
    .pipe(z.string().email().max(254));

// ---------------------------------------------------------------------------
// DTO schemas — exactly one schema per DTO, types derived from them
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
  name: sanitizedString(120).pipe(z.string().min(1)),
  email: sanitizedEmail(),
  bio: sanitizedText(2000).optional(),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.partial();
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationDto = z.infer<typeof paginationSchema>;

// ---------------------------------------------------------------------------
// Schema middleware
// ---------------------------------------------------------------------------

export interface ValidationTargets {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Express middleware factory that validates and sanitizes request input
 * against the provided schemas. Parsed (sanitized) values replace the raw
 * request data so downstream handlers only ever see validated input.
 */
export function validate(targets: ValidationTargets) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (targets.body) {
        req.body = targets.body.parse(req.body);
      }
      if (targets.query) {
        // Express query is read-only in some versions; assign parsed result.
        (req as Request & { query: unknown }).query = targets.query.parse(req.query);
      }
      if (targets.params) {
        req.params = targets.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}
